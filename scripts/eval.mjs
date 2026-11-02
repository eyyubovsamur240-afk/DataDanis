// Asks the 20 eval questions (tests/eval/questions.json) to a running DataDanış
// and scores the answers. Uses the real AI, so run it sparingly.
//
//   npm run eval                                   # against http://localhost:3000
//   EVAL_URL=https://data-danis.vercel.app npm run eval
//
// A question passes when:
//   - answerable: the app answered, picked the expected table, and the chart
//     holds every expected figure (item, year, value), and the text passed the number check
//   - refusal: the app politely declined (ok: false, code cannot_answer)
// Results are written to eval-results.json. Goal for the Week 1 milestone: 16 of 20.
import { readFile, writeFile } from "node:fs/promises";

const BASE = (process.env.EVAL_URL || "http://localhost:3000").replace(/\/$/, "");
// The free Gemini tier allows about 5 requests a minute per model, and each question uses 2 calls.
const GAP_MS = Number(process.env.EVAL_GAP_MS ?? 13000);
const ONLY = process.env.EVAL_ONLY?.split(",");

const questions = JSON.parse(await readFile(new URL("../tests/eval/questions.json", import.meta.url), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(q) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q.question, lang: q.lang }),
    });
    const body = await res.json();
    if (!body.ok && body.code === "busy") {
      console.log(`   (AI busy, waiting a minute)`);
      await sleep(60000);
      continue;
    }
    return body;
  }
  return { ok: false, code: "busy", message: "still busy after 3 tries" };
}

function score(q, r) {
  if (q.refuse) {
    return r.ok ? { pass: false, why: `answered instead of refusing (${r.dataset_id})` } : r.code === "cannot_answer" ? { pass: true } : { pass: false, why: `failed with ${r.code}, not a refusal` };
  }
  if (!r.ok) return { pass: false, why: `${r.code}: ${r.message}` };
  if (r.dataset_id !== q.plan.dataset_id) return { pass: false, why: `table ${r.dataset_id}, expected ${q.plan.dataset_id}` };
  for (const e of q.expect) {
    const s = r.chart.series.find((x) => x.item_id === e.item_id);
    const v = s?.points.find((p) => p.year === e.year)?.value;
    if (v !== e.value) return { pass: false, why: `item ${e.item_id} ${e.year}: got ${v ?? "nothing"}, expected ${e.value}` };
  }
  if (!r.checked) return { pass: false, why: "AI text failed the number check (template shown instead)" };
  return { pass: true };
}

console.log(`Evaluating ${BASE} …\n`);
const results = [];
for (const [i, q] of questions.entries()) {
  if (ONLY && !ONLY.includes(q.id)) continue;
  if (results.length) await sleep(GAP_MS);
  let r;
  try {
    r = await ask(q);
  } catch (err) {
    r = { ok: false, code: "network", message: String(err) };
  }
  const s = score(q, r);
  results.push({ id: q.id, lang: q.lang, question: q.question, ...s, answer: r.ok ? r.answer : r.message });
  console.log(`${s.pass ? "✓" : "✗"} ${String(i + 1).padStart(2)} [${q.lang}] ${q.question}${s.pass ? "" : `\n     → ${s.why}`}`);
}

const passed = results.filter((x) => x.pass).length;
const by = (l) => `${results.filter((x) => x.lang === l && x.pass).length}/${results.filter((x) => x.lang === l).length}`;
console.log(`\n${passed}/${results.length} passed (AZ ${by("az")}, EN ${by("en")}). Week 1 goal: 16/20.`);
await writeFile("eval-results.json", JSON.stringify({ url: BASE, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log("Details: eval-results.json");
process.exitCode = passed >= Math.ceil(results.length * 0.8) ? 0 : 1;
