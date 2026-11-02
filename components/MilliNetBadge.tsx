"use client";
// Renders the MilliNet badge code (lib/millinet-badge.ts) exactly as MilliNet
// gives it. Scripts inside the code are re-created so the browser runs them,
// one after another, and anything they document.write() lands in the badge box.
import { useEffect, useRef } from "react";
import { badgeHtml } from "@/lib/millinet-badge";

const HTML = badgeHtml();

function runScript(old: HTMLScriptElement): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
    const write = document.write;
    // Old-style badge scripts write their HTML in place; send it into the box instead.
    document.write = (...parts: string[]) => s.insertAdjacentHTML("beforebegin", parts.join(""));
    const done = () => {
      document.write = write;
      resolve();
    };
    if (old.src) {
      s.async = false;
      s.onload = done;
      s.onerror = done;
      old.replaceWith(s);
    } else {
      s.text = old.text;
      old.replaceWith(s);
      done();
    }
  });
}

export default function MilliNetBadge() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !HTML) return;
    el.innerHTML = HTML;
    let cancelled = false;
    (async () => {
      for (const s of Array.from(el.querySelectorAll("script"))) {
        if (cancelled) return;
        await runScript(s);
      }
    })();
    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, []);

  if (!HTML) {
    // Visible only while developing, so a missing badge is noticed before submitting.
    if (process.env.NODE_ENV !== "production") {
      return <div className="badge-missing">MilliNet badge missing: paste the code into lib/millinet-badge.ts</div>;
    }
    return null;
  }
  return <div id="millinet-badge" className="millinet-badge" ref={box} />;
}
