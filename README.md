# Tiburon

A personal AI chat app that answers from your own documents and shows where every answer came from.
Each answer carries source cards you can click: the original passage opens with the matching words
highlighted, so a claim can be checked instead of trusted.

It runs on one machine, for one person, against one corpus. Most design decisions follow from that.

## What it does

- **Answers from your corpus, with citations.** Notes, PDF, Word, Excel, CSV and scanned PDFs (OCR with
  Tesseract) are indexed into SQLite full-text search. Answers cite the passages they used.
- **Four modes.** Quick, Tiburon (corpus-grounded), Agent (tool use with a permission layer) and Code.
- **Model failover.** Requests walk a chain of free and paid providers, so one exhausted key or rate
  limit does not take the app down.
- **Permission layer for agent actions.** Tools that touch files or run commands go through
  `lib/izin.ts` before they execute.
- **Daily views.** Radar (morning tech news), scheduled tasks read from the local OpenClaw cron
  database, source history, and a gallery of recent content slides.
- **Job helper.** `/lamar` scores a job posting against the CV and drafts an application.
- **Telegram bot.** `npm run bot` serves a product catalog bot from the same data.
- **Password gate.** Middleware locks every page and API route when the app is reached over a network.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SQLite, Vitest (55 test files).

## Run it

```bash
npm install
cp .env.contoh .env.local   # add OPENROUTER_API_KEY
npm run indeks              # index a folder of documents
npm run dev
```

Open http://localhost:3000.

## Design

A deep-sea theme: navy surfaces, one bright blue accent used sparingly, a blue glow instead of drop
shadows, JetBrains Mono with Instrument Serif for headings, and a hand-drawn icon set. Tokens live in
`styles/tokens.css`. Development rules, including the "smallest footprint first" ladder for new
features, are in `AGENTS.md`.

## License

See `LICENSE`.
