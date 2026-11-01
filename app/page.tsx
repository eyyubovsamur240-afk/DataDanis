"use client";
import { useState, useRef, useEffect } from "react";
import Chart from "@/components/Chart";
import { UI } from "@/lib/i18n";
import { EXAMPLES } from "@/lib/examples";
import { DATASETS, DATA_AS_OF, type Lang } from "@/lib/catalog";
import { fmt, fmtPct } from "@/lib/format";
import { MAX_QUESTION_CHARS } from "@/lib/guards-shared";
import type { AskOk, AskFail } from "@/app/api/ask/route";

interface Turn {
  id: number;
  question: string;
  status: "loading" | "done";
  reply?: AskOk | AskFail;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("az");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const t = UI[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function ask(question: string, exampleId?: string) {
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setTurns((ts) => [...ts, { id, question: q, status: "loading" }]);
    setInput("");
    setBusy(true);
    let reply: AskOk | AskFail;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exampleId ? { example_id: exampleId, lang } : { question: q, lang }),
      });
      reply = await res.json();
    } catch {
      reply = {
        ok: false,
        lang,
        code: "ai_unavailable",
        message:
          lang === "az"
            ? "Bağlantı alınmadı. İnternet bağlantınızı yoxlayıb yenidən cəhd edin."
            : "Couldn't connect. Check your internet connection and try again.",
      };
    }
    setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, status: "done", reply } : x)));
    setBusy(false);
  }

  return (
    <main>
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◆
          </span>{" "}
          DataDanış
        </div>
        <button className="lang" onClick={() => setLang(lang === "az" ? "en" : "az")}>
          {t.switchLang}
        </button>
      </header>

      {turns.length === 0 && (
        <section className="hero">
          <h1>{t.tagline}</h1>
          <ol className="how">
            <li>{t.how1}</li>
            <li>{t.how2}</li>
            <li>{t.how3}</li>
          </ol>
        </section>
      )}

      <section className="examples" aria-label={t.examples}>
        <h2>{t.examples}</h2>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex.id} className="chip" disabled={busy} onClick={() => ask(ex.question[lang], ex.id)}>
              {ex.question[lang]}
            </button>
          ))}
        </div>
      </section>

      <section className="chat" aria-live="polite">
        {turns.map((turn) => (
          <article key={turn.id} className="turn">
            <p className="q">{turn.question}</p>
            {turn.status === "loading" && <p className="a muted">{t.thinking}</p>}
            {turn.reply && !turn.reply.ok && <p className="a error">{turn.reply.message}</p>}
            {turn.reply && turn.reply.ok && <Answer reply={turn.reply} />}
          </article>
        ))}
        <div ref={endRef} />
      </section>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          maxLength={MAX_QUESTION_CHARS}
          aria-label={t.placeholder}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {t.ask}
        </button>
      </form>

      <footer>
        <details>
          <summary>{t.datasetsTitle}</summary>
          <ul className="datasets">
            {DATASETS.map((d) => (
              <li key={d.id}>
                <a href={d.source_url} target="_blank" rel="noreferrer">
                  {lang === "az" ? d.title_az : d.title_en}
                </a>{" "}
                <span className="muted">
                  ({d.year_min}–{d.year_max})
                </span>
              </li>
            ))}
          </ul>
        </details>
        <p>
          <strong>{t.privacyTitle}:</strong> {t.privacy}
        </p>
        <p className="muted">{t.disclaimer}</p>
        <p className="muted">
          {t.credit} {DATA_AS_OF && `${t.dataAsOf}: ${DATA_AS_OF}.`}
        </p>
        <p className="muted">{t.builtBy}</p>
        {/* MilliNet badge: paste the code from millinet.az → your account → "Kod" here (see README). */}
        <div id="millinet-badge" />
      </footer>
    </main>
  );
}

function Answer({ reply }: { reply: AskOk }) {
  const t = UI[reply.lang];
  const [showTable, setShowTable] = useState(false);
  const pct = reply.unit.startsWith("%");
  const years = [...new Set(reply.chart.series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const show = (v: number | undefined) => (v === undefined ? "—" : pct ? fmtPct(v, reply.lang) : fmt(v, reply.lang));
  return (
    <div className="a">
      <p>{reply.answer}</p>
      <Chart spec={reply.chart} lang={reply.lang} pct={pct} />
      <button className="link" onClick={() => setShowTable(!showTable)}>
        {t.showTable}
      </button>
      {(showTable || reply.chart.type === "table") && (
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
      <p className="source">
        {t.source}:{" "}
        <a href={reply.source.url} target="_blank" rel="noreferrer">
          {reply.source.title}
        </a>{" "}
        — opendata.az
        {reply.data_as_of && (
          <span className="muted">
            {" "}
            · {t.dataAsOf}: {reply.data_as_of}
          </span>
        )}
      </p>
    </div>
  );
}
