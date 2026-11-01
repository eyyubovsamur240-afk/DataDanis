// Landing-page example questions. Each has a fixed, hand-checked plan, so the
// buttons answer instantly with no AI call (and keep working if the AI is down).
import type { Lang } from "./catalog";
import type { Plan } from "./plan";

export interface Example {
  id: string;
  question: Record<Lang, string>;
  plan: Omit<Plan, "answer_language">;
}

export const EXAMPLES: Example[] = [
  {
    id: "inflation",
    question: {
      az: "Son 10 ildə inflyasiya necə dəyişib?",
      en: "How has inflation changed over the last 10 years?",
    },
    plan: {
      can_answer: true,
      reason: "CPI trend, last 10 years",
      dataset_id: "DT_BL_001",
      item_ids: ["001"],
      operation: "trend",
      year_from: 2016,
      year_to: 2025,
      extreme: null,
      chart_type: "line",
    },
  },
  {
    id: "dollar",
    question: {
      az: "2005-ci ildə 1 dollar neçə manat idi, indi neçədir?",
      en: "How many manats did one dollar cost in 2005, and now?",
    },
    plan: {
      can_answer: true,
      reason: "USD rate 2005 vs latest",
      dataset_id: "DT_BK_011",
      item_ids: ["001"],
      operation: "change",
      year_from: 2005,
      year_to: null,
      extreme: null,
      chart_type: "line",
    },
  },
  {
    id: "population",
    question: {
      az: "2026-cı ilin əvvəlində Azərbaycanda neçə nəfər yaşayırdı?",
      en: "How many people lived in Azerbaijan at the start of 2026?",
    },
    plan: {
      can_answer: true,
      reason: "Population by sex, 2026",
      dataset_id: "DT_AA_001",
      item_ids: ["001", "004", "005"],
      operation: "compare",
      year_from: null,
      year_to: 2026,
      extreme: null,
      chart_type: "bar",
    },
  },
  {
    id: "regions",
    question: {
      az: "Hansı iqtisadi rayonda orta maaş ən yüksəkdir?",
      en: "Which economic region has the highest average wage?",
    },
    plan: {
      can_answer: true,
      reason: "Regional wage ranking, latest year",
      dataset_id: "DT_AB_080",
      item_ids: [],
      operation: "rank",
      year_from: null,
      year_to: null,
      extreme: "max",
      chart_type: "bar",
    },
  },
  {
    id: "neighbours",
    question: {
      az: "Adambaşına ÜDM: Azərbaycan qonşularla müqayisədə",
      en: "GDP per person: Azerbaijan next to its neighbours",
    },
    plan: {
      can_answer: true,
      reason: "World Bank GDP per capita, AZ vs GE, AM, KZ",
      dataset_id: "WB_GDP_PC",
      item_ids: ["AZE", "GEO", "ARM", "KAZ"],
      operation: "trend",
      year_from: 2010,
      year_to: null,
      extreme: null,
      chart_type: "line",
    },
  },
];
