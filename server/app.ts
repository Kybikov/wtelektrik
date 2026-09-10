import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import type { Store } from "./store.js";
import type { Collector } from "./collector.js";
import type { Bot } from "./bot.js";
import {
  constantEqual,
  createSession,
  hasSession,
  localRequest,
  originAllowed,
  sessionToken,
  digest,
} from "./auth.js";
import { sourceCatalog } from "./sources.js";
import type { Filters } from "../shared/types.js";
import {
  browserLoginToken,
  consumeTelegramLogin,
  createTelegramLogin,
  loginCookie,
  loginLifetime,
} from "./telegram-login.js";
export function createApp(store: Store, collector: Collector, bot: Bot) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "12kb" }));
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (req.path.startsWith("/api") && !originAllowed(req)) {
      res.status(403).json({ error: "Запит з іншого сайту заборонено" });
      return;
    }
    next();
  });
  const authorized = (req: express.Request) =>
    !config.password ? localRequest(req) : hasSession(store, req);
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, version: "0.1.1" }),
  );
  app.get("/api/session", (req, res) =>
    res.json({ authenticated: authorized(req), local: !config.password }),
  );
  const attempts = new Map<string, { n: number; until: number }>();
  const sessionCookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.secure,
    maxAge: 7 * 86400000,
    path: "/",
  };
  const telegramAttempts = new Map<string, { n: number; until: number }>();
  app.post("/api/login/telegram", (req, res) => {
    if (!bot.username || !["running", "reconnecting"].includes(bot.status)) {
      res.status(503).json({
        error:
          "Telegram-вхід тимчасово недоступний. Спробуй ще раз або увійди за паролем.",
      });
      return;
    }
    const now = Date.now(),
      ip = req.socket.remoteAddress || "unknown";
    for (const [key, value] of telegramAttempts)
      if (value.until <= now) telegramAttempts.delete(key);
    const attempt = telegramAttempts.get(ip);
    if (attempt && attempt.n >= 30) {
      res
        .status(429)
        .json({ error: "Забагато запитів входу. Спробуй через 15 хвилин." });
      return;
    }
    telegramAttempts.set(ip, {
      n: (attempt?.n || 0) + 1,
      until: attempt?.until || now + 900000,
    });
    const login = createTelegramLogin(
      store,
      browserLoginToken(req.headers.cookie),
    );
    if (!login) {
      res.status(429).json({ error: "Спробуй увійти трохи пізніше." });
      return;
    }
    res
      .cookie(loginCookie, login.browser, {
        ...sessionCookieOptions,
        maxAge: loginLifetime,
      })
      .json({
        url: `https://t.me/${bot.username}?start=login_${login.token}`,
        code: login.code,
        expires: login.expires,
      });
  });
  app.post("/api/login/telegram/check", (req, res) => {
    const state = consumeTelegramLogin(
      store,
      browserLoginToken(req.headers.cookie),
    );
    if (state === "pending") {
      res.status(202).json({ state });
      return;
    }
    res.clearCookie(loginCookie, {
      path: "/",
      secure: config.secure,
      sameSite: "strict",
      httpOnly: true,
    });
    if (state === "approved")
      res
        .cookie("elektrik_session", createSession(store), sessionCookieOptions)
        .json({ state });
    else
      res.status(state === "expired" ? 410 : 403).json({
        state,
        error:
          state === "expired"
            ? "Час входу минув. Створи новий запит."
            : "Вхід відхилено або доступ до Telegram-акаунта не дозволений.",
      });
  });
  app.post("/api/login", (req, res) => {
    const ip = req.socket.remoteAddress || "unknown",
      now = Date.now();
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    const a = attempts.get(ip);
    if (a && a.n >= 10) {
      res
        .status(429)
        .json({ error: "Забагато спроб. Спробуй через 15 хвилин." });
      return;
    }
    if (
      !config.password ||
      !constantEqual(String(req.body.password || ""), config.password)
    ) {
      attempts.set(ip, { n: (a?.n || 0) + 1, until: a?.until || now + 900000 });
      res.status(401).json({ error: "Неправильний пароль" });
      return;
    }
    attempts.delete(ip);
    res
      .cookie("elektrik_session", createSession(store), sessionCookieOptions)
      .json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    store.db
      .prepare("DELETE FROM sessions WHERE token=?")
      .run(digest(sessionToken(req)));
    res.clearCookie("elektrik_session", { path: "/" }).json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    if (!authorized(req)) {
      res.status(401).json({ error: "Потрібен приватний доступ" });
      return;
    }
    next();
  });
  app.get("/api/opportunities", (req, res) => {
    const f: Filters = {};
    for (const key of [
      "q",
      "kind",
      "category",
      "location",
      "unknownLocation",
      "mode",
      "travel",
      "saved",
      "page",
    ] as const)
      if (typeof req.query[key] === "string")
        f[key] = req.query[key].slice(0, 200);
    res.json(store.search(f));
  });
  app.post("/api/opportunities/:id/save", (req, res) => {
    if (typeof req.body.saved !== "boolean") {
      res.status(400).json({ error: "Некоректний стан" });
      return;
    }
    if (!store.save(String(req.params.id), req.body.saved)) {
      res.status(404).json({ error: "Пропозицію не знайдено" });
      return;
    }
    res.json({ ok: true });
  });
  app.get("/api/status", (_req, res) =>
    res.json({
      stats: store.stats(),
      runs: store.runs(),
      sources: sourceCatalog,
      collecting: collector.running,
      lastCollection: store.read("lastCollection", null),
      bot: { status: bot.status, username: bot.username },
      coverage:
        "Збираємо доступні результати підключених джерел. Це не повний перелік інтернету. Відсутні умови не вгадуємо; актуальність перевіряй у джерелі.",
    }),
  );
  app.post("/api/collect", (_req, res) => {
    if (collector.running) {
      res.status(409).json({ error: "Збір уже триває" });
      return;
    }
    void collector.run();
    res.status(202).json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Маршрут не знайдено" }),
  );
  const dist = resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Request failed:", err.name);
      res
        .status(500)
        .json({ error: "Не вдалося виконати запит. Спробуй ще раз." });
    },
  );
  return app;
}
