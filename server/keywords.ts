// Builds shared/keywords.json: a vocabulary per category, grown from a few seed words with WordNet synonyms.
//   npm run keywords   regenerate it (review the output, then add noisy words to EXCLUDE and run again)
// WordNet (the wordnet-db dev dependency) is only read here, never shipped with the app.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { CategoryId } from "../shared/categories.ts";

const WORDNET_DIR: string = createRequire(import.meta.url)("wordnet-db").path;
const OUT_FILE = path.resolve("shared/keywords.json");

type Pos = "noun" | "verb" | "adj";
/** A seed word. senses: which of its WordNet meanings to take synonyms from, 1 = most common (the default).
 *  Pick the meaning that fits the category: "call" sense 3 is phoning, sense 1 is naming.
 *  hyponyms: also take the more specific kinds of it ("document" → "certificate", "voucher"). */
type Seed = { word: string; pos: Pos; senses?: number[]; hyponyms?: boolean };

const n = (word: string, opts: Partial<Seed> = {}): Seed => ({ word, pos: "noun", ...opts });
const v = (word: string, opts: Partial<Seed> = {}): Seed => ({ word, pos: "verb", ...opts });
const a = (word: string, opts: Partial<Seed> = {}): Seed => ({ word, pos: "adj", ...opts });

const SEEDS: Record<CategoryId, Seed[]> = {
  todo: [
    ...["buy", "email", "submit", "pay", "schedule", "fix", "finish", "renew", "review", "reply", "remind", "prepare", "clean", "cancel", "complete"].map((w) => v(w)),
    v("call", { senses: [3] }),
    v("send", { senses: [3] }),
    v("book", { senses: [2] }),
    v("plan", { senses: [2] }),
    v("order", { senses: [2] }),
    v("arrange", { senses: [2] }),
    v("organize", { senses: [4] }),
    ...["task", "chore", "errand", "reminder", "deadline", "checklist", "priority"].map((w) => n(w)),
    n("appointment", { senses: [2] }),
    n("meeting", { senses: [1, 2] }),
    n("assignment", { senses: [5] }),
    ...["urgent", "important", "overdue", "pending"].map((w) => a(w)),
  ],
  idea: [
    ...["idea", "concept", "proposal", "suggestion", "invention", "hypothesis", "vision", "brainstorm"].map((w) => n(w)),
    n("notion", { senses: [3] }),
    ...["imagine", "invent", "propose", "brainstorm"].map((w) => v(w)),
  ],
  link: [
    ...["article", "website", "tutorial", "podcast", "blog", "newsletter", "bookmark", "resource", "tool"].map((w) => n(w)),
    n("video", { senses: [2] }),
    n("paper", { senses: [5] }),
    ...["read", "watch", "bookmark"].map((w) => v(w)),
  ],
  inspiration: [
    ...["inspiration", "palette", "typography", "font", "layout", "aesthetic", "design", "illustration", "color", "texture", "gradient", "interior", "outfit", "reference"].map((w) => n(w)),
    n("style", { senses: [2, 4] }),
  ],
  moment: [
    ...["photo", "picture", "sunset", "trip", "vacation", "memory", "dinner", "lunch", "celebration", "weekend", "walk", "friend"].map((w) => n(w)),
    n("party", { senses: [2, 4] }),
    n("view", { senses: [2] }),
    n("family", { senses: [2] }),
  ],
  note: [
    ...["thought", "feeling", "reflection", "fact", "insight", "mood", "journal", "diary"].map((w) => n(w)),
    n("observation", { senses: [3] }),
    n("lesson", { senses: [3] }),
    ...["feel", "realize", "notice", "wonder", "learn"].map((w) => v(w)),
  ],
  file: [
    n("document", { hyponyms: true }),
    ...["file", "pdf", "invoice", "contract", "report", "spreadsheet", "presentation", "certificate", "ticket"].map((w) => n(w)),
    n("receipt", { senses: [2] }),
    n("resume", { senses: [2] }),
  ],
};

/** Words WordNet suggests that don't fit the category. Add to these after reviewing the output. */
const EXCLUDE: Partial<Record<CategoryId, string[]>> = {
  todo: ["bushel", "doctor", "furbish up", "touch on", "restore", "set", "hold", "scratch", "scrub", "labor", "precedence", "precedency", "of import", "delinquent", "regenerate"],
  idea: ["thought", "insight", "design", "excogitation", "excogitate", "forge", "advise"],
  link: ["bookmarker"],
  inspiration: ["pallet", "face", "case", "inside", "mention"],
  moment: ["icon", "ikon", "dejeuner", "aspect", "prospect"],
  note: ["idea", "penetration", "temper", "humor", "humour", "agnize", "agnise", "find", "larn", "acquire"],
  file: [
    "ballot", "brevet", "capitulation", "charter", "confession", "copyright", "enclosure", "inclosure", "papyrus", "patent",
    "patent of invention", "platform", "political platform", "political program", "program", "resolution", "declaration",
    "resolve", "source", "specification", "study", "instrument", "legal instrument", "commercial instrument", "resignation", "account",
  ],
};

