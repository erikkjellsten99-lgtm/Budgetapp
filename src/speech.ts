// Tal för Jarvis: taligenkänning och uppläsning med webbläsarens inbyggda stöd (Web Speech API).
// Gratis och utan egen server. På iPhone sköts taligenkänningen av Apple (samma som diktering).
// Saknas stödet går det att skriva i stället.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => typeof window !== 'undefined' && recognitionCtor() !== null;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export interface Listening {
  stop(): void;
  abort(): void;
}

/** Felet som text att visa. */
export function listenError(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed')
    return 'Groundwork får inte använda mikrofonen. Tillåt den i Inställningar → Safari → Mikrofon, eller skriv i stället.';
  if (code === 'no-speech') return 'Jag hörde inget. Tryck och försök igen.';
  if (code === 'audio-capture') return 'Ingen mikrofon hittades.';
  if (code === 'network') return 'Taligenkänningen behöver uppkoppling. Skriv i stället.';
  return 'Det gick inte att lyssna just nu. Försök igen eller skriv.';
}

/** Lyssnar på en fråga på svenska. onText får texten medan du pratar, onDone hela frågan (eller tom). */
export function listen(handlers: {
  onText: (text: string) => void;
  onDone: (text: string) => void;
  onError: (message: string) => void;
}): Listening | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'sv-SE';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let text = '';
  let failed = false;
  rec.onresult = (e) => {
    let all = '';
    for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript;
    text = all.trim();
    handlers.onText(text);
  };
  rec.onerror = (e) => {
    if (e.error === 'aborted') return;
    failed = true;
    handlers.onError(listenError(e.error));
  };
  rec.onend = () => {
    if (!failed) handlers.onDone(text);
  };
  try {
    rec.start();
  } catch {
    handlers.onError(listenError('start'));
    return null;
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}

// ---------- Rösten ----------

export interface VoiceSettings {
  /** Vald röst (voiceURI). Saknas: en svensk röst som inte är telefonens standardröst, om det finns. */
  voice?: string;
  /** 0.5–1.5, lägre är mörkare. */
  pitch: number;
  /** 0.7–1.4 */
  rate: number;
}

export const DEFAULT_VOICE: VoiceSettings = { pitch: 0.85, rate: 1.05 };
const VOICE_SETTINGS_KEY = 'jarvis-röst';

export function readVoice(): VoiceSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_SETTINGS_KEY) ?? 'null') as Partial<VoiceSettings> | null;
    const clamp = (n: unknown, min: number, max: number, fallback: number) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    return {
      voice: typeof saved?.voice === 'string' ? saved.voice : undefined,
      pitch: clamp(saved?.pitch, 0.5, 1.5, DEFAULT_VOICE.pitch),
      rate: clamp(saved?.rate, 0.7, 1.4, DEFAULT_VOICE.rate),
    };
  } catch {
    return { ...DEFAULT_VOICE };
  }
}

export function saveVoice(settings: VoiceSettings) {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Gäller bara tills appen stängs.
  }
}

/** Telefonens svenska röster. Listan kan vara tom första gången; lyssna på onVoicesChanged. */
export function swedishVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('sv'));
}

export function onVoicesChanged(listener: () => void): () => void {
  if (!canSpeak()) return () => {};
  window.speechSynthesis.addEventListener?.('voiceschanged', listener);
  return () => window.speechSynthesis.removeEventListener?.('voiceschanged', listener);
}

/** Rösten att använda: den valda, annars en svensk röst som inte är standardrösten. */
export function pickVoice(voices: SpeechSynthesisVoice[], chosen?: string): SpeechSynthesisVoice | undefined {
  return (
    (chosen ? voices.find((v) => v.voiceURI === chosen) : undefined) ??
    voices.find((v) => !v.default && !/siri/i.test(v.name)) ??
    voices[0]
  );
}

/**
 * iPhone läser bara upp efter en tryckning. Anropa i samma tryckning som startar en fråga,
 * så att svaret sedan får läsas upp när det är klart.
 */
export function unlockSpeech() {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/** Läser upp en text på svenska med vald röst. onEnd körs när uppläsningen är klar eller avbryts. */
export function speak(text: string, onEnd: () => void, settings: VoiceSettings = readVoice()) {
  if (!canSpeak()) return onEnd();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'sv-SE';
  u.pitch = settings.pitch;
  const voice = pickVoice(swedishVoices(), settings.voice);
  try {
    if (voice) u.voice = voice;
  } catch {
    // Rösten gick inte att välja: telefonens standardröst för svenska används.
  }
  u.rate = settings.rate;
  u.onend = onEnd;
  u.onerror = onEnd;
  try {
    window.speechSynthesis.speak(u);
  } catch {
    onEnd();
  }
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
