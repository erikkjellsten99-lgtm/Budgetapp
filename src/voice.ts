// Jarvis röst bakom ett eget gränssnitt: tal till text (STT) och text till tal (TTS).
// Jarvis-vyn använder bara `stt` och `tts` härifrån. I dag ligger webbläsarens inbyggda stöd bakom
// (speech.ts: SpeechRecognition och speechSynthesis). Vill du byta till t.ex. Whisper eller ElevenLabs
// skriver du en ny SpeechToText eller TextToSpeech och byter raderna längst ner. Resten av appen rörs inte.

import { canListen, canSpeak, listen, readVoice, speak, stopSpeaking, unlockSpeech } from './speech';

/** En pågående lyssning. */
export interface ListenSession {
  /** Sluta lyssna och skicka det som hörts. */
  stop(): void;
  /** Avbryt utan att skicka något. */
  abort(): void;
}

export interface ListenHandlers {
  /** Texten hittills, medan du pratar. */
  onText: (text: string) => void;
  /** Hela frågan när du tystnat eller släppt knappen. Tom om inget hördes. */
  onDone: (text: string) => void;
  /** Ett fel som text att visa, och felkoden (t.ex. "not-allowed"). */
  onError: (message: string, code: string) => void;
}

/** Tal till text. */
export interface SpeechToText {
  /** Om det går att lyssna i den här webbläsaren. */
  available(): boolean;
  /** Börjar lyssna på svenska. Null om det inte gick att starta. */
  listen(handlers: ListenHandlers): ListenSession | null;
}

export interface SpeakHandlers {
  /** Rösten har börjat. Uteblir den har webbläsaren vägrat (iPhone kräver en tryckning först). */
  onStart?: () => void;
  /** Uppläsningen är klar eller avbruten. */
  onEnd: () => void;
}

/** Text till tal. */
export interface TextToSpeech {
  available(): boolean;
  /** Anropas i en tryckning, så att senare uppläsning tillåts (iPhone). */
  unlock(): void;
  speak(text: string, handlers: SpeakHandlers): void;
  stop(): void;
}

/** Webbläsarens taligenkänning (på iPhone Apples diktering), svenska. */
const browserStt: SpeechToText = {
  available: canListen,
  listen: (handlers) => listen(handlers),
};

/** Webbläsarens uppläsning, med rösten, tonen och tempot som är valda i Jarvis röstinställningar. */
const browserTts: TextToSpeech = {
  available: canSpeak,
  unlock: unlockSpeech,
  speak: (text, { onStart, onEnd }) => speak(text, onEnd, readVoice(), onStart),
  stop: stopSpeaking,
};

export const stt: SpeechToText = browserStt;
export const tts: TextToSpeech = browserTts;
