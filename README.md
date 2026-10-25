# AI Learning Platform

A working prototype with two learning modules behind one entry point:

| Module | For | What it does |
| --- | --- | --- |
| **Textbook AI Tutor** (`/tutor`) | Teachers, tutors, Classes 1–10 (demo: Class 1 English) | Upload a textbook PDF (or use the built-in demo reader), choose question types / count / difficulty / scope, generate **source-grounded** questions, review and edit them with page citations, run the quiz, and score it. |
| **Early Learning Studio** (`/early`) | LKG–UKG children with an adult nearby | English A–Z and a curated Hindi set. Hear each letter and its picture words, then trace it with finger, stylus or mouse and get gentle spoken feedback. |

No accounts. Works fully **without an API key** in a clearly labelled demo mode; add a key to switch question
writing and open-answer grading to a live model.

> The earlier static design mockup is preserved unchanged in `../opendesign/`. This app replaces it with a real
> implementation and reuses its design direction, letter data and demo passages.

---

## Quick start

Requirements: Node.js ≥ 20.9 (tested on 24), npm.

```bash
npm install
npm run dev            # http://localhost:3000
```

That's it — demo mode works immediately. To enable live AI mode:

```bash
cp .env.example .env.local
# then set ONE of these in .env.local:
#   LLM_API_KEY=AIza...      (Google Gemini — also enables embeddings)
#   LLM_API_KEY=gsk_...      (Groq)
#   LLM_API_KEY=sk-or-...    (OpenRouter)
npm run dev
```

The provider is detected from the key prefix (or set `LLM_PROVIDER`). The header badge shows **Demo mode** or
**Live · model-name**; `GET /api/status` reports the same in JSON.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest unit + API tests (73) — PDF extraction, chunking, retrieval, grounding validation, scoring, tracing geometry, lesson data, route handlers, live-mode adapter with a mocked provider |
| `npm run test:e2e` | Playwright end-to-end tests (18, desktop + phone) against a production build in forced demo mode. Uses the installed Chrome (`channel: "chrome"`); run `npx playwright install chromium` and remove `channel` to use bundled Chromium |
| `npm run assets:audio` | Regenerates the bundled voice clips (needs Python `edge-tts` + network) |
| `npm run assets:glyphs` | Rebuilds Hindi letter outlines from the Baloo 2 font |
| `npm run assets:pictures` | Downloads the picture SVGs (Noto Emoji) |
| `npm run assets:samples` | Rebuilds `public/samples/*.pdf` from the demo reader text |

All generated assets are committed, so none of the `assets:*` scripts are needed to run the app.

---

## Environment variables

Everything is optional. Keys are read only on the server (`import "server-only"`) and never reach the browser.

| Variable | Purpose | Default |
| --- | --- | --- |
| `LLM_API_KEY` | Key for the model provider (or use `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY`) | — (demo mode) |
| `LLM_PROVIDER` | `gemini` · `groq` · `openrouter` · `openai` · `custom` | auto-detected |
| `LLM_MODEL` | Model name | `gemini-2.5-flash` · `llama-3.3-70b-versatile` · `google/gemini-2.5-flash` · `gpt-5-mini` |
| `LLM_BASE_URL` | OpenAI-compatible endpoint (required for `custom`) | preset |
| `LLM_REASONING_EFFORT` | `low`/`medium`/`high` for models that accept it | unset |
| `GROUNDING_JUDGE` | Second-stage AI evidence check on answer keys | `true` in live mode |
| `LLM_TIMEOUT_MS` | Per-request timeout | `90000` |
| `EMBEDDING_PROVIDER` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` | Embeddings for hybrid retrieval. Automatic with a Gemini or OpenAI key; Groq/OpenRouter have no embeddings API, so pair them with a Gemini key here or run BM25-only | auto / none |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or Vercel's `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | Durable storage for uploads, quizzes and attempts | unset → local files |
| `DATA_DIR` | Local storage folder | `.data` (or `/tmp/alp-data` on Vercel) |
| `MAX_UPLOAD_MB` / `MAX_PDF_PAGES` | Upload limits (enforced in UI and API) | `15` / `250` (capped at 4.5 MB on Vercel — see below) |
| `DEMO_MODE` | Force deterministic demo behaviour even with a key | `false` |
| `PUBLIC_APP_URL` | Sent as `HTTP-Referer` to OpenRouter | `http://localhost:3000` |

