// One-tap follow-up questions, built by code from the current plan.
import { getDataset, itemLabel, yearsWithData, type Lang } from "./catalog";
import type { Plan } from "./plan";
import type { PlanInput } from "./local";

export interface FollowUp {
  key: string;
  label: string;
  plan: PlanInput;
}

export function followUps(p: Plan | PlanInput, lang: Lang): FollowUp[] {
  const ds = getDataset(p.dataset_id);
  if (!ds) return [];
  const az = lang === "az";
  const items = p.item_ids.length ? p.item_ids : [ds.default_item];
  const covered = [...new Set(items.flatMap((id) => yearsWithData(ds, id)))].sort((a, b) => a - b);
  if (!covered.length) return [];
  const minY = covered[0];
  const maxY = covered[covered.length - 1];
  const base: PlanInput = {
    can_answer: true,
    reason: "follow-up",
    dataset_id: ds.id,
    item_ids: items,
    operation: "trend",
    year_from: null,
    year_to: null,
    extreme: null,
    chart_type: "line",
  };
  const out: FollowUp[] = [];
  const isRange = p.year_from !== null && p.year_to !== null && p.year_from !== p.year_to;
  const fullRange = p.year_from === minY && p.year_to === maxY;

  if (!fullRange) {
    out.push({ key: "full", label: az ? `Bütün illər (${minY}–${maxY})` : `All years (${minY}–${maxY})`, plan: { ...base, year_from: minY, year_to: maxY } });
  }
  if (maxY - minY > 5 && !(p.year_from === maxY - 4 && p.year_to === maxY)) {
    out.push({ key: "last5", label: az ? "Son 5 il" : "Last 5 years", plan: { ...base, year_from: maxY - 4, year_to: maxY } });
  }
  if (isRange || fullRange) {
    out.push({ key: "max", label: az ? "Ən yüksək il hansı olub?" : "Which year was highest?", plan: { ...base, operation: "extreme", extreme: "max", year_from: p.year_from ?? minY, year_to: p.year_to ?? maxY } });
  }
  // Add one other figure from the same table that isn't shown yet.
  const others = Object.keys(ds.items).filter((id) => !items.includes(id) && yearsWithData(ds, id).length);
  for (const id of others.slice(0, 2)) {
    if (items.length >= 4) break;
    out.push({
      key: `add-${id}`,
      label: az ? `+ ${itemLabel(ds, id, lang)} ilə müqayisə` : `+ Compare with ${itemLabel(ds, id, lang).toLowerCase()}`,
      plan: { ...base, item_ids: [...items, id], year_from: p.year_from ?? minY, year_to: p.year_to ?? maxY },
    });
  }
  return out.slice(0, 4);
}
