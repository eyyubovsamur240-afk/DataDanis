// Builds lib/generated/datasets.json from catalog.yaml + the raw azstat and
// World Bank snapshots in data/cache/. Run with `npm run data` (also runs on build).
// Fails loudly if a catalog item is missing from the data, so a bad refresh
// can never reach the live site.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const catalog = yaml.load(fs.readFileSync(path.join(root, "catalog.yaml"), "utf8"));
const manifestPath = path.join(root, "data/cache/manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};

const out = { fetched_at: manifest.fetched_at ?? null, datasets: [] };
let problems = 0;
// data.worldbank.org links use 2-letter codes
const WB_ISO2 = { AZE: "AZ", GEO: "GE", ARM: "AM", TUR: "TR", KAZ: "KZ", UZB: "UZ", RUS: "RU" };

// World Bank values come with up to 15 decimals; keep 2 (enough for every indicator we use).
const round2 = (v) => Math.round(v * 100) / 100;

/** azstat JSON → { level_1_id: { year: value } } */
function azstatSeries(ds, raw) {
  const series = {};
  for (const row of raw.data) {
    if (row.period_type !== "Y") continue; // v1 only handles annual data
    if (ds.filter && Object.entries(ds.filter).some(([k, v]) => row[k] !== v)) continue;
    const lvl = row.level_1_id;
    if (!(lvl in ds.items)) continue;
    const year = Number(row.period);
    series[lvl] ??= {};
    // first_row_only: keep the first row for a (item, year); the JSON repeats
    // rows when it drops a dimension (see the catalog notes).
    if (year in series[lvl]) {
      if (ds.first_row_only) continue;
      console.error(`✗ ${ds.id}: duplicate row for item ${lvl} year ${year} (set first_row_only or a filter after checking)`);
      problems++;
      continue;
    }
    series[lvl][year] = row.value === null || row.value === undefined ? null : Number(row.value);
  }
  return series;
}

/** World Bank API JSON ([meta, rows]) → { iso3: { year: value } } */
function worldBankSeries(ds, raw) {
  const series = {};
  for (const row of raw[1] ?? []) {
    const c = row.countryiso3code;
    if (!(c in ds.items) || row.value === null) continue;
    series[c] ??= {};
    series[c][Number(row.date)] = round2(Number(row.value));
  }
  return series;
}

for (const ds of catalog.datasets) {
  const wb = ds.source === "worldbank";
  const table = ds.table ?? ds.id;
  const file = path.join(root, wb ? `data/cache/WB_${ds.indicator}.json` : `data/cache/${table}_az.json`);
  if (!fs.existsSync(file)) {
    console.error(`✗ ${ds.id}: no snapshot at ${file}`);
    problems++;
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const series = wb ? worldBankSeries(ds, raw) : azstatSeries(ds, raw);
  for (const lvl of Object.keys(ds.items)) {
    if (!series[lvl] || Object.keys(series[lvl]).length === 0) {
      console.error(`✗ ${ds.id}: item ${lvl} (${ds.items[lvl].az}) not found in data`);
      problems++;
    } else {
      const years = Object.keys(series[lvl]).map(Number);
      const names = wb ? [lvl] : [...new Set(raw.data.filter((r) => r.level_1_id === lvl).map((r) => r.item.replace(/\s+/g, " ")))];
      console.log(`✓ ${ds.id} ${lvl} ${ds.items[lvl].en.padEnd(42)} ← "${names.join(" | ")}" ${Math.min(...years)}–${Math.max(...years)}`);
    }
  }
  const years = Object.values(series).flatMap((s) => Object.keys(s).map(Number));
  const countries = Object.keys(ds.items).filter((c) => c !== "WLD").join(";");
  out.datasets.push({
    id: ds.id,
    title_az: ds.title_az,
    title_en: ds.title_en,
    synonyms: ds.synonyms ?? [],
    unit_az: ds.unit_az,
    unit_en: ds.unit_en,
    value_kind: ds.value_kind,
    default_item: ds.default_item,
    totals: ds.totals ?? [],
    notes: ds.notes ?? null,
    source_name: wb ? "World Bank" : "opendata.az",
    source_url: wb
      ? `https://data.worldbank.org/indicator/${ds.indicator}?locations=${Object.keys(ds.items).filter((c) => c !== "WLD").map((c) => WB_ISO2[c]).join("-")}`
      : `https://opendata.az/dataset/${ds.slug}`,
    data_url: wb
      ? `https://api.worldbank.org/v2/country/${countries}/indicator/${ds.indicator}?format=json`
      : `https://www.azstat.gov.az/AsisOpenDataApi/data?table_id=${table}&lang=az`,
    year_min: Math.min(...years),
    year_max: Math.max(...years),
    items: Object.fromEntries(Object.entries(ds.items).map(([k, v]) => [k, { az: v.az, en: v.en }])),
    series,
  });
}

fs.mkdirSync(path.join(root, "lib/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "lib/generated/datasets.json"), JSON.stringify(out));
console.log(`\n${out.datasets.length} datasets written to lib/generated/datasets.json`);
if (problems) {
  console.error(`${problems} problem(s) found`);
  process.exit(1);
}
