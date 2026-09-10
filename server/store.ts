import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { norm } from "./classify.js";
import { categories } from "../shared/catalog.js";
import type { Opportunity, Filters, SourceRun } from "../shared/types.js";
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY, canonical TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, data TEXT NOT NULL, saved INTEGER NOT NULL DEFAULT 0, firstSeen TEXT NOT NULL, lastSeen TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS opportunity_fingerprint ON opportunities(fingerprint);
 CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, source TEXT NOT NULL, startedAt TEXT NOT NULL, finishedAt TEXT, status TEXT NOT NULL, fetched INTEGER DEFAULT 0, imported INTEGER DEFAULT 0, error TEXT);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS telegram_logins(token TEXT PRIMARY KEY,browser TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,state TEXT NOT NULL,user_id TEXT);
 `);
    this.db.exec(
      "UPDATE runs SET status='interrupted',finishedAt=datetime('now'),error='Процес зупинився до завершення збору' WHERE status='running'",
    );
  }
  upsert(o: Opportunity) {
    const fingerprint = createHash("sha256")
      .update(
        [o.title, o.company, o.location || "", o.kind].map(norm).join("|"),
      )
      .digest("hex");
    const canSyndicate = !!o.location && o.company !== "Не вказано";
    const existing = this.db
      .prepare(
        "SELECT id FROM opportunities WHERE id=? OR canonical=? OR (?=1 AND fingerprint=? AND json_extract(data,'$.source')<>?) LIMIT 1",
      )
      .get(o.id, o.url, canSyndicate ? 1 : 0, fingerprint, o.source) as
      { id: string } | undefined;
    if (existing) {
      o.id = existing.id;
      this.db
        .prepare("UPDATE opportunities SET data=?,lastSeen=? WHERE id=?")
        .run(JSON.stringify(o), o.lastSeen, o.id);
      return false;
    }
    this.db
      .prepare(
        "INSERT INTO opportunities(id,canonical,fingerprint,data,firstSeen,lastSeen) VALUES(?,?,?,?,?,?)",
      )
      .run(
        o.id,
        o.url,
        fingerprint,
        JSON.stringify(o),
        o.firstSeen,
        o.lastSeen,
      );
    return true;
  }
  all() {
    return (
      this.db
        .prepare(
          "SELECT data,saved,firstSeen,lastSeen FROM opportunities ORDER BY lastSeen DESC",
        )
        .all() as {
        data: string;
        saved: number;
        firstSeen: string;
        lastSeen: string;
      }[]
    ).map(
      (r) =>
        ({
          ...JSON.parse(r.data),
          saved: !!r.saved,
          firstSeen: r.firstSeen,
          lastSeen: r.lastSeen,
        }) as Opportunity,
    );
  }
  search(f: Filters = {}, pageSize = 30) {
    const q = norm(f.q || ""),
      loc = norm(f.location || "");
    const tokens = q
      .replace(/\/in\b/g, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(
        (t) =>
          !["fur", "und", "der", "die", "das", "in", "m", "w", "d"].includes(t),
      );
    const matchedCategories = categories
      .filter(
        (c) => q.length > 3 && norm(c.label + " " + c.ukLabel).includes(q),
      )
      .map((c) => c.id);
    const rows = this.all()
      .filter((o) => {
        const haystack = norm(
          [o.title, o.company, o.description, ...o.categories].join(" "),
        );
        return (
          (!q ||
            tokens.every((t) => haystack.includes(t)) ||
            matchedCategories.some((c) => o.categories.includes(c))) &&
          (!f.kind || f.kind.split(",").includes(o.kind)) &&
          (!f.category ||
            f.category
              .split(",")
              .some((category) => o.categories.includes(category))) &&
          (!loc || norm(o.location || "").includes(loc)) &&
          (f.unknownLocation !== "true" || !o.location) &&
          (!f.mode || o.mode === f.mode) &&
          (!f.travel || o.travel === f.travel) &&
          (f.saved !== "true" || o.saved)
        );
      })
      .sort((a, b) =>
        (b.publishedAt || b.firstSeen).localeCompare(
          a.publishedAt || a.firstSeen,
        ),
      );
    const page = Math.max(1, Math.min(100000, Number(f.page) || 1));
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pages: Math.ceil(rows.length / pageSize),
    };
  }
  get(id: string) {
    return this.all().find((o) => o.id === id);
  }
  save(id: string, saved: boolean) {
    return (
      Number(
        this.db
          .prepare("UPDATE opportunities SET saved=? WHERE id=?")
          .run(saved ? 1 : 0, id).changes,
      ) > 0
    );
  }
  startRun(source: string) {
    return Number(
      this.db
        .prepare(
          "INSERT INTO runs(source,startedAt,status) VALUES(?,?,'running')",
        )
        .run(source, new Date().toISOString()).lastInsertRowid,
    );
  }
  finishRun(
    id: number,
    fetched: number,
    imported: number,
    error: string | null,
  ) {
    this.db
      .prepare(
        "UPDATE runs SET finishedAt=?,status=?,fetched=?,imported=?,error=? WHERE id=?",
      )
      .run(
        new Date().toISOString(),
        error ? (fetched ? "partial" : "error") : "ok",
        fetched,
        imported,
        error,
        id,
      );
  }
  runs() {
    return this.db
      .prepare(
        "SELECT source,startedAt,finishedAt,status,fetched,imported,error FROM runs ORDER BY id DESC LIMIT 100",
      )
      .all() as unknown as SourceRun[];
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  read<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : fallback;
  }
  stats() {
    const rows = this.all();
    return {
      total: rows.length,
      saved: rows.filter((o) => o.saved).length,
      unknownLocation: rows.filter((o) => !o.location).length,
      locations: [
        ...new Set(rows.map((o) => o.location).filter(Boolean)),
      ].sort(),
      kinds: Object.fromEntries(
        [...new Set(rows.map((o) => o.kind))].map((k) => [
          k,
          rows.filter((o) => o.kind === k).length,
        ]),
      ),
    };
  }
  close() {
    this.db.close();
  }
}
