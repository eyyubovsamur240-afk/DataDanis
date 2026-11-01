// Downloads fresh azstat snapshots for every dataset in catalog.yaml into
// data/cache/. Run from a computer in Azerbaijan (some servers abroad are
// blocked):  npm run fetch-data && npm run data && npm test
// Then check the ✓ lines from `npm run data` and commit data/cache/.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const catalog = yaml.load(fs.readFileSync(path.join(root, "catalog.yaml"), "utf8"));
const dir = path.join(root, "data/cache");
fs.mkdirSync(dir, { recursive: true });

let failed = 0;
for (const ds of catalog.datasets) {
  const url = `https://www.azstat.gov.az/AsisOpenDataApi/data?table_id=${ds.id}&lang=az`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) throw new Error("empty or unsuccessful response");
    fs.writeFileSync(path.join(dir, `${ds.id}_az.json`), JSON.stringify(json, null, 1));
    console.log(`✓ ${ds.id}: ${json.data.length} rows`);
  } catch (err) {
    failed++;
    console.error(`✗ ${ds.id}: ${err.message} — kept the old snapshot`);
  }
}

const manifest = {
  fetched_at: new Date().toISOString().slice(0, 10),
  source: "https://www.azstat.gov.az/AsisOpenDataApi/data?table_id={ID}&lang=az",
  note: "Raw azstat JSON snapshots. Refresh with `npm run fetch-data` from a computer in Azerbaijan, then `npm run data`.",
};
if (!failed) fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
process.exit(failed ? 1 : 0);
