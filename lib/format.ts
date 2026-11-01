import type { Lang } from "./catalog";

/**
 * Formats a number the way people write it in each language:
 * AZ "10 262,4" (space groups, comma decimal) · EN "10,262.4".
 * Done by hand so server and browser always agree (browsers differ in locale data).
 */
export function fmt(value: number, lang: Lang, maxDecimals = 2): string {
  const neg = value < 0;
  let fixed = Math.abs(value).toFixed(maxDecimals);
  if (fixed.includes(".")) fixed = fixed.replace(/\.?0+$/, "");
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "az" ? "\u00a0" : ",");
  const out = dec ? `${grouped}${lang === "az" ? "," : "."}${dec}` : grouped;
  return neg ? `−${out}` : out;
}

/** Signed percentage, e.g. "+5,6%" / "−2.1%". */
export function fmtPct(value: number, lang: Lang): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fmt(Math.abs(value), lang, 1)}%`;
}

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

// Azerbaijani ordinal suffix follows the vowel of the last spoken number word:
// 2026 → "2026-cı" (altı), 2023 → "2023-cü" (üç), 2010 → "2010-cu" (on), 2000 → "2000-ci" (min).
const ONES = ["", "ci", "ci", "cü", "cü", "ci", "cı", "ci", "ci", "cu"];
const TENS = ["", "cu", "ci", "cu", "cı", "ci", "cı", "ci", "ci", "cı"];
export function azOrdinal(n: number): string {
  const ones = n % 10;
  const tens = Math.floor(n / 10) % 10;
  const hundreds = Math.floor(n / 100) % 10;
  let suffix: string;
  if (ones) suffix = ONES[ones];
  else if (tens) suffix = TENS[tens];
  else if (hundreds) suffix = "cü"; // yüz
  else suffix = "ci"; // min
  return `${n}-${suffix}`;
}

/** "2026-cı ildə" / "in 2026" */
export function inYear(y: number, lang: "az" | "en"): string {
  return lang === "az" ? `${azOrdinal(y)} ildə` : `in ${y}`;
}