The PRD's `DATABASE_URL` / `OBJECT_STORAGE_*` are not used: persistence is Upstash Redis (REST, serverless-safe), and
PDFs are not stored after extraction — only their page text and chunks.

---

## How it works

### Textbook AI Tutor

```
PDF ──► validate (type, size, %PDF magic, page limit)
     ──► extract per-page text (unpdf / PDF.js text layer)  ── no text? → "looks scanned" error
     ──► detect chapters ("Unit 2 —", "Chapter 3", "पाठ 4"; contents pages ignored)
     ──► page-bounded, paragraph-aware chunks (~500 tokens, ~100 overlap) + metadata
     ──► (optional) embeddings ──► store
Quiz config ──► scope filter (chapter / page range) ──► context selection
     (whole scope if it fits; else BM25 ⊕ embeddings via reciprocal-rank fusion, ≤2 chunks per page)
     ──► generate (live model, or demo generator)
     ──► rule checks ──► dedupe ──► optional AI evidence judge ──► reviewable quiz
```

* **Grounding rules** (`src/lib/tutor/validate.ts`): citations must point at chunks that were actually supplied;
  quotes must appear on the cited page; **page numbers always come from chunk metadata, never from the model**;
  MCQs need 2–4 distinct options and exactly one valid key; blanks need a visible `___` and an accepted answer that
  occurs in the evidence; rubric points must sum to the max (auto-corrected and flagged); answers must be supported
  by the cited text. Problems that make a question unscorable remove it (with a warning); anything else marks it
  **Needs review**. Fewer questions are returned rather than padding with unsupported ones.
* **Prompt safety**: textbook text and student answers are wrapped in delimiters, declared untrusted, and
  delimiter-escaped. Models only see short source aliases (`S1…`), which are mapped back server-side.
* **Structured output**: JSON mode + Zod validation; invalid output gets exactly one corrective retry, then a
  user-safe error with a "use demo generator instead" option. Raw model output is never shown.
* **Scoring**: MCQ by stored option id (display order is shuffled per attempt); fill-in-the-blank by normalised
  match (Unicode NFKC, case, punctuation, articles) against accepted variants; short answer / comprehension by
  rubric — the model judges each criterion, the **score is the sum of met criteria**, clamped; unknown criteria,
  low confidence or failures set a teacher-review flag. Students never receive answer keys, rubrics or evidence
  before submitting (`toStudentQuestion`, covered by tests).
* **Demo mode**: the built-in reader uses a reviewed, source-tied question bank (24 items); uploaded PDFs get a
  deterministic cloze generator (fill-in-the-blank and "which word completes the sentence"). Open answers use a
  keyword-rubric checker labelled "Demo keyword check".

### Early Learning Studio

* **Lessons** (`src/lib/early/lessons.ts`): English A–Z (2–3 picture words each, letter name + "A for apple" cue +
  adult-facing phoneme hint) and Hindi: 10 vowels + 8 consonants with romanised glosses.
* **Audio**: bundled clips for every letter name, cue, word, instruction and feedback line (separate clips for
  letter name and cue). Falls back to the Web Speech API with a matching `en-IN`/`hi-IN` voice; if neither can
  play, the UI says so and offers read-aloud text — it never pretends audio played. New audio always stops the
  previous sequence; leaving a letter stops speech.
* **Tracing** (`src/lib/early/geometry.ts`, `src/components/early/trace-board.tsx`): English guides are hand-authored
  SVG stroke paths with numbered start dots, direction arrows and an animated "Show me". Hindi guides are the exact
  SVG outline of each letter (Baloo 2); its centre line is computed at runtime by rasterising that same path and
  thinning it (Zhang–Suen). Ink is stored in normalised 0..1 coordinates. Coverage = share of guide samples with
  ink within ~5.5% of the board; an on-guide ratio catches scribbles. ≥70% coverage with ≥55% on-guide → success;
  partial traces name the weakest stroke ("Trace line two again") or Hindi region (top line / left / right).
  Low scores never block moving on. `touch-action: none` is applied to the canvas only.
