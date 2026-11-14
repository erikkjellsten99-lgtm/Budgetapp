// Jarvis mänskliga röst: texten skickas till edge function jarvis-rost (Azure Speech) och ljudet spelas upp här.
// Nyckeln till Azure finns bara på servern. Går det inte (utloggad, utan nät, ingen nyckel, dagens gräns)
// tar telefonens egen röst över: se voice.ts, som är det enda stället som använder den här filen.

import { supabase } from './sync';

const SETTING_KEY = 'jarvis-molnröst';
const CACHE_NAME = 'jarvis-röst-1';
/** Så länge väntar appen innan den försöker med servern igen efter ett fel. */
const RETRY_MS = 5 * 60_000;
/** Ett tyst ljud, för att låsa upp uppspelning i en tryckning (iPhone). */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** Om den mänskliga rösten är påslagen i Jarvis röstinställningar. På från början. */
export function readCloudVoice(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'av';
  } catch {
    return true;
  }
}

export function saveCloudVoice(on: boolean) {
  try {
    localStorage.setItem(SETTING_KEY, on ? 'på' : 'av');
  } catch {
    // Gäller bara tills appen stängs.
  }
}

let blockedUntil = 0;

/** Om det är värt att fråga servern: påslagen, uppkopplad och inget färskt fel. */
export function cloudVoiceReady(now = Date.now()): boolean {
  if (typeof Audio === 'undefined' || !readCloudVoice()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return now >= blockedUntil;
}

/** Hämtar texten som ljud från servern. Null om det inte gick; då väntar appen en stund innan nästa försök. */
export async function fetchSpeech(text: string): Promise<Blob | null> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return null;
    const { data, error } = await supabase.functions.invoke('jarvis-rost', { body: { text } });
    if (!error && data instanceof Blob && data.size > 0) return new Blob([data], { type: 'audio/mpeg' });
  } catch {
    // Faller igenom till reserven.
  }
  blockedUntil = Date.now() + RETRY_MS;
  return null;
}

const cacheKey = (text: string) => `/jarvis-rost/${encodeURIComponent(text)}`;

/** Ljud som sparats i telefonen för en text (hälsningen), så att den spelas direkt utan anrop. */
export async function savedSpeech(text: string): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(text));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

export async function saveSpeech(text: string, audio: Blob) {
  try {
    await (await caches.open(CACHE_NAME)).put(cacheKey(text), new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } }));
  } catch {
    // Utan sparat ljud läser telefonens röst upp hälsningen.
  }
}

// En enda spelare återanvänds: iPhone tillåter uppspelning senare bara på ett element som startats i en tryckning.
let player: HTMLAudioElement | null = null;
let currentUrl = '';

function getPlayer(): HTMLAudioElement {
  return (player ??= new Audio());
}

/** Anropas i en tryckning, så att ljud får spelas när svaret kommit. */
export function unlockPlayer() {
  if (typeof Audio === 'undefined') return;
  const p = getPlayer();
  if (!p.paused) return;
  p.src = SILENCE;
  p.play().catch(() => {});
}

export function stopPlayer() {
  if (!player) return;
  player.onplaying = player.onended = player.onerror = null;
  player.pause();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = '';
}

/** Spelar ljudet. Löftet blir false om telefonen vägrade (ingen tryckning först) eller ljudet inte gick att spela. */
export function playSpeech(audio: Blob, onStart: (() => void) | undefined, onEnd: () => void): Promise<boolean> {
  stopPlayer();
  const p = getPlayer();
  currentUrl = URL.createObjectURL(audio);
  p.src = currentUrl;
  return new Promise((resolve) => {
    let started = false;
    p.onplaying = () => {
      if (started) return;
      started = true;
      onStart?.();
      resolve(true);
    };
    p.onended = () => {
      stopPlayer();
      onEnd();
    };
    p.onerror = () => {
      stopPlayer();
      if (started) onEnd();
      else resolve(false);
    };
    p.play().catch(() => {
      if (started) return;
      stopPlayer();
      resolve(false);
    });
  });
}
