// Typed access to the generated dataset bundle (built from catalog.yaml by
// scripts/prepare-data.mjs). Server and client can both import this.
import bundle from "./generated/datasets.json";

export type Lang = "az" | "en";

export interface Dataset {
  id: string;
  title_az: string;
  title_en: string;
  synonyms: string[];
  unit_az: string;
  unit_en: string;
  value_kind: "level" | "index_prev_year_100";
  default_item: string;
  notes: string | null;
  source_url: string;
  data_url: string;
  year_min: number;
  year_max: number;
  items: Record<string, { az: string; en: string }>;
  series: Record<string, Record<string, number | null>>;
}

export const DATASETS: Dataset[] = (bundle as unknown as { datasets: Dataset[] }).datasets;
export const DATA_AS_OF: string | null = (bundle as unknown as { fetched_at: string | null }).fetched_at;
export const DATASET_IDS = DATASETS.map((d) => d.id) as [string, ...string[]];

export function getDataset(id: string): Dataset | undefined {
  return DATASETS.find((d) => d.id === id);
}

export function title(ds: Dataset, lang: Lang): string {
  return lang === "az" ? ds.title_az : ds.title_en;
}

export function unit(ds: Dataset, lang: Lang): string {
  return lang === "az" ? ds.unit_az : ds.unit_en;
}

export function itemLabel(ds: Dataset, itemId: string, lang: Lang): string {
  return ds.items[itemId]?.[lang] ?? itemId;
}

/** Years (sorted) that have a non-null value for this item. */
export function yearsWithData(ds: Dataset, itemId: string): number[] {
  const s = ds.series[itemId] ?? {};
  return Object.keys(s)
    .filter((y) => s[y] !== null)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Compact catalog text for the planner's (cached) system prompt. */
export function catalogForPrompt(): string {
  return DATASETS.map((d) => {
    const items = Object.entries(d.items)
      .map(([id, l]) => {
        const ys = yearsWithData(d, id);
        const range = ys.length ? `${ys[0]}–${ys[ys.length - 1]}` : "no data";
        return `    - item "${id}": ${l.en} / ${l.az} (${range}${ys.length && ys.length < ys[ys.length - 1] - ys[0] + 1 ? `, gaps: only ${ys.join(", ")}` : ""})`;
      })
      .join("\n");
    return [
      `- dataset "${d.id}": ${d.title_en} / ${d.title_az}`,
      `  unit: ${d.unit_en}${d.value_kind === "index_prev_year_100" ? " — an index where previous year = 100, so 105.6 means +5.6%" : ""}`,
      `  keywords: ${d.synonyms.join(", ")}`,
      `  default item: "${d.default_item}"`,
      d.notes ? `  note: ${d.notes.trim()}` : null,
      `  items:\n${items}`,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");
}
