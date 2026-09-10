import type { Filters } from "../shared/types";
import { type Language } from "../shared/i18n";
interface TelegramApp {
  initData: string;
  isFullscreen?: boolean;
  platform: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast: (version: string) => boolean;
  requestFullscreen?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  onEvent: (event: string, callback: () => void) => void;
}
declare global {
  interface Window {
    Telegram?: { WebApp: TelegramApp };
  }
}
let token = "";
let bootstrap:
  Promise<{ language: Language; filters: Filters } | null> | undefined;
export const miniAppHeaders = (): Record<string, string> =>
  token ? { authorization: "Bearer " + token } : {};
export function requestMiniAppFullscreen() {
  const app = window.Telegram?.WebApp;
  if (!app?.initData) return;
  app.expand();
  if (
    app.isVersionAtLeast("8.0") &&
    app.requestFullscreen &&
    !app.isFullscreen
  ) {
    try {
      app.requestFullscreen();
    } catch {
      /* expand() remains available in older clients. */
    }
  }
}
export function startMiniApp() {
  if (bootstrap) return bootstrap;
  bootstrap = (async () => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) return null;
    document.documentElement.classList.add("telegram-miniapp");
    const safeArea = () => {
      for (const side of ["top", "bottom", "left", "right"] as const)
        document.documentElement.style.setProperty(
          "--telegram-safe-" + side,
          `${(app.safeAreaInset?.[side] || 0) + (app.contentSafeAreaInset?.[side] || 0)}px`,
        );
    };
    safeArea();
    app.onEvent("safeAreaChanged", safeArea);
    app.onEvent("contentSafeAreaChanged", safeArea);
    app.onEvent("fullscreenChanged", safeArea);
    app.ready();
    requestMiniAppFullscreen();
    if (app.isVersionAtLeast("6.9")) {
      app.setHeaderColor?.("#173e33");
      app.setBackgroundColor?.("#f5f6ef");
    }
    const response = await fetch("/api/login/miniapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: app.initData }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    token = data.token;
    return {
      language: data.language as Language,
      filters: data.filters as Filters,
    };
  })();
  bootstrap.catch(() => {
    bootstrap = undefined;
  });
  return bootstrap;
}
