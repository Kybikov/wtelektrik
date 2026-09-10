import type { Store } from "./store.js";
import type { Collector } from "./collector.js";
import { config } from "./config.js";
import { kinds, categories, modes, travels } from "../shared/catalog.js";
import { languageOf, translate, type Language } from "../shared/i18n.js";
import type { Filters, Opportunity } from "../shared/types.js";
import {
  approveTelegramLogin,
  loginCode,
  pendingTelegramLogin,
} from "./telegram-login.js";

type Button = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
};
type Field = "kind" | "category" | "location" | "mode" | "travel" | "language";
const steps = [
  "language",
  "kind",
  "category",
  "location",
  "mode",
  "travel",
  "review",
] as const;
type Step = (typeof steps)[number];
export interface BotProfile {
  language: Language;
  completed: boolean;
  step: Step | null;
  awaiting: "location" | "query" | null;
  optionPage: number;
}
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const fields: Field[] = [
  "kind",
  "category",
  "location",
  "mode",
  "travel",
  "language",
];
const optionsFor = (field: string) =>
  field === "kind"
    ? kinds
    : field === "category"
      ? categories
      : field === "mode"
        ? modes
        : travels;
const commandLabels = [
  ["start", "Головне меню"],
  ["app", "Відкрити застосунок"],
  ["search", "Пошук можливостей"],
  ["settings", "Налаштування пошуку та мови"],
  ["saved", "Збережені можливості"],
  ["filters", "Фільтри пошуку"],
  ["language", "Змінити мову"],
  ["onboarding", "Пройти налаштування ще раз"],
  ["location", "Змінити місто або індекс"],
  ["refresh", "Оновити джерела"],
  ["status", "Стан збору"],
  ["reset", "Скинути фільтри"],
  ["help", "Як користуватися"],
];
export const commandsFor = (language: Language) =>
  commandLabels.map(([command, description]) => ({
    command,
    description: translate(language, description),
  }));
