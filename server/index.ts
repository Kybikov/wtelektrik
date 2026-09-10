import { config } from "./config.js";
import { Store } from "./store.js";
import { Collector } from "./collector.js";
import { Bot } from "./bot.js";
import { createApp } from "./app.js";
if (
  !["127.0.0.1", "localhost", "::1"].includes(config.host) &&
  config.password.length < 20
)
  throw new Error(
    "Для мережевого доступу потрібен WEB_PASSWORD довжиною щонайменше 20 символів.",
  );
const store = new Store(config.dbPath),
  collector = new Collector(store),
  bot = new Bot(store, collector);
const server = createApp(store, collector, bot).listen(
  config.port,
  config.host,
  () => console.log(`Elektrik ready at http://${config.host}:${config.port}`),
);
void bot.start();
const timer = setInterval(() => void collector.run(), config.interval * 60000);
if (!store.stats().total) void collector.run();
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  bot.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
