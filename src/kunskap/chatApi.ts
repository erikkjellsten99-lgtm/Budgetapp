// Gå djupare: frågor till Claude om ett kort, via edge function `kunskap`. Appen skickar kortet, frågan och
// användarens inloggning. API-nyckeln finns bara på servern.

import { supabase } from '../sync';
import type { KunskapCard } from './cards';

export type ChatReply =
  | { ok: true; answer: string }
  /** `saknas`: funktionen är inte utlagd på servern än. */
  | { ok: false; reason: 'utloggad' | 'grans' | 'offline' | 'saknas' | 'fel'; message: string };

export interface ChatTurn {
  question: string;
  answer: string;
}

export const QUESTION_MAX = 500;
export const TURNS_BACK = 6;

export const SIGNED_OUT = 'Logga in under Konto för att gå djupare.';
export const NOT_DEPLOYED = 'Chatten är inte påslagen på servern än.';
const FAILED = 'Jag fick inget svar just nu. Försök igen.';

/** Svaret från servern tolkat. Egen funktion så att den kan testas utan nätverk. */
export function readChatReply(status: number, body: unknown): ChatReply {
  const b = (body ?? {}) as { answer?: unknown; error?: unknown; message?: unknown };
  if (status >= 200 && status < 300 && typeof b.answer === 'string' && b.answer.trim()) return { ok: true, answer: b.answer.trim() };
  const message = typeof b.message === 'string' && b.message.trim() ? b.message.trim() : FAILED;
  if (status === 401) return { ok: false, reason: 'utloggad', message: SIGNED_OUT };
  if (status === 404) return { ok: false, reason: 'saknas', message: NOT_DEPLOYED };
  if (status === 429 || b.error === 'grans') return { ok: false, reason: 'grans', message };
  return { ok: false, reason: 'fel', message };
}

/** Det av kortet som servern behöver för att kunna prata om det. */
export const cardPayload = (card: KunskapCard) => ({
  person: card.person,
  topic: card.topic,
  type: card.type,
  text: [card.text, card.sv ? `(På svenska: ${card.sv})` : '', ...(card.steps ?? []).map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n'),
  label: card.label,
  source: card.source,
});

/** Ställer en fråga om kortet. Kastar aldrig: fel kommer tillbaka som ett svar att visa. */
export async function askAboutCard(card: KunskapCard, question: string, history: ChatTurn[] = []): Promise<ChatReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline', message: 'Du är inte uppkopplad.' };
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return { ok: false, reason: 'utloggad', message: SIGNED_OUT };
    const { data, error, response } = await supabase.functions.invoke('kunskap', {
      body: { card: cardPayload(card), question: question.trim().slice(0, QUESTION_MAX), history: history.slice(-TURNS_BACK) },
    });
    if (!error) return readChatReply(200, data);
    if (response) return readChatReply(response.status, await response.json().catch(() => null));
    return { ok: false, reason: 'offline', message: FAILED };
  } catch {
    return { ok: false, reason: 'fel', message: FAILED };
  }
}
