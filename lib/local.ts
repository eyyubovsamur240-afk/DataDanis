// Answers that need no AI: the code runs a fixed plan on the bundled data and
// writes the answer from a template. Used by the headline cards, the data
// explorer, follow-up buttons and shared links, so they work instantly in the
// browser and never touch the Gemini quota.
import { execute } from "./executor";
import { templateAnswer } from "./templates";
import { errorMessage } from "./i18n";
import { DATA_AS_OF, type Lang } from "./catalog";
import type { Plan } from "./plan";
import type { AskOk, AskFail } from "@/app/api/ask/route";

export type PlanInput = Omit<Plan, "answer_language">;

export function answerLocally(plan: PlanInput, lang: Lang): AskOk | AskFail {
  const r = execute({ ...plan, answer_language: lang });
  if (!r.ok) return { ok: false, lang, code: r.reason, message: errorMessage(r.reason, lang, r.detail) };
  return {
    ok: true,
    lang,
    answer: templateAnswer(r),
    checked: true,
    chart: r.chart,
    unit: r.unit,
    year_from: r.year_from,
    year_to: r.year_to,
    source: r.source,
    data_as_of: DATA_AS_OF,
    plan: { ...r.plan, year_from: r.year_from, year_to: r.year_to },
    dataset_id: r.dataset_id,
  };
}
