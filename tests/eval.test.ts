// Checks the eval set itself: every expected number must be what the code
// computes from the data for the hand-written plan. If a data refresh changes
// a figure, this test says which question to update.
import { describe, it, expect } from "vitest";
import { execute } from "@/lib/executor";
import type { Plan } from "@/lib/plan";
import questions from "./eval/questions.json";

interface EvalQuestion {
  id: string;
  lang: "az" | "en";
  question: string;
  refuse?: boolean;
  plan?: Omit<Plan, "can_answer" | "reason" | "answer_language" | "chart_type">;
  expect?: { item_id: string; year: number; value: number }[];
}
const QS = questions as EvalQuestion[];

describe("eval set", () => {
  it("has 20 questions: 10 Azerbaijani, 10 English, 3 to refuse", () => {
    expect(QS.length).toBe(20);
    expect(QS.filter((q) => q.lang === "az").length).toBe(10);
    expect(QS.filter((q) => q.refuse).length).toBe(3);
    expect(new Set(QS.map((q) => q.id)).size).toBe(QS.length);
  });

  for (const q of QS.filter((x) => !x.refuse)) {
    it(`${q.id}: expected numbers match the data`, () => {
      const r = execute({ can_answer: true, reason: "", answer_language: q.lang, chart_type: "kpi", ...q.plan! });
      if (!r.ok) throw new Error(`plan failed: ${r.reason}`);
      for (const e of q.expect!) {
        const s = r.series.find((x) => x.item_id === e.item_id);
        expect(s, `item ${e.item_id}`).toBeDefined();
        expect(s!.points.find((p) => p.year === e.year)?.value).toBe(e.value);
      }
      if (q.plan!.operation === "rank") {
        const top = r.ranking!.find((x) => !x.total)!;
        const want = q.plan!.extreme === "min" ? r.ranking!.filter((x) => !x.total).at(-1)! : top;
        expect(want.item_id).toBe(q.expect![0].item_id);
      }
    });
  }
});
