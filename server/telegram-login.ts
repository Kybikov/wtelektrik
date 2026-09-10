import { randomBytes } from "node:crypto";
import type { Store } from "./store.js";
import { digest } from "./auth.js";
import { config } from "./config.js";

export const loginLifetime = 5 * 60000;
export const loginCookie = "elektrik_login";
export function browserLoginToken(cookie = "") {
  return (
    cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(loginCookie + "="))
      ?.slice(loginCookie.length + 1) || ""
  );
}
export function createTelegramLogin(store: Store, previous = "") {
  const now = Date.now();
  store.db
    .prepare("DELETE FROM telegram_logins WHERE expires<=? OR browser=?")
    .run(now, digest(previous));
  const count = store.db
    .prepare("SELECT count(*) AS n FROM telegram_logins")
    .get() as { n: number };
  if (count.n >= 1000) return null;
  const token = randomBytes(24).toString("base64url"),
    browser = randomBytes(32).toString("hex"),
    expires = now + loginLifetime;
  store.db
    .prepare(
      "INSERT INTO telegram_logins(token,browser,expires,state) VALUES(?,?,?,'pending')",
    )
    .run(digest(token), digest(browser), expires);
  return { token, browser, expires, code: loginCode(token) };
}
export const loginCode = (token: string) =>
  digest(token).slice(0, 6).toUpperCase();
export function pendingTelegramLogin(store: Store, token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  return !!store.db
    .prepare(
      "SELECT token FROM telegram_logins WHERE token=? AND expires>? AND state='pending'",
    )
    .get(digest(token), Date.now());
}
export function approveTelegramLogin(
  store: Store,
  token: string,
  userId: string,
  approved: boolean,
) {
  if (!config.owners.includes(userId) || !pendingTelegramLogin(store, token))
    return false;
  return (
    store.db
      .prepare(
        "UPDATE telegram_logins SET state=?,user_id=? WHERE token=? AND state='pending' AND expires>?",
      )
      .run(approved ? "approved" : "denied", userId, digest(token), Date.now())
      .changes === 1
  );
}
export function consumeTelegramLogin(
  store: Store,
  browser: string,
): "pending" | "approved" | "denied" | "expired" {
  if (!/^[a-f0-9]{64}$/.test(browser)) return "expired";
  const hash = digest(browser);
  const row = store.db
    .prepare(
      "SELECT state,expires,user_id FROM telegram_logins WHERE browser=?",
    )
    .get(hash) as
    | {
        state: "pending" | "approved" | "denied";
        expires: number;
        user_id: string | null;
      }
    | undefined;
  if (!row) return "expired";
  if (row.expires <= Date.now()) {
    store.db.prepare("DELETE FROM telegram_logins WHERE browser=?").run(hash);
    return "expired";
  }
  if (row.state === "pending") return "pending";
  store.db.prepare("DELETE FROM telegram_logins WHERE browser=?").run(hash);
  return row.state === "approved" && config.owners.includes(row.user_id || "")
    ? "approved"
    : "denied";
}
