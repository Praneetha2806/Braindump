import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  "A weekly review of my ideas and notes, in a serif magazine style",
  "A reading list of everything I saved, as a compact list",
  "A moodboard gallery of my inspiration images",
  "Open to-dos grouped by topic, as a green checklist",
  "A timeline of my day, oldest first, in a typewriter font",
];

type Props = {
  initialPrompt?: string;
  editing: boolean;
  ai: boolean;
  onSubmit: (prompt: string) => Promise<void>;
  onClose: () => void;
};

/** Prompt box for creating a template, or changing the prompt of an existing one. */
export function TemplateDialog({ initialPrompt = "", editing, ai, onSubmit, onClose }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(prompt.trim());
    } catch (e) {
      console.error(e);
      setError("Couldn't make the template. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="tpl-dialog-title">
        <h2 id="tpl-dialog-title">{editing ? "Edit template" : "New template"}</h2>
        <p className="dialog-lede">Describe the page you want. What should it show, how should it be grouped, and how should it look?</p>
        <textarea
          id="tpl-prompt"
          ref={textRef}
          rows={3}
          value={prompt}
          placeholder="e.g. A weekly review of my ideas and notes, in a serif magazine style"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          disabled={busy}
        />
        {!editing && (
          <div className="dialog-examples" aria-label="Examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setPrompt(ex)} disabled={busy}>
                {ex}
              </button>
            ))}
          </div>
        )}
        <p className="dialog-mode">
          {ai ? "Claude turns your description into a template." : "Without an API key, templates are made by matching keywords, so keep the description simple."}
        </p>
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={submit} disabled={busy || !prompt.trim()}>
            {busy ? "Making template…" : editing ? "Update template" : "Create template"}
          </button>
        </div>
      </div>
    </div>
  );
}
