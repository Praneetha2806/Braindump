import { api } from "../api.ts";
import { CATEGORIES } from "../../shared/categories.ts";
import type { Entry } from "../doc.ts";

/** Hover actions on any organized item: fix its category, or jump to the original message. */
export function ItemActions({ e, onJumpToMessage }: { e: Entry; onJumpToMessage: (messageId: string) => void }) {
  return (
    <span className="item-actions">
      <select
        value={e.category}
        title="Move to another category"
        onChange={(ev) => api.patchItem(e.id, { category: ev.target.value })}
        onClick={(ev) => ev.stopPropagation()}
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.label}
          </option>
        ))}
      </select>
      <button title="Show the original message" onClick={() => onJumpToMessage(e.message.id)}>
        ↗
      </button>
    </span>
  );
}
