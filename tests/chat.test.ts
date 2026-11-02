import { describe, it, expect } from "vitest";
import { chatContext, type Turn } from "@/lib/chat";
import { answerLocally } from "@/lib/local";
import { EXAMPLES } from "@/lib/examples";

const ok = (id: number, q: string, exIndex = 0): Turn => ({ id, question: q, status: "done", viaAi: true, reply: answerLocally(EXAMPLES[exIndex].plan, "en") });

describe("chat context", () => {
  it("is empty for a new chat", () => {
    expect(chatContext([])).toBeUndefined();
  });
  it("uses the latest answered question and its plan", () => {
    const c = chatContext([ok(1, "inflation?", 0), ok(2, "population in 2026?", 2)]);
    expect(c?.question).toBe("population in 2026?");
    expect(c?.plan.dataset_id).toBe(EXAMPLES[2].plan.dataset_id);
    expect(c?.plan.item_ids.length).toBeGreaterThan(0);
  });
  it("skips a question still loading", () => {
    const c = chatContext([ok(1, "inflation?", 0), { id: 2, question: "and food?", status: "loading", viaAi: true }]);
    expect(c?.question).toBe("inflation?");
  });
  it("starts fresh after a failed answer", () => {
    const failed: Turn = { id: 2, question: "bread price?", status: "done", viaAi: true, reply: { ok: false, lang: "en", code: "cannot_answer", message: "" } };
    expect(chatContext([ok(1, "inflation?"), failed])).toBeUndefined();
  });
});
