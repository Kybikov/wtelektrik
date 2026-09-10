import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });
export const config = {
  port: Number(process.env.PORT || 4317),
  host: process.env.HOST || "127.0.0.1",
  token: process.env.BOTTOKEN || process.env.TELEGRAM_BOT_TOKEN || "",
  owners: (process.env.TELEGRAM_OWNER_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  password: process.env.WEB_PASSWORD || "",
  secure: process.env.COOKIE_SECURE === "true",
  publicUrl: process.env.PUBLIC_URL || "http://localhost:4317",
  botEnabled: process.env.BOT_ENABLED === "true",
  interval: Math.max(30, Number(process.env.COLLECT_INTERVAL_MINUTES) || 120),
  pages: Math.min(20, Math.max(1, Number(process.env.BA_PAGES_PER_QUERY) || 2)),
  pageSize: Math.min(100, Math.max(10, Number(process.env.BA_PAGE_SIZE) || 50)),
  dbPath: process.env.DB_PATH || "runtime/elektrik.sqlite",
};
