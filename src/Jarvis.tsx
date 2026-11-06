import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ask, EXAMPLES } from './jarvis';

interface Message {
  id: number;
  question: string;
  /** null medan svaret räknas. */
  reply: string | null;
  failed?: boolean;
}

const MAX_LENGTH = 300;

// En pratbubbla: frågan skrivs (eller dikteras med tangentbordets mikrofon).
const Bubble = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
  </svg>
);

/** Knappen i Översikt och frågevyn. Läser bara: svaren räknas i telefonen (jarvis.ts). */
export default function Jarvis() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  return (
    <>
      <button ref={button} type="button" className="card jarvis-open" onClick={() => setOpen(true)}>
        <span className="jarvis-open-text">
          <span className="jarvis-eyebrow">Fråga Jarvis</span>
          <span className="jarvis-open-hint">Vad blir över? Hur sov jag?</span>
        </span>
        <span className="jarvis-mic">
          <Bubble />
        </span>
      </button>
      {open && <JarvisSheet onClose={close} />}
    </>
  );
}

function JarvisSheet({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const busy = messages.some((m) => m.reply === null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages]);

  async function send(question: string) {
    const q = question.trim().slice(0, MAX_LENGTH);
    if (!q || busy) return;
    const id = nextId.current++;
    setMessages((all) => [...all, { id, question: q, reply: null }]);
    setText('');
    let reply: string;
    let failed = false;
    try {
      reply = await ask(q);
    } catch {
      reply = 'Det gick inte att läsa Groundwork just nu. Försök igen.';
      failed = true;
    }
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, reply, failed } : m)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  return (
    <div className="jarvis-sheet" role="dialog" aria-modal="true" aria-labelledby="jarvis-title">
      <header className="jarvis-head">
        <button type="button" className="jarvis-close" onClick={onClose} aria-label="Stäng Fråga Jarvis">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h2 id="jarvis-title">Fråga Jarvis</h2>
          <p className="jarvis-sub">Läser bara · exakta siffror</p>
        </div>
      </header>

      <div className="jarvis-messages" ref={list} aria-live="polite">
        {messages.length === 0 && (
          <p className="jarvis-empty">
            Fråga om ekonomin, dagen eller hälsan. Svaren är exakt de siffror som ligger i Groundwork, och inget ändras.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="jarvis-pair">
            <p className="jarvis-question">{m.question}</p>
            <div className={m.failed ? 'jarvis-reply failed' : 'jarvis-reply'}>
              <span className="jarvis-eyebrow">Jarvis</span>
              {m.reply === null ? <p className="jarvis-wait">Räknar…</p> : <p>{m.reply}</p>}
            </div>
          </div>
        ))}
      </div>

      <footer className="jarvis-foot">
        <div className="jarvis-examples">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" disabled={busy} onClick={() => send(example)}>
              {example}
            </button>
          ))}
        </div>
        <form className="jarvis-form" onSubmit={submit}>
          <label className="jarvis-field">
            <span className="visually-hidden">Din fråga</span>
            <input
              ref={input}
              type="text"
              value={text}
              maxLength={MAX_LENGTH}
              enterKeyHint="send"
              placeholder="Skriv en fråga…"
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button type="submit" className="primary jarvis-send" disabled={busy || !text.trim()}>
            Fråga
          </button>
        </form>
      </footer>
    </div>
  );
}