export class BotUI {
  private chat = 0;
  private messageId?: number;
  private profile!: BotProfile;
  constructor(
    private store: Store,
    private collector: Collector,
    private api: (method: string, body?: object) => Promise<any>,
  ) {}
  private t(text: string, values: Record<string, string | number> = {}) {
    return translate(this.profile?.language || "uk", text, values);
  }
  private saveProfile(change: Partial<BotProfile>) {
    this.profile = { ...this.profile, ...change };
    this.store.set("profile:" + this.chat, this.profile);
  }
  private filters() {
    return this.store.read<Filters>("filters:" + this.chat, {});
  }
  private setFilters(filters: Filters) {
    this.store.set("filters:" + this.chat, {
      ...filters,
      page: "1",
      saved: "",
    });
  }
  private button(text: string, data: string): Button {
    return { text: this.t(text), callback_data: data };
  }
  private appButtons(): Button[][] {
    return config.publicUrl.startsWith("https://")
      ? [
          [
            {
              text: this.t("Відкрити застосунок"),
              web_app: { url: config.publicUrl },
            },
          ],
        ]
      : [];
  }
  private async panel(text: string, buttons: Button[][] = []) {
    const body = {
      chat_id: this.chat,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [...buttons, ...this.appButtons()] },
    };
    if (this.messageId) {
      try {
        return await this.api("editMessageText", {
          ...body,
          message_id: this.messageId,
        });
      } catch (error) {
        if ((error as Error).message.includes("message is not modified"))
          return;
      }
    }
    return this.api("sendMessage", body);
  }
  private values(field: "kind" | "category" | "mode" | "travel") {
    const value = this.filters()[field];
    return value
      ? value
          .split(",")
          .map((id) =>
            this.t(optionsFor(field).find((o) => o.id === id)?.label || id),
          )
          .join(", ")
      : this.t("Усі варіанти");
  }
  private summary() {
    const f = this.filters();
    return [
      this.t("Мова: {value}", {
        value: this.profile.language === "de" ? "Deutsch" : "Українська",
      }),
      this.t("Тип: {value}", { value: escape(this.values("kind")) }),
      this.t("Напрям: {value}", { value: escape(this.values("category")) }),
      this.t("Місце: {value}", {
        value: escape(
          f.unknownLocation === "true"
            ? this.t("Місце не вказано")
            : f.location || this.t("Вся Німеччина"),
        ),
      }),
      this.t("Формат: {value}", { value: escape(this.values("mode")) }),
      this.t("Поїздки: {value}", { value: escape(this.values("travel")) }),
      ...(f.q ? [this.t("Запит: {value}", { value: escape(f.q) })] : []),
    ].join("\n");
  }
  private async home() {
    this.saveProfile({ awaiting: null });
    return this.api("sendMessage", {
      chat_id: this.chat,
      parse_mode: "HTML",
      text: `<b>Elektrik</b>\n${this.t("Робота й навчання в електротехніці по всій Німеччині.")}\n\n${this.summary()}\n\n${this.t("Напиши професію або скористайся кнопками внизу.")}`,
      reply_markup: {
        keyboard: [
          [
            { text: this.t("Знайти можливості") },
            { text: this.t("Збережене") },
          ],
          [{ text: this.t("Налаштування") }, { text: this.t("Допомога") }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    });
  }
  private async settings() {
    this.saveProfile({ step: null, awaiting: null, optionPage: 0 });
    return this.panel(
      `<b>${this.t("Налаштування")}</b>\n\n${this.summary()}\n\n${this.t("Обери, що змінити. Зміни зберігаються автоматично.")}`,
      [
        [
          this.button("Тип можливості", "field:kind"),
          this.button("Професійний напрям", "field:category"),
        ],
        [
          this.button("Місто або індекс", "field:location"),
          this.button("Онлайн / офлайн", "field:mode"),
        ],
        [
          this.button("Поїздки та відрядження", "field:travel"),
          this.button("Мова інтерфейсу", "field:language"),
        ],
        [
          this.button("Пошуковий запит", "query:ask"),
          this.button("Очистити запит", "query:clear"),
        ],
        [this.button("Пройти налаштування ще раз", "setup:start")],
        [
          this.button("Скинути фільтри", "reset:ask"),
          this.button("Знайти", "nav:search"),
        ],
        [this.button("Головне меню", "nav:home")],
      ],
    );
  }
  private async wizard(step: Step = this.profile.step || "language") {
    this.saveProfile({ step, awaiting: null, optionPage: 0 });
    if (step === "review")
      return this.panel(
        `<b>${this.t("Усе готово до пошуку")}</b>\n\n${this.summary()}\n\n${this.t("Усі параметри можна змінити в налаштуваннях.")}`,
        [
          [this.button("Зберегти й почати пошук", "setup:finish")],
          [
            this.button("Назад", "setup:back"),
            this.button("Пропустити налаштування", "setup:skip"),
          ],
        ],
      );
    return this.field(step);
  }
  private async field(field: Field, page = 0) {
    const step = this.profile.step;
    const wizard = !!step;
    const footer: Button[][] = wizard
      ? [
          [
            this.button("Назад", "setup:back"),
            this.button("Далі", "setup:next"),
          ],
          [this.button("Пропустити налаштування", "setup:skip")],
        ]
      : [
          [
            this.button("Готово", "nav:settings"),
            this.button("Знайти", "nav:search"),
          ],
        ];
    const stepText = wizard
      ? this.t("Налаштування · крок {step} із 7", {
          step: steps.indexOf(step) + 1,
        }) + "\n\n"
      : "";
    if (field === "language")
      return this.panel(
        stepText +
          "<b>" +
          this.t("Обери мову") +
          "</b>\n" +
          this.t("Назви професій і типів можливостей залишаються німецькою."),
        [
          [
            {
              text: (this.profile.language === "uk" ? "✓ " : "") + "Українська",
              callback_data: "lang:uk",
            },
            {
              text: (this.profile.language === "de" ? "✓ " : "") + "Deutsch",
              callback_data: "lang:de",
            },
          ],
          ...footer,
        ],
      );
    if (field === "location") {
      const f = this.filters();
      return this.panel(
        stepText +
          `<b>${this.t("Де шукати?")}</b>\n` +
          this.t(
            "Обери всю Німеччину, невідоме місце або введи місто чи індекс.",
          ) +
          "\n\n" +
          this.t("Поточне місце: {value}", {
            value: escape(
              f.unknownLocation === "true"
                ? this.t("Місце не вказано")
                : f.location || this.t("Вся Німеччина"),
            ),
          }),
        [
          [
            this.button("Вся Німеччина", "place:all"),
            this.button("Місце не вказано", "place:unknown"),
          ],
          [this.button("Ввести місто або індекс", "place:ask")],
          ...footer,
        ],
      );
    }
    const options = optionsFor(field),
      selected = (this.filters()[field] || "").split(",").filter(Boolean);
    const pages = Math.ceil(options.length / 7);
    page = Math.max(0, Math.min(page, pages - 1));
    this.saveProfile({ optionPage: page });
    const names = {
      kind: "Що тебе цікавить?",
      category: "Які професійні напрями?",
      mode: "Який формат підходить?",
      travel: "Чи підходять поїздки?",
    };
    const multi = field === "kind" || field === "category";
    const hint = multi
      ? "Можна обрати кілька варіантів. Натисни повторно, щоб прибрати."
      : "Обери один варіант або залиш без обмеження.";
    const description =
      field === "kind"
        ? "Stellenangebote — робота; Ausbildung — професійне навчання; Umschulung — перенавчання; Weiterbildung — підвищення кваліфікації; Kurse — короткі курси."
        : "";
    return this.panel(
      stepText +
        `<b>${this.t(names[field])}</b>\n${this.t(hint)}${description ? "\n\n" + this.t(description) : ""}\n\n${this.t("Обрано: {value}", { value: escape(this.values(field)) })}`,
      [
        [
          {
            text: (!selected.length ? "✓ " : "") + this.t("Усі варіанти"),
            callback_data: `pick:${field}.all`,
          },
        ],
        ...options.slice(page * 7, page * 7 + 7).map((o) => [
          {
            text: (selected.includes(o.id) ? "✓ " : "") + this.t(o.label),
            callback_data: `pick:${field}.${o.id}`,
          },
        ]),
        ...(pages > 1
          ? [
              [
                ...(page > 0
                  ? [this.button("← Назад", `opts:${field}.${page - 1}`)]
                  : []),
                ...(page + 1 < pages
                  ? [this.button("Ще варіанти →", `opts:${field}.${page + 1}`)]
                  : []),
              ],
            ]
          : []),
        ...footer,
      ],
    );
  }
  private async search(filters = this.filters()) {
    const result = this.store.search(filters, 5);
    this.store.set("view:" + this.chat, {
      ...filters,
      page: String(result.page),
    });
    let text = `<b>${this.t("Знайдено: {count}", { count: result.total })}</b>`;
    if (result.total)
      text +=
        " · " +
        this.t("Сторінка {page}/{pages}", {
          page: result.page,
          pages: result.pages,
        });
    if (filters.q)
      text += "\n" + this.t("Запит: {value}", { value: escape(filters.q) });
    const buttons: Button[][] = [];
    for (const [i, o] of result.items.entries()) {
      text += `\n\n<b>${i + 1}. <a href="${escape(o.url)}">${escape(o.title.slice(0, 120))}</a></b>\n${escape(this.t(o.company).slice(0, 75))}\n${escape((o.location || this.t("Місце не вказано")).slice(0, 90))}\n${escape(kinds.find((k) => k.id === o.kind)?.label || o.kind)} · ${escape(this.t(modes.find((m) => m.id === o.mode)?.label || ""))}`;
      buttons.push([
        {
          text: `${i + 1} · ${this.t("Деталі")}`,
          callback_data: "detail:" + o.id,
        },
        {
          text:
            (o.saved ? "★ " : "☆ ") +
            `${i + 1} · ${this.t(o.saved ? "Збережено" : "Зберегти")}`,
          callback_data: "save:" + o.id,
        },
      ]);
    }
    if (!result.total)
      text +=
        "\n\n" +
        this.t("Спробуй ширший запит або зміни фільтри в налаштуваннях.");
    if (result.pages > 1)
      buttons.push([
        ...(result.page > 1
          ? [this.button("← Назад", "page:" + (result.page - 1))]
          : []),
        ...(result.page < result.pages
          ? [this.button("Далі →", "page:" + (result.page + 1))]
          : []),
      ]);
    buttons.push([
      this.button("Налаштування", "nav:settings"),
      this.button("Головне меню", "nav:home"),
    ]);
    return this.panel(text, buttons);
  }
  private async detail(o: Opportunity) {
    return this.panel(
      `<b>${escape(o.title.slice(0, 250))}</b>\n${escape(this.t(o.company))}\n${escape(o.location || this.t("Місце не вказано"))}\n${escape(kinds.find((k) => k.id === o.kind)?.label || o.kind)}\n${escape(this.t(modes.find((m) => m.id === o.mode)?.label || ""))}\n${escape(this.t(travels.find((v) => v.id === o.travel)?.label || ""))}${o.salary ? "\n" + escape(this.t(o.salary)) : ""}\n\n${escape(this.t(o.description).slice(0, 1800))}${o.catalog ? "\n\n" + this.t("Каталог курсу · дати уточнюй у провайдера") : ""}`,
      [
        [
          { text: this.t("Відкрити джерело ↗"), url: o.url },
          this.button(
            o.saved ? "Прибрати зі збережених" : "Зберегти",
            "mark:" + o.id,
          ),
        ],
        [
          this.button("До результатів", "nav:results"),
          this.button("Налаштування", "nav:settings"),
        ],
      ],
    );
  }
  async handle(update: any) {
    const callback = update.callback_query,
      msg = callback?.message || update.message,
      user = callback?.from || msg?.from;
    if (!msg || !user || msg.chat.type !== "private" || msg.chat.id !== user.id)
      return;
    this.chat = msg.chat.id;
    this.profile = this.store.read<BotProfile>("profile:" + this.chat, {
      language: languageOf(user.language_code),
      completed: false,
      step: null,
      awaiting: null,
      optionPage: 0,
    });
    if (!config.owners.includes(String(user.id))) {
      if (/^\/start(?:@\w+)?\s+login_/.test(String(msg.text || "")))
        await this.panel(
          this.t(
            "Для цього Telegram-акаунта доступ до Elektrik не відкритий. Звернися до власника сайту.",
          ),
        );
      return;
    }
    this.saveProfile({});
    if (callback) {
      this.messageId = msg.message_id;
      await this.api("answerCallbackQuery", { callback_query_id: callback.id });
      const [action, value = ""] = String(callback.data || "").split(":");
      if (action === "webok" || action === "webno") {
        const approved = action === "webok",
          changed = approveTelegramLogin(
            this.store,
            value,
            String(user.id),
            approved,
          );
        await this.panel(
          this.t(
            !changed
              ? "Цей запит уже використаний або прострочений. Створи новий на сайті."
              : approved
                ? "Вхід підтверджено. Повернися у вкладку браузера, де починав вхід — сайт відкриється автоматично."
                : "Вхід відхилено.",
          ),
        );
        if (changed && approved && !this.profile.completed) {
          this.messageId = undefined;
          await this.wizard("language");
        }
        return;
      }
      if (action === "lang" && ["uk", "de"].includes(value)) {
        this.saveProfile({ language: value as Language });
        await this.api("setMyCommands", {
          scope: { type: "chat", chat_id: this.chat },
          commands: commandsFor(this.profile.language),
        });
        return this.profile.step ? this.wizard("kind") : this.settings();
      }
      if (action === "setup") {
        if (value === "start") return this.wizard("language");
        if (value === "skip" || value === "finish") {
          this.saveProfile({ completed: true, step: null, awaiting: null });
          this.messageId = undefined;
          await this.home();
          return this.search();
        }
        if (!this.profile.step) return this.settings();
        if (!["next", "back"].includes(value)) return;
        const index = steps.indexOf(this.profile.step),
          next = Math.max(
            0,
            Math.min(steps.length - 1, index + (value === "back" ? -1 : 1)),
          );
        return this.wizard(steps[next]);
      }
      if (action === "nav") {
        if (value === "settings") return this.settings();
        if (value === "home") return this.home();
        if (value === "search") {
          this.saveProfile({ awaiting: null });
          return this.search();
        }
        if (value === "results")
          return this.search(
            this.store.read("view:" + this.chat, this.filters()),
          );
      }
      if (action === "refresh") return this.refresh();
      if (action === "field" && fields.includes(value as Field)) {
        this.saveProfile({ step: null, awaiting: null });
        return this.field(value as Field);
      }
      if (action === "opts") {
        const [field, page] = value.split(".");
        if (["kind", "category", "mode", "travel"].includes(field))
          return this.field(field as Field, Number(page) || 0);
      }
      if (
        action === "pick" ||
        ["kind", "category", "mode", "travel"].includes(action)
      ) {
        const [field, chosen] =
          action === "pick" ? value.split(".") : [action, value];
        if (
          !["kind", "category", "mode", "travel"].includes(field) ||
          (chosen !== "all" && !optionsFor(field).some((o) => o.id === chosen))
        )
          return;
        const f = this.filters(),
          key = field as "kind" | "category" | "mode" | "travel";
        const selected = new Set((f[key] || "").split(",").filter(Boolean));
        if (chosen === "all") selected.clear();
        else if (["kind", "category"].includes(field)) {
          if (selected.has(chosen)) selected.delete(chosen);
          else selected.add(chosen);
        } else {
          selected.clear();
          selected.add(chosen);
        }
        this.setFilters({ ...f, [key]: [...selected].join(",") });
        return this.field(key, this.profile.optionPage);
      }
      if (action === "place") {
        if (value === "ask") {
          this.saveProfile({ awaiting: "location" });
          return this.panel(
            this.t(
              "Напиши місто або поштовий індекс одним повідомленням. Наприклад: Berlin або 10115.",
            ),
            [[this.button("Назад", "place:cancel")]],
          );
        }
        this.saveProfile({ awaiting: null });
        if (value !== "cancel")
          this.setFilters({
            ...this.filters(),
            location: "",
            unknownLocation: value === "unknown" ? "true" : "",
          });
        return this.field("location");
      }
      if (action === "query") {
        if (value === "clear") {
          this.setFilters({ ...this.filters(), q: "" });
          return this.settings();
        }
        this.saveProfile({ awaiting: "query" });
        return this.panel(
          this.t(
            "Напиши професію, компанію або навичку. Наприклад: SPS або Elektriker.",
          ),
          [[this.button("Скасувати", "nav:settings")]],
        );
      }
      if (action === "reset") {
        if (value !== "confirm")
          return this.panel(
            this.t(
              "Скинути всі фільтри? Мова та збережені можливості залишаться.",
            ),
            [
              [
                this.button("Скинути", "reset:confirm"),
                this.button("Скасувати", "nav:settings"),
              ],
            ],
          );
        this.setFilters({});
        return this.settings();
      }
      if (action === "page")
        return this.search({
          ...this.store.read<Filters>("view:" + this.chat, this.filters()),
          page: value,
        });
      if (["save", "mark", "detail"].includes(action)) {
        const o = this.store.get(value);
        if (!o) return this.panel(this.t("Пропозицію не знайдено"));
        if (action === "detail") return this.detail(o);
        this.store.save(value, !o.saved);
        o.saved = !o.saved;
        return action === "mark"
          ? this.detail(o)
          : this.search(this.store.read("view:" + this.chat, this.filters()));
      }
      // Buttons sent by the previous release remain usable.
      if (action === "menu")
        return value === "filters"
          ? this.settings()
          : fields.includes(value as Field)
            ? this.field(value as Field)
            : this.settings();
      if (action === "unknown") {
        this.setFilters({
          ...this.filters(),
          location: "",
          unknownLocation: "true",
        });
        return this.settings();
      }
      return;
    }
    const text = String(msg.text || "").trim();
    const [raw, ...rest] = text.split(/\s+/),
      command = raw.split("@")[0].toLowerCase(),
      arg = rest.join(" ");
    if (command === "/start" && arg.startsWith("login_")) {
      const token = arg.slice(6);
      if (!pendingTelegramLogin(this.store, token))
        return this.panel(
          this.t(
            "Запит входу прострочений або вже використаний. Створи новий на сайті.",
          ),
        );
      return this.panel(
        `<b>${this.t("Вхід на сайт Elektrik")}</b>\n\n${this.t("Код: {value}", { value: loginCode(token) })}\n${this.t("Звір код із сайтом. Підтверджуй лише вхід, який щойно почав сам. Запит діє 5 хвилин.")}`,
        [
          [
            this.button("Підтвердити вхід", "webok:" + token),
            this.button("Відхилити", "webno:" + token),
          ],
        ],
      );
    }
    if (command === "/start")
      return this.profile.completed
        ? this.home()
        : this.wizard(this.profile.step || "language");
    if (
      command === "/app" ||
      ["Відкрити застосунок", "App öffnen"].includes(text)
    )
      return this.panel(
        this.t("Пошук на весь екран у Telegram. Натисни кнопку нижче."),
      );
    if (command === "/onboarding") return this.wizard("language");
    if (
      ["/settings", "/filters"].includes(command) ||
      ["Налаштування", "Einstellungen"].includes(text)
    )
      return this.settings();
    if (command === "/language") {
      this.saveProfile({ step: null, awaiting: null });
      return this.field("language");
    }
    if (command === "/help" || ["Допомога", "Hilfe"].includes(text))
      return this.panel(
        this.t(
          "Напиши професію для пошуку або натисни «Знайти можливості». У налаштуваннях можна змінити мову, типи, напрями, місце, формат і поїздки. Зірочка зберігає пропозицію. Назви професій і типів німецькою; пояснення — обраною мовою. Обране спільне для дозволених користувачів.",
        ),
        [
          [
            this.button("Налаштування", "nav:settings"),
            this.button("Головне меню", "nav:home"),
          ],
          ...(config.publicUrl.startsWith("https://")
            ? [[{ text: this.t("Відкрити сайт"), url: config.publicUrl }]]
            : []),
        ],
      );
    if (command === "/saved" || ["Збережене", "Merkliste"].includes(text))
      return this.search({ saved: "true" });
    if (command === "/reset")
      return this.panel(
        this.t("Скинути всі фільтри? Мова та збережені можливості залишаться."),
        [
          [
            this.button("Скинути", "reset:confirm"),
            this.button("Скасувати", "nav:settings"),
          ],
        ],
      );
    if (command === "/location") {
      if (!arg) {
        this.saveProfile({ step: null });
        return this.field("location");
      }
      this.setFilters({
        ...this.filters(),
        location: ["all", "unknown"].includes(arg) ? "" : arg.slice(0, 100),
        unknownLocation: arg === "unknown" ? "true" : "",
      });
      this.saveProfile({ awaiting: null });
      return this.field("location");
    }
    if (command === "/status") {
      const runs = this.store.runs().slice(0, 3);
      return this.panel(
        `<b>${this.t("У базі: {count}", { count: this.store.stats().total })}</b>\n${this.t(this.collector.running ? "Збір триває" : "Збір не виконується")}\n\n${runs.map((r) => `${escape(r.source)}: ${this.t(({ ok: "Працює", error: "Помилка", partial: "Частково", running: "Збираємо", interrupted: "Перервано" } as Record<string, string>)[r.status] || r.status)} · ${r.fetched} ${this.t("знайдено")}${r.error ? "\n" + escape(this.t(r.error)) : ""}`).join("\n")}`,
        [
          [
            this.button("Оновити джерела", "refresh:run"),
            this.button("Головне меню", "nav:home"),
          ],
        ],
      );
    }
    if (command === "/refresh") return this.refresh();
    if (["Знайти можливості", "Angebote finden"].includes(text)) {
      this.saveProfile({ awaiting: null });
      return this.search();
    }
    if (this.profile.awaiting && !text.startsWith("/")) {
      if (!text || text.length > 100)
        return this.panel(
          this.t("Введи текст довжиною від 1 до 100 символів."),
        );
      const awaiting = this.profile.awaiting;
      this.saveProfile({ awaiting: null });
      this.setFilters({
        ...this.filters(),
        ...(awaiting === "location"
          ? { location: text, unknownLocation: "" }
          : { q: text }),
      });
      return awaiting === "location" ? this.field("location") : this.settings();
    }
    if (command.startsWith("/") && command !== "/search")
      return this.panel(this.t("Невідома команда. /help — підказка."));
    if (!text)
      return this.panel(
        this.t(
          "Напиши професію, компанію або навичку. Наприклад: SPS або Elektriker.",
        ),
      );
    const f = {
      ...this.filters(),
      q: (command === "/search" ? arg : text).slice(0, 200),
      page: "1",
    };
    this.setFilters(f);
    return this.search(f);
  }
  private async refresh() {
    if (this.collector.running) return this.panel(this.t("Збір уже триває"));
    void this.collector.run();
    return this.panel(
      this.t("Збір запущено. Нові результати додаються поступово."),
      [[this.button("Головне меню", "nav:home")]],
    );
  }
}
