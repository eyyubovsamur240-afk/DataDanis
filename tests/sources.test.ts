import { describe, it, expect } from "vitest";
import { execute, allowedNumbers, type Result } from "@/lib/executor";
import { templateAnswer } from "@/lib/templates";
import { unbackedNumbers } from "@/lib/numbercheck";
import { getDataset } from "@/lib/catalog";
import { parseCbarXml, rateIntent, perUnit, RATES_SNAPSHOT } from "@/lib/rates";
import { decodePlan, encodePlan } from "@/lib/share";
import { followUps } from "@/lib/followups";
import type { Plan } from "@/lib/plan";

const base: Plan = {
  can_answer: true,
  reason: "",
  answer_language: "en",
  dataset_id: "DT_AB_080",
  item_ids: [],
  operation: "rank",
  year_from: null,
  year_to: null,
  extreme: "max",
  chart_type: "bar",
};

function ok(p: Partial<Plan>): Result {
  const r = execute({ ...base, ...p });
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
}

describe("regional tables", () => {
  it("regional wage total matches the national wage table (2024 = 1009.4)", () => {
    const r = ok({ operation: "value", item_ids: ["001"], year_to: 2024, chart_type: "kpi" });
    expect(r.facts[0].to).toEqual({ year: 2024, value: 1009.4 });
    expect(getDataset("DT_AB_036")!.series["001"]["2024"]).toBe(1009.4);
  });

  it("ranks every region in the latest year, highest first", () => {
    const r = ok({});
    expect(r.year_to).toBe(2024);
    expect(r.ranking).toHaveLength(15);
    const vals = r.ranking!.map((x) => x.value);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
    expect(r.series.map((s) => s.item_id)).toEqual(r.ranking!.map((x) => x.item_id));
    expect(r.chart.type).toBe("bar");
    expect(r.ranking!.find((x) => x.item_id === "001")!.total).toBe(true);
  });

  it("never calls the whole-country row the highest or lowest", () => {
    const r = ok({});
    const text = templateAnswer(r);
    const realTop = r.ranking!.filter((x) => !x.total)[0];
    expect(text).toContain(realTop.label);
    expect(text).toMatch(/highest was/);
    expect(unbackedNumbers(text, allowedNumbers(r))).toEqual([]);
  });

  it("ranks unemployment rate by region and keeps a 4-item limit outside rank", () => {
    expect(ok({ dataset_id: "DT_AB_076" }).ranking!.length).toBe(15);
    const many = Object.keys(getDataset("DT_AB_076")!.items);
    const r = ok({ dataset_id: "DT_AB_076", operation: "compare", item_ids: many, year_to: 2025 });
    expect(r.series).toHaveLength(4);
  });

  it("internet table keeps only the both-sexes total (2025 country = 91.5)", () => {
    const r = ok({ dataset_id: "DT_CC_005", operation: "value", item_ids: ["001"], year_to: 2025, chart_type: "kpi" });
    expect(r.facts[0].to?.value).toBe(91.5);
  });
});

describe("national tables", () => {
  it("splits poverty rate and poverty line from one azstat table", () => {
    expect(ok({ dataset_id: "DT_CA_020", operation: "value", item_ids: ["002"], year_to: 2025 }).facts[0].to?.value).toBe(5.2);
    const line = ok({ dataset_id: "DT_CA_020_LINE", operation: "value", item_ids: ["001"], year_to: 2025 });
    expect(line.facts[0].to?.value).toBe(286);
    expect(line.unit).toBe("manat");
    expect(getDataset("DT_CA_020_LINE")!.data_url).toContain("table_id=DT_CA_020&");
  });

  it("foreign trade uses customs figures in million USD", () => {
    const r = ok({ dataset_id: "DT_BH_011", operation: "value", item_ids: ["001001003"], year_to: 2025 });
    expect(r.facts[0].to?.value).toBe(25042.8);
  });

  it("electricity consumption 2025", () => {
    expect(ok({ dataset_id: "DT_BD_001", operation: "value", item_ids: ["001"], year_to: 2025 }).facts[0].to?.value).toBe(25426.4);
  });
});

