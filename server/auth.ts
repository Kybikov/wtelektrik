import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Store } from "./store.js";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const constantEqual = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
export const loopback = (ip: string | undefined) =>
  !!ip && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
export function localRequest(req: Request) {
  const host = req.hostname;
  return (
    loopback(req.socket.remoteAddress) &&
    ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)
  );
}
export function originAllowed(req: Request) {
  const origin = req.get("origin");
  if (!origin) return req.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}
export function sessionToken(req: Request) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("elektrik_session="))
      ?.slice(17) || ""
  );
}
export function createSession(store: Store) {
  const token = randomBytes(32).toString("hex");
  store.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  store.db
    .prepare("INSERT INTO sessions VALUES(?,?)")
    .run(digest(token), Date.now() + 7 * 86400000);
  return token;
}
export function hasSession(store: Store, req: Request) {
  const token = sessionToken(req);
  return (
    !!token &&
    !!store.db
      .prepare("SELECT token FROM sessions WHERE token=? AND expires>?")
      .get(digest(token), Date.now())
  );
}
