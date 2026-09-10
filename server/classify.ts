import { createHash } from "node:crypto";
import { load } from "cheerio";
import { categories } from "../shared/catalog.js";
import type { Opportunity, Mode, Travel } from "../shared/types.js";
export const plain = (v: unknown) =>
  load(String(v || ""))
    .text()
    .replace(/\s+/g, " ")
    .trim();
export const norm = (s: string) =>
  s
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss");
export function classifyCategories(text: string) {
  const t = norm(text);
  return categories
    .filter((c) => c.patterns.some((p) => t.includes(norm(p))))
    .map((c) => c.id);
}
export function relevant(title: string, description = "") {
  return /elektr|electri|mechatron|sps[ -]|\bknx\b|eplan|photovoltaik|solartech|windenergie|windkraft|hochvolt|oberleitung|signalmechanik|mikrotechnolog|schaltanlagen|kabelmonteur/i.test(
    title + " " + description,
  );
}
export function classifyKind(title: string, fallback = "work") {
  const t = norm(title);
  const patterns: [string, RegExp][] = [
    ["recognition", /anpassungsqualifiz|anerkennungsqualifiz/],
    ["extern", /externenpruf/],
    ["tq", /teilqualifiz/],
    ["eq", /einstiegsqualifiz|berufsvorbereit/],
    ["umschulung", /umschulung|umschuler/],
    ["study", /duales? studium|bachelorstud|masterstud|studiengang/],
    ["ausbildung", /ausbildung|auszubildende|\bazubi/],
    ["werkstudent", /werkstudent|abschlussarbeit|bachelorarbeit|masterarbeit/],
    ["praktikum", /praktik|schulerprakt/],
    ["trainee", /trainee/],
  ];
  for (const [kind, re] of patterns) if (re.test(t)) return kind;
  // A Meister/Techniker job is still a job. Classify qualifications only in course context.
  if (fallback !== "work") {
    if (/meister/.test(t)) return "meister";
    if (/staatlich.*techniker|techniker.*staatlich/.test(t)) return "techniker";
    if (/seminar|zertifikat|schulung|kurs|sps|eplan|knx/.test(t))
      return "course";
  }
  return fallback;
}
export function classifyMode(text: string): Mode {
  const t = norm(text);
  if (/hybrid|blended learning|teilweise.*homeoffice/.test(t)) return "hybrid";
  if (
    /kein(e|en)? homeoffice|kein(e|en)? remote|nur.*prasenz|ausschliesslich vor ort/.test(
      t,
    )
  )
    return "offline";
  if (
    /100\s*%.*remote|fully remote|vollstandig.*homeoffice|online[- ]?(kurs|training|seminar|unterricht)|live[- ]online|virtuelles klassenzimmer|remote work/.test(
      t,
    )
  )
    return "online";
  if (/prasenzunterricht|prasenzseminar|vor ort|onsite|on-site/.test(t))
    return "offline";
  return "unknown";
}
export function classifyTravel(text: string): Travel {
  const t = norm(text);
  if (/keine? reise|ohne reise|keine? montage|ohne montage/.test(t))
    return "none";
  if (
    /bundesweite.*montage|montage.*bundesweit|weltweit|international.*reise|reise.*international|mehrtag|wochenmontage|langere.*reise|reisebereitschaft.*(80|90|100)\s*%/.test(
      t,
    )
  )
    return "long";
  if (/reisebereitschaft|dienstreise|gelegentlich.*reise|aussendienst/.test(t))
    return "occasional";
  return "unknown";
}
export function safeUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      return "";
    for (const k of [...u.searchParams.keys()])
      if (k.startsWith("utm_") || ["fbclid", "gclid"].includes(k))
        u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}
export type Incoming = Partial<Opportunity> &
  Pick<Opportunity, "title" | "url" | "source" | "sourceId">;
export function normalize(row: Incoming): Opportunity | null {
  const url = safeUrl(row.url),
    title = plain(row.title);
  if (!title || !url) return null;
  const description = plain(row.description).slice(0, 12000),
    now = new Date().toISOString();
  const location = plain(row.location) || null;
  return {
    id: createHash("sha256")
      .update(row.source + ":" + row.sourceId)
      .digest("hex")
      .slice(0, 20),
    title,
    company: plain(row.company) || "Не вказано",
    url,
    source: row.source,
    sourceId: row.sourceId,
    kind: row.kind || classifyKind(title),
    categories: row.categories || classifyCategories(title + " " + description),
    location,
    mode: row.mode || classifyMode(title + " " + description),
    travel: row.travel || classifyTravel(title + " " + description),
    description,
    publishedAt:
      row.publishedAt && !Number.isNaN(Date.parse(row.publishedAt))
        ? new Date(row.publishedAt).toISOString()
        : null,
    firstSeen: now,
    lastSeen: now,
    salary: row.salary || null,
    employment: row.employment || [],
    saved: false,
    catalog: row.catalog || false,
  };
}
