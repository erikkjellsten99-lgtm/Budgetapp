// Specialrummets typsnitt laddas här, inte vid start (designspec "Två rum").
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ask, EXAMPLES } from './jarvis';
import { addTurn, askServer, greeting, type Turn } from './jarvisApi';
import { firstNameOf, supabase } from './sync';
// Tal och uppläsning går via gränssnittet i voice.ts. speech.ts används bara för röstinställningarna.
import { stt, tts, type ListenSession } from './voice';
import { onVoicesChanged, pickVoice, readVoice, saveVoice, swedishVoices, type VoiceSettings } from './speech';
import { readCloudVoice, saveCloudVoice } from './cloudVoice';

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
  idle: 'Håll in eller tryck, och prata',
  listening: 'Lyssnar…',
  thinking: 'Tänker…',
  speaking: 'Svarar…',
};

/** Håller du knappen längre än så här skickas frågan när du släpper. Ett kort tryck lyssnar tills du tystnar. */
const HOLD_MS = 400;
/** Har rösten inte börjat efter så här lång tid har telefonen vägrat läsa upp (kräver en tryckning först). */
const SPEAK_START_MS = 2500;
/** Fel som inte visas när Jarvis själv försökte börja lyssna efter hälsningen: då räcker det att trycka. */
const QUIET_ERRORS = ['not-allowed', 'service-not-allowed', 'no-speech', 'aborted', 'start'];

/**
 * Jarvis: en ring i mitten som du håller in eller trycker på och pratar med. När rummet öppnas hälsar
 * Jarvis (uppläst av telefonen, inget anrop) och börjar lyssna. Frågan går till servern (edge function
 * jarvis, som frågar Claude med verktyg) och svaret visas som text och läses upp. Går också att skriva.
 * Utan inloggning eller nät, eller när dagens gräns är nådd, svarar den enklare Jarvis som räknar i
 * telefonen (jarvis.ts). Visningsläget döljer alla belopp och använder alltid den. Läser bara.
 */
