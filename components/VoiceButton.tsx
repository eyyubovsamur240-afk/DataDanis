"use client";
// Voice questions with the browser's built-in speech recognition (Chrome,
// Edge, Safari). Hidden where the browser doesn't support it.
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/catalog";

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type Ctor = new () => Recognition;

export default function VoiceButton({
  lang,
  label,
  listeningLabel,
  onText,
  onFinal,
  disabled,
}: {
  lang: Lang;
  label: string;
  listeningLabel: string;
  onText: (s: string) => void;
  onFinal: (s: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggle() {
    if (on) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.lang = lang === "az" ? "az-AZ" : "en-US";
    r.interimResults = true;
    r.maxAlternatives = 1;
    let text = "";
    let final = false;
    r.onresult = (e) => {
      text = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
      final = e.results[e.results.length - 1].isFinal;
      onText(text);
    };
    r.onend = () => {
      setOn(false);
      if (final && text.trim()) onFinal(text.trim());
    };
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  }

  if (!supported) return null;
  return (
    <button type="button" className={`mic ${on ? "on" : ""}`} onClick={toggle} disabled={disabled} aria-label={on ? listeningLabel : label} title={on ? listeningLabel : label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
