"use client";
import { useMemo, useState } from "react";
import { DATASETS, getDataset, yearsWithData, type Lang } from "@/lib/catalog";
import { UI } from "@/lib/i18n";
import type { PlanInput } from "@/lib/local";

export default function Explorer({ lang, onRun }: { lang: Lang; onRun: (label: string, plan: PlanInput) => void }) {
  const t = UI[lang];
  const [dsId, setDsId] = useState(DATASETS[0].id);
  const ds = getDataset(dsId)!;
  const [items, setItems] = useState<string[]>([ds.default_item]);
  const [chart, setChart] = useState<"line" | "bar" | "table">("line");

  const years = useMemo(() => {
    const ys = [...new Set((items.length ? items : [ds.default_item]).flatMap((id) => yearsWithData(ds, id)))].sort((a, b) => a - b);
    return ys.length ? ys : [ds.year_min, ds.year_max];
  }, [ds, items]);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const yFrom = from !== null && years.includes(from) ? from : years[Math.max(0, years.length - 10)];
  const yTo = to !== null && years.includes(to) ? to : years[years.length - 1];

  function pickDataset(id: string) {
    const next = getDataset(id)!;
    setDsId(id);
    setItems([next.default_item]);
    setFrom(null);
    setTo(null);
  }
  function toggle(id: string) {
    setItems((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= 4 ? xs : [...xs, id]));
  }
  function run() {
    const ids = items.length ? items : [ds.default_item];
    const [a, b] = yFrom <= yTo ? [yFrom, yTo] : [yTo, yFrom];
    const name = lang === "az" ? ds.title_az : ds.title_en;
    onRun(`${name} · ${a === b ? a : `${a}–${b}`}`, {
      can_answer: true,
      reason: "explorer",
      dataset_id: ds.id,
      item_ids: ids,
      operation: a === b ? "compare" : "trend",
      year_from: a === b ? null : a,
      year_to: b,
      extreme: null,
      chart_type: a === b && chart === "line" ? "bar" : chart,
    });
  }

  return (
    <section className="explorer card">
      <h2>{t.exploreTitle}</h2>
      <p className="muted">{t.exploreSub}</p>
      <label className="field">
        <span>{t.exploreTable}</span>
        <select value={dsId} onChange={(e) => pickDataset(e.target.value)}>
          {DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {lang === "az" ? d.title_az : d.title_en}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field">
        <legend>{t.exploreFigures}</legend>
        <div className="checks">
          {Object.entries(ds.items).map(([id, l]) => {
            const on = items.includes(id);
            const empty = !yearsWithData(ds, id).length;
            return (
              <label key={id} className={`check-chip ${on ? "on" : ""}`}>
                <input type="checkbox" checked={on} disabled={empty || (!on && items.length >= 4)} onChange={() => toggle(id)} />
                {l[lang]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="row">
        <label className="field">
          <span>{t.exploreFrom}</span>
          <select value={yFrom} onChange={(e) => setFrom(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t.exploreTo}</span>
          <select value={yTo} onChange={(e) => setTo(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t.exploreChart}</span>
          <select value={chart} onChange={(e) => setChart(e.target.value as typeof chart)}>
            <option value="line">{t.chartLine}</option>
            <option value="bar">{t.chartBar}</option>
            <option value="table">{t.chartTable}</option>
          </select>
        </label>
      </div>
      <button className="btn" onClick={run}>
        {t.exploreGo}
      </button>
    </section>
  );
}
