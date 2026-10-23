# BrainDump

Dump anything into a chat (text, links, images, video, files, voice). It gets turned into a document automatically, in one of two built-in templates, or in templates you describe yourself:

- **📔 Journal:** one magazine-style spread per day: a cover illustration, a serif date headline, then sections instead of a timeline (notes with a drop cap, a to-do checklist, a photo grid, ideas as pull quotes, further reading, voice memos). Wide and narrow sections alternate left and right across a 12-column grid (`arrange()` in `JournalView.tsx`).
- **🗂️ Organized:** a Notion-style page with everything regrouped by intent (to-dos, ideas, saved links, inspiration, moments, notes, files), then by topic.
- **＋ Custom templates:** describe a page in words ("a weekly review of my ideas and notes, in a serif magazine style") and it becomes a new tab. Claude turns the prompt into a template spec (`shared/templates.ts`): which categories to show, grouping (day / week / month / category / topic), layout (list / cards / gallery / checklist / timeline), sort order, and style (font, accent color, density). The app renders your entries with that spec, so a template can't produce a broken page. Without an API key, a keyword matcher builds the spec instead. Templates can be edited (re-prompted) or deleted from their page.

The chat log is the source of truth: the organizer never rewrites your messages. It only adds "items" derived from them, and you can re-run it on any message.

## Run

```bash
npm install
cp .env.example .env   # optional: add ANTHROPIC_API_KEY for AI categorization
npm run dev            # http://localhost:5173
```

You need Node 23.4 or newer, because the app uses the built-in `node:sqlite`.

The repo ships with sample data in `seed/` (the log, its images and voice memos, and a few custom templates). The first time the app starts with an empty database, it loads that sample automatically, so a fresh clone looks the same as the original. Your own entries are saved in `data/`, which is not committed. To update the sample from your current data, run `npm run seed:export` and commit `seed/`. To start from a blank log instead, delete `seed/seed.json` before the first run.

If you don't set `ANTHROPIC_API_KEY`, a rule-based categorizer is used instead. It handles the obvious cases: links, images, bulleted to-do lists, and "Idea:" prefixes.

To run a production build: `npm run build && npm start`.

`npm run build:demo` builds a shareable snapshot of your current data as one HTML file, `dist-demo/braindump-demo.html`, with every image inlined and no server needed. Viewers can send messages (sorted by the rule-based categorizer in their browser), switch templates, tick to-dos, and change categories. Nothing is saved, so changes reset on reload.

## How it works

| Piece | File |
|---|---|
| HTTP API, uploads, live updates (SSE), Vite dev middleware | `server/index.ts` |
| SQLite schema: `messages` → `attachments`, `links`, `items` | `server/db.ts` |
| Link previews (Open Graph) | `server/links.ts` |
| Categorizer: Claude with structured output, plus the rule fallback | `server/classify.ts` |
| Category list (shared by server and UI) | `shared/categories.ts` |
| Rule-based categorizer: splits a message into one item per intent | `shared/rules.ts` |
| Template spec + keyword fallback; Claude template generator | `shared/templates.ts`, `server/templates.ts` |
| Template page and prompt dialog | `src/components/TemplateView.tsx`, `TemplateDialog.tsx` |
| Chat log + composer (paste, drag-drop, voice) | `src/components/Chat.tsx`, `Composer.tsx` |
| Templates | `src/components/JournalView.tsx`, `OrganizedView.tsx` |

Pipeline per message: save the raw message and files → fetch link previews → classify into items (one message can produce several items, e.g. two to-dos and a link) → push the update to the browser.

Voice memos are recorded in the browser. While recording, the browser's Web Speech API (Chrome, Edge, Safari) produces a transcript, and that transcript is what gets categorized.

Data lives in `data/` (the SQLite DB plus uploaded files).
