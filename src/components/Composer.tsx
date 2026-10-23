import { useEffect, useRef, useState } from "react";
import { api, type Pending } from "../api.ts";
import { formatSize } from "../format.ts";

type Recording = { recorder: MediaRecorder; recognition: any; startedAt: number; transcript: string };

// Web Speech API: Chrome/Edge/Safari. Used only for a live transcript next to the audio file.
const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export function Composer({ dropped, onDroppedConsumed }: { dropped: File[]; onDroppedConsumed: () => void }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<Recording | null>(null);
  const [, tick] = useState(0);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: File[]) =>
    setPending((p) => [...p, ...files.map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }))]);

  useEffect(() => {
    if (dropped.length) {
      addFiles(dropped);
      onDroppedConsumed();
    }
  }, [dropped, onDroppedConsumed]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  // Recording timer.
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [rec]);

  async function send() {
    if (sending || rec || (!text.trim() && pending.length === 0)) return;
    setSending(true);
    setError(null);
    try {
      await api.send(text, pending);
      setText("");
      setPending([]);
    } catch (e) {
      setError("Couldn't send. Try again.");
      console.error(e);
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  }

  async function startRecording() {
    setError(null);
    // Browsers only allow the microphone on https:// or localhost.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording only works when the app is opened at http://localhost:5173 (or over https).");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access is blocked. Allow it for this site in your browser, and for your browser in System Settings → Privacy & Security → Microphone."
          : name === "NotFoundError"
            ? "No microphone found. Connect one and try again."
            : name === "NotReadableError"
              ? "The microphone is being used by another app. Close it and try again."
              : "Couldn't start the microphone. You can type instead.",
      );
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const state: Recording = { recorder, recognition: null, startedAt: Date.now(), transcript: "" };

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => {
        state.transcript = Array.from(e.results as ArrayLike<any>)
          .map((r) => r[0].transcript)
          .join("");
        setRec({ ...state });
      };
      recognition.onerror = () => {};
      try {
        recognition.start();
        state.recognition = recognition;
      } catch {
        // Recognition unavailable in this context; audio still records.
      }
    }

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = recorder.mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const stamp = new Date().toTimeString().slice(0, 5).replace(":", "");
      const file = new File(chunks, `voice-${stamp}.${ext}`, { type });
      setPending((p) => [...p, { file, transcript: state.transcript || undefined }]);
    };
    recorder.start();
    setRec(state);
  }

  function stopRecording() {
    if (!rec) return;
    rec.recognition?.stop();
    rec.recorder.stop();
    setRec(null);
  }

  const elapsed = rec ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0;

  return (
    <div className="composer">
      {pending.length > 0 && (
        <div className="pending">
          {pending.map((p, i) => (
            <div className="pending-chip" key={i}>
              {p.preview ? (
                <img src={p.preview} alt="" />
              ) : (
                <span className="pending-icon">{p.file.type.startsWith("audio/") ? "🎙️" : p.file.type.startsWith("video/") ? "🎬" : "📎"}</span>
              )}
              <span className="pending-name">
                {p.transcript ? `“${p.transcript.slice(0, 24)}${p.transcript.length > 24 ? "…" : ""}”` : p.file.name}
                <small>{formatSize(p.file.size)}</small>
              </span>
              <button className="pending-x" onClick={() => setPending((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {rec ? (
        <div className="recording">
          <span className="rec-dot" />
          <span className="rec-time">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
          <span className="rec-transcript">{rec.transcript || (SpeechRecognition ? "Listening…" : "Recording…")}</span>
          <button className="rec-stop" onClick={stopRecording}>
            Done
          </button>
        </div>
      ) : (
        <div className="composer-row">
          <button className="icon-btn" title="Add images, videos or files" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <textarea
            ref={textRef}
            rows={1}
            value={text}
            placeholder="Dump anything here… text, links, images, voice"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // isComposing: don't send while an IME (e.g. pinyin) candidate is being picked.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
          />
          {/* Shared demo pages run in a sandbox that never grants the microphone, so don't offer it there. */}
          {!api.demo && (
            <button className="icon-btn" title="Record a voice memo" onClick={startRecording}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
          <button className="send-btn" onClick={send} disabled={sending || (!text.trim() && pending.length === 0)} title="Send (Enter)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M3.4 20.4l17.5-7.5a1 1 0 000-1.8L3.4 3.6a1 1 0 00-1.4 1.2L4.5 12l-2.5 7.2a1 1 0 001.4 1.2z" />
            </svg>
          </button>
        </div>
      )}
      {error && <div className="composer-error">{error}</div>}
    </div>
  );
}
