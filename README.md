# DataDanış

**Açıq dövlət statistikası sadə dildə.** Ask a plain-language question about Azerbaijan's official statistics, in Azerbaijani or English, and get a short answer, a chart and a link to the source dataset on [opendata.az](https://opendata.az).

Made by Samur Eyyubov for MilliNet 2026.

## How it works

1. **Plan.** An AI model turns the question into a small, fixed-format query plan: which dataset, which figures, which years, which operation. It can only choose from the datasets listed in `catalog.yaml`.
2. **Compute.** Plain TypeScript (`lib/executor.ts`) runs the plan on a saved copy of the official data. **Every number is calculated by code, never by the AI.**
3. **Explain.** The AI writes 1–3 sentences from the computed numbers only. The app then checks every number in the text against the result (`lib/numbercheck.ts`). If any number doesn't match, a template answer is shown instead.
4. **Show.** The chart, the table and the source link are drawn by fixed code.

If the data can't answer a question (for example, today's price of bread in Baku), the app says so instead of guessing. The example questions, headline cards, explorer and follow-ups use fixed plans, so they answer instantly and keep working even if the AI service is down.

## Features

- **Headline cards** on the home page: population, inflation, the dollar rate and the average wage, with the change on the previous year and a 10-year sparkline. Tap a card for the full chart.
- **Share and download**: every answer has a share link, a CSV download and a chart image (PNG). A share link stores the query plan (for example `/?a=DT_BL_001.001.trend.2016-2025.line`), not the answer, so opening it recomputes the same numbers from the data with no AI call.
- **"How was this calculated?"** under each answer: the official table and its id, the figures, the years, the operation, and whether the AI text passed the number check.
- **Follow-up buttons**: all years, last 5 years, highest year, or compare with another figure from the same table.
- **Explore data** tab: pick a table, up to 4 figures, the years and a chart type.
- **Voice questions** through the browser's speech recognition (Azerbaijani or English), where the browser supports it.
- Works on phones, follows the system dark mode, and can be added to the home screen.

The headline cards, example questions, follow-ups, explorer and share links all run in the browser on the bundled data (`lib/local.ts`), so they are instant and never use the Gemini quota. Only typed or spoken questions call the AI.

## Data

The app covers 12 annual national tables from the State Statistics Committee (licence CC0):

- inflation
- population
- exchange rates
- employment and unemployment
- wages by sector
- income per person
- GDP growth
- life expectancy
- births and deaths
- marriages and divorces
- tourism
- crime

- `catalog.yaml` is the hand-checked list of datasets and figures, with Azerbaijani and English names and known data traps.
- `data/cache/` holds the raw JSON snapshots from `https://www.azstat.gov.az/AsisOpenDataApi/data?table_id=…`. The app never fetches data live.
- `npm run data` builds `lib/generated/datasets.json` from both. It stops with an error if a figure in the catalog is missing from the data.

**To refresh the data**, run this from a computer in Azerbaijan, since some servers abroad are blocked:

```bash
npm run fetch-data   # downloads new snapshots into data/cache/
npm run data         # rebuilds and checks; read the ✓ lines
npm test             # spot-checks published figures
```

## Run locally

```bash
npm install
cp .env.example .env.local   # then put your API key in .env.local
npm run dev                  # http://localhost:3000
npm test
```

## Deploy on Vercel

1. Import this GitHub repo at [vercel.com/new](https://vercel.com/new). It detects Next.js; keep the default settings.
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/apikey)). `LLM_MODEL` and `LLM_FALLBACK_MODEL` are optional; the defaults are in `.env.example`.
3. Deploy. Every push to `main` redeploys.
4. On the free Gemini tier each model allows only about 5 requests a minute. The app spreads calls over three models (`gemini-3.6-flash` plans the query, the light models write the text), skips a model for 30 seconds after it runs out, caches repeated questions, and shows a friendly "try again in a minute" message if every model is busy. The example questions never use the AI. For judging, turn on billing and set a small monthly budget (about $0.01 per question).

## MilliNet badge

The MilliNet rules require their badge on the home page. Copy the code from millinet.az → your account → **Kod**, and put it in the `<div id="millinet-badge" />` at the bottom of `app/page.tsx`.

## Project layout

```
app/page.tsx          home page: examples, chat, chart, source, privacy note
app/api/ask/route.ts  API: limits → plan → compute → explain
components/Chart.tsx  Plotly chart (fixed code)
lib/ai.ts             the two AI calls (Gemini, with a fallback model)
lib/executor.ts       validation + all calculations
lib/numbercheck.ts    checks AI text against computed numbers
lib/templates.ts      template answers (examples + fallback)
lib/i18n.ts           all interface text and error messages (AZ first)
catalog.yaml          dataset catalog
data/cache/           raw data snapshots
scripts/              fetch-data / prepare-data
tests/                unit tests (npm test)
```
