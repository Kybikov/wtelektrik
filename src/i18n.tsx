import { useSyncExternalStore } from "react";
import { Maximize2 } from "lucide-react";
import { requestMiniAppFullscreen } from "./miniapp";
import { languageOf, translate, type Language } from "../shared/i18n";
const listeners = new Set<() => void>();
let language: Language = languageOf(navigator.language);
try {
  const saved = localStorage.getItem("elektrik.language");
  if (saved) language = languageOf(saved);
} catch {
  /* Browser storage may be disabled. */
}
export const getLanguage = () => language;
export const locale = () => (language === "de" ? "de-DE" : "uk-UA");
export const t = (text: string, values: Record<string, string | number> = {}) =>
  translate(language, text, values);
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem("elektrik.language", next);
  } catch {
    /* Keep the selected language for this session. */
  }
  document.documentElement.lang = next;
  document.title =
    next === "de"
      ? "Elektrik — Arbeit & Bildung"
      : "Elektrik — робота та навчання";
  listeners.forEach((listener) => listener());
}
setLanguage(language);
export const useLanguage = () =>
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getLanguage);
export function LanguageSwitch() {
  const current = useLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={t("Мова інтерфейсу")}
    >
      <button
        lang="uk"
        aria-pressed={current === "uk"}
        onClick={() => setLanguage("uk")}
      >
        Українська
      </button>
      <button
        lang="de"
        aria-pressed={current === "de"}
        onClick={() => setLanguage("de")}
      >
        Deutsch
      </button>
      {window.Telegram?.WebApp.initData && (
        <button
          onClick={requestMiniAppFullscreen}
          aria-label={t("На весь екран")}
          title={t("На весь екран")}
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  );
}
