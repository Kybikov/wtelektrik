import type { Store } from "./store.js";
import type { Collector } from "./collector.js";
import { config } from "./config.js";
import { BotUI, commandsFor, type BotProfile } from "./bot-ui.js";
export const ownerAllowed = (id: number, chatType: string, owners: string[]) =>
  chatType === "private" && owners.includes(String(id));
export class Bot {
  status = "disabled";
  username = "";
  private stopped = false;
  private abort = new AbortController();
  constructor(
    private store: Store,
    private collector: Collector,
  ) {}
  async api(method: string, body: object = {}) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${config.token}/${method}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any([
            AbortSignal.timeout(method === "getUpdates" ? 40000 : 15000),
            this.abort.signal,
          ]),
        },
      );
      const data = (await response.json()) as any;
      if (!data.ok)
        throw new Error(
          `Telegram ${data.error_code || response.status}: ${String(data.description || "request failed").slice(0, 150)}`,
        );
      return data.result;
    } catch (e) {
      if ((e as Error).message.startsWith("Telegram ")) throw e;
      throw new Error("Telegram: запит не завершився");
    }
  }
  async start() {
    if (!config.botEnabled || !config.token) {
      this.status = "disabled";
      return;
    }
    if (!config.owners.length) {
      this.status = "owner_required";
      return;
    }
    try {
      const me = await this.api("getMe");
      this.username = me.username;
      const webhook = await this.api("getWebhookInfo");
      if (webhook.url) {
        this.status = "webhook_conflict";
        console.error(
          "Bot has an existing webhook. Stop the old bot integration before polling.",
        );
        return;
      }
      for (const language of ["de", "uk"] as const) {
        await this.api("setMyCommands", {
          commands: commandsFor(language),
          language_code: language,
        });
      }
      await this.api("setMyCommands", { commands: commandsFor("de") });
      if (config.publicUrl.startsWith("https://"))
        await this.api("setChatMenuButton", {
          menu_button: {
            type: "web_app",
            text: "Elektrik",
            web_app: { url: config.publicUrl },
          },
        });
      for (const owner of config.owners) {
        const profile = this.store.read<BotProfile | null>(
          "profile:" + owner,
          null,
        );
        if (profile)
          await this.api("setMyCommands", {
            scope: { type: "chat", chat_id: Number(owner) },
            commands: commandsFor(profile.language),
          });
      }
      this.status = "running";
      void this.poll();
    } catch (e) {
      this.status = "error";
      console.error((e as Error).message);
    }
  }
  stop() {
    this.stopped = true;
    this.abort.abort();
  }
  private async poll() {
    let failures = 0;
    while (!this.stopped) {
      try {
        const updates = await this.api("getUpdates", {
          offset: this.store.read("telegramOffset", 0),
          timeout: 25,
          allowed_updates: ["message", "callback_query"],
        });
        this.status = "running";
        failures = 0;
        for (const update of updates) {
          try {
            await this.handle(update);
          } catch (e) {
            console.error("Bot update failed:", (e as Error).message);
          }
          this.store.set("telegramOffset", update.update_id + 1);
        }
      } catch (e) {
        if (this.stopped) break;
        this.status = "reconnecting";
        console.error((e as Error).message);
        await new Promise((r) =>
          setTimeout(r, Math.min(30000, 1000 * 2 ** Math.min(++failures, 5))),
        );
      }
    }
  }
  async handle(update: any) {
    return new BotUI(this.store, this.collector, (method, body) =>
      this.api(method, body),
    ).handle(update);
  }
}
