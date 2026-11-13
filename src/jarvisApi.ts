// Frågor till Jarvis på servern (edge function jarvis, som frågar Claude). Appen skickar bara frågan och
// användarens inloggning. API-nyckeln till Claude finns bara på servern.

import { supabase } from './sync';

export type JarvisReply =
  | { ok: true; answer: string }
  /** `reason`: utloggad, grans (50 frågor i dag), offline eller fel. `message` är text att visa och läsa upp. */
  | { ok: false; reason: 'utloggad' | 'grans' | 'offline' | 'fel'; message: string };

export const SIGNED_OUT = 'Logga in under Konto för att fråga Jarvis fritt.';
const FAILED = 'Jag fick inget svar från servern just nu.';

/** Svaret från servern tolkat. Egen funktion så att den kan testas utan nätverk. */
export function readReply(status: number, body: unknown): JarvisReply {
  const b = (body ?? {}) as { answer?: unknown; error?: unknown; message?: unknown };
  if (status >= 200 && status < 300 && typeof b.answer === 'string' && b.answer.trim()) return { ok: true, answer: b.answer.trim() };
  const message = typeof b.message === 'string' && b.message.trim() ? b.message.trim() : FAILED;
  if (status === 401) return { ok: false, reason: 'utloggad', message: SIGNED_OUT };
  if (status === 429 || b.error === 'grans') return { ok: false, reason: 'grans', message };
  return { ok: false, reason: 'fel', message };
}

/** Ställer en fråga till Jarvis på servern. Kastar aldrig: fel kommer tillbaka som ett svar att visa. */
export async function askServer(question: string): Promise<JarvisReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline', message: 'Du är inte uppkopplad.' };
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return { ok: false, reason: 'utloggad', message: SIGNED_OUT };
    const { data, error, response } = await supabase.functions.invoke('jarvis', { body: { question } });
    if (!error) return readReply(200, data);
    // Vid ett felsvar från funktionen ligger svaret kvar oläst i `response`.
    if (response) return readReply(response.status, await response.json().catch(() => null));
    return { ok: false, reason: 'offline', message: FAILED };
  } catch {
    return { ok: false, reason: 'fel', message: FAILED };
  }
}

/** Hälsningen när Jarvis öppnas. Läses upp av telefonen, utan något anrop till servern. */
export function greeting(firstName: string | null): string {
  const name = firstName?.trim();
  return `Hej${name ? ` ${name}` : ''}, hur står det till i dag? Vad kan jag hjälpa dig med?`;
}

/** Om adressen ber om Jarvis: `?jarvis=1` (med eller utan `listen=1`), eller sökvägen `/jarvis`. */
export function wantsJarvis(location: { pathname: string; search: string }): boolean {
  const params = new URLSearchParams(location.search);
  return params.has('jarvis') || /\/jarvis\/?$/.test(location.pathname);
}
