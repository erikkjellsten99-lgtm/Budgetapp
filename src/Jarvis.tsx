import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ask, EXAMPLES } from './jarvis';
import { canListen, canSpeak, listen, speak, stopSpeaking, unlockSpeech, type Listening } from './speech';

interface Message {
  id: number;
  question: string;
  reply: string;
}

type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

const MAX_LENGTH = 300;
const VOICE_KEY = 'jarvis-uppläsning';

function readVoiceSetting(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'av';
  } catch {
    return true;
  }
}

const Mic = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

/** Knappen på Idag som tar dig till Jarvis. */
export function JarvisButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="card jarvis-open" onClick={onOpen}>
      <span className="jarvis-open-text">
        <span className="jarvis-eyebrow">Fråga Jarvis</span>
        <span className="jarvis-open-hint">Prata eller skriv: Vad blir över? Hur sov jag?</span>
      </span>
      <span className="jarvis-mic">
        <Mic />
      </span>
    </button>
  );
}

const HIDE_KEY = 'jarvis-visningsläge';
/** Exempel utan ekonomi, för visningsläget. */
const SHOW_EXAMPLES = ['Vad kan du?', 'Hur sov jag i natt?', 'Vad ska jag göra idag?'];

function readHideSetting(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === 'på';
  } catch {
    return false;
  }
}

const STATUS: Record<Mode, string> = {
  idle: 'Tryck och prata',
  listening: 'Lyssnar…',
  thinking: 'Räknar…',
  speaking: 'Svarar…',
};

/**
 * Jarvis-fliken: en ring i mitten som du trycker på och pratar med. När du pratar täcker Jarvis
 * hela skärmen. Svaret visas stort och läses upp. Går också att skriva. Visningsläget döljer alla
 * belopp, så att Jarvis kan visas för andra. Läser bara: svaren räknas i telefonen (jarvis.ts).
 * Visar inga siffror förrän du frågar.
 */
