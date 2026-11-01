"use client";
// Today's official CBAR exchange rates and a manat converter. The page shows
// the bundled copy at once, then swaps in the live rates from /api/rates.
// Every conversion is plain arithmetic in this file.
import { useEffect, useMemo, useState } from "react";
import { RATES_SNAPSHOT, MAIN_CODES, perUnit, currencyName, type RatesData } from "@/lib/rates";
import { fmt } from "@/lib/format";
import type { Lang } from "@/lib/catalog";

const TEXT = {
  az: { title: "Bugünkü rəsmi məzənnələr", conv: "Çevirici", amount: "Məbləğ", saved: "son saxlanmış məzənnə", src: "Mənbə: Azərbaycan Mərkəzi Bankı", swap: "Yerini dəyiş", manat: "manat" },
  en: { title: "Today's official exchange rates", conv: "Converter", amount: "Amount", saved: "last saved rate", src: "Source: Central Bank of Azerbaijan", swap: "Swap", manat: "manat" },
};

export default function Rates({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const [data, setData] = useState<RatesData>(RATES_SNAPSHOT);
  const [amount, setAmount] = useState("100");
  const [code, setCode] = useState("USD");
  const [toManat, setToManat] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RatesData | null) => {
        if (alive && d?.rates?.length) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const main = MAIN_CODES.map((c) => data.rates.find((r) => r.code === c)).filter((r) => r !== undefined);
  const options = [...main, ...data.rates.filter((r) => !MAIN_CODES.includes(r.code))];
  const rate = data.rates.find((r) => r.code === code) ?? main[0];
  const n = Number(amount.replace(",", ".").replace(/\s/g, ""));
  const result = useMemo(() => {
    if (!rate || !Number.isFinite(n)) return null;
    return toManat ? n * perUnit(rate) : n / perUnit(rate);
  }, [rate, n, toManat]);

  return (
    <section className="rates card" aria-label={t.title}>
      <div className="rates-head">
        <h2 className="section-title">{t.title}</h2>
        <span className="muted small">
          {data.date}
          {data.origin === "snapshot" ? ` · ${t.saved}` : ""}
        </span>
      </div>
      <div className="rates-row">
        {main.map((r) => (
          <div key={r.code} className="rate">
            <span className="rate-code">
              {r.nominal > 1 ? `${r.nominal} ` : ""}
              {r.code}
            </span>
            <span className="rate-val">{fmt(r.value, lang, 4)}</span>
            <span className="rate-name">{currencyName(r, lang)}</span>
          </div>
        ))}
      </div>
      <div className="conv">
        <span className="conv-label">{t.conv}</span>
        <input aria-label={t.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {toManat ? (
          <select aria-label="currency" value={code} onChange={(e) => setCode(e.target.value)}>
            {options.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code}
              </option>
            ))}
          </select>
        ) : (
          <span className="conv-unit">AZN</span>
        )}
        <button className="action" onClick={() => setToManat(!toManat)} aria-label={t.swap} title={t.swap}>
          ⇄
        </button>
        <span className="conv-out">
          = <b>{result === null ? "—" : fmt(result, lang, 2)}</b>{" "}
          {toManat ? (
            "AZN"
          ) : (
            <select aria-label="currency" value={code} onChange={(e) => setCode(e.target.value)}>
              {options.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}
                </option>
              ))}
            </select>
          )}
        </span>
      </div>
      <p className="muted small">
        <a href={data.source_url} target="_blank" rel="noreferrer">
          {t.src}
        </a>
      </p>
    </section>
  );
}
