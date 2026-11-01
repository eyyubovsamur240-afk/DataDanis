import { describe, it, expect } from "vitest";
import { encodePlan, decodePlan } from "@/lib/share";
import { answerLocally, type PlanInput } from "@/lib/local";
import { followUps } from "@/lib/followups";
import { highlightValues } from "@/lib/highlights";
import { toCsv } from "@/lib/csv";
import { EXAMPLES } from "@/lib/examples";

const cpi: PlanInput = {
  can_answer: true,
  reason: "",
  dataset_id: "DT_BL_001",
  item_ids: ["001", "002"],
  operation: "trend",
  year_from: 2016,
  year_to: 2025,
  extreme: null,
  chart_type: "line",
};

describe("share links", () => {
  it("round-trips a plan", () => {
    const s = encodePlan(cpi);
    expect(s).toBe("DT_BL_001.001_002.trend.2016-2025.line");
    expect(decodePlan(s)).toMatchObject({ dataset_id: "DT_BL_001", item_ids: ["001", "002"], year_from: 2016, year_to: 2025, chart_type: "line", extreme: null });
  });
  it("still reads links where + became a space", () => {
    expect(decodePlan("DT_BL_001.001 002.trend.2016-2025.line")?.item_ids).toEqual(["001", "002"]);
  });
  it("keeps extreme and null years", () => {
    const p = decodePlan(encodePlan({ ...cpi, operation: "extreme", extreme: "max", year_from: null }));
    expect(p).toMatchObject({ operation: "extreme", extreme: "max", year_from: null, year_to: 2025 });
  });
  it("rejects junk", () => {
    expect(decodePlan("nope")).toBeNull();
    expect(decodePlan("DT_XX_999.001.trend.2016-2025.line")).toBeNull();
    expect(decodePlan("DT_BL_001.001.hack.2016-2025.line")).toBeNull();
  });
  it("every example question survives a share link", () => {
    for (const ex of EXAMPLES) {
      const a = answerLocally(ex.plan, "en");
      expect(a.ok).toBe(true);
      if (!a.ok || !a.plan) continue;
      const b = answerLocally(decodePlan(encodePlan(a.plan))!, "en");
      expect(b.ok && b.answer).toBe(a.answer);
    }
  });
});

describe("local answers", () => {
  it("answers without AI and includes the plan", () => {
    const a = answerLocally(cpi, "az");
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.plan?.dataset_id).toBe("DT_BL_001");
      expect(a.chart.series).toHaveLength(2);
    }
  });
  it("explains uncovered years", () => {
    const a = answerLocally({ ...cpi, year_from: 1950, year_to: 1960 }, "en");
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.code).toBe("year_not_covered");
  });
});

describe("follow-ups", () => {
  it("offers valid, answerable plans", () => {
    const fs = followUps({ ...cpi, item_ids: ["001"] }, "en");
    expect(fs.length).toBeGreaterThan(1);
    for (const f of fs) expect(answerLocally(f.plan, "en").ok).toBe(true);
  });
  it("never goes past 4 figures", () => {
    const fs = followUps({ ...cpi, item_ids: ["001", "002", "004", "006"] }, "en");
    for (const f of fs) expect(f.plan.item_ids.length).toBeLessThanOrEqual(4);
  });
});

describe("headline cards", () => {
  it("computes the 2026 population and the latest inflation", () => {
    const hv = highlightValues();
    const pop = hv.find((v) => v.h.id === "pop")!;
    expect(pop.year).toBe(2026);
    expect(pop.value).toBe(10262.4);
    expect(hv.find((v) => v.h.id === "cpi")!.year).toBe(2025);
    for (const v of hv) expect(answerLocally(v.plan, "az").ok).toBe(true);
  });
});

describe("csv", () => {
  it("has a header and one row per year", () => {
    const a = answerLocally(cpi, "en");
    if (!a.ok) throw new Error("expected ok");
    const lines = toCsv(a.chart, "Year").trim().split("\n");
    expect(lines[0]).toContain("Year");
    expect(lines).toHaveLength(11);
  });
});
