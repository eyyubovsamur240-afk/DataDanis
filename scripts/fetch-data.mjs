// Downloads fresh snapshots for every dataset in catalog.yaml into data/cache/:
//   - azstat tables (run from a computer in Azerbaijan; some servers abroad are blocked)
//   - World Bank indicators (work from anywhere)
//   - today's Central Bank (CBAR) exchange rates, the fallback copy for the rates card
// Then:  npm run data && npm test   — check the ✓ lines and commit data/cache/.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const catalog = yaml.load(fs.readFileSync(path.join(root, "catalog.yaml"), "utf8"));
const dir = path.join(root, "data/cache");
fs.mkdirSync(dir, { recursive: true });

let failed = 0;
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const seen = new Set();
for (const ds of catalog.datasets) {
  try {
    if (ds.source === "worldbank") {
      const countries = Object.keys(ds.items).join(";");
      const url = `https://api.worldbank.org/v2/country/${countries}/indicator/${ds.indicator}?format=json&per_page=1000&date=2000:${new Date().getFullYear()}`;
      const json = await getJson(url);
      if (!Array.isArray(json) || !Array.isArray(json[1]) || json[1].length === 0) throw new Error("empty response");
      fs.writeFileSync(path.join(dir, `WB_${ds.indicator}.json`), JSON.stringify(json, null, 1));
      console.log(`✓ ${ds.id}: ${json[1].length} rows`);
      continue;
    }
    const table = ds.table ?? ds.id;
    if (seen.has(table)) continue; // two catalog entries can share one table
    seen.add(table);
    const json = await getJson(`https://www.azstat.gov.az/AsisOpenDataApi/data?table_id=${table}&lang=az`);
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) throw new Error("empty or unsuccessful response");
    fs.writeFileSync(path.join(dir, `${table}_az.json`), JSON.stringify(json, null, 1));
    console.log(`✓ ${table}: ${json.data.length} rows`);
  } catch (err) {
    failed++;
    console.error(`✗ ${ds.id}: ${err.message} — kept the old snapshot`);
  }
}

// CBAR: today's rates (Baku date), saved in the same shape as lib/rates.ts expects.
try {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  const date = `${g("day")}.${g("month")}.${g("year")}`;
  const url = `https://www.cbar.az/currencies/${date}.xml`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const block = /<ValType Type="Xarici valyutalar">([\s\S]*?)<\/ValType>/.exec(xml)?.[1] ?? "";
  const rates = [...block.matchAll(/<Valute Code="([A-Z]{3})">([\s\S]*?)<\/Valute>/g)].map((m) => ({
    code: m[1],
    nominal: Number(/<Nominal>\s*([\d.]+)/.exec(m[2])?.[1]),
    name_az: (/<Name>\s*([^<]+?)\s*<\/Name>/.exec(m[2])?.[1] ?? m[1]).replace(/^\d+\s+/, ""),
    value: Number(/<Value>\s*([\d.]+)\s*<\/Value>/.exec(m[2])?.[1]),
  })).filter((r) => r.nominal > 0 && r.value > 0);
  if (!rates.length) throw new Error("no rates in the file");
  const note = "Fallback copy of the Central Bank of Azerbaijan official rates, used only when the live CBAR file can't be reached. Refreshed by `npm run fetch-data`.";
  fs.writeFileSync(path.join(dir, "cbar_latest.json"), JSON.stringify({ date, source_url: url, note, rates }, null, 1) + "\n");
  console.log(`✓ CBAR ${date}: ${rates.length} currencies`);
} catch (err) {
  failed++;
  console.error(`✗ CBAR: ${err.message} — kept the old snapshot`);
}

const manifest = {
  fetched_at: new Date().toISOString().slice(0, 10),
  sources: {
    azstat: "https://www.azstat.gov.az/AsisOpenDataApi/data?table_id={ID}&lang=az (CC0, via opendata.az)",
    worldbank: "https://api.worldbank.org/v2/country/{ISO3;...}/indicator/{CODE}?format=json (CC BY 4.0)",
    cbar: "https://www.cbar.az/currencies/{DD.MM.YYYY}.xml (official rates; the app reads it live, this copy is the fallback)",
  },
  note: "Raw snapshots. Refresh with `npm run fetch-data` from a computer in Azerbaijan, then `npm run data`.",
};
if (!failed) fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
process.exit(failed ? 1 : 0);
