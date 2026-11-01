// Headline figures for the home page, computed from the bundled data.
import { getDataset, itemLabel, yearsWithData, type Lang } from "./catalog";
import type { PlanInput } from "./local";

export interface Highlight {
  id: string;
  label: Record<Lang, string>;
  dataset_id: string;
  item_id: string;
  /** index tables (previous year = 100) are shown as % change */
  pct: boolean;
  unit: Record<Lang, string>;
  /** is a rise good news? decides the colour of the change arrow */
  upIsGood: boolean | null;
}

export const HIGHLIGHTS: Highlight[] = [
  { id: "pop", label: { az: "Əhali", en: "Population" }, dataset_id: "DT_AA_001", item_id: "001", pct: false, unit: { az: "min nəfər", en: "thousand" }, upIsGood: null },
  { id: "cpi", label: { az: "İnflyasiya", en: "Inflation" }, dataset_id: "DT_BL_001", item_id: "001", pct: true, unit: { az: "illik", en: "a year" }, upIsGood: false },
  { id: "usd", label: { az: "1 ABŞ dolları", en: "1 US dollar" }, dataset_id: "DT_BK_011", item_id: "001", pct: false, unit: { az: "manat", en: "manat" }, upIsGood: null },
  { id: "wage", label: { az: "Orta aylıq maaş", en: "Average monthly wage" }, dataset_id: "DT_AB_036", item_id: "001", pct: false, unit: { az: "manat", en: "manat" }, upIsGood: true },
];

export interface HighlightValue {
  h: Highlight;
  year: number;
  value: number;
  prev?: { year: number; value: number };
  spark: number[];
  plan: PlanInput;
  title: Record<Lang, string>;
}

export function highlightValues(): HighlightValue[] {
  const out: HighlightValue[] = [];
  for (const h of HIGHLIGHTS) {
    const ds = getDataset(h.dataset_id);
    if (!ds) continue;
    const ys = yearsWithData(ds, h.item_id);
    if (!ys.length) continue;
    const s = ds.series[h.item_id];
    const val = (y: number) => {
      const raw = s[String(y)] as number;
      return h.pct ? Math.round((raw - 100) * 10) / 10 : raw;
    };
    const last = ys[ys.length - 1];
    const recent = ys.slice(-10);
    const prevYear = ys.length > 1 ? ys[ys.length - 2] : undefined;
    out.push({
      h,
      year: last,
      value: val(last),
      prev: prevYear !== undefined ? { year: prevYear, value: val(prevYear) } : undefined,
      spark: recent.map(val),
      title: { az: itemLabel(ds, h.item_id, "az"), en: itemLabel(ds, h.item_id, "en") },
      plan: {
        can_answer: true,
        reason: "headline card",
        dataset_id: h.dataset_id,
        item_ids: [h.item_id],
        operation: "trend",
        year_from: recent[0],
        year_to: last,
        extreme: null,
        chart_type: "line",
      },
    });
  }
  return out;
}
