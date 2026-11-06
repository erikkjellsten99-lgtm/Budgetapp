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

function swedishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'sv-SE') ?? voices.find((v) => v.lang.startsWith('sv'));
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

/** Läser upp en text på svenska. onEnd körs när uppläsningen är klar eller avbryts. */
export function speak(text: string, onEnd: () => void) {
  if (!canSpeak()) return onEnd();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'sv-SE';
  const voice = swedishVoice();
  try {
    if (voice) u.voice = voice;
  } catch {
    // Rösten gick inte att välja: telefonens standardröst för svenska används.
  }
  u.rate = 1.02;
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
