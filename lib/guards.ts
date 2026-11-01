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

// Small in-memory answer cache: identical questions skip both AI calls.
const cache = new Map<string, unknown>();
export function cached<T>(key: string): T | undefined {
  return cache.get(key.toLocaleLowerCase("az")) as T | undefined;
}
export function remember(key: string, value: unknown) {
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(key.toLocaleLowerCase("az"), value);
}
