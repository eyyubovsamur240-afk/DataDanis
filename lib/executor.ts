// Validates a plan against the catalog and the data, then computes the answer
// with fixed code. This is the only place numbers are produced.
import { getDataset, itemLabel, title, unit, yearsWithData, type Dataset, type Lang } from "./catalog";
import type { Plan } from "./plan";
import { round } from "./format";

export type FailReason =
  | "cannot_answer"
  | "unknown_dataset"
  | "unknown_item"
  | "year_not_covered"
  | "no_data";

export interface Point {
  year: number;
  value: number;
}

export interface SeriesOut {
  item_id: string;
  label: string;
  /** whole-country / world row in a ranking (drawn in grey) */
  total?: boolean;
  points: Point[];
}

/** Numbers computed for one item, used by the answer text and the number check. */
export interface ItemFacts {
  item_id: string;
  label: string;
  from?: Point;
  to?: Point;
  abs_change?: number;
  pct_change?: number | null;
  max?: Point;
  min?: Point;
}

export interface ChartSpec {
  type: "line" | "bar" | "kpi" | "table";
  title: string;
  unit: string;
  series: SeriesOut[];
}

export interface Result {
  ok: true;
  lang: Lang;
  plan: Plan;
  dataset_id: string;
  dataset_title: string;
  unit: string;
  /** index datasets are shown as "% change on previous year" */
  shown_as_pct_change: boolean;
  year_from: number;
  year_to: number;
  series: SeriesOut[];
  facts: ItemFacts[];
  chart: ChartSpec;
  source: { title: string; url: string; name: string };
  /** operation=rank: items sorted from highest to lowest in year_to */
  ranking?: { item_id: string; label: string; value: number; total: boolean }[];
}

export interface Failure {
  ok: false;
  lang: Lang;
  reason: FailReason;
  /** extra info for the friendly message, e.g. the covered year range */
  detail?: { dataset_title?: string; year_min?: number; year_max?: number; ai_reason?: string };
}

const MAX_ITEMS = 4;
/** rank compares every item of a table (15 regions, 8 countries) in one year */
const MAX_RANK_ITEMS = 20;

function displayUnit(ds: Dataset, lang: Lang): string {
  if (ds.value_kind === "index_prev_year_100") {
    return lang === "az" ? "% (əvvəlki ilə nisbətən dəyişmə)" : "% change on previous year";
  }
  return unit(ds, lang);
}

function shownValue(ds: Dataset, raw: number): number {
  // An index where previous year = 100 is easier to read as a % change: 105.6 → 5.6
  return ds.value_kind === "index_prev_year_100" ? round(raw - 100, 1) : raw;
}

