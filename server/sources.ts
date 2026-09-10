import { load } from "cheerio";
import { config } from "./config.js";
import {
  normalize,
  plain,
  relevant,
  classifyKind,
  classifyMode,
  safeUrl,
  type Incoming,
} from "./classify.js";
import type { Opportunity } from "../shared/types.js";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const sourceCatalog = [
  {
    id: "ba",
    name: "Bundesagentur für Arbeit",
    type: "Автоматичний збір",
    url: "https://www.arbeitsagentur.de/jobsuche/",
    description:
      "Робота, Ausbildung, практика. Пошук за німецькими професіями з поступовим переглядом сторінок.",
  },
  {
    id: "arbeitnow",
    name: "Arbeitnow",
    type: "Автоматичний збір",
    url: "https://www.arbeitnow.com/",
    description:
      "Додаткові вакансії через публічний API; відбір електротехнічних посад.",
  },
  {
    id: "wbs",
    name: "WBS TRAINING",
    type: "Автоматичний збір",
    url: "https://www.wbstraining.de/weiterbildungen/elektrotechnik/",
    description:
      "Каталог конкретних курсів, Umschulung та адаптації кваліфікації. Розклад і наявність місць перевіряються на сайті.",
  },
  {
    id: "now",
    name: "mein NOW",
    type: "Пошук на сайті",
    url: "https://web.arbeitsagentur.de/weiterbildungssuche/",
    description:
      "Національний пошук Weiterbildung. Автоматичний імпорт поки не підключено.",
  },
  {
    id: "sitrain",
    name: "Siemens SITRAIN",
    type: "Пошук на сайті",
    url: "https://www.sitrain-learning.siemens.com/DE/de/",
    description: "SPS, SIMATIC, TIA Portal, промислова автоматизація.",
  },
  {
    id: "ihk",
    name: "IHK — Weiterbildung",
    type: "Пошук на сайті",
    url: "https://www.ihk.de/",
    description:
      "Industriemeister, Externenprüfung та професійні сертифікати регіональних палат.",
  },
  {
    id: "hwk",
    name: "Handwerkskammern",
    type: "Пошук на сайті",
    url: "https://www.handwerkskammer.de/",
    description:
      "Майстерні школи, Ausbildung і ремісничі курси регіональних палат.",
  },
  {
    id: "recognition",
    name: "Anerkennung in Deutschland",
    type: "Пошук на сайті",
    url: "https://www.anerkennung-in-deutschland.de/",
    description: "Визнання дипломів та Anpassungsqualifizierung.",
  },
  {
    id: "hochschulkompass",
    name: "Hochschulkompass",
    type: "Пошук на сайті",
    url: "https://www.hochschulkompass.de/",
    description: "Електротехнічні та дуальні програми університетів.",
  },
  {
    id: "tuv",
    name: "TÜV Rheinland Akademie",
    type: "Пошук на сайті",
    url: "https://akademie.tuv.com/",
    description: "Електробезпека, EFKffT, EuP, DGUV, Schaltberechtigung.",
  },
];
export const baQueries = [
  "Elektroniker",
  "Elektriker",
  "Elektrotechniker",
  "Elektrohelfer",
  "Elektroingenieur",
  "Elektroanlagenmonteur",
  "Industrieelektriker",
  "Automatisierungstechniker",
  "SPS Programmierer",
  "Mechatroniker",
  "Gebäudesystemintegration",
  "Informationselektroniker",
  "Mikrotechnologe",
  "Photovoltaik",
  "Windenergie Servicetechniker",
  "Schaltanlagenmonteur",
  "Netzmonteur Strom",
  "Oberleitungsmonteur",
  "Signalmechaniker",
  "Elektrokonstrukteur",
  "Elektrofachkraft",
  "Elektrotechnischer Assistent",
  "Ladeinfrastruktur",
  "Fluggerätelektroniker",
];
export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "ElektrikPrivate/0.1 (personal opportunity search)",
        ...headers,
      },
      signal: AbortSignal.timeout(25000),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 2) {
      const retry = Number(r.headers.get("retry-after"));
      await sleep(
        Math.min(
          30000,
          Math.max(1500, Number.isFinite(retry) ? retry * 1000 : 0),
        ) *
          (attempt + 1),
      );
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} (${new URL(url).hostname})`);
    if (Number(r.headers.get("content-length") || 0) > 8e6)
      throw new Error("Відповідь джерела завелика");
    const text = await r.text();
    if (text.length > 8e6) throw new Error("Відповідь джерела завелика");
    return text;
  }
  throw new Error("Джерело тимчасово недоступне");
}
// The BA v6 response was verified live. Keep absent fields unknown, never infer on-site from a city.
export function parseBA(data: any): Opportunity[] {
  if (
    !data.ergebnisliste &&
    Number.isInteger(data.maxErgebnisse) &&
    (data.maxErgebnisse === 0 ||
      (Number.isInteger(data.page) &&
        Number.isInteger(data.size) &&
        (data.page - 1) * data.size >= data.maxErgebnisse))
  )
    return [];
  if (!Array.isArray(data.ergebnisliste))
    throw new Error("BA змінила формат відповіді: ergebnisliste відсутній");
  return data.ergebnisliste.flatMap((j: any) => {
    const title = plain(j.stellenangebotsTitel),
      professional = (j.alleBerufe || []).join(", ");
    if (!relevant(title, professional) || !j.referenznummer) return [];
    const locs = (j.stellenlokationen || [])
      .map((l: any) => l.adresse || {})
      .filter((a: any) => !a.land || a.land === "DEUTSCHLAND");
    if (j.stellenlokationen?.length && !locs.length) return [];
    const location =
      [
        ...new Set(
          locs
            .map((a: any) => [a.plz, a.ort].filter(Boolean).join(" "))
            .filter(Boolean),
        ),
      ].join(" · ") || null;
    const employment = [
      j.arbeitszeitVollzeit && "Vollzeit",
      (j.arbeitszeitTeilzeitFlexibel ||
        j.arbeitszeitTeilzeitVormittag ||
        j.arbeitszeitTeilzeitAbend ||
        j.arbeitszeitTeilzeitNachmittag) &&
        "Teilzeit",
      j.arbeitszeitSchichtNachtWochenende && "Schichtarbeit",
      j.istGeringfuegigeBeschaeftigung && "Minijob",
      j.quereinstiegGeeignet && "Quereinstieg",
      j.vertragsdauer === "UNBEFRISTET" && "Unbefristet",
    ].filter(Boolean) as string[];
    const salary = j.gehaltsspanneVon
      ? `${j.gehaltsspanneVon}${j.gehaltsspanneBis ? "–" + j.gehaltsspanneBis : ""} €${j.verguetungsangabe === "STUNDENLOHN" ? " / год" : j.verguetungsangabe === "MONATSGEHALT" ? " / місяць" : ""}`
      : null;
    const fallback =
      j.stellenangebotsart === "AUSBILDUNG"
        ? "ausbildung"
        : /PRAKTIKUM/.test(j.stellenangebotsart || "")
          ? "praktikum"
          : "work";
    const row = normalize({
      title,
      company: j.firma,
      url: `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(j.referenznummer)}`,
      source: "ba",
      sourceId: j.referenznummer,
      location,
      description:
        professional +
        (j.eintrittszeitraum?.von
          ? ` · Початок: ${j.eintrittszeitraum.von}`
          : ""),
      kind: classifyKind(title, fallback),
      publishedAt: j.datumErsteVeroeffentlichung,
      salary,
      employment,
      mode: j.homeofficemoeglich === false ? "offline" : classifyMode(title),
    });
    return row ? [row] : [];
  });
}
export function parseArbeitnow(data: any): Opportunity[] {
  if (!Array.isArray(data.data))
    throw new Error("Arbeitnow змінила формат відповіді");
  return data.data.flatMap((j: any) => {
    if (!relevant(j.title || "")) return [];
    const row = normalize({
      title: j.title,
      company: j.company_name,
      url: j.url,
      source: "arbeitnow",
      sourceId: j.slug,
      description: j.description,
      location: j.location || null,
      mode: j.remote ? "online" : undefined,
      publishedAt:
        typeof j.created_at === "number"
          ? new Date(j.created_at * 1000).toISOString()
          : null,
      employment: j.job_types || [],
    });
    return row ? [row] : [];
  });
}
export function wbsLinks(html: string) {
  const $ = load(html);
  return [
    ...new Set(
      $("a[href]")
        .map((_, el) => $(el).attr("href") || "")
        .get()
        .filter((p) =>
          /^\/kurse\/(weiterbildung|umschulung|anerkennung-abschluesse|aufstiegsfortbildung)\/[^/]+\/$/.test(
            p,
          ),
        ),
    ),
  ].map((p) => "https://www.wbstraining.de" + p);
}
export function parseWBS(html: string, url: string): Opportunity | null {
  const $ = load(html);
  $("nav,footer,header,script,style").remove();
  const title = plain($("h1").first().text());
  if (!relevant(title)) return null;
  const main = $("main").length ? $("main") : $("body");
  const desc = main.text().replace(/\s+/g, " ").trim();
  const learningFormat =
    desc
      .match(
        /Lernformat:\s*(.*?)(?:Zertifikat:|Fördermöglichkeiten:|Dauer:|$)/i,
      )?.[1]
      ?.slice(0, 120) || "";
  const fallback = url.includes("/umschulung/")
    ? "umschulung"
    : url.includes("/anerkennung-abschluesse/")
      ? "recognition"
      : "weiterbildung";
  return normalize({
    title,
    url: safeUrl(url),
    source: "wbs",
    sourceId: new URL(url).pathname,
    company: "WBS TRAINING",
    description: desc.slice(0, 10000),
    kind: classifyKind(title, fallback),
    mode: classifyMode(title + " " + learningFormat),
    travel: "unknown",
    catalog: true,
  });
}
export type Sink = (rows: Opportunity[]) => void;
export async function collectBA(sink: Sink, startPage = 1) {
  const errors: string[] = [];
  for (const query of baQueries) {
    for (const offer of ["1", "4", "34"]) {
      for (let page = startPage; page < startPage + config.pages; page++) {
        try {
          const params = new URLSearchParams({
            was: query,
            angebotsart: offer,
            page: String(page),
            size: String(config.pageSize),
            sort: "veroeffdatum",
          });
          const data = JSON.parse(
            await fetchText(
              "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?" +
                params,
              { "X-API-Key": "jobboerse-jobsuche" },
            ),
          );
          sink(parseBA(data));
          if (
            !data.ergebnisliste?.length ||
            page * config.pageSize >= data.maxErgebnisse
          )
            break;
        } catch (e) {
          errors.push(`${query}: ${(e as Error).message}`);
          break;
        }
        await sleep(200);
      }
    }
  }
  return errors;
}
export async function collectArbeitnow(sink: Sink) {
  for (let page = 1; page <= 3; page++) {
    const data = JSON.parse(
      await fetchText(
        "https://www.arbeitnow.com/api/job-board-api?page=" + page,
      ),
    );
    sink(parseArbeitnow(data));
    if (!data.links?.next) break;
    await sleep(250);
  }
  return [];
}
export async function collectWBS(sink: Sink) {
  const errors: string[] = [];
  const links = new Set<string>();
  for (const url of [
    "https://www.wbstraining.de/weiterbildungen/elektrotechnik/",
    "https://www.wbstraining.de/weiterbildungen/automatisierungstechnik-industrie-40/",
    "https://www.wbstraining.de/weiterbildungen/automatisierungstechnik-industrie-40/sps/",
  ]) {
    try {
      for (const link of wbsLinks(await fetchText(url))) links.add(link);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (!links.size)
    throw new Error(
      "WBS: не знайдено посилань на курси; потрібна перевірка парсера",
    );
  for (const url of [...links].slice(0, 60)) {
    try {
      const row = parseWBS(await fetchText(url), url);
      if (row) sink([row]);
    } catch (e) {
      errors.push((e as Error).message);
    }
    await sleep(400);
  }
  return errors;
}