describe("World Bank comparisons", () => {
  it("compares GDP per person and credits the World Bank", () => {
    const r = ok({ dataset_id: "WB_GDP_PC", operation: "compare", item_ids: ["AZE", "GEO"], year_to: 2025 });
    expect(r.facts[0].to).toEqual({ year: 2025, value: 7410.72 });
    expect(r.source.name).toBe("World Bank");
    expect(r.source.url).toContain("data.worldbank.org/indicator/NY.GDP.PCAP.CD");
  });

  it("ranks countries, world average marked as a total", () => {
    const r = ok({ dataset_id: "WB_UNEMPLOYMENT" });
    expect(r.ranking).toHaveLength(8);
    expect(r.ranking!.find((x) => x.item_id === "WLD")!.total).toBe(true);
    expect(templateAnswer(r)).not.toMatch(/highest was World/);
  });

  it("azstat answers still credit opendata.az", () => {
    expect(ok({ operation: "value", item_ids: ["001"] }).source.name).toBe("opendata.az");
  });
});

describe("rank plans in links and follow-ups", () => {
  it("round-trips a rank share link", () => {
    const p = decodePlan(encodePlan({ ...base, year_to: 2020 }));
    expect(p).toMatchObject({ dataset_id: "DT_AB_080", operation: "rank", item_ids: [], year_to: 2020 });
  });

  it("offers the country trend and other years after a ranking", () => {
    const keys = followUps({ ...base, year_to: 2024 }, "en").map((f) => f.key);
    expect(keys).toContain("trend");
    expect(keys).toContain("rank-first");
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<ValCurs Date="30.10.2026" Name="AZN məzənnələri">
  <ValType Type="Bank metalları">
    <Valute Code="XAU"><Nominal>1 t.u.</Nominal><Name>Qızıl</Name><Value>6796.43</Value></Valute>
  </ValType>
  <ValType Type="Xarici valyutalar">
    <Valute Code="USD">
      <Nominal>1</Nominal>
      <Name>1 ABŞ dolları</Name>
      <Value>1.7</Value>
    </Valute>
    <Valute Code="RUB"><Nominal>100</Nominal><Name>100 Rusiya rublu</Name><Value>2.0923</Value></Valute>
  </ValType>
</ValCurs>`;

describe("CBAR rates", () => {
  it("parses foreign currencies and skips bank metals", () => {
    const p = parseCbarXml(XML)!;
    expect(p.date).toBe("30.10.2026");
    expect(p.rates.map((r) => r.code)).toEqual(["USD", "RUB"]);
    expect(p.rates[1]).toEqual({ code: "RUB", nominal: 100, name_az: "Rusiya rublu", value: 2.0923 });
    expect(perUnit(p.rates[1])).toBeCloseTo(0.020923, 6);
  });

  it("returns null for a page that is not a rates file", () => {
    expect(parseCbarXml("<html>blocked</html>")).toBeNull();
  });

  it("bundled snapshot has the dollar", () => {
    expect(RATES_SNAPSHOT.rates.find((r) => r.code === "USD")?.value).toBe(1.7);
  });

  it("spots today's-rate questions and leaves history to the planner", () => {
    expect(rateIntent("Bu gün dollar neçə manatdır?")).toEqual(["USD"]);
    expect(rateIntent("What is the euro rate today?")).toEqual(["EUR"]);
    expect(rateIntent("Курс рубля сегодня")).toEqual(["RUB"]);
    expect(rateIntent("indiki məzənnə")).toEqual(["USD", "EUR", "RUB"]);
    expect(rateIntent("Bu gün Bakıda neçə nəfər yaşayır?")).toBeNull();
    expect(rateIntent("Adambaşına ÜDM dollarla indi nə qədərdir?")).toBeNull();
    expect(rateIntent("What is GDP per person in dollars now?")).toBeNull();
    expect(rateIntent("hazırda məzənnələr necədir")).toEqual(["USD", "EUR", "RUB"]);
    expect(rateIntent("How many manats was one dollar in 2005, and now?")).toBeNull();
    expect(rateIntent("Dolların məzənnəsi son 10 ildə necə dəyişib?")).toBeNull();
    expect(rateIntent("Son 10 ildə inflyasiya necə dəyişib?")).toBeNull();
  });
});
