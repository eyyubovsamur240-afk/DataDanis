"use client";
import { useState } from "react";
import Chart, { loadPlotly } from "@/components/Chart";
import { UI } from "@/lib/i18n";
import { fmt, fmtPct } from "@/lib/format";
import { getDataset, itemLabel } from "@/lib/catalog";
import { followUps } from "@/lib/followups";
import { shareUrl } from "@/lib/share";
import { toCsv, download } from "@/lib/csv";
import type { PlanInput } from "@/lib/local";
import type { AskOk } from "@/app/api/ask/route";

export default function Answer({
  reply,
  turnId,
  viaAi,
  onFollow,
}: {
  reply: AskOk;
  turnId: number;
  viaAi: boolean;
  onFollow: (label: string, plan: PlanInput) => void;
}) {
  const t = UI[reply.lang];
  const [showTable, setShowTable] = useState(false);
  const [copied, setCopied] = useState(false);
  const pct = reply.unit.startsWith("%");
  const chartId = `chart-${turnId}`;
  const years = [...new Set(reply.chart.series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const show = (v: number | undefined) => (v === undefined ? "—" : pct ? fmtPct(v, reply.lang) : fmt(v, reply.lang));
  const hasRows = reply.chart.series.length > 0;
  const tableOpen = hasRows && (showTable || reply.chart.type === "table");
  const hasPlot = reply.chart.type === "line" || reply.chart.type === "bar";
  const ds = reply.plan ? getDataset(reply.plan.dataset_id) : undefined;
  const fileBase = `datadanis-${reply.dataset_id ?? "data"}-${reply.year_from}-${reply.year_to}`;

  async function share() {
    if (!reply.plan) return;
    const url = shareUrl(reply.plan, reply.lang);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await nav.share({ title: "DataDanış", text: reply.answer, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function png() {
    const el = document.getElementById(chartId);
    if (!el) return;
    const Plotly = await loadPlotly();
    await Plotly.downloadImage(el as never, { format: "png", filename: fileBase, width: 1000, height: 560 } as never);
  }

  return (
    <div className="answer">
      <p className="answer-text">{reply.answer}</p>
      <Chart spec={reply.chart} lang={reply.lang} pct={pct} id={chartId} />

      {tableOpen && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.year}</th>
                {reply.chart.series.map((s) => (
                  <th key={s.item_id}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y}>
                  <td>{y}</td>
                  {reply.chart.series.map((s) => (
                    <td key={s.item_id}>{show(s.points.find((p) => p.year === y)?.value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">{reply.unit}</p>
        </div>
      )}

      <div className="actions">
        {hasRows && reply.chart.type !== "table" && (
          <button className="action" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
            <Icon d="M3 5h18M3 12h18M3 19h18" /> {showTable ? t.hideTable : t.showTable}
          </button>
        )}
        {hasRows && (
          <button className="action" onClick={() => download(`${fileBase}.csv`, toCsv(reply.chart, t.year))}>
            <Icon d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /> {t.csv}
          </button>
        )}
        {hasPlot && (
          <button className="action" onClick={png}>
            <Icon d="M4 5h16v14H4zM8 13l3-3 5 6M15 9h.01" /> {t.png}
          </button>
        )}
        {reply.plan && (
          <button className="action primary" onClick={share}>
            <Icon d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5" /> {copied ? t.copied : t.share}
          </button>
        )}
      </div>

      <p className="source">
        <span className="badge-src">{reply.source.name ?? "opendata.az"}</span>
        <a href={reply.source.url} target="_blank" rel="noreferrer">
          {reply.source.title}
        </a>
        {reply.data_as_of && reply.kind !== "rates" && <span className="muted"> · {t.dataAsOf}: {reply.data_as_of}</span>}
      </p>

      {reply.plan && (
        <details className="calc">
          <summary>
            <span className="check" aria-hidden>
              ✓
            </span>{" "}
            {t.howCalc}
          </summary>
          <dl>
            <dt>{t.calcTable}</dt>
            <dd>
              {reply.source.title} <code>{reply.plan.dataset_id}</code>
            </dd>
            <dt>{t.calcFigures}</dt>
            <dd>{ds ? reply.plan.item_ids.map((id) => itemLabel(ds, id, reply.lang)).join(", ") : reply.plan.item_ids.join(", ")}</dd>
            <dt>{t.calcYears}</dt>
            <dd>{reply.year_from === reply.year_to ? reply.year_to : `${reply.year_from}–${reply.year_to}`}</dd>
            <dt>{t.calcOp}</dt>
            <dd>{t.ops[reply.plan.operation]}</dd>
          </dl>
          <p className="small">{viaAi ? (reply.checked ? t.calcChecked : t.calcTemplate) : t.calcTemplate}</p>
          <p className="small muted">{t.calcCode}</p>
        </details>
      )}

      {reply.plan && (
        <div className="followups">
          <span className="followups-label">{t.followUps}</span>
          <div className="chips">
            {followUps(reply.plan, reply.lang).map((f) => (
              <button key={f.key} className="chip small-chip" onClick={() => onFollow(f.label, f.plan)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
