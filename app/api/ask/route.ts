import { NextResponse } from "next/server";
import { z } from "zod";
import { plan, write, AiUnavailable } from "@/lib/ai";
import { execute, type Result } from "@/lib/executor";
import { EXAMPLES } from "@/lib/examples";
import { templateAnswer } from "@/lib/templates";
import { errorMessage, type ErrorCode } from "@/lib/i18n";
import { checkLimits, normaliseQuestion, cached, remember, MAX_QUESTION_CHARS } from "@/lib/guards";
import { DATA_AS_OF, type Lang } from "@/lib/catalog";
import { rateIntent, currencyName } from "@/lib/rates";
import { getRates } from "@/lib/rates-server";
import { fmt } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  question: z.string().optional(),
  example_id: z.string().optional(),
  lang: z.enum(["az", "en"]).default("az"),
});

export interface AskOk {
  ok: true;
  lang: Lang;
  answer: string;
  checked: boolean;
  chart: Result["chart"];
  unit: string;
  year_from: number;
  year_to: number;
  source: Result["source"];
  data_as_of: string | null;
  /** the plan that produced this answer, with the years actually used; drives share links and follow-ups */
  plan?: Omit<Result["plan"], "answer_language"> & { answer_language?: Lang };
  dataset_id?: string;
  /** "rates": a live CBAR exchange-rate answer (no chart, no plan) */
  kind?: "rates";
}
export interface AskFail {
  ok: false;
  lang: Lang;
  code: ErrorCode;
  message: string;
}

/** "Dollar rate today?" → today's official CBAR rate, computed by code, no AI call. */
async function ratesAnswer(codes: string[], question: string, uiLang: Lang): Promise<AskOk | null> {
  const data = await getRates();
  const found = codes.map((c) => data.rates.find((r) => r.code === c)).filter((r) => r !== undefined);
  if (!found.length) return null;
  // Answer in the question's language: Latin letters ə/ı/ş/ç/ğ/ö/ü or Cyrillic → az, otherwise the UI language.
  const lang: Lang = /[əğıöüçş\u0400-\u04FF]/i.test(question) ? "az" : /\b(what|rate|today|how|the|exchange|current|dollar)\b/i.test(question) ? "en" : uiLang;
  const parts = found.map((r) => {
    return `${r.nominal} ${currencyName(r, lang)} = ${fmt(r.value, lang, 4)} ${lang === "az" ? "manat" : "manats"}`;
  });
  const snap = data.origin === "snapshot";
  const answer =
    lang === "az"
      ? `Mərkəzi Bankın ${data.date} tarixinə rəsmi məzənnəsi: ${parts.join("; ")}.${snap ? " (Mərkəzi Bankın saytına indi qoşulmaq alınmadı, ona görə son saxlanmış məzənnə göstərilir.)" : ""}`
      : `Official Central Bank rate for ${data.date}: ${parts.join("; ")}.${snap ? " (The Central Bank site couldn't be reached just now, so the last saved rate is shown.)" : ""}`;
  const year = Number(data.date.slice(-4));
  return {
    ok: true,
    lang,
    kind: "rates",
    answer,
    checked: true,
    chart: { type: "table", title: lang === "az" ? "Rəsmi məzənnələr" : "Official exchange rates", unit: "AZN", series: [] },
    unit: "AZN",
    year_from: year,
    year_to: year,
    source: { title: lang === "az" ? `Rəsmi məzənnələr, ${data.date}` : `Official exchange rates, ${data.date}`, url: data.source_url, name: "CBAR" },
    data_as_of: data.date,
  };
}

function fail(code: ErrorCode, lang: Lang, detail?: Parameters<typeof errorMessage>[2], status = 200) {
  return NextResponse.json<AskFail>({ ok: false, lang, code, message: errorMessage(code, lang, detail) }, { status });
}

function ok(r: Result, answer: string, checked: boolean): AskOk {
  return {
    ok: true,
    lang: r.lang,
    answer,
    checked,
    chart: r.chart,
    unit: r.unit,
    year_from: r.year_from,
    year_to: r.year_to,
    source: r.source,
    data_as_of: DATA_AS_OF,
    plan: { ...r.plan, year_from: r.year_from, year_to: r.year_to },
    dataset_id: r.dataset_id,
  };
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return fail("bad_request", "az", undefined, 400);
  }
  const uiLang = body.lang;

  try {
    // 1. Example buttons: fixed plan + template answer, no AI call.
    if (body.example_id) {
      const ex = EXAMPLES.find((e) => e.id === body.example_id);
      if (!ex) return fail("bad_request", uiLang, undefined, 400);
      const r = execute({ ...ex.plan, answer_language: uiLang });
      if (!r.ok) return fail(r.reason, uiLang, r.detail);
      return NextResponse.json(ok(r, templateAnswer(r), true));
    }

    const question = normaliseQuestion(body.question ?? "");
    if (!question) return NextResponse.json<AskFail>({ ok: false, lang: uiLang, code: "bad_request", message: uiLang === "az" ? "Zəhmət olmasa sual yazın." : "Please type a question." });
    if (question.length > MAX_QUESTION_CHARS) return fail("bad_request", uiLang);

    // Today's exchange rate: answered from the Central Bank file, no AI call and no quota used.
    const codes = rateIntent(question);
    if (codes) {
      const res = await ratesAnswer(codes, question, uiLang);
      if (res) return NextResponse.json(res);
    }

    const hit = cached<AskOk | AskFail>(question);
    if (hit) return NextResponse.json({ ...hit, lang: hit.ok ? hit.lang : uiLang });

    const visitor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limit = checkLimits(visitor);
    if (limit !== "ok") return fail(limit, uiLang);

    // 2. AI call 1: question → plan.  3. Code: plan → numbers.  4. AI call 2: numbers → words.
    const p = await plan(question);
    const r = execute(p);
    if (!r.ok) {
      // Remember "not in the data" answers too, so the same question doesn't use the AI again.
      const res: AskFail = { ok: false, lang: r.lang, code: r.reason, message: errorMessage(r.reason, r.lang, r.detail) };
      remember(question, res);
      return NextResponse.json(res);
    }
    const { text, checked } = await write(question, r);
    const response = ok(r, text, checked);
    remember(question, response);
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof AiUnavailable) return fail(err.kind, uiLang);
    console.error("unexpected error in /api/ask", err);
    return fail("ai_unavailable", uiLang);
  }
}
