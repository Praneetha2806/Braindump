import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Template, TemplateSpec } from "../shared/templates.ts";

export const DATA_DIR = path.resolve("data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "braindump.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000; -- wait for another writer instead of failing with "database is locked"

  -- The raw log. Never rewritten by the AI: it is the source of truth.
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL DEFAULT 'main',
    created_at INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' -- pending | done | error
  );
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, -- image | video | audio | file
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    stored_name TEXT NOT NULL,
    transcript TEXT
  );
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    image TEXT,
    site_name TEXT
  );

  -- Derived view of a message: what the organizer made of it.
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    category TEXT NOT NULL,
    topic TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    attachment_id TEXT REFERENCES attachments(id) ON DELETE CASCADE,
    link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
    done INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

  -- Custom templates: the user's prompt and the spec generated from it (JSON).
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    spec TEXT NOT NULL
  );
`);

export const newId = () => crypto.randomUUID();

export type Attachment = {
  id: string;
  kind: "image" | "video" | "audio" | "file";
  filename: string;
  mime: string;
  size: number;
  url: string;
  transcript: string | null;
};
export type Link = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
};
export type Item = {
  id: string;
  category: string;
  topic: string | null;
  title: string;
  body: string;
  attachment_id: string | null;
  link_id: string | null;
  done: boolean;
};
export type Message = {
  id: string;
  created_at: number;
  text: string;
  status: "pending" | "done" | "error";
  attachments: Attachment[];
  links: Link[];
  items: Item[];
};

type Row = Record<string, any>;

export function storedPath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}

function hydrate(m: Row): Message {
  const attachments = (db.prepare("SELECT * FROM attachments WHERE message_id = ? ORDER BY rowid").all(m.id) as Row[]).map(
    (a) => ({
      id: a.id,
      kind: a.kind,
      filename: a.filename,
      mime: a.mime,
      size: a.size,
      url: `/uploads/${a.stored_name}`,
      transcript: a.transcript,
    }),
  );
  const links = db.prepare("SELECT id, url, title, description, image, site_name FROM links WHERE message_id = ? ORDER BY rowid").all(m.id) as Link[];
  const items = (db.prepare("SELECT * FROM items WHERE message_id = ? ORDER BY position").all(m.id) as Row[]).map((i) => ({
    id: i.id,
    category: i.category,
    topic: i.topic,
    title: i.title,
    body: i.body,
    attachment_id: i.attachment_id,
    link_id: i.link_id,
    done: !!i.done,
  }));
  return { id: m.id, created_at: m.created_at, text: m.text, status: m.status, attachments, links, items };
}

export function listMessages(conversationId = "main"): Message[] {
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at").all(conversationId) as Row[];
  return rows.map(hydrate);
}

export function getMessage(id: string): Message | null {
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row | undefined;
  return row ? hydrate(row) : null;
}

export function getStoredName(attachmentId: string): string {
  return (db.prepare("SELECT stored_name FROM attachments WHERE id = ?").get(attachmentId) as Row).stored_name;
}

export function insertMessage(
  text: string,
  attachments: { kind: Attachment["kind"]; filename: string; mime: string; size: number; storedName: string; transcript: string | null }[],
): Message {
  const id = newId();
  db.prepare("INSERT INTO messages (id, created_at, text) VALUES (?, ?, ?)").run(id, Date.now(), text);
  const ins = db.prepare(
    "INSERT INTO attachments (id, message_id, kind, filename, mime, size, stored_name, transcript) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const a of attachments) ins.run(newId(), id, a.kind, a.filename, a.mime, a.size, a.storedName, a.transcript);
  return getMessage(id)!;
}

export function replaceLinks(messageId: string, links: Omit<Link, "id">[]) {
  db.prepare("DELETE FROM links WHERE message_id = ?").run(messageId);
  const ins = db.prepare("INSERT INTO links (id, message_id, url, title, description, image, site_name) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const l of links) ins.run(newId(), messageId, l.url, l.title, l.description, l.image, l.site_name);
}

export function replaceItems(messageId: string, items: Omit<Item, "id" | "done">[]) {
  db.prepare("DELETE FROM items WHERE message_id = ?").run(messageId);
  const ins = db.prepare(
    "INSERT INTO items (id, message_id, position, category, topic, title, body, attachment_id, link_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  items.forEach((i, pos) => ins.run(newId(), messageId, pos, i.category, i.topic, i.title, i.body, i.attachment_id, i.link_id));
}

export function setStatus(messageId: string, status: Message["status"]) {
  db.prepare("UPDATE messages SET status = ? WHERE id = ?").run(status, messageId);
}

export function updateItem(id: string, patch: { done?: boolean; category?: string }): string | null {
  if (patch.done !== undefined) db.prepare("UPDATE items SET done = ? WHERE id = ?").run(patch.done ? 1 : 0, id);
  if (patch.category !== undefined) db.prepare("UPDATE items SET category = ? WHERE id = ?").run(patch.category, id);
  const row = db.prepare("SELECT message_id FROM items WHERE id = ?").get(id) as Row | undefined;
  return row?.message_id ?? null;
}

export function deleteMessage(id: string): string[] {
  const files = (db.prepare("SELECT stored_name FROM attachments WHERE message_id = ?").all(id) as Row[]).map((r) => r.stored_name);
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
  return files;
}

export function pendingMessageIds(): string[] {
  return (db.prepare("SELECT id FROM messages WHERE status = 'pending'").all() as Row[]).map((r) => r.id);
}

/** Topics already in use per category, so new items reuse them instead of inventing near-duplicates. */
export function existingTopics(): Record<string, string[]> {
  const rows = db.prepare("SELECT category, topic, COUNT(*) n FROM items WHERE topic IS NOT NULL GROUP BY category, topic ORDER BY n DESC").all() as Row[];
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.category] ??= []).push(r.topic);
  return out;
}

// ---------- Templates ----------

const toTemplate = (r: Row): Template => ({ id: r.id, created_at: r.created_at, prompt: r.prompt, spec: JSON.parse(r.spec) });

export function listTemplates(): Template[] {
  return (db.prepare("SELECT * FROM templates ORDER BY created_at").all() as Row[]).map(toTemplate);
}

export function insertTemplate(prompt: string, spec: TemplateSpec): Template {
  const id = newId();
  db.prepare("INSERT INTO templates (id, created_at, prompt, spec) VALUES (?, ?, ?, ?)").run(id, Date.now(), prompt, JSON.stringify(spec));
  return toTemplate(db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as Row);
}

export function updateTemplate(id: string, prompt: string, spec: TemplateSpec): Template | null {
  db.prepare("UPDATE templates SET prompt = ?, spec = ? WHERE id = ?").run(prompt, JSON.stringify(spec), id);
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as Row | undefined;
  return row ? toTemplate(row) : null;
}

export function deleteTemplate(id: string) {
  db.prepare("DELETE FROM templates WHERE id = ?").run(id);
}
