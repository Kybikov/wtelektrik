import type { Store } from "./store.js";
import type { Collector } from "./collector.js";
import { config } from "./config.js";
import { kinds, categories, modes, travels } from "../shared/catalog.js";
import type { Filters, Opportunity } from "../shared/types.js";
export const ownerAllowed = (id: number, chatType: string, owners: string[]) =>
  chatType === "private" && owners.includes(String(id));
const escape = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
type Button = { text: string; callback_data?: string; url?: string };
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
      await this.api("setMyCommands", {
        commands: [
          { command: "start", description: "Головне меню" },
          { command: "search", description: "Пошук: /search Elektriker" },
          { command: "filters", description: "Фільтри пошуку" },
          {
            command: "location",
            description: "Місто: /location Berlin або unknown",
          },
          { command: "saved", description: "Збережені можливості" },
          { command: "refresh", description: "Оновити джерела" },
          { command: "status", description: "Стан збору" },
          { command: "reset", description: "Скинути фільтри" },
          { command: "help", description: "Як користуватися" },
        ],
      });
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
  private async send(chat: number, text: string, buttons: Button[][] = []) {
    return this.api("sendMessage", {
      chat_id: chat,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }
  private filters(chat: number) {
    return this.store.read<Filters>("filters:" + chat, {});
  }
  private setFilters(chat: number, filters: Filters) {
    this.store.set("filters:" + chat, filters);
  }
  async handle(update: any) {
    const callback = update.callback_query,
      msg = callback?.message || update.message,
      user = callback?.from || msg?.from;
    if (
      !msg ||
      !user ||
      !ownerAllowed(user.id, msg.chat.type, config.owners) ||
      msg.chat.id !== user.id
    )
      return;
    const chat = msg.chat.id;
    if (callback) {
      await this.api("answerCallbackQuery", { callback_query_id: callback.id });
      const [action, value] = String(callback.data || "").split(":");
      if (action === "page") {
        return this.results(chat, { ...this.filters(chat), page: value });
      }
      if (action === "save") {
        const o = this.store.get(value);
        if (o) {
          this.store.save(value, !o.saved);
          await this.send(
            chat,
            o.saved ? "Прибрано зі збережених." : "Збережено.",
          );
        }
        return;
      }
      if (action === "menu") {
        return this.menu(chat, value);
      }
      if (["kind", "mode", "travel", "category"].includes(action)) {
        const allowed =
          action === "kind"
            ? kinds
            : action === "mode"
              ? modes
              : action === "travel"
                ? travels
                : categories;
        if (value !== "all" && !allowed.some((x) => x.id === value)) return;
        const f = {
          ...this.filters(chat),
          [action]: value === "all" ? "" : value,
          page: "1",
        };
        this.setFilters(chat, f);
        return this.results(chat, f);
      }
      if (action === "reset") {
        this.setFilters(chat, {});
        return this.results(chat, {});
      }
      if (action === "unknown") {
        const f = {
          ...this.filters(chat),
          unknownLocation: "true",
          location: "",
          page: "1",
        };
        this.setFilters(chat, f);
        return this.results(chat, f);
      }
      return;
    }
    const text = String(msg.text || "").trim(),
      [raw, ...rest] = text.split(/\s+/),
      command = raw.split("@")[0].toLowerCase(),
      arg = rest.join(" ");
    if (command === "/start" || command === "/help") {
      await this.send(
        chat,
        "<b>Elektrik · твій приватний пошук</b>\n\nРобота й навчання в електротехніці по всій Німеччині. Напиши професію або /search Elektriker.\n\n/location Berlin — місто або індекс\n/location unknown — місце не вказано\n/location all — вся Німеччина\n/filters — тип, напрям, онлайн/офлайн, поїздки\n/saved — збережене\n/refresh — запустити збір\n/reset — скинути фільтри\n\nНевказані умови залишаються невідомими. Для курсів перевіряй дати на сайті провайдера.",
        [
          [
            { text: "Знайти можливості", callback_data: "page:1" },
            { text: "Фільтри", callback_data: "menu:filters" },
          ],
          ...(config.publicUrl.startsWith("https://")
            ? [[{ text: "Відкрити сайт", url: config.publicUrl }]]
            : []),
        ],
      );
      return;
    }
    if (command === "/filters") return this.menu(chat, "filters");
    if (command === "/status") {
      const stats = this.store.stats();
      const runs = this.store.runs().slice(0, 3);
      await this.send(
        chat,
        `<b>У базі: ${stats.total}</b>\n${this.collector.running ? "Збір триває" : "Збір не виконується"}\n\n${runs.map((r) => `${escape(r.source)}: ${escape(r.status)}, знайдено ${r.fetched}, нових ${r.imported}${r.error ? " · " + escape(r.error) : ""}`).join("\n")}`,
      );
      return;
    }
    if (command === "/refresh") {
      if (this.collector.running)
        await this.send(chat, "Збір уже триває. /status — перевірити стан.");
      else {
        void this.collector.run();
        await this.send(
          chat,
          "Збір запущено. Результати поступово з’являються в пошуку. /status — перевірити стан.",
        );
      }
      return;
    }
    if (command === "/reset") {
      this.setFilters(chat, {});
      return this.results(chat, {});
    }
    if (command === "/saved") return this.results(chat, { saved: "true" });
    if (command === "/location") {
      if (!arg) {
        await this.send(
          chat,
          "Наприклад: /location Berlin, /location 10115, /location unknown або /location all.",
        );
        return;
      }
      const f = {
        ...this.filters(chat),
        location: ["all", "unknown"].includes(arg) ? "" : arg,
        unknownLocation: arg === "unknown" ? "true" : "",
        page: "1",
      };
      this.setFilters(chat, f);
      return this.results(chat, f);
    }
    if (command.startsWith("/") && command !== "/search") {
      await this.send(chat, "Невідома команда. /help — підказка.");
      return;
    }
    const f = {
      ...this.filters(chat),
      saved: "",
      q: (command === "/search" ? arg : text).slice(0, 200),
      page: "1",
    };
    this.setFilters(chat, f);
    return this.results(chat, f);
  }
  private async menu(chat: number, type: string) {
    if (type === "filters") {
      const f = this.filters(chat);
      await this.send(
        chat,
        `<b>Фільтри</b>\nМісце: ${escape(f.unknownLocation === "true" ? "не вказано" : f.location || "вся Німеччина")}\nЗапит: ${escape(f.q || "усі професії")}\nТип: ${escape(kinds.find((x) => x.id === f.kind)?.label || "усі")}\nФормат: ${escape(modes.find((x) => x.id === f.mode)?.label || "усі")}\nПоїздки: ${escape(travels.find((x) => x.id === f.travel)?.label || "усі")}\n\nМісто змінюється командою /location Berlin.`,
        [
          [
            { text: "Тип можливості", callback_data: "menu:kind" },
            { text: "Напрям", callback_data: "menu:category" },
          ],
          [
            { text: "Онлайн / офлайн", callback_data: "menu:mode" },
            { text: "Поїздки", callback_data: "menu:travel" },
          ],
          [
            { text: "Місце не вказано", callback_data: "unknown:1" },
            { text: "Скинути все", callback_data: "reset:all" },
          ],
        ],
      );
      return;
    }
    const options =
      type === "kind"
        ? kinds
        : type === "mode"
          ? modes
          : type === "travel"
            ? travels
            : categories;
    await this.send(chat, "Обери фільтр:", [
      [{ text: "Усі", callback_data: type + ":all" }],
      ...options.map((o) => [
        { text: o.label, callback_data: type + ":" + o.id },
      ]),
    ]);
  }
  private async results(chat: number, filters: Filters) {
    const result = this.store.search(filters, 5);
    await this.send(
      chat,
      `<b>Знайдено: ${result.total}</b>${result.total ? ` · сторінка ${result.page}/${result.pages}` : ""}${filters.q ? "\nЗапит: " + escape(filters.q) : ""}${!result.total ? "\nСпробуй ширший запит або скинь фільтри." : ""}`,
      [
        [
          { text: "Фільтри", callback_data: "menu:filters" },
          { text: "Скинути", callback_data: "reset:all" },
        ],
      ],
    );
    for (const o of result.items)
      await this.send(chat, this.format(o), [
        [
          { text: "Відкрити джерело ↗", url: o.url },
          {
            text: o.saved ? "★ Збережено" : "☆ Зберегти",
            callback_data: "save:" + o.id,
          },
        ],
      ]);
    // Pagination stores the actual displayed query, including saved-only mode.
    this.setFilters(chat, { ...filters, page: String(result.page) });
    if (result.pages > 1)
      await this.send(chat, "Сторінки:", [
        [
          ...(result.page > 1
            ? [{ text: "← Назад", callback_data: "page:" + (result.page - 1) }]
            : []),
          ...(result.page < result.pages
            ? [{ text: "Далі →", callback_data: "page:" + (result.page + 1) }]
            : []),
        ],
      ]);
  }
  private format(o: Opportunity) {
    return `<b>${escape(o.title.slice(0, 250))}</b>\n${escape(o.company)}\n📍 ${escape(o.location || "Місце не вказано")}\n${escape(kinds.find((k) => k.id === o.kind)?.label || o.kind)} · ${escape(modes.find((m) => m.id === o.mode)?.label || "")}\n${escape(travels.find((t) => t.id === o.travel)?.label || "")}${o.salary ? "\n" + escape(o.salary) : ""}${o.catalog ? "\nКаталог курсу · дати уточнюй у провайдера" : ""}\n\n${escape(o.description.slice(0, 450))}`;
  }
}
