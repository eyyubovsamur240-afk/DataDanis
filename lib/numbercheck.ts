// Checks that every number in an AI-written answer comes from the computed
// result. If one doesn't, the app shows a template answer instead.

// A number: digits, optionally grouped by spaces/dots/commas, optional decimals.
const NUMBER_RE = /\d(?:[\d   ]*[\d])?(?:[.,]\d+)*/g;

/** All plausible readings of a number as written in AZ or EN style. */
export function readings(token: string): number[] {
  const t = token.replace(/[   ]/g, "");
  const out = new Set<number>();
  // EN style: 1,103.2  → comma groups, dot decimal
  const en = Number(t.replace(/,/g, ""));
  if (Number.isFinite(en)) out.add(en);
  // AZ/EU style: 1.103,2 → dot groups, comma decimal
  const az = Number(t.replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(az)) out.add(az);
  return [...out];
}

export function extractNumbers(text: string): string[] {
  return text.match(NUMBER_RE) ?? [];
}

function matches(n: number, allowed: number[]): boolean {
  return allowed.some((a) => {
    const v = Math.abs(a);
    return [0, 1, 2].some((d) => Math.abs(Number(v.toFixed(d)) - n) < 1e-9) || Math.abs(v - n) < 1e-9;
  });
}

/** Returns the numbers in `text` that are not backed by `allowed`. Empty = pass. */
export function unbackedNumbers(text: string, allowed: number[]): string[] {
  return extractNumbers(text).filter((tok) => {
    const rs = readings(tok);
    // small counting words ("3 sectors", "10 years") are fine
    if (rs.some((r) => Number.isInteger(r) && r >= 0 && r <= 12)) return false;
    return !rs.some((r) => matches(r, allowed));
  });
}
