import type { Attachment, Link } from "../api.ts";
import { formatSize } from "../format.ts";

const URL_SPLIT = /(https?:\/\/[^\s<>"'，。！？、）)\]]+)/gi;

/** Renders plain text with URLs turned into links. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export const fileIcon = (mime: string) =>
  mime === "application/pdf" ? "📕" : mime.includes("sheet") || mime.includes("csv") ? "📊" : mime.includes("zip") ? "🗜️" : mime.startsWith("text/") ? "📄" : "📁";

export function FileChip({ a }: { a: Attachment }) {
  return (
    <a className="file-chip" href={a.url} target="_blank" rel="noreferrer" download={a.filename}>
      <span className="file-chip-icon">{fileIcon(a.mime)}</span>
      <span className="file-chip-name">{a.filename}</span>
      <span className="file-chip-size">{formatSize(a.size)}</span>
    </a>
  );
}

export function VoiceNote({ a }: { a: Attachment }) {
  return (
    <div className="voice">
      <audio src={a.url} controls preload="metadata" />
      {a.transcript && <p className="voice-transcript">“{a.transcript}”</p>}
    </div>
  );
}

export function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === "image")
    return (
      <a className="att-image" href={a.url} target="_blank" rel="noreferrer">
        <img src={a.url} alt={a.filename} loading="lazy" />
      </a>
    );
  if (a.kind === "video") return <video className="att-video" src={a.url} controls preload="metadata" />;
  if (a.kind === "audio") return <VoiceNote a={a} />;
  return <FileChip a={a} />;
}

export function LinkCard({ link, compact = false }: { link: Link; compact?: boolean }) {
  const host = (() => {
    try {
      return new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      return link.url;
    }
  })();
  return (
    <a className={`link-card ${compact ? "compact" : ""}`} href={link.url} target="_blank" rel="noreferrer">
      {link.image && !compact && <img className="link-card-img" src={link.image} alt="" loading="lazy" />}
      <span className="link-card-text">
        <span className="link-card-site">
          {link.site_name ?? host}
        </span>
        <span className="link-card-title">{link.title ?? link.url}</span>
        {link.description && !compact && <span className="link-card-desc">{link.description}</span>}
      </span>
    </a>
  );
}
