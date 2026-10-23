import type { Attachment, Item, Link, Message } from "./api.ts";

/** An organized item joined with the message it came from and the media it points at. */
export type Entry = Item & { message: Message; attachment?: Attachment; link?: Link };

export const toEntries = (m: Message): Entry[] =>
  m.items.map((i) => ({
    ...i,
    message: m,
    attachment: m.attachments.find((a) => a.id === i.attachment_id),
    link: m.links.find((l) => l.id === i.link_id),
  }));

/** The picture to show for an entry, if it has one (uploaded image, or a link's preview image). */
export const visualOf = (e: Entry): string | undefined =>
  e.attachment?.kind === "image" ? e.attachment.url : e.link?.image ?? undefined;

const truncates = (title: string, body: string) => title.endsWith("…") && body.startsWith(title.slice(0, -1));

/** The title to display: the full text when the stored title is just a truncated copy of the body. */
export const headline = (e: Entry) => (truncates(e.title, e.body) ? e.body : e.title);

/** Body text worth showing under the headline (skips bodies that just repeat it). */
export const extraBody = (e: Entry) => (!e.body || e.body === e.title || truncates(e.title, e.body) || e.title.startsWith(e.body) ? "" : e.body);

/** Stable non-negative hash of a string, for picking per-item variations that don't change between renders. */
export function hash(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}
