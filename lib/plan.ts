// The query plan the AI fills in. Every field is constrained, so the AI can
// only pick from datasets, items and operations that exist. It never does
// arithmetic: lib/executor.ts computes every number from the snapshot.
import { z } from "zod";
import { DATASET_IDS } from "./catalog";

export const OPERATIONS = ["value", "trend", "change", "compare", "extreme"] as const;
export const CHART_TYPES = ["line", "bar", "kpi", "table"] as const;

export const PlanSchema = z.object({
  can_answer: z
    .boolean()
    .describe("false if no dataset in the catalog can answer the question"),
  reason: z
    .string()
    .describe("One short sentence: what will be computed, or why it cannot be answered"),
  answer_language: z.enum(["az", "en"]).describe("Language of the user's question (Russian → az)"),
  dataset_id: z.enum([...DATASET_IDS, "none"]),
  item_ids: z.array(z.string()).describe("1–4 item ids from the chosen dataset"),
  operation: z.enum(OPERATIONS),
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),
  extreme: z.enum(["max", "min"]).nullable().describe("only for operation=extreme"),
  chart_type: z.enum(CHART_TYPES),
});

export type Plan = z.infer<typeof PlanSchema>;
