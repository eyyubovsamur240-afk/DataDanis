"use client";
import { highlightValues, type HighlightValue } from "@/lib/highlights";
import { fmt, fmtPct } from "@/lib/format";
import { UI } from "@/lib/i18n";
import type { Lang } from "@/lib/catalog";
import type { PlanInput } from "@/lib/local";

const VALUES = highlightValues();

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} className="spark-fill" />
      <polyline points={pts.join(" ")} className="spark-line" />
    </svg>
  );
}

function Card({ v, lang, onOpen }: { v: HighlightValue; lang: Lang; onOpen: (label: string, plan: PlanInput) => void }) {
  const t = UI[lang];
  const value = v.h.pct ? fmtPct(v.value, lang) : fmt(v.value, lang);
  let delta: { text: string; cls: string } | null = null;
  if (v.prev) {
    const d = v.h.pct ? v.value - v.prev.value : ((v.value - v.prev.value) / Math.abs(v.prev.value)) * 100;
    const r = Math.round(d * 10) / 10;
    const good = v.h.upIsGood === null || r === 0 ? "neutral" : (r > 0) === v.h.upIsGood ? "good" : "bad";
    const txt = v.h.pct ? `${r > 0 ? "▲" : r < 0 ? "▼" : "•"} ${fmt(Math.abs(r), lang, 1)} ${lang === "az" ? "faiz bəndi" : "pts"}` : `${r > 0 ? "▲" : r < 0 ? "▼" : "•"} ${fmtPct(r, lang).replace(/^[+−]/, "")}`;
    delta = { text: txt, cls: good };
  }
  const label = `${v.h.label[lang]} · ${v.plan.year_from}–${v.plan.year_to}`;
  return (
    <button className="hl" onClick={() => onOpen(label, v.plan)} title={t.tapToSee}>
      <span className="hl-label">{v.h.label[lang]}</span>
      <span className="hl-value">
        {value} <small>{v.h.unit[lang]}</small>
      </span>
      <span className="hl-meta">
        {v.year}
        {delta && (
          <span className={`delta ${delta.cls}`} title={t.vsPrev}>
            {delta.text}
          </span>
        )}
      </span>
      <Spark values={v.spark} />
    </button>
  );
}

export default function Highlights({ lang, onOpen }: { lang: Lang; onOpen: (label: string, plan: PlanInput) => void }) {
  return (
    <section className="highlights" aria-label={UI[lang].latest}>
      {VALUES.map((v) => (
        <Card key={v.h.id} v={v} lang={lang} onOpen={onOpen} />
      ))}
    </section>
  );
}
