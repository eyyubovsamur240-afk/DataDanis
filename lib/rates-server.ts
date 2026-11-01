import "server-only";
import { RATES_SNAPSHOT, bakuDate, cbarUrl, parseCbarXml, type RatesData } from "./rates";

/** Live CBAR rates for today (Baku time), cached for an hour; falls back to the bundled snapshot. */
export async function getRates(): Promise<RatesData> {
  const date = bakuDate();
  const url = cbarUrl(date);
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseCbarXml(await res.text());
    if (!parsed) throw new Error("unexpected XML");
    return { date: parsed.date, source_url: url, origin: "live", rates: parsed.rates };
  } catch (err) {
    console.warn("CBAR rates unavailable, using the bundled snapshot", err instanceof Error ? err.message : err);
    return RATES_SNAPSHOT;
  }
}
