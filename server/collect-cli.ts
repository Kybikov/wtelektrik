import { config } from "./config.js";
import { Store } from "./store.js";
import { Collector } from "./collector.js";
const store = new Store(config.dbPath);
await new Collector(store).run();
const { locations, ...stats } = store.stats();
console.log(
  JSON.stringify(
    { stats, locationCount: locations.length, runs: store.runs().slice(0, 3) },
    null,
    2,
  ),
);
store.close();