export function execute(plan: Plan, langOverride?: Lang): Result | Failure {
  const lang: Lang = langOverride ?? plan.answer_language;

  if (!plan.can_answer || plan.dataset_id === "none") {
    return { ok: false, lang, reason: "cannot_answer", detail: { ai_reason: plan.reason } };
  }
  const ds = getDataset(plan.dataset_id);
  if (!ds) return { ok: false, lang, reason: "unknown_dataset" };

  const rank = plan.operation === "rank";
  const requested = plan.item_ids.length ? plan.item_ids : rank ? Object.keys(ds.items) : [ds.default_item];
  const itemIds = [...new Set(requested)].slice(0, rank ? MAX_RANK_ITEMS : MAX_ITEMS);
  if (itemIds.some((id) => !(id in ds.items))) {
    return { ok: false, lang, reason: "unknown_item", detail: { dataset_title: title(ds, lang) } };
  }

  // Years: fill gaps in the plan with sensible defaults, then check coverage.
  const covered = [...new Set(itemIds.flatMap((id) => yearsWithData(ds, id)))].sort((a, b) => a - b);
  if (!covered.length) return { ok: false, lang, reason: "no_data", detail: { dataset_title: title(ds, lang) } };
  const minY = covered[0];
  const maxY = covered[covered.length - 1];

  const single = plan.operation === "value" || rank || (plan.operation === "compare" && plan.year_from === null);
  let yearTo = plan.year_to ?? (single ? plan.year_from ?? maxY : maxY);
  let yearFrom = single ? yearTo : plan.year_from ?? minY;
  if (yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  const outOfRange = yearTo < minY || yearFrom > maxY;
  if (outOfRange) {
    return {
      ok: false,
      lang,
      reason: "year_not_covered",
      detail: { dataset_title: title(ds, lang), year_min: minY, year_max: maxY },
    };
  }
  // Clip a partly covered range to what exists (e.g. "since 1990" → from 1995).
  yearFrom = Math.max(yearFrom, minY);
  yearTo = Math.min(yearTo, maxY);

  const series: SeriesOut[] = itemIds.map((id) => {
    const s = ds.series[id] ?? {};
    const points = Object.entries(s)
      .filter(([y, v]) => v !== null && Number(y) >= yearFrom && Number(y) <= yearTo)
      .map(([y, v]) => ({ year: Number(y), value: shownValue(ds, v as number) }))
      .sort((a, b) => a.year - b.year);
    return { item_id: id, label: itemLabel(ds, id, lang), points };
  });

  if (series.every((s) => s.points.length === 0)) {
    return {
      ok: false,
      lang,
      reason: single ? "year_not_covered" : "no_data",
      detail: { dataset_title: title(ds, lang), year_min: minY, year_max: maxY },
    };
  }

  const facts: ItemFacts[] = series.map((s) => {
    const f: ItemFacts = { item_id: s.item_id, label: s.label };
    if (!s.points.length) return f;
    const first = s.points[0];
    const last = s.points[s.points.length - 1];
    f.from = first;
    f.to = last;
    if (s.points.length > 1) {
      f.abs_change = round(last.value - first.value, 2);
      f.pct_change =
        ds.value_kind === "level" && first.value !== 0 ? round(((last.value - first.value) / Math.abs(first.value)) * 100, 1) : null;
      f.max = s.points.reduce((a, b) => (b.value > a.value ? b : a));
      f.min = s.points.reduce((a, b) => (b.value < a.value ? b : a));
    }
    return f;
  });

  // rank: one year, items sorted from highest to lowest. A whole-country row
  // (Azerbaijan total, world average) stays in the chart for reference.
  let ranking: Result["ranking"];
  if (rank) {
    ranking = series
      .filter((s) => s.points.length)
      .map((s) => ({ item_id: s.item_id, label: s.label, value: s.points[s.points.length - 1].value, total: ds.totals.includes(s.item_id) }))
      .sort((a, b) => b.value - a.value);
    const order = new Map(ranking.map((r, i) => [r.item_id, i]));
    series.sort((a, b) => (order.get(a.item_id) ?? 99) - (order.get(b.item_id) ?? 99));
    for (const s of series) if (ds.totals.includes(s.item_id)) s.total = true;
    facts.sort((a, b) => (order.get(a.item_id) ?? 99) - (order.get(b.item_id) ?? 99));
  }

  let chartType = plan.chart_type;
  if (rank && chartType !== "table") chartType = "bar";
  const nPoints = Math.max(...series.map((s) => s.points.length));
  if (nPoints === 1 && (chartType === "line" || chartType === "bar")) chartType = series.length > 1 ? "bar" : "kpi";
  if (nPoints > 1 && chartType === "kpi") chartType = "line";

  return {
    ok: true,
    lang,
    plan,
    dataset_id: ds.id,
    dataset_title: title(ds, lang),
    unit: displayUnit(ds, lang),
    shown_as_pct_change: ds.value_kind === "index_prev_year_100",
    year_from: yearFrom,
    year_to: yearTo,
    series,
    facts,
    chart: { type: chartType, title: title(ds, lang), unit: displayUnit(ds, lang), series },
    source: { title: title(ds, lang), url: ds.source_url, name: ds.source_name },
    ranking,
  };
}

/** Every number the answer text is allowed to contain. */
export function allowedNumbers(r: Result): number[] {
  const nums: number[] = [];
  for (const s of r.series) for (const p of s.points) nums.push(p.year, p.value);
  for (const f of r.facts) {
    for (const v of [f.abs_change, f.pct_change]) if (typeof v === "number") nums.push(v);
    for (const p of [f.from, f.to, f.max, f.min]) if (p) nums.push(p.year, p.value);
  }
  nums.push(r.year_from, r.year_to, r.year_to - r.year_from, r.year_to - r.year_from + 1);
  if (r.ranking) nums.push(r.ranking.length, r.ranking.filter((x) => !x.total).length);
  // differences between items in the same year (e.g. "women live 4.4 years longer")
  if (r.facts.length === 2 && r.facts[0].to && r.facts[1].to && r.facts[0].to.year === r.facts[1].to.year) {
    nums.push(round(r.facts[0].to.value - r.facts[1].to.value, 2));
  }
  return nums;
}
