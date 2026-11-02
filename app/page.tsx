"use client";
import { useState, useRef, useEffect } from "react";
import Answer from "@/components/Answer";
import Highlights from "@/components/Highlights";
import Explorer from "@/components/Explorer";
import Rates from "@/components/Rates";
import VoiceButton from "@/components/VoiceButton";
import { UI } from "@/lib/i18n";
import { EXAMPLES } from "@/lib/examples";
import { DATASETS, DATA_AS_OF, getDataset, type Lang } from "@/lib/catalog";
import { MAX_QUESTION_CHARS } from "@/lib/guards-shared";
import { answerLocally, type PlanInput } from "@/lib/local";
import { decodePlan } from "@/lib/share";
import { chatContext, loadChat, saveChat, type Turn } from "@/lib/chat";
import type { AskOk, AskFail } from "@/app/api/ask/route";

type Tab = "chat" | "explore";
let nextId = 1;

export default function Home() {
  const [lang, setLang] = useState<Lang>("az");
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const t = UI[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (ready) saveChat(turns);
  }, [turns, ready]);
  // Grow the input box with its text, up to about 5 lines.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // On load: restore the saved conversation, then add a shared answer (/?a=<plan>) if the link has one.
  useEffect(() => {
    const saved = loadChat();
    nextId = Math.max(0, ...saved.map((x) => x.id)) + 1;
    const qs = new URLSearchParams(window.location.search);
    const l = qs.get("lang");
    const startLang: Lang = l === "en" ? "en" : "az";
    if (l === "en") setLang("en");
    const a = qs.get("a");
    const plan = a ? decodePlan(a) : null;
    let restored = saved;
    if (plan) {
      const ds = getDataset(plan.dataset_id)!;
      const yrs = plan.year_from && plan.year_to && plan.year_from !== plan.year_to ? `${plan.year_from}–${plan.year_to}` : `${plan.year_to ?? ""}`;
      const q = `${startLang === "az" ? ds.title_az : ds.title_en}${yrs ? ` · ${yrs}` : ""}`;
      restored = [...saved, { id: nextId++, question: q, status: "done", viaAi: false, reply: answerLocally(plan, startLang) }];
      window.history.replaceState(null, "", window.location.pathname);
    }
    setTurns(restored);
    setReady(true);
  }, []);

  function showLocal(question: string, plan: PlanInput, l: Lang = lang) {
    const reply = answerLocally(plan, l);
    setTurns((ts) => [...ts, { id: nextId++, question, status: "done", viaAi: false, reply }]);
    setTab("chat");
  }

  async function ask(question: string, exampleId?: string) {
    const q = question.trim();
    if (!q || busy) return;
    const ex = exampleId ? EXAMPLES.find((e) => e.id === exampleId) : undefined;
    if (ex) return showLocal(q, ex.plan);
    const id = nextId++;
    const context = chatContext(turns);
    setTurns((ts) => [...ts, { id, question: q, status: "loading", viaAi: true, followUp: Boolean(context) }]);
    setInput("");
    setBusy(true);
    let reply: AskOk | AskFail;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang, ...(context ? { context } : {}) }),
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
  const lastId = turns.length ? turns[turns.length - 1].id : -1;

  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/" aria-label="DataDanış">
            <Logo /> <span>DataDanış</span>
          </a>
          <nav className="tabs" aria-label="sections">
            <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
              {t.navChat}
            </button>
            <button className={tab === "explore" ? "on" : ""} onClick={() => setTab("explore")}>
              <span className="long">{t.navExplore}</span>
              <span className="short">{lang === "az" ? "Araşdır" : "Explore"}</span>
            </button>
          </nav>
          {!empty && (
            <button className="icon-btn" onClick={() => setTurns([])} title={t.newChatTitle} aria-label={t.newChatTitle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          <button className="lang" onClick={() => setLang(lang === "az" ? "en" : "az")} aria-label={t.switchLang}>
            {lang === "az" ? "EN" : "AZ"}
          </button>
        </div>
      </header>

      <main>
        {tab === "explore" && <Explorer lang={lang} onRun={(label, plan) => showLocal(label, plan)} />}

        {tab === "chat" && (
          <section className="thread" aria-live="polite">
            <div className="msg bot">
              <Avatar />
              <div className="bubble">
                <p>{t.greeting}</p>
                <p className="muted small">{t.greetingFollow}</p>
                {empty && (
                  <>
                    <span className="bubble-label">{t.tryThese}</span>
                    <div className="chips">
                      {EXAMPLES.map((ex) => (
                        <button key={ex.id} className="chip" disabled={busy} onClick={() => ask(ex.question[lang], ex.id)}>
                          {ex.question[lang]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {empty && (
              <div className="msg bot extra">
                <span className="avatar-space" />
                <div className="bubble wide">
                  <span className="bubble-label">{t.latest}</span>
                  <Highlights lang={lang} onOpen={(label, plan) => showLocal(label, plan)} />
                  <Rates lang={lang} />
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className="pair">
                <div className="msg user">
                  <div className="bubble">{turn.question}</div>
                </div>
                <div className="msg bot">
                  <Avatar />
                  <div className="bubble wide">
                    {turn.status === "loading" && (
                      <p className="loading" aria-label={t.thinking}>
                        <span className="dots" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="muted small">{turn.followUp ? t.contextOn : t.thinking}</span>
                      </p>
                    )}
                    {turn.reply?.ok && (
                      <span className={`tag ${turn.viaAi ? "ai" : "local"}`}>{turn.viaAi ? t.aiAnswer : t.noAi}</span>
                    )}
                    {turn.reply && !turn.reply.ok && <p className="error">{turn.reply.message}</p>}
                    {turn.reply && turn.reply.ok && (
                      <Answer
                        reply={turn.reply}
                        turnId={turn.id}
                        viaAi={turn.viaAi}
                        last={turn.id === lastId}
                        onFollow={(label, plan) => showLocal(label, plan)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
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
          <textarea
            ref={boxRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function Avatar() {
  return (
    <span className="avatar" aria-hidden>
      <Logo />
    </span>
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
