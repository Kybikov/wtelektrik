export type Mode = "online" | "offline" | "hybrid" | "unknown";
export type Travel = "long" | "occasional" | "none" | "unknown";
export interface Opportunity {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  sourceId: string;
  kind: string;
  categories: string[];
  location: string | null;
  mode: Mode;
  travel: Travel;
  description: string;
  publishedAt: string | null;
  firstSeen: string;
  lastSeen: string;
  salary: string | null;
  employment: string[];
  saved: boolean;
  catalog: boolean;
}
export interface Filters {
  q?: string;
  kind?: string;
  category?: string;
  location?: string;
  unknownLocation?: string;
  mode?: string;
  travel?: string;
  saved?: string;
  page?: string;
}
export interface SourceRun {
  source: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  fetched: number;
  imported: number;
  error: string | null;
}
