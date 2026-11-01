// Official daily exchange rates of the Central Bank of Azerbaijan (CBAR).
// CBAR publishes one XML file per day: https://www.cbar.az/currencies/DD.MM.YYYY.xml
// Values are manats per `nominal` units of the currency (e.g. 100 RUB).
// Parsing and every conversion are plain code; no AI touches these numbers.
import snapshot from "../data/cache/cbar_latest.json";

export interface Rate {
  code: string;
  nominal: number;
  name_az: string;
  /** manats for `nominal` units */
  value: number;
}

export interface RatesData {
  /** DD.MM.YYYY, the date CBAR set these rates for */
  date: string;
  source_url: string;
  /** live = fetched from cbar.az just now (cached for an hour); snapshot = the copy bundled with the app */
  origin: "live" | "snapshot";
  rates: Rate[];
}

export const RATES_SNAPSHOT: RatesData = { ...(snapshot as Omit<RatesData, "origin">), origin: "snapshot" };

/** Currencies shown first in the card and the converter. */
export const MAIN_CODES = ["USD", "EUR", "RUB", "TRY", "GBP", "GEL"];

export function cbarUrl(date: string): string {
  return `https://www.cbar.az/currencies/${date}.xml`;
}

/** Today's date in Baku as DD.MM.YYYY. */
export function bakuDate(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

/** Parses the CBAR XML. Only foreign currencies are kept (bank metals are skipped). */
export function parseCbarXml(xml: string): { date: string; rates: Rate[] } | null {
  const date = /<ValCurs[^>]*\sDate="(\d{2}\.\d{2}\.\d{4})"/.exec(xml)?.[1];
  const block = /<ValType Type="Xarici valyutalar">([\s\S]*?)<\/ValType>/.exec(xml)?.[1];
  if (!date || !block) return null;
  const rates: Rate[] = [];
  for (const m of block.matchAll(/<Valute Code="([A-Z]{3})">([\s\S]*?)<\/Valute>/g)) {
    const body = m[2];
    const nominal = Number(/<Nominal>\s*([\d.]+)/.exec(body)?.[1]);
    const name = /<Name>\s*([^<]+?)\s*<\/Name>/.exec(body)?.[1] ?? m[1];
    const value = Number(/<Value>\s*([\d.]+)\s*<\/Value>/.exec(body)?.[1]);
    if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) continue;
    rates.push({ code: m[1], nominal, name_az: name.replace(/^\d+\s+/, ""), value });
  }
  return rates.length ? { date, rates } : null;
}

/** Manats for one unit of the currency. */
export function perUnit(r: Rate): number {
  return r.value / r.nominal;
}

export function currencyName(r: Rate, lang: "az" | "en"): string {
  if (lang === "az") return r.name_az;
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(r.code) ?? r.code;
  } catch {
    return r.code;
  }
}

// ── Chat shortcut: "what is the dollar rate today?" ─────────────────────────
// Answered from the CBAR file with no AI call. Questions with a year or about
// a change over time still go to the planner (annual table DT_BK_011).
const CURRENCY_WORDS: [RegExp, string][] = [
  [/dollar|dolları|dolar|usd|\$|доллар/i, "USD"],
  [/avro|euro|eur\b|€|евро/i, "EUR"],
  [/rubl|rub\b|рубл/i, "RUB"],
  [/lirə|lira|try\b|лир/i, "TRY"],
  [/funt|pound|sterling|gbp|фунт/i, "GBP"],
  [/lari|gel\b|лари/i, "GEL"],
  [/yuan|cny|юан/i, "CNY"],
  [/tenge|tengə|kzt|тенге/i, "KZT"],
  [/dirhəm|dirham|aed/i, "AED"],
];
const RATE_WORD = /məzənnə|mezenne|kurs|exchange rate|\brate\b|курс|neçə manat|how many manats/i;
const NOW_WORD = /bu ?gün|bugun|indi|hazırda|hazirda|cari|today|current|right now|\bnow\b|latest|сегодня|сейчас|текущ/i;
// Questions about other statistics that merely mention dollars ("GDP in dollars now")
const OTHER_TOPIC = /üdm|udm|gdp|ввп|maaş|maas|əməkhaq|wage|salary|зарплат|gəlir|income|ixrac|export|idxal|import|pensiya|pension|ticarət|trade|qiymət|price|inflyas|inflation/i;
const TIME_SPAN = /\b(19|20)\d{2}\b|dəyiş|deyis|change|trend|since|ildən|son \d+ il|last \d+ years|illik|annual|orta|average|динамик/i;

export function rateIntent(question: string): string[] | null {
  if (TIME_SPAN.test(question) || OTHER_TOPIC.test(question)) return null;
  const codes = CURRENCY_WORDS.filter(([re]) => re.test(question)).map(([, c]) => c);
  const rateish = RATE_WORD.test(question) || codes.length > 0;
  if (!rateish || !NOW_WORD.test(question)) return null;
  return codes.length ? codes : ["USD", "EUR", "RUB"];
}
