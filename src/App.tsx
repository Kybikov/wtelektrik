import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Filter,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrainFront,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import AnimatedContent from "./components/AnimatedContent/AnimatedContent";
import {
  categories,
  kinds,
  modes,
  travels,
  references,
} from "../shared/catalog";
import type { Filters, Opportunity, SourceRun } from "../shared/types";

type Tab = "search" | "saved" | "guide" | "sources";
interface Status {
  stats: {
    total: number;
    saved: number;
    unknownLocation: number;
    locations: string[];
    kinds: Record<string, number>;
  };
  runs: SourceRun[];
  sources: {
    id: string;
    name: string;
    type: string;
    url: string;
    description: string;
  }[];
  collecting: boolean;
  lastCollection: string | null;
  bot: { status: string; username: string };
  coverage: string;
}
interface Results {
  items: Opportunity[];
  total: number;
  page: number;
  pages: number;
}
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch("/api" + path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  if (r.status === 401) {
    window.dispatchEvent(new Event("session-expired"));
    throw new Error("Сеанс завершився. Увійди ще раз.");
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Не вдалося отримати дані");
  return data;
}
const date = (value: string) =>
  new Intl.DateTimeFormat("uk", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
const label = (list: { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label || id;
const initialFilters = (): Filters =>
  Object.fromEntries(
    [...new URLSearchParams(location.search)].filter(([k]) =>
      [
        "q",
        "kind",
        "category",
        "location",
        "unknownLocation",
        "mode",
        "travel",
      ].includes(k),
    ),
  );

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [telegram, setTelegram] = useState<{
      url: string;
      code: string;
      expires: number;
    } | null>(null),
    [telegramError, setTelegramError] = useState(""),
    [waiting, setWaiting] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setTelegram(null);
    setTelegramError("");
    setWaiting(false);
    void api<{ url: string; code: string; expires: number }>(
      "/login/telegram",
      { method: "POST", body: "{}", signal: abort.signal },
    )
      .then(setTelegram)
      .catch((e) => {
        if (!abort.signal.aborted) setTelegramError((e as Error).message);
      });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    if (!telegram || !waiting) return;
    let stopped = false,
      checking = false;
    const check = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const response = await fetch("/api/login/telegram/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const data = await response.json();
        if (stopped) return;
        if (response.ok && data.state === "approved") {
          stopped = true;
          onSuccess();
        } else if (!response.ok) {
          setTelegramError(data.error || "Не вдалося перевірити вхід.");
          setTelegram(null);
        }
      } catch {
        if (!stopped)
          setTelegramError(
            "Не вдалося перевірити вхід. Відновлюємо з’єднання…",
          );
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void check(), 2500);
    const focus = () => void check();
    window.addEventListener("focus", focus);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [telegram, waiting, onSuccess]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="wordmark">
        <Zap /> elektrik<span>приватний пошук</span>
      </div>
      <ShieldCheck size={42} />
      <h1>
        Твій простір
        <br />
        можливостей.
      </h1>
      <p>
        Робота й навчання в електротехніці.
        <br />
        Приватний доступ для дозволених користувачів.
      </p>
      <section className="telegram-login" aria-label="Вхід через Telegram">
        {telegram ? (
          <>
            <a
              className="primary"
              href={telegram.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWaiting(true)}
            >
              {waiting ? "Відкрити бота ще раз" : "Увійти через Telegram"}
              <ArrowUpRight size={18} />
            </a>
            <p className="login-instructions" role="status">
              {waiting
                ? "Натисни Start у Telegram, підтвердь вхід у боті й повернися сюди."
                : "Відкрий бота й підтвердь вхід. Код на сайті та в боті має збігатися."}
              <strong className="login-code">Код: {telegram.code}</strong>
            </p>
          </>
        ) : !telegramError ? (
          <button className="primary" disabled>
            Готуємо Telegram-вхід…
          </button>
        ) : null}
        {telegramError && (
          <p role="alert" className="error">
            {telegramError}
          </p>
        )}
        {telegramError && (
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Спробувати ще раз
          </button>
        )}
      </section>
      <details className="password-login">
        <summary>Увійти за паролем</summary>
        <form onSubmit={submit}>
          <label>
            Пароль доступу
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Вхід…" : "Увійти"}
            <ArrowRight size={18} />
          </button>
        </form>
      </details>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<boolean | null>(null),
    [sessionError, setSessionError] = useState("");
  const [tab, setTab] = useState<Tab>("search"),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [query, setQuery] = useState(filters.q || "");
  const [status, setStatus] = useState<Status | null>(null),
    [results, setResults] = useState<Results>({
      items: [],
      total: 0,
      page: 1,
      pages: 0,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false),
    [refreshKey, setRefreshKey] = useState(0),
    [starting, setStarting] = useState(false);
  const [reducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const loadSession = useCallback(() => {
    setSessionError("");
    fetch("/api/session")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((s) => setSession(s.authenticated))
      .catch(() =>
        setSessionError("Сервер недоступний. Перевір, чи запущено Elektrik."),
      );
  }, []);
  useEffect(() => {
    loadSession();
    const expired = () => setSession(false);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [loadSession]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((f) => (f.q === query ? f : { ...f, q: query, page: "1" })),
      350,
    );
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value && key !== "page") params.set(key, value);
    history.replaceState(null, "", params.size ? "?" + params : "./");
  }, [filters]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      ...filters,
      ...(tab === "saved" ? { saved: "true" } : {}),
    });
    api<Results>("/opportunities?" + params, { signal: controller.signal })
      .then((data) => {
        if (alive) setResults(data);
      })
      .catch((e) => {
        if (alive && e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [filters, tab, refreshKey, session]);
  const loadStatus = useCallback(() => {
    if (session)
      api<Status>("/status")
        .then(setStatus)
        .catch(() => {});
  }, [session]);
  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 7000);
    return () => clearInterval(timer);
  }, [loadStatus]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function update(key: keyof Filters, value: string) {
    setFilters((f) => ({
      ...f,
      page: "1",
      [key]: value,
      ...(key === "unknownLocation" && value === "true"
        ? { location: "" }
        : {}),
    }));
  }
  function reset() {
    setQuery("");
    setFilters({});
  }
  function switchTab(next: Tab) {
    setTab(next);
    setFilters((f) => ({ ...f, page: "1" }));
    setFiltersOpen(false);
  }
  async function collect() {
    setStarting(true);
    try {
      await api("/collect", { method: "POST" });
      setNotice("Збір запущено. Нові результати додаються поступово.");
      loadStatus();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function save(o: Opportunity) {
    try {
      await api("/opportunities/" + o.id + "/save", {
        method: "POST",
        body: JSON.stringify({ saved: !o.saved }),
      });
      setResults((r) => ({
        ...r,
        items: r.items.map((x) =>
          x.id === o.id ? { ...x, saved: !o.saved } : x,
        ),
      }));
      loadStatus();
      if (tab === "saved") setRefreshKey((k) => k + 1);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function searchTerm(q: string) {
    setQuery(q);
    setFilters({ q });
    switchTab("search");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== "page" && k !== "q",
  ).length;
  const nav = [
    { id: "search" as Tab, name: "Знайти", icon: Search },
    { id: "saved" as Tab, name: "Збережене", icon: Bookmark },
    { id: "guide" as Tab, name: "Довідник", icon: BookOpen },
    { id: "sources" as Tab, name: "Джерела", icon: Radio },
  ];
  if (sessionError)
    return (
      <main className="login">
        <Zap />
        <h1>Немає зв’язку</h1>
        <p role="alert">{sessionError}</p>
        <button className="primary" onClick={loadSession}>
          Спробувати ще раз
        </button>
      </main>
    );
  if (session === null)
    return (
      <main className="login">
        <Zap />
        <p role="status">Відкриваємо твій простір…</p>
      </main>
    );
  if (!session) return <Login onSuccess={() => setSession(true)} />;
  return (
    <div className="app">
      <a className="skip" href="#content">
        Перейти до результатів
      </a>
      <header className="topbar">
        <a href="/" className="wordmark" aria-label="Elektrik — головна">
          <span className="logo">
            <Zap size={22} fill="currentColor" />
          </span>
          elektrik<span className="brand-caption">робота & навчання</span>
        </a>
        <nav className="desktop-nav" aria-label="Основна навігація">
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => switchTab(n.id)}
              aria-current={tab === n.id ? "page" : undefined}
            >
              {n.name}
              {n.id === "saved" && !!status?.stats.saved && (
                <span>{status.stats.saved}</span>
              )}
            </button>
          ))}
        </nav>
        <span className="private-label">
          <ShieldCheck size={15} />
          Приватний простір
        </span>
      </header>
      <main id="content" className="main">
        {(tab === "search" || tab === "saved") && (
          <>
            <section className="intro">
              <div>
                {reducedMotion ? (
                  <h1>
                    {tab === "saved" ? (
                      "Те, що варте уваги."
                    ) : (
                      <>
                        Знайди свій
                        <br />
                        <span>наступний крок.</span>
                      </>
                    )}
                  </h1>
                ) : (
                  <AnimatedContent
                    distance={12}
                    duration={0.5}
                    animateOpacity={false}
                    style={{ visibility: "visible" }}
                  >
                    <h1>
                      {tab === "saved" ? (
                        "Те, що варте уваги."
                      ) : (
                        <>
                          Знайди свій
                          <br />
                          <span>наступний крок.</span>
                        </>
                      )}
                    </h1>
                  </AnimatedContent>
                )}
                <p>
                  {tab === "saved"
                    ? "Твої збережені вакансії, курси та навчальні програми."
                    : "Від першої роботи до нової кваліфікації. Можливості з перевірених джерел по всій Німеччині."}
                </p>
              </div>
              <div className="territory">
                <div className="territory-icon">
                  <Compass size={42} strokeWidth={1} />
                </div>
                <strong>Deutschland</strong>
                <span>Усі землі · усі напрями</span>
                <small>
                  <span className="status-dot" />{" "}
                  {status?.collecting
                    ? "Збираємо можливості"
                    : "Твій особистий пошук"}
                </small>
              </div>
            </section>
            <div className="searchbar">
              <Search size={22} />
              <input
                aria-label="Пошук професії, компанії або навички"
                placeholder="Професія, компанія або навичка…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Очистити пошук"
                  onClick={() => setQuery("")}
                >
                  <X size={18} />
                </button>
              )}
              <span className="search-example">Elektriker · SPS · EPLAN</span>
              <button
                className="filter-toggle"
                aria-label={
                  activeCount
                    ? `Фільтри пошуку: ${activeCount} активних`
                    : "Фільтри пошуку"
                }
                aria-expanded={filtersOpen}
                aria-controls="filters"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                <SlidersHorizontal size={19} />
                <span>Фільтри{activeCount ? " · " + activeCount : ""}</span>
              </button>
            </div>
            <div className="quick-types" aria-label="Швидкий вибір типу">
              {[
                ["", "Усе"],
                ["work", "Робота"],
                ["ausbildung", "Ausbildung"],
                ["weiterbildung", "Weiterbildung"],
                ["course", "Курси"],
                ["umschulung", "Перенавчання"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  className={(filters.kind || "") === id ? "selected" : ""}
                  onClick={() => update("kind", id)}
                  aria-pressed={(filters.kind || "") === id}
                >
                  {name}
                  {id === "work" && status?.stats.kinds.work ? (
                    <span>{status.stats.kinds.work}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="workspace">
              <aside
                id="filters"
                className={"filters " + (filtersOpen ? "open" : "")}
              >
                <div className="filter-heading">
                  <h2>
                    <Filter size={17} />
                    Уточнити пошук
                  </h2>
                  {activeCount > 0 && (
                    <button className="text-button" onClick={reset}>
                      Скинути
                    </button>
                  )}
                </div>
                <label>
                  Місто або індекс
                  <div className="location-input">
                    <MapPin size={17} />
                    <input
                      placeholder="Наприклад, Berlin"
                      list="cities"
                      value={filters.location || ""}
                      disabled={filters.unknownLocation === "true"}
                      onChange={(e) => update("location", e.target.value)}
                    />
                  </div>
                </label>
                <datalist id="cities">
                  {status?.stats.locations.slice(0, 300).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={filters.unknownLocation === "true"}
                    onChange={(e) =>
                      update("unknownLocation", e.target.checked ? "true" : "")
                    }
                  />
                  Тільки місце не вказано
                </label>
                <Select
                  label="Тип можливості"
                  value={filters.kind}
                  options={kinds}
                  onChange={(v) => update("kind", v)}
                />
                <Select
                  label="Професійний напрям"
                  value={filters.category}
                  options={categories}
                  onChange={(v) => update("category", v)}
                />
                <Select
                  label="Онлайн / офлайн"
                  value={filters.mode}
                  options={modes}
                  onChange={(v) => update("mode", v)}
                />
                <Select
                  label="Поїздки та відрядження"
                  value={filters.travel}
                  options={travels}
                  onChange={(v) => update("travel", v)}
                />
                <p className="filter-note">
                  Місце, формат і поїздки — незалежні умови. Якщо джерело їх не
                  вказало, ми їх не вгадуємо.
                </p>
                <button
                  className="primary mobile-apply"
                  onClick={() => setFiltersOpen(false)}
                >
                  Показати результати
                  <ArrowDown size={16} />
                </button>
              </aside>
              <section className="results" aria-label="Можливості">
                <div className="results-heading">
                  <h2>
                    {tab === "saved" ? "Збережені можливості" : "Можливості"}{" "}
                    <span>
                      {loading ? "…" : results.total.toLocaleString("uk")}
                    </span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setRefreshKey((k) => k + 1);
                      loadStatus();
                    }}
                    title="Оновити список"
                  >
                    <RefreshCw
                      size={14}
                      className={loading ? "spinning" : ""}
                    />
                    <span>Оновити</span>
                  </button>
                </div>
                <div className="result-context">
                  <span>
                    {filters.unknownLocation === "true"
                      ? "Місце не вказано"
                      : filters.location || "Вся Німеччина"}
                    {filters.mode ? " · " + label(modes, filters.mode) : ""}
                    {filters.travel
                      ? " · " + label(travels, filters.travel)
                      : ""}
                  </span>
                  <span>Новіші спочатку</span>
                </div>
                {error ? (
                  <div className="empty">
                    <Radio />
                    <h3>Не вдалося завантажити</h3>
                    <p role="alert">{error}</p>
                    <button
                      className="primary"
                      onClick={() => setRefreshKey((k) => k + 1)}
                    >
                      Повторити
                    </button>
                  </div>
                ) : loading ? (
                  <div className="loading-state" role="status">
                    <div className="skeleton" />
                    <div className="skeleton" />
                    <div className="skeleton" />
                    <span>Шукаємо можливості…</span>
                  </div>
                ) : results.items.length ? (
                  results.items.map((o) => (
                    <OpportunityRow
                      key={o.id}
                      item={o}
                      onSave={() => void save(o)}
                    />
                  ))
                ) : (
                  <div className="empty">
                    <Search size={32} />
                    <h3>
                      {tab === "saved"
                        ? "Збережи те, що зацікавило"
                        : "Поки немає збігів"}
                    </h3>
                    <p>
                      {tab === "saved"
                        ? "Натисни закладку біля вакансії або курсу — вони з’являться тут."
                        : status?.collecting
                          ? "Джерела ще збираються. Онови список за хвилину."
                          : "Спробуй іншу професію, прибери частину фільтрів або запусти збір джерел."}
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        reset();
                        if (tab === "saved") switchTab("search");
                        else if (!status?.stats.total) void collect();
                      }}
                    >
                      {tab === "saved"
                        ? "Перейти до пошуку"
                        : status?.stats.total
                          ? "Скинути фільтри"
                          : "Зібрати можливості"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                {!loading && results.pages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={results.page === 1}
                      onClick={() => update("page", String(results.page - 1))}
                    >
                      <ChevronLeft size={16} />
                      Назад
                    </button>
                    <span>
                      {results.page} / {results.pages}
                    </span>
                    <button
                      disabled={results.page === results.pages}
                      onClick={() => update("page", String(results.page + 1))}
                    >
                      Далі
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                <p className="coverage-note">
                  {status?.coverage ||
                    "Збираємо лише реальні пропозиції з відкритих джерел."}
                </p>
              </section>
            </div>
          </>
        )}
        {tab === "guide" && <Guide onSearch={searchTerm} />}
        {tab === "sources" && (
          <section className="sources-page">
            <div className="page-title">
              <div>
                <h1>Звідки можливості.</h1>
                <p>
                  Що вже збирається автоматично, а де можна продовжити пошук.
                </p>
              </div>
              <button
                className="primary"
                disabled={starting || status?.collecting}
                onClick={() => void collect()}
              >
                <RefreshCw
                  size={17}
                  className={status?.collecting ? "spinning" : ""}
                />
                {status?.collecting ? "Збираємо…" : "Оновити джерела"}
              </button>
            </div>
            <div className="connection-bar">
              <span>
                <span
                  className={
                    "status-dot " +
                    (status?.bot.status === "running" ? "" : "muted")
                  }
                />
                Telegram:{" "}
                {status?.bot.status === "running"
                  ? "підключено"
                  : status?.bot.status || "перевіряємо"}
              </span>
              <a
                href={
                  "https://t.me/" +
                  (status?.bot.username || "wtelektrikerparserbot")
                }
                target="_blank"
                rel="noreferrer"
              >
                Відкрити бота
                <ArrowUpRight size={15} />
              </a>
            </div>
            <p className="source-explanation">
              Автоматичний збір охоплює підключені джерела, а не весь інтернет.
              Великі каталоги переглядаються частинами; наступні запуски додають
              інші сторінки. Вакансії можуть закриватися — перевіряй оригінал.
            </p>
            {status?.sources.map((s) => {
              const run = status.runs.find((r) => r.source === s.id);
              return (
                <article className="source-row" key={s.id}>
                  <div>
                    <h2>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.name}
                        <ArrowUpRight size={17} />
                      </a>
                    </h2>
                    <span className="type-label">{s.type}</span>
                    <p>{s.description}</p>
                    {run?.error && <p className="error">{run.error}</p>}
                  </div>
                  <div className="source-status">
                    {run ? (
                      <>
                        <span className={"run-status " + run.status}>
                          {(
                            {
                              ok: "Працює",
                              partial: "Частково",
                              error: "Помилка",
                              running: "Збираємо",
                              interrupted: "Перервано",
                            } as Record<string, string>
                          )[run.status] || run.status}
                        </span>
                        <strong>
                          {run.fetched} <small>знайдено</small>
                        </strong>
                        <span>
                          {run.imported} нових · {date(run.startedAt)}
                        </span>
                      </>
                    ) : (
                      <span>
                        {s.type === "Автоматичний збір"
                          ? "Ще не збирався"
                          : "Відкрити вручну ↗"}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
        <footer>
          <span>
            elektrik <span className="footer-separator">/</span> твій наступний
            крок
          </span>
          <span>Німеччина · Приватний доступ</span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Навігація телефону">
        {nav.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            onClick={() => switchTab(n.id)}
            aria-current={tab === n.id ? "page" : undefined}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            aria-label="Закрити повідомлення"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Select({
  label: caption,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {caption}
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Усі варіанти</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function OpportunityRow({
  item: o,
  onSave,
}: {
  item: Opportunity;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="opportunity">
      <div className="opportunity-main">
        <h3>
          <a href={o.url} target="_blank" rel="noreferrer">
            {o.title}
            <ArrowUpRight size={18} />
          </a>
        </h3>
        <p className="company">{o.company}</p>
        <div className="metadata">
          <span
            className={
              "opportunity-kind " + (o.kind === "work" ? "work" : "learn")
            }
          >
            {label(kinds, o.kind)}
          </span>
          <span>
            <MapPin size={14} />
            {o.location || "Місце не вказано"}
          </span>
          {o.mode !== "unknown" && (
            <span>
              <Wifi size={14} />
              {label(modes, o.mode)}
            </span>
          )}
          {o.travel !== "unknown" && (
            <span>
              <TrainFront size={14} />
              {label(travels, o.travel)}
            </span>
          )}
          <span className="posted">
            {o.publishedAt
              ? date(o.publishedAt)
              : "Знайдено " + date(o.firstSeen)}
          </span>
        </div>
        {o.salary && <p className="salary">{o.salary}</p>}
        <div className="opportunity-bottom">
          <span>
            {o.source === "ba"
              ? "Bundesagentur für Arbeit"
              : o.source === "wbs"
                ? "WBS TRAINING"
                : "Arbeitnow"}
            {o.catalog ? " · каталог курсу" : ""}
          </span>
          <button
            className="text-button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Згорнути" : "Деталі"}
            <ChevronRight
              size={14}
              style={{ transform: expanded ? "rotate(90deg)" : undefined }}
            />
          </button>
        </div>
        {expanded && (
          <div className="details">
            <div className="detail-tags">
              {o.employment.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <p>
              {o.description ||
                "Опис не надано. Відкрий оригінальне оголошення."}
            </p>
            <p className="detail-disclaimer">
              Формат: {label(modes, o.mode)}. Поїздки:{" "}
              {label(travels, o.travel)}.{" "}
              {o.catalog
                ? "Це сторінка курсу, а не підтверджене місце на конкретну дату. "
                : ""}
              Останнє спостереження: {date(o.lastSeen)}.
            </p>
            <a
              className="source-link"
              href={o.url}
              target="_blank"
              rel="noreferrer"
            >
              Повний опис у джерелі
              <ExternalLink size={15} />
            </a>
          </div>
        )}
      </div>
      <button
        className={"save-button " + (o.saved ? "saved" : "")}
        onClick={onSave}
        aria-label={o.saved ? "Прибрати зі збережених" : "Зберегти " + o.title}
        aria-pressed={o.saved}
      >
        <Bookmark size={20} fill={o.saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
function Guide({ onSearch }: { onSearch: (q: string) => void }) {
  const [section, setSection] = useState<"professions" | "types" | "terms">(
    "professions",
  );
  return (
    <section className="guide">
      <div className="page-title">
        <div>
          <h1>Розберімося в назвах.</h1>
          <p>
            Німецькі терміни — з поясненнями українською. Натисни професію, щоб
            знайти можливості.
          </p>
        </div>
        <BookOpen size={42} strokeWidth={1} />
      </div>
      <div className="guide-tabs">
        {[
          ["professions", "Напрями та професії"],
          ["types", "Типи можливостей"],
          ["terms", "Що означають терміни"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={section === id ? "selected" : ""}
            onClick={() => setSection(id as typeof section)}
          >
            {name}
          </button>
        ))}
      </div>
      {section === "professions" ? (
        <div className="profession-list">
          {categories.map((c) => (
            <article key={c.id}>
              <h2>{c.label}</h2>
              <div>
                {c.names.map((name) => (
                  <button key={name} onClick={() => onSearch(name)}>
                    {name}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : section === "types" ? (
        <div className="type-list">
          {kinds.map((k) => (
            <article key={k.id}>
              <div>
                <h2>{k.label}</h2>
                <span>{k.de}</span>
              </div>
              <p>{k.description}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="terms">
          <article>
            <h2>Elektriker чи Elektroniker?</h2>
            <p>
              Elektriker — поширена загальна назва електрика у вакансіях. У
              сучасних Ausbildungsberufe зазвичай вказують Elektroniker та
              спеціалізацію: будівлі, промисловість, автоматизація, прилади або
              приводи. Старі назви на кшталт Elektroinstallateur теж корисні для
              пошуку.
            </p>
          </article>
          <article>
            <h2>Techniker — не просто «технік»</h2>
            <p>
              Servicetechniker може бути назвою посади. Staatlich geprüfter
              Techniker — конкретна професійна кваліфікація. Elektrotechniker у
              вакансії може бути широкою назвою: вимоги потрібно читати окремо.
            </p>
          </article>
          <article>
            <h2>Meister, Ingenieur та Elektrofachkraft</h2>
            <p>
              Meister — професійна кваліфікація майстра. Ingenieur — інженерний
              напрям, зазвичай після вищої освіти. Elektrofachkraft (EFK) описує
              фахову компетентність для конкретної сфери робіт; це не
              універсальний дозвіл після будь-якого короткого курсу.
            </p>
          </article>
          <article>
            <h2>EuP та EFKffT</h2>
            <p>
              EuP — електротехнічно проінструктована особа. EFKffT — фахівець
              для визначених повторюваних операцій. Це різні обсяги підготовки
              та відповідальності, які не можна прирівнювати до повної
              професійної освіти електроніка. Обсяг дозволених робіт уточнюється
              окремо.
            </p>
          </article>
          <article>
            <h2>Формат роботи — окремий фільтр</h2>
            <p>
              Vollzeit, Teilzeit, Minijob — зайнятість. Unbefristet та befristet
              — тривалість договору. Zeitarbeit — робота через кадрову агенцію.
              Quereinstieg — перехід з іншої професії. Homeoffice, Präsenz і
              Montage — умови виконання роботи; вони можуть поєднуватися.
            </p>
          </article>
          <article>
            <h2>Курси й навички для ширшого пошуку</h2>
            <p>
              SPS / PLC, Siemens S7 / TIA Portal, WinCC, CODESYS, KNX, EPLAN P8,
              CAD, MSR, DGUV V3, VDE, Schaltberechtigung, Hochvolt,
              Photovoltaik, Windenergie, Ladeinfrastruktur, LWL / Glasfaser,
              робототехніка та промислові мережі.
            </p>
          </article>
          <article>
            <h2>Фінансування і допуск</h2>
            <p>
              Bildungsgutschein, AZAV, Aufstiegs-BAföG, Berufssprachkurs та
              Anerkennung — додаткові умови або програми, а не гарантія
              безкоштовного навчання чи вступу. Перевіряй конкретний курс,
              вимоги та рішення відповідної установи.
            </p>
          </article>
        </div>
      )}
      <div className="references">
        <h2>Перевірені першоджерела</h2>
        <p>
          Досліджено 10 вересня 2026. Довідник об’єднує офіційні професії,
          поширені назви посад і суміжні спеціалізації; це не перелік
          рівнозначних дипломів.
        </p>
        {references.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
            {r.name}
            <ArrowUpRight size={14} />
          </a>
        ))}
      </div>
    </section>
  );
}
