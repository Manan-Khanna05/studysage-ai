# StudySage AI

An AI study copilot that turns lecture notes into a **summary, flashcards and a quiz** — plus a Pomodoro study timer.

Paste notes (or upload a `.txt` / `.md` file), click **Generate**, and StudySage builds your study pack in seconds. Progress — known flashcards, best quiz score, completed focus sessions — is saved in `localStorage` on your device.

> **AI honesty:** StudySage uses **on-device, rule-based AI only**. Summaries are extractive (sentences scored by keyword frequency and position), flashcards are cloze + "What is X?" cards built from key sentences, and quizzes are generated from extracted facts with keyword distractors. **No GPT, no OpenAI, no external API call, no API key needed.** The same engine runs in the browser (`src/lib/ai.ts`) and on the server (`server/ai.js`).

## Features

- **Summary** — top 5 sentences, in reading order, plus the top 10 key terms as chips
- **Flashcards** — flip, shuffle, previous / next, mark *I know this* / *Still learning*; known cards persist in localStorage
- **Quiz** — 6 questions (3 multiple-choice + 3 fill-in-the-blank), scored, with a review of every answer at the end; best score saved
- **Pomodoro timer** — 25 min focus / 5 min short break / 15 min long break, with completed-session count
- **Sample notes** — "Try sample DBMS notes" loads a full DBMS lecture-notes sample, so the app works instantly
- **File upload** — `.txt` / `.md` lecture notes

## UI

Clean, professional **Apple Light System** UI, following `apple.com-design.md`:
primary `#0071e3`, secondary `#2997ff`, tertiary `#0066cc`, neutral `#f5f5f7`, surface `#ffffff`, on-surface `#1d1d1f`, error `#d92d20`, border `#e5e7eb`;
SF Pro Display / Text (system fallback), headlines 56 / 47 / 40 px, body 17 px / 1.47;
pill buttons (9999 px radius, 44 px height, 11 px 21 px padding);
white cards with a 1 px `#e5e7eb` border and 4–8 px radius, **no heavy shadows, no gradients**, airy centred layout with 24 / 54 / 70 px section spacing.

## Tech stack

- **Frontend:** Vite + React 18 + TypeScript
- **Backend:** Node + Express (`server/`)
- **Storage:** localStorage only — no database, no account

## Run it

```bash
npm install
npm run dev      # starts the Express API on :4000 and Vite on :5173
```

Open http://localhost:5173, paste notes (or click "Try sample DBMS notes"), then click **Generate summary, flashcards & quiz**.

Production:

```bash
npm run build    # tsc + vite build
npm start        # Express serves the API and the built frontend on :4000
```

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | `{ status: "ok", service: "studysage-ai", ai: "local-rule-based" }` |
| `POST` | `/api/analyze` | Body `{ "text": "..." }` (min. 100 chars). Returns `{ stats, summary, keywords, flashcards, quiz, method }` |

Example:

```bash
curl -X POST http://localhost:4000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"text": "A database is an organised collection of related data. A DBMS is software that lets users create, read, update and delete data..."}'
```

Response shape:

```json
{
  "stats": { "characters": 1234, "words": 210, "sentences": 18 },
  "summary": ["A database is an organised collection of related data ...", "..."],
  "keywords": [{ "word": "database", "count": 12 }],
  "flashcards": [{ "id": "fc-1", "front": "What is a database?", "back": "...", "type": "definition" }],
  "quiz": [{ "id": "q-1", "type": "mcq", "question": "...", "options": ["..."], "answer": "database", "explanation": "..." }]
}
```

## How the AI works

1. **Tokenise** the notes, remove English stopwords, count keyword frequencies.
2. **Score every sentence** by average keyword frequency, with a small bonus for early sentences and a penalty for very long ones.
3. **Summary** = the 5 highest-scoring sentences, returned in original order.
4. **Flashcards** = the highest-scoring sentences turned into cloze cards (key term blanked out) or "What is X?" cards for definition sentences.
5. **Quiz** = the same key sentences as fill-in-the-blank, plus MCQ versions where the other top keywords act as distractors.

Limitations, stated plainly: it can only reuse what is in the notes — it cannot add outside knowledge, and a short or repetitive note set gives weaker cards and quizzes.

## Screenshots

_Screenshots coming soon — run `npm run dev`, load the sample DBMS notes, and capture Summary / Flashcards / Quiz / Timer._

## Project structure

```
studysage-ai/
├── src/                 # React frontend (App.tsx, App.css, lib/ai.ts, data/sampleNotes.ts)
├── server/              # Express API (index.js) + AI engine (ai.js)
├── samples/             # Sample lecture notes (dbms-notes.md)
├── scripts/dev.mjs      # Starts API + Vite together for `npm run dev`
├── index.html
├── vite.config.ts       # Proxies /api to the Express server in dev
└── package.json
```

## License

MIT — see [LICENSE](LICENSE). Copyright 2026 Manan Khanna.
