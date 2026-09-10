import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validateMiniAppData } from "./miniapp-auth.js";
import { Store } from "./store.js";
import { Collector } from "./collector.js";
import { Bot } from "./bot.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { citySuggestions } from "../shared/locations.js";
import { categories, kinds } from "../shared/catalog.js";
import { translate } from "../shared/i18n.js";
function signed(
  id = 42,
  date = Math.floor(Date.now() / 1000),
  token = "test-token",
) {
  const p = new URLSearchParams({
    auth_date: String(date),
    user: JSON.stringify({ id, language_code: "de" }),
    query_id: "test",
    signature: "included-in-hmac",
  });
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  p.set(
    "hash",
    createHmac("sha256", secret)
      .update(
        [...p.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("\n"),
      )
      .digest("hex"),
  );
  return p.toString();
}
test("Mini App validates signature, time, unique fields and private allowlist", () => {
  assert.equal(validateMiniAppData(signed(), "test-token", ["42"])?.id, 42);
  for (const raw of [
    signed(99),
    signed(42, 1),
    signed(42, Math.floor(Date.now() / 1000) + 60),
    signed() + "&auth_date=1",
    signed().replace("test", "evil"),
    signed(42, Math.floor(Date.now() / 1000), "wrong"),
    null,
  ])
    assert.equal(validateMiniAppData(raw, "test-token", ["42"]), null);
});
test("Mini App API creates a bearer session, restores preferences, denies strangers and revokes logout", async () => {
  const old = { ...config };
  Object.assign(config, {
    token: "test-token",
    owners: ["42"],
    password: "test-password",
  });
  const store = new Store(":memory:");
  store.set("profile:42", { language: "de" });
  store.set("filters:42", { location: "Berlin", kind: "work,course" });
  const c = new Collector(store),
    server = createApp(store, c, new Bot(store, c)).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = "http://127.0.0.1:" + (server.address() as any).port;
  try {
    const login = await fetch(url + "/api/login/miniapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: signed() }),
    });
    assert.equal(login.status, 200);
    const data = await login.json();
    assert.equal(data.language, "de");
    assert.equal(data.filters.location, "Berlin");
    const headers = { authorization: "Bearer " + data.token };
    assert.equal(
      (await fetch(url + "/api/opportunities", { headers })).status,
      200,
    );
    await fetch(url + "/api/logout", { method: "POST", headers });
    assert.equal(
      (await fetch(url + "/api/opportunities", { headers })).status,
      401,
    );
    const denied = await fetch(url + "/api/login/miniapp", {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": "de" },
      body: JSON.stringify({ initData: signed(99) }),
    });
    assert.equal(denied.status, 403);
    assert.doesNotMatch((await denied.json()).error, /[А-Яа-яІіЇїЄє]/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    Object.assign(config, old);
  }
});
test("City suggestions separate composite locations, deduplicate cities and limit the popup", () => {
  const places = [
    "01067 Dresden · 10115 Berlin",
    "01069 Dresden",
    "20095 Hamburg",
    "80331 München",
    "50667 Köln",
    "70173 Stuttgart",
    "60311 Frankfurt am Main",
  ];
  assert.equal(citySuggestions(places, "").length, 6);
  assert.deepEqual(citySuggestions(places, "dres"), ["Dresden"]);
  assert.deepEqual(citySuggestions(places, "010"), [
    "01067 Dresden",
    "01069 Dresden",
  ]);
  assert.deepEqual(citySuggestions(places, "mun"), ["München"]);
  assert.deepEqual(citySuggestions(places, "no-match"), []);
});
test("Bot onboarding and settings persist per user with German labels and multiselect", async () => {
  const old = { ...config };
  Object.assign(config, {
    owners: ["42", "84"],
    publicUrl: "https://elektrik.example",
  });
  const store = new Store(":memory:"),
    c = new Collector(store),
    bot = new Bot(store, c);
  const sent: any[] = [];
  bot.api = async (method, body) => {
    sent.push({ method, ...body });
    return { message_id: 1 };
  };
  const message = (text: string, id = 42) =>
    bot.handle({
      message: {
        message_id: 1,
        chat: { id, type: "private" },
        from: { id, language_code: "de" },
        text,
      },
    });
  const click = (data: string) =>
    bot.handle({
      callback_query: {
        id: "callback",
        from: { id: 42 },
        message: { message_id: 1, chat: { id: 42, type: "private" } },
        data,
      },
    });
  try {
    await message("/start");
    assert.equal(store.read<any>("profile:42", {}).step, "language");
    await click("lang:de");
    assert.equal(store.read<any>("profile:42", {}).step, "kind");
    await click("pick:kind.work");
    await click("pick:kind.course");
    assert.equal(store.read<any>("filters:42", {}).kind, "work,course");
    await click("setup:next");
    await click("pick:category." + categories[0].id);
    await click("setup:next");
    await click("place:ask");
    await message("Berlin");
    await click("setup:next");
    await click("pick:mode.online");
    await click("setup:next");
    await click("pick:travel.long");
    await click("setup:next");
    assert.equal(store.read<any>("profile:42", {}).step, "review");
    await click("setup:finish");
    assert.equal(store.read<any>("profile:42", {}).completed, true);
    await message("/saved");
    assert.equal(store.read<any>("filters:42", {}).kind, "work,course");
    await message("/settings");
    await click("field:location");
    await click("place:unknown");
    assert.equal(store.read<any>("filters:42", {}).unknownLocation, "true");
    assert.equal(store.read<any>("filters:42", {}).mode, "online");
    await message("/start", 84);
    assert.equal(store.read<any>("profile:84", {}).completed, false);
    assert.equal(store.read<any>("filters:84", {}).location, undefined);
    await message("/app");
    assert.ok(
      sent
        .at(-1)
        .reply_markup.inline_keyboard.flat()
        .some((b: any) => b.web_app?.url === "https://elektrik.example"),
    );
    await click("reset:confirm");
    assert.equal(store.read<any>("filters:42", {}).kind, undefined);
    assert.equal(store.read<any>("profile:42", {}).language, "de");
    for (const entry of sent.filter((e) => e.text))
      assert.doesNotMatch(entry.text, /[А-Яа-яІіЇїЄєҐґ]/);
    assert.ok(sent.some((e) => e.method === "editMessageText"));
    for (const item of [...kinds, ...categories])
      assert.doesNotMatch(item.label, /[А-Яа-яІіЇїЄєҐґ]/);
    assert.equal(translate("de", "20 EUR / год"), "20 EUR / Std.");
  } finally {
    store.close();
    Object.assign(config, old);
  }
});
