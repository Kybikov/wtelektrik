import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.js";
import { Bot } from "./bot.js";
import { Collector } from "./collector.js";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { digest } from "./auth.js";
import {
  approveTelegramLogin,
  consumeTelegramLogin,
  createTelegramLogin,
} from "./telegram-login.js";

test("Telegram login requires an allowed private user, explicit approval and the initiating browser", async () => {
  const previous = { owners: config.owners, password: config.password };
  config.owners = ["42", "84"];
  config.password = "246810";
  const store = new Store(":memory:"),
    collector = new Collector(store),
    bot = new Bot(store, collector);
  bot.username = "test_elektrik_bot";
  bot.status = "running";
  const sent: any[] = [];
  bot.api = async (method, body) => {
    sent.push({ method, body });
    return {};
  };
  const server = createApp(store, collector, bot).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const root =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const post = (path: string, cookie = "", body = {}, origin = root) =>
    fetch(root + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post("/api/login/telegram", "", {}, "https://other.example"))
        .status,
      403,
    );
    for (const id of [42, 84]) {
      const begin = await post("/api/login/telegram");
      assert.equal(begin.status, 200);
      assert.ok(begin.headers.get("set-cookie")?.includes("HttpOnly"));
      const cookie = begin.headers.get("set-cookie")!.split(";")[0];
      const challenge = await begin.json();
      const start = new URL(challenge.url).searchParams.get("start")!;
      assert.ok(start.length <= 64);
      assert.equal(new URL(challenge.url).hostname, "t.me");
      const msg = (user: number, type = "private") => ({
        message: {
          from: { id: user },
          chat: { id: user, type },
          text: "/start " + start,
        },
      });
      await bot.handle(msg(999));
      const callback = (user: number, type = "private") => ({
        callback_query: {
          id: "cb",
          from: { id: user },
          message: { chat: { id: user, type } },
          data: "webok:" + start.slice(6),
        },
      });
      await bot.handle(callback(999));
      await bot.handle(callback(id, "group"));
      assert.equal(
        (await post("/api/login/telegram/check", cookie)).status,
        202,
      );
      await bot.handle(msg(id));
      assert.ok(sent.some((x) => x.body?.text?.includes(challenge.code)));
      assert.equal(
        (await post("/api/login/telegram/check", cookie)).status,
        202,
      );
      await bot.handle(callback(id));
      assert.equal(
        (await post("/api/login/telegram/check", "", { token: start.slice(6) }))
          .status,
        410,
      );
      const finish = await post("/api/login/telegram/check", cookie);
      assert.equal(finish.status, 200);
      assert.equal((await finish.json()).state, "approved");
      const session = finish.headers
        .getSetCookie()
        .find((x) => x.startsWith("elektrik_session="))!
        .split(";")[0];
      assert.equal(
        (
          await fetch(root + "/api/opportunities", {
            headers: { cookie: session },
          })
        ).status,
        200,
      );
      assert.equal(
        (await post("/api/login/telegram/check", cookie)).status,
        410,
      );
    }
    bot.status = "disabled";
    assert.equal((await post("/api/login/telegram")).status, 503);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    Object.assign(config, previous);
  }
});

test("Telegram challenges expire, can be denied, are superseded and recheck revoked access", () => {
  const previous = config.owners;
  config.owners = ["42"];
  const store = new Store(":memory:");
  try {
    const expired = createTelegramLogin(store)!;
    store.db
      .prepare("UPDATE telegram_logins SET expires=0 WHERE token=?")
      .run(digest(expired.token));
    assert.equal(approveTelegramLogin(store, expired.token, "42", true), false);
    assert.equal(consumeTelegramLogin(store, expired.browser), "expired");
    const denied = createTelegramLogin(store)!;
    assert.equal(approveTelegramLogin(store, denied.token, "42", false), true);
    assert.equal(consumeTelegramLogin(store, denied.browser), "denied");
    const old = createTelegramLogin(store)!;
    createTelegramLogin(store, old.browser);
    assert.equal(approveTelegramLogin(store, old.token, "42", true), false);
    const revoked = createTelegramLogin(store)!;
    assert.equal(approveTelegramLogin(store, revoked.token, "42", true), true);
    config.owners = [];
    assert.equal(consumeTelegramLogin(store, revoked.browser), "denied");
  } finally {
    store.close();
    config.owners = previous;
  }
});