export default function JarvisView({ active }: { active: boolean }) {
  const voiceInput = canListen();
  const [mode, setMode] = useState<Mode>('idle');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(!voiceInput);
  const [text, setText] = useState('');
  const [voiceOut, setVoiceOut] = useState(readVoiceSetting);
  const listening = useRef<Listening | null>(null);
  const nextId = useRef(1);
  const input = useRef<HTMLInputElement>(null);
  const [hideMoney, setHideMoney] = useState(readHideSetting);
  const [full, setFull] = useState(false);
  const alive = useRef(true);

  function stopAll() {
    listening.current?.abort();
    listening.current = null;
    stopSpeaking();
    setMode('idle');
  }

  function exitFull() {
    stopAll();
    setFull(false);
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      listening.current?.abort();
      stopSpeaking();
    };
  }, []);

  // Lämnar du fliken slutar Jarvis lyssna och prata.
  useEffect(() => {
    if (!active) {
      stopAll();
      setFull(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && exitFull();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('jarvis-locked');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('jarvis-locked');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);

  async function send(question: string) {
    const q = question.trim().slice(0, MAX_LENGTH);
    if (!q) {
      setMode('idle');
      return;
    }
    setHeard(q);
    setError('');
    setMode('thinking');
    let reply: string;
    try {
      reply = await ask(q, { hideMoney });
    } catch {
      reply = 'Det gick inte att läsa Groundwork just nu. Försök igen.';
    }
    if (!alive.current) return;
    setMessages((all) => [{ id: nextId.current++, question: q, reply }, ...all].slice(0, 20));
    if (voiceOut && canSpeak()) {
      setMode('speaking');
      speak(reply, () => alive.current && setMode((m) => (m === 'speaking' ? 'idle' : m)));
    } else setMode('idle');
  }

  function toggleListening() {
    if (mode === 'listening') {
      listening.current?.stop();
      return;
    }
    if (mode === 'speaking') stopSpeaking();
    if (mode === 'thinking') return;
    unlockSpeech();
    setError('');
    setHeard('');
    setFull(true);
    const session = listen({
      onText: (t) => setHeard(t),
      onDone: (t) => {
        listening.current = null;
        if (t) send(t);
        else {
          setMode('idle');
          setError('Jag hörde inget. Tryck och försök igen.');
        }
      },
      onError: (message) => {
        listening.current = null;
        setMode('idle');
        setError(message);
      },
    });
    if (session) {
      listening.current = session;
      setMode('listening');
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'thinking' || !text.trim()) return;
    unlockSpeech();
    const q = text;
    setText('');
    send(q);
  }

  function ask_(example: string) {
    if (mode === 'thinking') return;
    listening.current?.abort();
    unlockSpeech();
    send(example);
  }

  function toggleHide() {
    const next = !hideMoney;
    setHideMoney(next);
    // Svar som redan visas kan innehålla belopp: ta bort dem när visningsläget slås på.
    if (next) setMessages([]);
    try {
      localStorage.setItem(HIDE_KEY, next ? 'på' : 'av');
    } catch {
      // Gäller bara tills appen stängs.
    }
  }

  function toggleVoiceOut() {
    const next = !voiceOut;
    setVoiceOut(next);
    if (!next) {
      stopSpeaking();
      if (mode === 'speaking') setMode('idle');
    }
    try {
      localStorage.setItem(VOICE_KEY, next ? 'på' : 'av');
    } catch {
      // Inställningen gäller bara tills appen stängs.
    }
  }

  const [latest, ...earlier] = messages;
  const busy = mode === 'thinking';

  return (
    <div
      className={`jarvis-screen mode-${mode}${full ? ' full' : ''}`}
      role={full ? 'dialog' : undefined}
      aria-modal={full ? true : undefined}
      aria-labelledby="jarvis-title"
    >
      <div className="jarvis-stars" aria-hidden="true" />
      <header className="jarvis-top">
        {full ? (
          <button type="button" className="jarvis-icon-button" onClick={exitFull} aria-label="Stäng helskärm">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className={hideMoney ? 'jarvis-icon-button on' : 'jarvis-icon-button'}
            onClick={toggleHide}
            aria-pressed={hideMoney}
            aria-label={hideMoney ? 'Visningsläge på: belopp döljs. Tryck för att visa belopp' : 'Visningsläge av. Tryck för att dölja belopp'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="3" />
              {hideMoney && <path d="M4 20L20 4" />}
            </svg>
          </button>
        )}
        <div className="jarvis-top-title">
          <h2 id="jarvis-title">Jarvis</h2>
          <p>{hideMoney ? 'Visningsläge · belopp döljs' : 'Läser bara · exakta siffror'}</p>
        </div>
        {canSpeak() ? (
          <button
            type="button"
            className={voiceOut ? 'jarvis-icon-button on' : 'jarvis-icon-button'}
            onClick={toggleVoiceOut}
            aria-pressed={voiceOut}
            aria-label={voiceOut ? 'Uppläsning på. Tryck för att stänga av' : 'Uppläsning av. Tryck för att slå på'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
              {voiceOut ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
            </svg>
          </button>
        ) : (
          <span className="jarvis-icon-spacer" />
        )}
      </header>

      <div className="jarvis-stage">
        <button
          type="button"
          className="jarvis-core"
          onClick={voiceInput ? toggleListening : () => (setTyping(true), setFull(true))}
          disabled={busy}
          aria-label={voiceInput ? (mode === 'listening' ? 'Sluta lyssna' : 'Prata med Jarvis') : 'Skriv en fråga'}
        >
          <span className="ring r1" aria-hidden="true" />
          <span className="ring r2" aria-hidden="true" />
          <span className="ring r3" aria-hidden="true" />
          <span className="core-inner">
            <Mic />
            <span className="core-name">JARVIS</span>
          </span>
        </button>
        <p className="jarvis-status" aria-live="polite">
          {voiceInput ? STATUS[mode] : busy ? STATUS.thinking : 'Skriv en fråga nedan'}
        </p>
        {heard && mode !== 'idle' && <p className="jarvis-heard">”{heard}”</p>}
        {error && (
          <p className="jarvis-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="jarvis-answers" aria-live="polite">
        {latest && (
          <article className="jarvis-latest">
            <p className="jarvis-q">{latest.question}</p>
            <p className="jarvis-a">{latest.reply}</p>
          </article>
        )}
        {earlier.map((m) => (
          <article key={m.id} className="jarvis-earlier">
            <p className="jarvis-q">{m.question}</p>
            <p className="jarvis-a">{m.reply}</p>
          </article>
        ))}
      </div>

      <footer className="jarvis-bottom">
        <div className="jarvis-examples">
          {(hideMoney ? SHOW_EXAMPLES : EXAMPLES).map((example) => (
            <button key={example} type="button" disabled={busy} onClick={() => ask_(example)}>
              {example}
            </button>
          ))}
        </div>
        {typing ? (
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
        ) : (
          <button type="button" className="jarvis-type" onClick={() => setTyping(true)}>
            Skriv i stället
          </button>
        )}
      </footer>
    </div>
  );
}
