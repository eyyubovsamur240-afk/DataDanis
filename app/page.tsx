"use client";
import { useState, useRef, useEffect } from "react";
import Answer from "@/components/Answer";
import Highlights from "@/components/Highlights";
import Explorer from "@/components/Explorer";
import VoiceButton from "@/components/VoiceButton";
import { UI } from "@/lib/i18n";
import { EXAMPLES } from "@/lib/examples";
import { DATASETS, DATA_AS_OF, getDataset, type Lang } from "@/lib/catalog";
import { MAX_QUESTION_CHARS } from "@/lib/guards-shared";
import { answerLocally, type PlanInput } from "@/lib/local";
import { decodePlan } from "@/lib/share";
import type { AskOk, AskFail } from "@/app/api/ask/route";

interface Turn {
  id: number;
  question: string;
  status: "loading" | "done";
  viaAi: boolean;
  reply?: AskOk | AskFail;
}

type Tab = "ask" | "explore";
let nextId = 1;

export default function Home() {
  const [lang, setLang] = useState<Lang>("az");
  const [tab, setTab] = useState<Tab>("ask");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const t = UI[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  // Shared links: /?a=<plan>&lang=az recompute the answer locally.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const l = qs.get("lang");
    const startLang: Lang = l === "en" ? "en" : "az";
    if (l === "en") setLang("en");
    const a = qs.get("a");
    const plan = a ? decodePlan(a) : null;
    if (plan) {
      const ds = getDataset(plan.dataset_id)!;
      const yrs = plan.year_from && plan.year_to && plan.year_from !== plan.year_to ? `${plan.year_from}–${plan.year_to}` : `${plan.year_to ?? ""}`;
      showLocal(`${startLang === "az" ? ds.title_az : ds.title_en}${yrs ? ` · ${yrs}` : ""}`, plan, startLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showLocal(question: string, plan: PlanInput, l: Lang = lang) {
    const reply = answerLocally(plan, l);
    setTurns((ts) => [...ts, { id: nextId++, question, status: "done", viaAi: false, reply }]);
  }

  async function ask(question: string, exampleId?: string) {
    const q = question.trim();
    if (!q || busy) return;
    const ex = exampleId ? EXAMPLES.find((e) => e.id === exampleId) : undefined;
    if (ex) return showLocal(q, ex.plan);
    const id = nextId++;
    setTurns((ts) => [...ts, { id, question: q, status: "loading", viaAi: true }]);
    setInput("");
    setBusy(true);
    let reply: AskOk | AskFail;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
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

  const empty = turns.length === 0;

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/" aria-label="DataDanış">
            <Logo /> <span>DataDanış</span>
          </a>
          <nav className="tabs" aria-label="sections">
            <button className={tab === "ask" ? "on" : ""} onClick={() => setTab("ask")}>
              {t.navAsk}
            </button>
            <button className={tab === "explore" ? "on" : ""} onClick={() => setTab("explore")}>
              {t.navExplore}
            </button>
          </nav>
          <button className="lang" onClick={() => setLang(lang === "az" ? "en" : "az")} aria-label={t.switchLang}>
            {lang === "az" ? "EN" : "AZ"}
          </button>
        </div>
      </header>

      <main>
        {tab === "explore" && <Explorer lang={lang} onRun={(label, plan) => showLocal(label, plan)} />}

        {tab === "ask" && empty && (
          <section className="hero">
            <p className="kicker">{t.heroKicker}</p>
            <h1>{t.heroTitle}</h1>
            <p className="sub">{t.heroSub}</p>
            <ul className="trust">
              <li>{t.trust1}</li>
              <li>{t.trust2}</li>
              <li>{t.trust3}</li>
            </ul>
            <h2 className="section-title">{t.latest}</h2>
            <Highlights lang={lang} onOpen={(label, plan) => showLocal(label, plan)} />
          </section>
        )}

        {tab === "ask" && (
          <section className="examples" aria-label={t.examples}>
            <h2 className="section-title">{t.examples}</h2>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex.id} className="chip" disabled={busy} onClick={() => ask(ex.question[lang], ex.id)}>
                  {ex.question[lang]}
                </button>
              ))}
            </div>
          </section>
        )}

        {turns.length > 0 && (
          <section className="chat" aria-live="polite">
            {turns.map((turn) => (
              <article key={turn.id} className="turn">
                <p className="q">
                  <span>{turn.question}</span>
                </p>
                <div className="a card">
                  {turn.status === "loading" && (
                    <p className="loading">
                      <span className="dots" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                      {t.thinking}
                    </p>
                  )}
                  {turn.reply && (
                    <span className={`tag ${turn.viaAi ? "ai" : "local"}`}>{turn.viaAi ? t.aiAnswer : t.noAi}</span>
                  )}
                  {turn.reply && !turn.reply.ok && <p className="error">{turn.reply.message}</p>}
                  {turn.reply && turn.reply.ok && (
                    <Answer reply={turn.reply} turnId={turn.id} viaAi={turn.viaAi} onFollow={(label, plan) => showLocal(label, plan)} />
                  )}
                </div>
              </article>
            ))}
            <div className="chat-tools">
              <button className="link" onClick={() => setTurns([])}>
                {t.newChat}
              </button>
            </div>
            <div ref={endRef} />
          </section>
        )}

        {tab === "ask" && empty && (
          <section className="how card">
            <h2 className="section-title">{t.howTitle}</h2>
            <ol>
              <li>
                <b>1</b>
                <span>{t.how1}</span>
              </li>
              <li>
                <b>2</b>
                <span>{t.how2}</span>
              </li>
              <li>
                <b>3</b>
                <span>{t.how3}</span>
              </li>
            </ol>
          </section>
        )}

        <footer>
          <details>
            <summary>
              {t.datasetsTitle} ({DATASETS.length})
            </summary>
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

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="ask-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            maxLength={MAX_QUESTION_CHARS}
            aria-label={t.placeholder}
            enterKeyHint="send"
          />
          <VoiceButton
            lang={lang}
            label={t.voice}
            listeningLabel={t.listening}
            disabled={busy}
            onText={setInput}
            onFinal={(s) => ask(s)}
          />
          <button type="submit" className="send" disabled={busy || !input.trim()} aria-label={t.ask}>
            <span className="send-text">{t.ask}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </form>
    </>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" opacity=".75" />
      <rect x="14" y="12" width="4" height="13" rx="1.5" fill="#fff" opacity=".9" />
      <rect x="21" y="7" width="4" height="18" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}
