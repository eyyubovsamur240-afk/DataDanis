// Share links carry the plan, not the answer: /?a=DT_BL_001.001_002.trend.2016-2025.line
// Opening the link recomputes the same answer from the bundled data, with no AI call.
import { PlanSchema, type Plan } from "./plan";
import type { PlanInput } from "./local";

const SEP = ".";

export function encodePlan(p: Plan | PlanInput): string {
  const years = `${p.year_from ?? ""}-${p.year_to ?? ""}`;
  return [p.dataset_id, p.item_ids.join("_"), p.operation, years, p.chart_type, p.extreme ?? ""]
    .join(SEP)
    .replace(/\.$/, "");
}

export function decodePlan(s: string): PlanInput | null {
  const [dataset_id, items, operation, years = "-", chart_type = "line", extreme = ""] = s.split(SEP);
  const [yf, yt] = years.split("-");
  const num = (x: string | undefined) => (x && /^\d{4}$/.test(x) ? Number(x) : null);
  const parsed = PlanSchema.safeParse({
    can_answer: true,
    reason: "shared link",
    answer_language: "az",
    dataset_id,
    item_ids: (items ?? "").split(/[_+ ,]/).filter(Boolean).slice(0, operation === "rank" ? 20 : 4),
    operation,
    year_from: num(yf),
    year_to: num(yt),
    extreme: extreme === "max" || extreme === "min" ? extreme : null,
    chart_type,
  });
  if (!parsed.success) return null;
  const { answer_language: _drop, ...plan } = parsed.data;
  void _drop;
  return plan;
}

export function shareUrl(p: Plan | PlanInput, lang: string): string {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("a", encodePlan(p));
  u.searchParams.set("lang", lang);
  return u.toString();
}