export default function JarvisView({ active }: { active: boolean }) {
  const voiceInput = stt.available();
  const [mode, setMode] = useState<Mode>('idle');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  // Textfältet syns alltid, som reserv när rösten inte passar eller inte finns.
  const [typing, setTyping] = useState(true);
  const [text, setText] = useState('');
  const [voiceOut, setVoiceOut] = useState(readVoiceSetting);
  const [voice, setVoice] = useState<VoiceSettings>(readVoice);
  const [voicePanel, setVoicePanel] = useState(false);
  const listening = useRef<ListenSession | null>(null);
  /** Hälsningen visas som text tills första frågan. */
  const [hello, setHello] = useState('');
  /** Sant medan hälsningen läses upp. En tryckning eller en fråga avbryter den. */
  const greeting_ = useRef(false);
  const pressedAt = useRef(0);
  const stopOnRelease = useRef(false);
  const nextId = useRef(1);
  const input = useRef<HTMLInputElement>(null);
  const [hideMoney, setHideMoney] = useState(readHideSetting);
  const [full, setFull] = useState(false);
  const alive = useRef(true);
  /** Samtalet hittills (äldst först), som följer med nästa fråga. Glöms när rummet stängs. */
  const talk = useRef<Turn[]>([]);

  function stopAll() {
    greeting_.current = false;
    listening.current?.abort();
    listening.current = null;
    tts.stop();
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
      tts.stop();
    };
  }, []);

  // Rummet öppnas: Jarvis hälsar och börjar lyssna. Rummet stängs: Jarvis slutar lyssna och prata.
  useEffect(() => {
    if (!active) {
      stopAll();
      setFull(false);
      talk.current = [];
      return;
    }
    let cancelled = false;
    let watchdog: number | undefined;
    (async () => {
      // Förnamnet kommer från den inloggade användaren. Utloggad eller utan namn: bara "Hej".
      let name: string | null = null;
      try {
        name = firstNameOf((await supabase.auth.getSession()).data.session?.user.user_metadata);
      } catch {
        // Hälsar utan namn.
      }
      if (cancelled || !alive.current) return;
      const text = greeting(name);
      setHello(text);
      if (!voiceOut || !tts.available()) {
        if (voiceInput) startListening(true);
        return;
      }
      greeting_.current = true;
      let started = false;
      setMode('speaking');
      // iPhone läser bara upp efter en tryckning. Börjar rösten aldrig väntar Jarvis på att du trycker.
      watchdog = window.setTimeout(() => {
        if (started || !greeting_.current) return;
        greeting_.current = false;
        tts.stop();
        if (alive.current) setMode((m) => (m === 'speaking' ? 'idle' : m));
      }, SPEAK_START_MS);
      tts.speak(text, {
        keep: true,
        onStart: () => (started = true),
        onEnd: () => {
          clearTimeout(watchdog);
          // Avbruten av en tryckning, en fråga eller att rummet stängdes: då gör den som avbröt resten.
          if (!greeting_.current || !alive.current) return;
          greeting_.current = false;
          if (started && voiceInput) startListening(true);
          else setMode((m) => (m === 'speaking' ? 'idle' : m));
        },
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
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

  // Utan taligenkänning är textfältet huvudvägen in: ställ markören där. Annars skulle tangentbordet skymma Jarvis.
  useEffect(() => {
    if (typing && !voiceInput) input.current?.focus();
  }, [typing, voiceInput]);

  async function send(question: string) {
    const q = question.trim().slice(0, MAX_LENGTH);
    if (!q) {
      setMode('idle');
      return;
    }
    greeting_.current = false;
    setHeard(q);
    setError('');
    setMode('thinking');
    let reply: string;
    try {
      if (hideMoney) {
        // Visningsläget: bara den enklare Jarvis, som vet vilka svar som innehåller belopp.
        reply = await ask(q, { hideMoney });
      } else {
        const server = await askServer(q, talk.current);
        if (server.ok) {
          reply = server.answer;
          talk.current = addTurn(talk.current, { question: q, answer: reply });
        } else {
          // Utloggad, utan nät, dagens gräns nådd eller fel på servern: säg varför, och ge det enklare svaret.
          setError(`${server.message} Här är ett enklare svar som räknas i telefonen.`);
          reply = await ask(q);
        }
      }
    } catch {
      reply = 'Det gick inte att läsa Groundwork just nu. Försök igen.';
    }
    if (!alive.current) return;
    setMessages((all) => [{ id: nextId.current++, question: q, reply }, ...all].slice(0, 20));
    if (voiceOut && tts.available()) {
      setMode('speaking');
      tts.speak(reply, { onEnd: () => alive.current && setMode((m) => (m === 'speaking' ? 'idle' : m)) });
    } else setMode('idle');
  }

  /** Börjar lyssna. `quiet`: Jarvis startade själv efter hälsningen, så helskärm och småfel hoppas över. */
  function startListening(quiet = false) {
    setError('');
    setHeard('');
    if (!quiet) setFull(true);
    const session = stt.listen({
      onText: (t) => setHeard(t),
      onDone: (t) => {
        listening.current = null;
        if (t) send(t);
        else {
          setMode('idle');
          if (!quiet) setError('Jag hörde inget. Tryck och försök igen.');
        }
      },
      onError: (message, code) => {
        listening.current = null;
        setMode('idle');
        if (!(quiet && QUIET_ERRORS.includes(code))) setError(message);
      },
    });
    if (session) {
      listening.current = session;
      setMode('listening');
    } else setMode((m) => (m === 'listening' || m === 'speaking' ? 'idle' : m));
  }

  /** Knappen trycks ner: börja lyssna. Lyssnar den redan skickas frågan när du släpper. */
  function press() {
    if (mode === 'thinking') return;
    greeting_.current = false;
    if (mode === 'listening') {
      stopOnRelease.current = true;
      return;
    }
    stopOnRelease.current = false;
    if (mode === 'speaking') tts.stop();
    tts.unlock();
    pressedAt.current = Date.now();
    startListening();
  }

  /** Knappen släpps: höll du in den skickas frågan nu. Efter ett kort tryck lyssnar Jarvis tills du tystnar. */
  function release() {
    if (!listening.current) return;
    if (stopOnRelease.current || Date.now() - pressedAt.current > HOLD_MS) listening.current.stop();
    stopOnRelease.current = false;
  }

  /** Tangentbord (Enter eller mellanslag på knappen): börja lyssna, eller skicka om den redan lyssnar. */
  function toggleListening() {
    if (mode === 'listening') listening.current?.stop();
    else press();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'thinking' || !text.trim()) return;
    listening.current?.abort();
    tts.unlock();
    const q = text;
    setText('');
    send(q);
  }

  function ask_(example: string) {
    if (mode === 'thinking') return;
    listening.current?.abort();
    tts.unlock();
    send(example);
  }

  function toggleHide() {
    const next = !hideMoney;
    setHideMoney(next);
    // Svar som redan visas kan innehålla belopp: ta bort dem när visningsläget slås på.
    if (next) {
      setMessages([]);
      talk.current = [];
    }
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
      greeting_.current = false;
      tts.stop();
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
      className={`room jarvis-screen mode-${mode}${full ? ' full' : ''}`}
      role={full ? 'dialog' : undefined}
      aria-modal={full ? true : undefined}
      aria-labelledby="jarvis-title"
    >
      <div className="jarvis-stars" aria-hidden="true" />
      <header className="jarvis-top">
        {/* Vänstra hörnet: Stäng i helskärm, annars plats för rummets Tillbaka-knapp. */}
        <div className="jarvis-top-side">
          {full && (
            <button type="button" className="jarvis-icon-button" onClick={exitFull} aria-label="Stäng helskärm">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <div className="jarvis-top-title">
          <h2 id="jarvis-title">Jarvis</h2>
          <p>{hideMoney ? 'Visningsläge · belopp döljs' : 'Läser bara'}</p>
        </div>
        <div className="jarvis-top-side end">
          {!full && (
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
          {tts.available() ? (
            <button
              type="button"
              className={voiceOut ? 'jarvis-icon-button on' : 'jarvis-icon-button'}
              onClick={() => setVoicePanel(true)}
              aria-haspopup="dialog"
              aria-label={voiceOut ? 'Röst och uppläsning (på)' : 'Röst och uppläsning (av)'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
                {voiceOut ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
              </svg>
            </button>
          ) : null}
        </div>
      </header>

      <div className="jarvis-stage">
        <button
          type="button"
          className="jarvis-core"
          // Pekare (finger eller mus): håll in och släpp, eller ett kort tryck. Tangentbord går via onClick.
          onPointerDown={voiceInput ? press : undefined}
          onPointerUp={voiceInput ? release : undefined}
          onPointerCancel={voiceInput ? release : undefined}
          onContextMenu={(e) => e.preventDefault()}
          onClick={voiceInput ? (e) => e.detail === 0 && toggleListening() : () => (setTyping(true), setFull(true))}
          disabled={busy}
          aria-label={voiceInput ? (mode === 'listening' ? 'Sluta lyssna och skicka' : 'Prata med Jarvis') : 'Skriv en fråga'}
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
          {voiceInput ? STATUS[mode] : busy ? STATUS.thinking : mode === 'speaking' ? STATUS.speaking : 'Skriv en fråga nedan'}
        </p>
        {!voiceInput && (
          <p className="jarvis-notice" role="status">
            Den här webbläsaren kan inte lyssna, så Jarvis hör dig inte här. Skriv din fråga i fältet nedan.
          </p>
        )}
        {heard && mode !== 'idle' && <p className="jarvis-heard">”{heard}”</p>}
        {error && (
          <p className="jarvis-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="jarvis-answers" aria-live="polite">
        {!latest && hello && <p className="jarvis-hello">{hello}</p>}
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

      {voicePanel && (
        <VoicePanel
          on={voiceOut}
          onToggle={toggleVoiceOut}
          settings={voice}
          onChange={(next) => {
            setVoice(next);
            saveVoice(next);
          }}
          onClose={() => setVoicePanel(false)}
        />
      )}
    </div>
  );
}

/** Välj Jarvis röst bland telefonens svenska röster, och ton och tempo. */
function VoicePanel({
  on,
  onToggle,
  settings,
  onChange,
  onClose,
}: {
  on: boolean;
  onToggle: () => void;
  settings: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
  onClose: () => void;
}) {
  const [voices, setVoices] = useState(swedishVoices);
  useEffect(() => onVoicesChanged(() => setVoices(swedishVoices())), []);
  const current = pickVoice(voices, settings.voice);
  const [cloud, setCloud] = useState(readCloudVoice);

  return (
    <div className="jarvis-voice" role="dialog" aria-modal="true" aria-labelledby="jarvis-voice-title">
      <h3 id="jarvis-voice-title">Jarvis röst</h3>
      <label className="jarvis-voice-row">
        <span>Läs upp svaren</span>
        <input type="checkbox" checked={on} onChange={onToggle} />
      </label>
      <label className="jarvis-voice-row">
        <span>Mänsklig röst</span>
        <input
          type="checkbox"
          checked={cloud}
          onChange={() => {
            saveCloudVoice(!cloud);
            setCloud(!cloud);
          }}
        />
      </label>
      <p className="jarvis-voice-hint">
        {cloud
          ? 'Svaren läses upp med en röst från ElevenLabs när du är inloggad och uppkopplad. Inställningarna nedan gäller telefonens röst, som tar över annars.'
          : 'Svaren läses upp med telefonens röst.'}
      </p>
      {voices.length > 0 ? (
        <label className="jarvis-voice-field">
          <span>{cloud ? 'Reservröst' : 'Röst'}</span>
          <select value={current?.voiceURI ?? ''} onChange={(e) => onChange({ ...settings, voice: e.target.value })}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
                {v.default ? ' (standard)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="jarvis-voice-hint">Inga svenska röster hittades på telefonen.</p>
      )}
      <label className="jarvis-voice-field">
        <span>
          Ton <small>{settings.pitch < 1 ? 'mörkare' : settings.pitch > 1 ? 'ljusare' : 'normal'}</small>
        </span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={settings.pitch}
          onChange={(e) => onChange({ ...settings, pitch: Number(e.target.value) })}
        />
      </label>
      <label className="jarvis-voice-field">
        <span>
          Tempo <small>{settings.rate < 1 ? 'lugnare' : settings.rate > 1 ? 'snabbare' : 'normal'}</small>
        </span>
        <input
          type="range"
          min={0.7}
          max={1.4}
          step={0.05}
          value={settings.rate}
          onChange={(e) => onChange({ ...settings, rate: Number(e.target.value) })}
        />
      </label>
      <p className="jarvis-voice-hint">
        Fler röster, t.ex. Oskar eller Klara i bättre kvalitet: på iPhone, Inställningar → Hjälpmedel → Uppläst innehåll →
        Röster → Svenska. Starta om appen efteråt.
      </p>
      <div className="jarvis-voice-actions">
        <button
          type="button"
          onClick={() => {
            tts.unlock();
            tts.speak('Hej, jag är Jarvis. Vad vill du veta?', { onEnd: () => {} });
          }}
        >
          Testa rösten
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Klar
        </button>
      </div>
    </div>
  );
}
