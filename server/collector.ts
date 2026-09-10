import type { Store } from "./store.js";
import { collectBA, collectArbeitnow, collectWBS } from "./sources.js";
import { config } from "./config.js";
export class Collector {
  running = false;
  constructor(private store: Store) {}
  async run() {
    if (this.running) return false;
    this.running = true;
    try {
      await Promise.allSettled([
        this.source("ba", (sink) =>
          collectBA(sink, this.store.read("baNextPage", 1)),
        ),
        this.source("arbeitnow", collectArbeitnow),
        this.source("wbs", collectWBS),
      ]);
      // Rotate deeper through the catalog, interleaving a refresh of the latest pages.
      const next = this.store.read<number>("baNextPage", 1),
        deep = this.store.read<number>("baDeepPage", 1 + config.pages);
      this.store.set("baNextPage", next === 1 ? deep : 1);
      if (next !== 1)
        this.store.set(
          "baDeepPage",
          deep >= 39 ? 1 + config.pages : deep + config.pages,
        );
      this.store.set("lastCollection", new Date().toISOString());
      return true;
    } finally {
      this.running = false;
    }
  }
  private async source(
    name: string,
    fn: (sink: Parameters<typeof collectBA>[0]) => Promise<string[]>,
  ) {
    const id = this.store.startRun(name);
    let fetched = 0,
      imported = 0;
    try {
      const errors = await fn((rows) => {
        for (const row of rows) {
          fetched++;
          if (this.store.upsert(row)) imported++;
        }
      });
      this.store.finishRun(
        id,
        fetched,
        imported,
        errors.length ? errors.slice(0, 4).join("; ") : null,
      );
    } catch (e) {
      this.store.finishRun(
        id,
        fetched,
        imported,
        (e as Error).message.slice(0, 400),
      );
    }
  }
}
