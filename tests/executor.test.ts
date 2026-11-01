import { describe, it, expect } from "vitest";
import { execute, allowedNumbers, type Result } from "@/lib/executor";
import { templateAnswer } from "@/lib/templates";
import { unbackedNumbers, readings } from "@/lib/numbercheck";
import { EXAMPLES } from "@/lib/examples";
import type { Plan } from "@/lib/plan";

const base: Plan = {
  can_answer: true,
  reason: "",
  answer_language: "en",
  dataset_id: "DT_AA_001",
  item_ids: ["001"],
  operation: "value",
  year_from: null,
  year_to: null,
  extreme: null,
  chart_type: "kpi",
};

function ok(p: Partial<Plan>): Result {
  const r = execute({ ...base, ...p });
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
}

describe("executor", () => {
  it("returns the 2026 population (published figure: 10,262.4 thousand)", () => {
    const r = ok({ year_to: 2026 });
    expect(r.facts[0].to).toEqual({ year: 2026, value: 10262.4 });
    expect(r.chart.type).toBe("kpi");
  });

  it("defaults to the latest year when none is given", () => {
    expect(ok({}).facts[0].to?.year).toBe(2026);
  });

  it("shows CPI as % change: 2022 = +13.9, 2025 = +5.6", () => {
    const r = ok({ dataset_id: "DT_BL_001", operation: "trend", year_from: 2016, year_to: 2025, chart_type: "line" });
    expect(r.shown_as_pct_change).toBe(true);
    const pts = Object.fromEntries(r.series[0].points.map((p) => [p.year, p.value]));
    expect(pts[2022]).toBe(13.9);
    expect(pts[2025]).toBe(5.6);
    expect(r.facts[0].max).toEqual({ year: 2022, value: 13.9 });
  });

  it("computes the dollar change 2005 → latest", () => {
    const r = ok({ dataset_id: "DT_BK_011", operation: "change", year_from: 2005, year_to: null, chart_type: "line" });
    expect(r.facts[0].from?.value).toBe(0.95);
    expect(r.facts[0].to).toEqual({ year: 2025, value: 1.7 });
  });

  it("uses the first (all-ownership) wage row: 2024 = 1009.4 AZN", () => {
    const r = ok({ dataset_id: "DT_AB_036", year_to: 2024 });
    expect(r.facts[0].to?.value).toBe(1009.4);
  });

  it("refuses a year outside the data and reports the covered range", () => {
    const r = execute({ ...base, dataset_id: "DT_BK_011", item_ids: ["001"], year_to: 1990 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("year_not_covered");
      expect(r.detail?.year_min).toBe(2005);
    }
  });

  it("rejects an item id that isn't in the catalog", () => {
    const r = execute({ ...base, item_ids: ["999"] });
    expect(r.ok).toBe(false);
  });

  it("passes through can_answer=false", () => {
    const r = execute({ ...base, can_answer: false, dataset_id: "none" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cannot_answer");
  });

  it("only uses annual GDP rows (no quarterly or monthly)", () => {
    const r = ok({ dataset_id: "DT_BA_006", operation: "trend", year_from: 2020, year_to: 2025 });
    expect(r.series[0].points.map((p) => p.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("every example question runs in both languages", () => {
    for (const ex of EXAMPLES) {
      for (const lang of ["az", "en"] as const) {
        const r = execute({ ...ex.plan, answer_language: lang });
        expect(r.ok, ex.id).toBe(true);
        if (r.ok) expect(templateAnswer(r).length).toBeGreaterThan(10);
      }
    }
  });
});

describe("number check", () => {
  const r = ok({ dataset_id: "DT_AA_011", item_ids: ["003", "002"], operation: "compare", chart_type: "bar" });
  const allowed = allowedNumbers(r);

  it("reads AZ and EN number styles", () => {
    expect(readings("1 103,2")).toContain(1103.2);
    expect(readings("1,103.2")).toContain(1103.2);
    expect(readings("10 262,4")).toContain(10262.4);
    expect(readings("10\u00a0262,4")).toContain(10262.4);
  });

  it("accepts numbers from the data, in either style", () => {
    expect(unbackedNumbers("In 2025 women lived 79.3 years and men 74.9, a gap of 4.4 years.", allowed)).toEqual([]);
    expect(unbackedNumbers("2025-ci ildə qadınlar 79,3, kişilər 74,9 il yaşayıb.", allowed)).toEqual([]);
  });

  it("flags an invented number", () => {
    expect(unbackedNumbers("Women live 81.2 years.", allowed)).toEqual(["81.2"]);
  });

  it("template answers always pass their own check", () => {
    for (const ex of EXAMPLES) {
      const res = execute({ ...ex.plan, answer_language: "az" });
      if (res.ok) expect(unbackedNumbers(templateAnswer(res), allowedNumbers(res))).toEqual([]);
    }
  });
});

import { azOrdinal } from "@/lib/format";
describe("Azerbaijani year suffix", () => {
  it("follows vowel harmony", () => {
    expect(azOrdinal(2026)).toBe("2026-cı");
    expect(azOrdinal(2025)).toBe("2025-ci");
    expect(azOrdinal(2023)).toBe("2023-cü");
    expect(azOrdinal(2019)).toBe("2019-cu");
    expect(azOrdinal(2010)).toBe("2010-cu");
    expect(azOrdinal(2020)).toBe("2020-ci");
    expect(azOrdinal(1990)).toBe("1990-cı");
    expect(azOrdinal(2000)).toBe("2000-ci");
    expect(azOrdinal(2024)).toBe("2024-cü");
  });
});

import { fmt } from "@/lib/format";
describe("number formatting", () => {
  it("formats AZ and EN styles", () => {
    expect(fmt(10262.4, "az")).toBe("10 262,4");
    expect(fmt(10262.4, "en")).toBe("10,262.4");
    expect(fmt(1.7, "az")).toBe("1,7");
    expect(fmt(1000, "en")).toBe("1,000");
    expect(fmt(0.95, "en")).toBe("0.95");
    expect(fmt(1000, "en", 0)).toBe("1,000");
    expect(fmt(-2.5, "az")).toBe("−2,5");
  });
});
