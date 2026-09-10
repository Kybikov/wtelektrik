import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  classifyKind,
  classifyMode,
  classifyTravel,
  safeUrl,
} from "./classify.js";
import { Store } from "./store.js";
import { parseBA, parseArbeitnow, parseWBS, wbsLinks } from "./sources.js";
import { ownerAllowed, Bot } from "./bot.js";
import { Collector } from "./collector.js";
import { config } from "./config.js";
const sample = (id = "1") =>
  normalize({
    title: "Elektriker (m/w/d)",
    company: "Test GmbH",
    url: "https://example.com/jobs/" + id,
    source: "test",
    sourceId: id,
    location: "Berlin",
  })!;
test("missing geography, mode and travel stay explicitly unknown", () => {
  const o = normalize({
    title: "Elektroniker",
    url: "https://example.com/1",
    source: "test",
    sourceId: "1",
  });
  assert.equal(o?.location, null);
  assert.equal(o?.mode, "unknown");
  assert.equal(o?.travel, "unknown");
  assert.equal(classifyMode("Arbeitsort Berlin"), "unknown");
});
test("travel and delivery mode are independent, including negation", () => {
  assert.equal(classifyTravel("Keine Reisebereitschaft erforderlich"), "none");
  assert.equal(
    classifyTravel("Bundesweite Montage mit mehrtägigen Reisen"),
    "long",
  );
  assert.equal(classifyTravel("Gelegentliche Dienstreisen"), "occasional");
  assert.equal(classifyMode("Online-Kurs SPS"), "online");
  assert.equal(classifyMode("Kein Homeoffice möglich"), "offline");
  assert.equal(classifyMode("Blended Learning"), "hybrid");
});
test("job titles mentioning qualifications do not become education programs", () => {
  assert.equal(
    classifyKind("Elektrotechniker Meister für Betriebstechnik"),
    "work",
  );
  assert.equal(
    classifyKind("Industriemeister Elektrotechnik", "weiterbildung"),
    "meister",
  );
  assert.equal(classifyKind("Umschulung Elektroniker"), "umschulung");
  assert.equal(classifyKind("Duales Studium Elektrotechnik"), "study");
  assert.equal(
    classifyKind("Anpassungsqualifizierung Elektrotechnik", "weiterbildung"),
    "recognition",
  );
});
test("unsafe URLs rejected and tracking removed", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://user:pass@example.com/"), "");
  assert.equal(
    safeUrl("https://example.com/a?utm_source=feed&id=3#x"),
    "https://example.com/a?id=3",
  );
});
test("BA parsing retains structured fields, filters unrelated jobs and maps Ausbildung", () => {
  const rows = parseBA({
    ergebnisliste: [
      {
        stellenangebotsTitel: "Elektroniker Ausbildung",
        referenznummer: "123-x",
        firma: "Bau",
        stellenangebotsart: "AUSBILDUNG",
        stellenlokationen: [
          { adresse: { ort: "Berlin", plz: "10115", land: "DEUTSCHLAND" } },
        ],
        homeofficemoeglich: false,
        alleBerufe: ["Elektroniker/in - Betriebstechnik"],
        arbeitszeitVollzeit: true,
      },
      {
        stellenangebotsTitel: "Verkäufer",
        referenznummer: "other",
        alleBerufe: [],
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "ausbildung");
  assert.equal(rows[0].location, "10115 Berlin");
  assert.equal(rows[0].mode, "offline");
  assert.equal(rows[0].travel, "unknown");
  assert.deepEqual(rows[0].employment, ["Vollzeit"]);
});
test("BA zero-result envelope is valid, malformed payload is not", () => {
  assert.deepEqual(parseBA({ maxErgebnisse: 0, page: 1 }), []);
  assert.throws(() => parseBA({ error: "broken" }));
});
test("BA pages past the last match are empty rather than failures", () => {
  assert.deepEqual(parseBA({ maxErgebnisse: 3, page: 3, size: 50 }), []);
  assert.throws(() => parseBA({ maxErgebnisse: 100, page: 1, size: 50 }));
});
test("Arbeitnow only imports relevant titles and sanitizes HTML", () => {
  const rows = parseArbeitnow({
    data: [
      {
        title: "Marketing Manager",
        description: "AI automation",
        slug: "a",
        url: "https://example.com/a",
      },
      {
        title: "Electrical Engineer",
        slug: "b",
        url: "https://example.com/b",
        description: "<p>Build devices</p>",
        remote: true,
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, "Build devices");
  assert.equal(rows[0].mode, "online");
});
test("WBS restricts discovery to course URLs and does not use global navigation for classification", () => {
  const links = wbsLinks(
    '<a href="/kurse/umschulung/elektroniker/">Kurs</a><a href="https://evil.test/kurse/umschulung/a/">Bad</a>',
  );
  assert.deepEqual(links, [
    "https://www.wbstraining.de/kurse/umschulung/elektroniker/",
  ]);
  const o = parseWBS(
    "<html><body><nav>online-kurs</nav><main><h1>Umschulung Elektroniker</h1><p>Fachwissen</p></main></body></html>",
    links[0],
  );
  assert.equal(o?.kind, "umschulung");
  assert.equal(o?.mode, "unknown");
  assert.equal(o?.catalog, true);
});
test("deduplication preserves saved flag and first discovery when content changes", () => {
  const store = new Store(":memory:");
  const a = sample();
  assert.equal(store.upsert(a), true);
  store.save(a.id, true);
  const old = store.get(a.id)!.firstSeen;
  assert.equal(
    store.upsert({
      ...a,
      description: "new",
      firstSeen: "2099-01-01T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(store.get(a.id)?.saved, true);
  assert.equal(store.get(a.id)?.firstSeen, old);
  assert.equal(
    store.upsert({
      ...a,
      id: "another",
      source: "other",
      url: "https://example.net/syndicated",
    }),
    false,
  );
  assert.equal(store.stats().total, 1);
  store.close();
});
test("distinct references from one source are not collapsed solely by job title", () => {
  const store = new Store(":memory:");
  store.upsert(sample("1"));
  assert.equal(store.upsert(sample("2")), true);
  assert.equal(store.stats().total, 2);
  store.close();
});
test("course format comes from course facts, not generic consultation or sales copy", () => {
  const o = parseWBS(
    "<main><h1>SPS Kurs</h1><p>Beratung vor Ort. Blended Learning für Unternehmen.</p><p>Lernformat: Live-Online Zertifikat: WBS</p></main>",
    "https://www.wbstraining.de/kurse/weiterbildung/sps/",
  );
  assert.equal(o?.mode, "online");
});
test("search distinguishes unknown location from online, and pages remain distinct", () => {
  const store = new Store(":memory:");
  for (let i = 0; i < 8; i++)
    store.upsert({
      ...sample(String(i)),
      title: "Elektriker " + i,
      location: i === 0 ? null : "Berlin",
      mode: i === 0 ? "online" : "offline",
    });
  assert.equal(store.search({ unknownLocation: "true" }).total, 1);
  assert.equal(store.search({ mode: "online" }).total, 1);
  assert.equal(store.search({ location: "Berlin" }).total, 7);
  assert.notEqual(
    store.search({ page: "1" }, 3).items[0].id,
    store.search({ page: "2" }, 3).items[0].id,
  );
  assert.equal(store.search({ q: "' OR 1=1 --" }).total, 0);
  store.close();
});
test("Telegram access fails closed and rejects groups", () => {
  assert.equal(ownerAllowed(7, "private", []), false);
  assert.equal(ownerAllowed(7, "group", ["7"]), false);
  assert.equal(ownerAllowed(7, "private", ["8"]), false);
  assert.equal(ownerAllowed(7, "private", ["7"]), true);
});
test("private bot commands search and save with a stubbed Telegram transport", async () => {
  const store = new Store(":memory:");
  const row = sample();
  store.upsert(row);
  const bot = new Bot(store, new Collector(store));
  const sent: { method: string; body: any }[] = [];
  bot.api = async (method, body = {}) => {
    sent.push({ method, body });
    return {};
  };
  const previous = config.owners;
  config.owners = ["42"];
  try {
    await bot.handle({
      message: {
        from: { id: 43 },
        chat: { id: 43, type: "private" },
        text: "/search Elektriker",
      },
    });
    assert.equal(sent.length, 0);
    await bot.handle({
      message: {
        from: { id: 42 },
        chat: { id: 42, type: "private" },
        text: "/search Elektriker",
      },
    });
    assert.ok(sent.some((x) => x.body.text?.includes("Test GmbH")));
    await bot.handle({
      callback_query: {
        id: "cb",
        from: { id: 42 },
        message: { chat: { id: 42, type: "private" } },
        data: "save:" + row.id,
      },
    });
    assert.equal(store.get(row.id)?.saved, true);
  } finally {
    config.owners = previous;
    store.close();
  }
});
