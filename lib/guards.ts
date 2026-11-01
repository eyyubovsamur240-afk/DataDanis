import "server-only";
// Simple abuse limits so a public demo can't run up the API bill.
// Note: on Vercel each server instance keeps its own counters, so these are
// soft limits. The hard backstop is the monthly spend limit in the AI
// provider's console.
export { MAX_QUESTION_CHARS } from "./guards-shared";
const PER_DAY = Number(process.env.MAX_QUESTIONS_PER_DAY ?? 1500);
const PER_VISITOR_HOUR = Number(process.env.MAX_QUESTIONS_PER_VISITOR_PER_HOUR ?? 20);

let day = "";
let dayCount = 0;
const visitors = new Map<string, number[]>();

export type LimitResult = "ok" | "daily_limit" | "visitor_limit";

export function checkLimits(visitor: string, now = Date.now()): LimitResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
    visitors.clear();
  }
  if (dayCount >= PER_DAY) return "daily_limit";
  const hourAgo = now - 3_600_000;
  const times = (visitors.get(visitor) ?? []).filter((t) => t > hourAgo);
  if (times.length >= PER_VISITOR_HOUR) return "visitor_limit";
  times.push(now);
  visitors.set(visitor, times);
  dayCount++;
  return "ok";
}

/** NFC-normalise, collapse whitespace, trim. Keeps ə/ı/ğ etc. intact. */
export function normaliseQuestion(q: string): string {
  return q.normalize("NFC").replace(/\s+/g, " ").trim();
}

// In-memory answer cache: a repeated question skips both AI calls.
// The key ignores case, punctuation and the special Azerbaijani letters, so
// "Torpaq təyinatı?" and "torpaq teyinati" share one entry.
const FOLD: Record<string, string> = { ə: "e", ı: "i", ğ: "g", ö: "o", ü: "u", ç: "c", ş: "s", i̇: "i" };
export function cacheKey(q: string): string {
  return q
    .toLocaleLowerCase("az")
    .replace(/[əığöüçş]|i̇/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const MAX_CACHE = 3000;
const cache = new Map<string, unknown>();
export function cached<T>(q: string): T | undefined {
  return cache.get(cacheKey(q)) as T | undefined;
}
export function remember(q: string, value: unknown) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey(q), value);
}