* **Progress**: per-device `localStorage` (explored / traced / attempts / last letter), with a reset in the
  grown-ups panel. Nothing is sent to the server.

### Project layout

```
src/app/                    routes (App Router) + API route handlers under src/app/api
  tutor/(workspace)/        teacher pages: dashboard, document/[id], generate, review/[id]
  tutor/(student)/          student pages: quiz/[id], results/[id] (no teacher navigation)
  early/[language]/[letter] lessons and /trace (all prerendered via generateStaticParams)
src/lib/tutor/              pure logic: types, schemas, pdf, chunk, retrieve, validate, score, demo bank
src/lib/ai/                 provider config, OpenAI-compatible client, generate / evaluate / judge / embed tasks
src/lib/server/             services: ingest, generate, attempts, review, http helpers
src/lib/store/              KV (file · Upstash · memory) + repositories
src/lib/early/              lessons, strokes, glyph outlines, geometry & scoring, audio engine, progress
src/components/             UI (tutor/, early/, ui/)
tests/                      Vitest unit + API tests; tests/e2e Playwright specs
scripts/                    asset generators
```

### API (PRD §11)

`POST/GET /api/documents` · `GET/DELETE /api/documents/:id` (`?page=N` for a page's text) ·
`POST /api/quizzes/generate` (NDJSON progress stream) · `GET /api/quizzes` · `GET/DELETE /api/quizzes/:id` ·
`PATCH/DELETE /api/quizzes/:id/questions/:qid` · `POST /api/quizzes/:id/questions/:qid/regenerate` ·
`POST /api/quizzes/:id/attempts` · `GET /api/attempts/:id` · `POST /api/attempts/:id/submit` ·
`GET /api/attempts/:id/results` · `GET /api/early/lessons?language=en|hi` · `GET /api/early/lessons/:language/:character` ·
`GET /api/status`. All inputs are validated with Zod; errors are `{ error: { message } }` without stack traces.
Uploads, generation and submissions are rate-limited per IP (best effort, per instance).

---

## Deployment (Vercel)

1. Push this folder to a Git repository and import it in Vercel (framework: Next.js, no build settings needed).
2. Optional env vars in *Project → Settings → Environment Variables*: `LLM_API_KEY` (and `LLM_MODEL`), and for
   durable data add **Upstash Redis** from the Vercel Marketplace (it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`).
3. Deploy. Or from the CLI: `vercel` (preview) / `vercel --prod`.

Platform notes:

* **Upload size**: Vercel functions reject request bodies over **4.5 MB**, so the effective limit there is
  4.5 MB (the UI shows it). Larger books: upload a chapter, or self-host.
* **Persistence**: without Upstash, uploads/quizzes live in the instance's `/tmp` and can disappear — the UI shows a
  "temporary" notice. The demo reader and all Early Learning content are built in and always available.
* **Timeouts**: generation and grading routes set `maxDuration` (60–120 s).

---

## Testing

* `npm test` — 73 Vitest tests (unit + route-handler/API) including: answer keys never sent before submission;
  demo mode with no key; invalid model JSON → one retry → safe failure; provider auth errors hidden; unsupported
  citations rejected; MCQ determinism; fill-blank normalisation; rubric scoring clamped and flagged; scanned and
  oversized PDFs; coordinate normalisation and coverage tiers (empty / partial / full / scribble).
* `npm run test:e2e` — 18 Playwright tests: full teacher → student → results flow, upload + preview + scanned
  error, setup validation, lesson audio/navigation, tracing (empty, partial with stroke hint, full, undo, guide
  toggle, show me), Hindi lesson, progress reset, no horizontal scroll at phone width, canvas-only scroll blocking.

### Manual acceptance checklist (PRD §15.2)

| Check | Status |
| --- | --- |
| Home on desktop and mobile | ✅ automated (layout) + manual screenshots |
| Generate a quiz from demo content | ✅ automated |
| Upload a searchable PDF; pages preserved | ✅ automated (`public/samples/sunny-steps-demo-reader.pdf`) |
| Invalid and oversized files | ✅ automated (API) + UI message |
| MCQ, fill-blank, short-answer and comprehension questions | ✅ demo bank; live mode needs a key |
| Citations support the question | ✅ citation drawer highlights the quote on the page |
| Edit a question, start a quiz | ✅ automated |
| Correct and incorrect MCQ scoring | ✅ automated |
| Semantically correct short answer, different wording | ⚠️ needs live mode (demo uses keywords) |
| English A: letter audio + two example words | ✅ automated (captions) — listen manually for audio quality |
| Hindi lesson: glyph rendering + audio fallback | ✅ glyphs automated; audio fallback by design |
| Trace with mouse and touch; clear and retry | ✅ mouse automated; touch uses the same pointer events — verify on a device |
| High, partial and empty traces | ✅ automated |
| Navigate letters while audio plays | ✅ audio stops on navigation |
| Refresh: persistence explained | ✅ storage notice in the tutor; progress in localStorage |
| Build and tests, no console errors | ✅ |

---

## Implemented vs deferred

**Implemented**: everything in the PRD's M1–M5 milestones, plus provider-agnostic live AI (Gemini, Groq,
OpenRouter, OpenAI, any OpenAI-compatible endpoint), hybrid retrieval, an optional AI grounding judge, question
regeneration, Upstash persistence, NDJSON progress streaming, and the automated test suites above.

**Deferred / limitations** — please read before relying on the prototype:

* **OCR** is not implemented: scanned PDFs are detected and rejected with an explanation.
* **Question-bank import** (PRD §6.3, optional) is not implemented; questions are labelled by origin
  (AI-generated, rule-based demo, reviewed demo set).
* **Hindi stroke order**: Hindi letters are traced over their outline without numbered strokes; authoring reviewed
  Devanagari stroke paths is future work. "Show me" is disabled for Hindi and says why.
* **Lowercase English** and the full Hindi alphabet (ऋ, अं, अः and remaining consonants) are not included yet.
* **Content review**: lesson words, feedback lines and Hindi text were curated for the prototype but have
  **not** been reviewed by a qualified teacher (`reviewed: false`). Voice clips are machine-generated placeholders
  (Microsoft Edge neural TTS: `en-IN-NeerjaNeural`, `hi-IN-SwaraNeural`); record real audio before classroom use.
* **Phoneme audio**: letter sounds are taught through the "A for apple" / "अ से अनार" cue and words, not isolated
  phoneme recordings.
* **Live-mode quality** depends on the chosen model; AI scores are estimates and flagged for review when uncertain.
* **Rate limiting** is per server instance (not shared across serverless instances).
* No authentication, roles, or multi-tenant separation (by design for the prototype).

## Content & licences

* Demo reader text and question bank: original, written for this prototype (`src/lib/tutor/demo-textbook.ts`).
* Pictures: [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Apache 2.0), plus two in-repo drawings.
* Fonts: Fraunces, Figtree, Geist Mono, Baloo 2 via `next/font` (SIL OFL). Hindi outlines derive from Baloo 2.
* Icons: Phosphor Icons (MIT).

## Troubleshooting

* **Still says "Demo mode" after adding a key** — restart `npm run dev`; check `GET /api/status` → `demoReason`.
* **"The model provider rejected the request"** — `LLM_MODEL` isn't available for that provider/key. List models
  with `curl -H "Authorization: Bearer $KEY" <base-url>/models`.
* **No sound** — check device volume; the lesson shows a read-aloud fallback when audio can't play. Hindi speech
  fallback requires a Hindi system voice; bundled clips don't.
* **Upload fails on Vercel with a large PDF** — the 4.5 MB platform limit; upload one chapter.
* **Playwright can't find Chrome** — install Chrome, or `npx playwright install chromium` and remove `channel`.
