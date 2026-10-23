// Sample data that ships with the repo, so a fresh clone opens with the same log, documents and templates.
//   npm run seed:export   copy the current data/ into seed/ (commit the result)
//   On startup, an empty database is filled from seed/ automatically.
import fs from "node:fs";
import path from "node:path";
import { db, UPLOAD_DIR } from "./db.ts";

const SEED_DIR = path.resolve("seed");
const SEED_FILE = path.join(SEED_DIR, "seed.json");
const SEED_UPLOADS = path.join(SEED_DIR, "uploads");
const TABLES = ["messages", "attachments", "links", "items", "templates"] as const;

type Row = Record<string, string | number | null>;

export function exportSeed() {
  const data = Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Row[]]));
  fs.rmSync(SEED_DIR, { recursive: true, force: true });
  fs.mkdirSync(SEED_UPLOADS, { recursive: true });
  for (const a of data.attachments) fs.copyFileSync(path.join(UPLOAD_DIR, String(a.stored_name)), path.join(SEED_UPLOADS, String(a.stored_name)));
  fs.writeFileSync(SEED_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`Exported ${TABLES.map((t) => `${data[t].length} ${t}`).join(", ")} to seed/`);
}

/** Fills an empty database from seed/. Does nothing once there is any data, so it never touches someone's own notes. */
export function importSeedIfEmpty() {
  if (!fs.existsSync(SEED_FILE)) return;
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  if (count("messages") > 0 || count("templates") > 0) return;

  const data: Record<(typeof TABLES)[number], Row[]> = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  db.exec("BEGIN");
  try {
    for (const t of TABLES) {
      for (const row of data[t] ?? []) {
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => row[c]));
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  for (const a of data.attachments ?? []) {
    const from = path.join(SEED_UPLOADS, String(a.stored_name));
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(UPLOAD_DIR, String(a.stored_name)));
  }
  console.log(`Loaded sample data from seed/ (${data.messages.length} messages, ${data.templates?.length ?? 0} templates)`);
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv[2] === "export") exportSeed();
