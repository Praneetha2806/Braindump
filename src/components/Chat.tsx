import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, type Message } from "../api.ts";
import { CATEGORIES } from "../../shared/categories.ts";
import { dayKey, formatDay, formatTime, groupBy } from "../format.ts";
import { AttachmentView, LinkCard, Linkified } from "./Media.tsx";
import { Composer } from "./Composer.tsx";
import { COVERS } from "../covers.ts";

type Props = {
  messages: Message[];
  onJumpToItem: (itemId: string) => void;
};

export function Chat({ messages, onJumpToItem }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);

  // Keep the view pinned to the newest message unless the user scrolled up to read history.
  const pinToBottom = () => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  };
  useLayoutEffect(pinToBottom, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => (stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      className={`chat ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        setDropped([...e.dataTransfer.files]);
      }}
    >
      <header className="chat-header">
        <div className="brand">
          <span className="brand-mark">🧠</span>
          <span>BrainDump</span>
        </div>
        <span className="chat-count">{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
      </header>

      <div
        className="chat-list"
        ref={listRef}
        // Images and videos load after the first scroll; keep the newest message in view as they grow the list.
        onLoadCapture={pinToBottom}
        onLoadedMetadataCapture={pinToBottom}
      >
        {messages.length === 0 && (
          <div className="empty">
            <img src={COVERS.toast} alt="" />
            <h2>Empty your head here</h2>
            <p>To-dos, ideas, links, screenshots, inspiration, voice memos. Send them as they come and Docs sorts them for you.</p>
          </div>
        )}
        {groupBy(messages, (m) => dayKey(m.created_at)).map(([day, msgs]) => {
          const d = formatDay(msgs[0].created_at);
          return (
            <div key={day}>
              <div className="day-sep">
                <span>
                  {d.rel}
                  {d.weekday}, {d.date}
                </span>
              </div>
              {msgs.map((m) => (
                <Bubble key={m.id} m={m} onJumpToItem={onJumpToItem} />
              ))}
            </div>
          );
        })}
      </div>

      <Composer dropped={dropped} onDroppedConsumed={() => setDropped([])} />
      {dragging && <div className="drop-overlay">Drop to add</div>}
    </section>
  );
}

function Bubble({ m, onJumpToItem }: { m: Message; onJumpToItem: (itemId: string) => void }) {
  // Links without a fetched preview yet are still shown inline in the text.
  return (
    <div className="msg" id={`msg-${m.id}`}>
      <div className="msg-body">
        {m.attachments.length > 0 && (
          <div className={`msg-atts n${Math.min(m.attachments.length, 3)}`}>
            {m.attachments.map((a) => (
              <AttachmentView key={a.id} a={a} />
            ))}
          </div>
        )}
        {m.text && (
          <div className="bubble">
            <Linkified text={m.text} />
          </div>
        )}
        {m.links.map((l) => (
          <LinkCard key={l.id} link={l} compact />
        ))}
      </div>
      <div className="msg-meta">
        {/* Delete/re-organize need the server (and confirm() doesn't work inside a shared Artifact). */}
        {!api.demo && <MessageMenu m={m} />}
        <Status m={m} onJumpToItem={onJumpToItem} />
        <time dateTime={new Date(m.created_at).toISOString()}>{formatTime(m.created_at)}</time>
      </div>
    </div>
  );
}

function Status({ m, onJumpToItem }: { m: Message; onJumpToItem: (itemId: string) => void }) {
  if (m.status === "pending") return <span className="status pending">Sorting…</span>;
  if (m.status === "error")
    return (
      <button className="status error" onClick={() => api.reorganize(m.id)}>
        Couldn't sort · Retry
      </button>
    );
  return (
    <span className="status-chips">
      {CATEGORIES.map((c) => {
        const items = m.items.filter((i) => i.category === c.id);
        if (!items.length) return null;
        return (
          <button key={c.id} className={`tag cat-${c.id}`} onClick={() => onJumpToItem(items[0].id)} title="Show in Docs">
            {c.emoji} {c.label}
            {items.length > 1 ? ` ×${items.length}` : ""}
          </button>
        );
      })}
    </span>
  );
}

function MessageMenu({ m }: { m: Message }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="msg-menu">
      <button className="msg-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="More">
        ···
      </button>
      {open && (
        <span className="msg-menu-pop" onMouseLeave={() => setOpen(false)}>
          <button
            onClick={() => {
              setOpen(false);
              api.reorganize(m.id);
            }}
          >
            Sort again
          </button>
          <button
            className="danger"
            onClick={() => {
              setOpen(false);
              if (confirm("Delete this message? Everything sorted from it is deleted too.")) api.remove(m.id);
            }}
          >
            Delete
          </button>
        </span>
      )}
    </span>
  );
}