// ---------- WordNet ----------
// index.<pos>: "lemma pos synset_cnt p_cnt [ptr×p_cnt] sense_cnt tagsense_cnt offset×synset_cnt", most common sense first.
// data.<pos>:  "offset lex_filenum ss_type w_cnt(hex) [word lex_id]×w_cnt p_cnt [symbol offset pos src/tgt]×p_cnt … | gloss".

const files = new Map<string, { index: Map<string, string[]>; data: Buffer }>();
function load(pos: Pos) {
  if (!files.has(pos)) {
    const index = new Map<string, string[]>();
    for (const line of fs.readFileSync(path.join(WORDNET_DIR, `index.${pos}`), "utf8").split("\n")) {
      if (!line || line.startsWith(" ")) continue;
      const f = line.trim().split(" ");
      const synsets = Number(f[2]);
      index.set(f[0], f.slice(f.length - synsets));
    }
    files.set(pos, { index, data: fs.readFileSync(path.join(WORDNET_DIR, `data.${pos}`)) });
  }
  return files.get(pos)!;
}

type Synset = { words: string[]; hyponyms: string[]; gloss: string };
function synset(pos: Pos, offset: string): Synset {
  const { data } = load(pos);
  const start = Number(offset);
  const line = data.toString("utf8", start, data.indexOf(10, start));
  const [head, gloss = ""] = line.split(" | ");
  const f = head.split(" ");
  const count = parseInt(f[3], 16);
  const words = Array.from({ length: count }, (_, i) => f[4 + i * 2]);
  const p = 4 + count * 2;
  const hyponyms: string[] = [];
  for (let i = 0; i < Number(f[p]); i++) {
    const [symbol, target] = f.slice(p + 1 + i * 4, p + 3 + i * 4);
    if (symbol === "~") hyponyms.push(target);
  }
  return { words, hyponyms, gloss: gloss.split(";")[0].trim() };
}

/** "pick_up" → "pick up", "CV" → "cv"; drops proper nouns ("Google") and long phrases. */
function clean(word: string): string | null {
  let w = word.replace(/\(\w+\)$/, "").replace(/_/g, " ");
  if (/^[A-Z]+$/.test(w)) w = w.toLowerCase();
  if (/[A-Z]/.test(w) || w.split(" ").length > 3 || /\d/.test(w)) return null;
  return w;
}

// ---------- Build ----------

type Found = { word: string; from: string; gloss: string };

function expand(seed: Seed): Found[] {
  const offsets = load(seed.pos).index.get(seed.word.replace(/ /g, "_")) ?? [];
  const picked = (seed.senses ?? [1]).map((i) => offsets[i - 1]).filter(Boolean);
  const out: Found[] = [];
  for (const off of picked) {
    const s = synset(seed.pos, off);
    const related = [s, ...(seed.hyponyms ? s.hyponyms.map((h) => synset(seed.pos, h)) : [])];
    for (const r of related) for (const w of r.words) {
      const word = clean(w);
      if (word) out.push({ word, from: seed.word, gloss: r.gloss });
    }
  }
  return out;
}

const result: Record<string, string[]> = {};
const review: Record<string, Found[]> = {};
const missing: string[] = [];
for (const [category, seeds] of Object.entries(SEEDS) as [CategoryId, Seed[]][]) {
  const seen = new Map<string, Found>();
  for (const s of seeds) {
    seen.set(s.word, seen.get(s.word) ?? { word: s.word, from: "seed", gloss: "" });
    const found = expand(s);
    if (!found.length) missing.push(`${category}: ${s.word} (${s.pos})`);
    for (const f of found) if (!seen.has(f.word)) seen.set(f.word, f);
  }
  for (const x of EXCLUDE[category] ?? []) seen.delete(x);
  review[category] = [...seen.values()];
  result[category] = [...seen.keys()].sort();
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + "\n");
const total = Object.values(result).reduce((s, l) => s + l.length, 0);
console.log(`Wrote ${total} keywords to shared/keywords.json (${Object.entries(result).map(([c, l]) => `${c} ${l.length}`).join(", ")})`);
if (missing.length) console.log(`Not in WordNet, kept as-is: ${missing.join("; ")}`);

// Words found in more than one category: worth a look, since they can't decide a category on their own.
const owners = new Map<string, string[]>();
for (const [c, words] of Object.entries(result)) for (const w of words) owners.set(w, [...(owners.get(w) ?? []), c]);
const shared = [...owners].filter(([, cs]) => cs.length > 1);
if (shared.length) console.log(`In several categories: ${shared.map(([w, cs]) => `${w} (${cs.join(", ")})`).join("; ")}`);

if (process.argv.includes("--review")) console.log(JSON.stringify(review));
