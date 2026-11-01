// Plain template answers built only from computed facts. Used for the example
// buttons (no AI call) and whenever an AI-written answer fails the number check.
import type { Result, ItemFacts } from "./executor";
import { fmt, fmtPct, azOrdinal } from "./format";

function v(r: Result, n: number): string {
  return r.shown_as_pct_change ? fmtPct(n, r.lang) : `${fmt(n, r.lang)} ${r.unit}`;
}

function one(r: Result, f: ItemFacts): string {
  const az = r.lang === "az";
  const op = r.plan.operation;
  if (!f.to) return "";
  if (!f.from || f.from.year === f.to.year || op === "value" || op === "compare") {
    return az ? `${f.label}: ${azOrdinal(f.to.year)} ildə ${v(r, f.to.value)}.` : `${f.label}: ${v(r, f.to.value)} in ${f.to.year}.`;
  }
  if (op === "extreme" && f.max && f.min) {
    const p = r.plan.extreme === "min" ? f.min : f.max;
    return az
      ? `${f.label}: ${f.from.year}–${f.to.year} arasında ən ${r.plan.extreme === "min" ? "aşağı" : "yüksək"} göstərici ${azOrdinal(p.year)} ildə olub: ${v(r, p.value)}.`
      : `${f.label}: between ${f.from.year} and ${f.to.year} the ${r.plan.extreme === "min" ? "lowest" : "highest"} value was in ${p.year}: ${v(r, p.value)}.`;
  }
  let s = az
    ? `${f.label}: ${azOrdinal(f.from.year)} ildə ${v(r, f.from.value)}, ${azOrdinal(f.to.year)} ildə ${v(r, f.to.value)}`
    : `${f.label}: ${v(r, f.from.value)} in ${f.from.year} and ${v(r, f.to.value)} in ${f.to.year}`;
  if (typeof f.pct_change === "number") s += az ? ` (${fmtPct(f.pct_change, r.lang)} dəyişmə)` : ` (${fmtPct(f.pct_change, r.lang)} change)`;
  if (r.shown_as_pct_change && f.max && f.min && op === "trend") {
    s += az
      ? `. Ən yüksək: ${f.max.year} (${fmtPct(f.max.value, r.lang)}), ən aşağı: ${f.min.year} (${fmtPct(f.min.value, r.lang)})`
      : `. Highest: ${f.max.year} (${fmtPct(f.max.value, r.lang)}), lowest: ${f.min.year} (${fmtPct(f.min.value, r.lang)})`;
  }
  return s + ".";
}

export function templateAnswer(r: Result): string {
  return r.facts.map((f) => one(r, f)).filter(Boolean).join(" ");
}
