import type { Message } from "../server/db.ts";

export type { Message, Item, Attachment, Link } from "../server/db.ts";
export type { Template, TemplateSpec } from "../shared/templates.ts";
import type { Template } from "../shared/templates.ts";
export type Pending = { file: File; transcript?: string; preview?: string };
export type ServerEvent = { type: "message"; message: Message } | { type: "deleted"; id: string };

async function ok(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res;
}

export const api = {
  /** The static demo build (src/demo/api.ts) swaps this module out and sets this to true. */
  demo: false,
  /** Live updates. onOpen fires on every (re)connect so the caller can reload anything it missed. */
  subscribe: (onEvent: (e: ServerEvent) => void, onOpen: () => void) => {
    const es = new EventSource("/api/events");
    es.onopen = onOpen;
    es.onmessage = (ev) => onEvent(JSON.parse(ev.data));
    return () => es.close();
  },
  status: (): Promise<{ ai: boolean }> => fetch("/api/status").then((r) => r.json()),
  list: (): Promise<Message[]> => fetch("/api/messages").then((r) => r.json()),
  send: async (text: string, files: Pending[]): Promise<Message> => {
    const form = new FormData();
    form.append("text", text);
    for (const p of files) form.append("files", p.file);
    form.append("transcripts", JSON.stringify(files.map((p) => p.transcript ?? null)));
    return (await ok(await fetch("/api/messages", { method: "POST", body: form }))).json();
  },
  remove: (id: string) => fetch(`/api/messages/${id}`, { method: "DELETE" }).then(ok),
  reorganize: (id: string) => fetch(`/api/messages/${id}/reorganize`, { method: "POST" }).then(ok),
  templates: {
    list: (): Promise<Template[]> => fetch("/api/templates").then((r) => r.json()),
    create: async (prompt: string): Promise<Template> =>
      (await ok(await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }))).json(),
    update: async (id: string, prompt: string): Promise<Template> =>
      (await ok(await fetch(`/api/templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }))).json(),
    remove: (id: string) => fetch(`/api/templates/${id}`, { method: "DELETE" }).then(ok),
  },
  patchItem: (id: string, patch: { done?: boolean; category?: string }) =>
    fetch(`/api/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then(ok),
};
