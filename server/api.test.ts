import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { Collector } from "./collector.js";
import { Bot } from "./bot.js";
import { config } from "./config.js";
import { normalize } from "./classify.js";
test("API enforces private session, origin checks, persistent saves and logout", async () => {
  const old = config.password;
  config.password = "246810";
  const store = new Store(":memory:");
  const row = normalize({
    title: "Elektriker",
    url: "https://example.com/a",
    source: "test",
    sourceId: "1",
  })!;
  store.upsert(row);
  const collector = new Collector(store);
  const app = createApp(store, collector, new Bot(store, collector));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  const root = "http://127.0.0.1:" + address.port;
  try {
    assert.equal((await fetch(root + "/api/opportunities")).status, 401);
    assert.equal(
      (
        await fetch(root + "/api/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://evil.example",
          },
          body: JSON.stringify({ password: config.password }),
        })
      ).status,
      403,
    );
    const login = await fetch(root + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: config.password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.ok(login.headers.get("set-cookie")!.includes("HttpOnly"));
    assert.equal(
      (await fetch(root + "/api/opportunities", { headers: { cookie } }))
        .status,
      200,
    );
    const save = await fetch(root + "/api/opportunities/" + row.id + "/save", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ saved: true }),
    });
    assert.equal(save.status, 200);
    assert.equal(store.get(row.id)?.saved, true);
    await fetch(root + "/api/logout", { method: "POST", headers: { cookie } });
    assert.equal(
      (await fetch(root + "/api/opportunities", { headers: { cookie } }))
        .status,
      401,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    config.password = old;
  }
});
