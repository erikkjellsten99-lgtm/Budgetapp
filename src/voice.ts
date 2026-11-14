// Jarvis röst bakom ett eget gränssnitt: tal till text (STT) och text till tal (TTS).
// Jarvis-vyn använder bara `stt` och `tts` härifrån. Lyssnandet är webbläsarens (speech.ts: SpeechRecognition).
// Rösten är ElevenLabs via servern (cloudVoice.ts), med webbläsarens uppläsning (speechSynthesis) som reserv.
// Vill du byta motor, t.ex. till Whisper, skriver du en ny SpeechToText eller TextToSpeech och byter raderna
// längst ner. Resten av appen rörs inte.

import { canListen, canSpeak, listen, readVoice, speak, stopSpeaking, unlockSpeech } from './speech';
import { cloudVoiceReady, fetchSpeech, playSpeech, savedSpeech, saveSpeech, stopPlayer, unlockPlayer } from './cloudVoice';

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
  /**
   * Texten är alltid densamma (hälsningen): spara ljudet i telefonen, så att den nästa gång spelas direkt
   * utan anrop. Första gången läser telefonens röst upp den medan ljudet hämtas i bakgrunden.
   */
  keep?: boolean;
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

/** Ökar för varje uppläsning och stopp, så att ett ljud som kommer för sent från servern inte spelas. */
let turn = 0;

/**
 * Mänsklig röst från servern (ElevenLabs). Går den inte att få fram, eller vägrar telefonen spela ljudet,
 * läser telefonens röst upp texten i stället, så att Jarvis aldrig blir tyst.
 */
const cloudTts: TextToSpeech = {
  available: () => canSpeak() || cloudVoiceReady(),
  unlock: () => {
    unlockSpeech();
    unlockPlayer();
  },
  speak: (text, handlers) => {
    const mine = ++turn;
    stopPlayer();
    const fallback = () => {
      if (mine !== turn) return;
      if (canSpeak()) browserTts.speak(text, handlers);
      else handlers.onEnd();
    };
    if (!cloudVoiceReady()) return fallback();
    (async () => {
      let audio = handlers.keep ? await savedSpeech(text) : null;
      if (mine !== turn) return;
      if (!audio && handlers.keep) {
        // Hälsningen ska komma direkt: telefonens röst nu, och ljudet sparas till nästa gång.
        fallback();
        const fetched = await fetchSpeech(text);
        if (fetched) await saveSpeech(text, fetched);
        return;
      }
      audio ??= await fetchSpeech(text);
      if (mine !== turn) return;
      if (!audio) return fallback();
      const onEnd = () => mine === turn && handlers.onEnd();
      if (!(await playSpeech(audio, handlers.onStart, onEnd))) fallback();
    })();
  },
  stop: () => {
    turn++;
    stopPlayer();
    stopSpeaking();
  },
};

export const stt: SpeechToText = browserStt;
export const tts: TextToSpeech = cloudTts;
