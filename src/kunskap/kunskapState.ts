// Kunskap: ren logik för personer att följa, gilla/ogilla och vilka kort som visas. Inget här rör lagringen.

import type { CardType, KunskapCard } from './cards';
import {
  batchesLastDay,
  leaning,
  MAX_BATCHES_PER_DAY,
  MAX_PROFILES_PER_DAY,
  profilesLastDay,
  personKey,
  STALE_MS,
  weights,
  type Batch,
  type KunskapPrefs,
  type ManualLevel,
  type PersonProfile,
  type PrefKind,
  type Weight,
} from '../../supabase/functions/kunskap-generera/shared.ts';

export { personKey };

/** En person du följer. Sparas i kunskap_people och synkas privat till kontot. */
export interface FollowedPerson {
  id: string;
  name: string;
  topics: string[];
  created: number;
  /** Presentation skriven av Claude på servern (bara egna personer, och bara när du bett om den). */
  profile?: PersonProfile;
}

/** Gilla (1) eller ogilla (-1) på ett kort. Sparas i kunskap_votes, ett per kort. */
export interface Vote {
  cardId: string;
  value: 1 | -1;
  ts: number;
  /** Det som behövs för att lära sig av rösten utan att slå upp kortet: person, ämne och typ. */
  person: string;
  topic: string;
  type: CardType;
}

export const NAME_MAX = 60;
export const TOPIC_MAX = 30;
export const TOPICS_MAX = 6;

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');

export const cleanName = (name: string) => tidy(name).slice(0, NAME_MAX).trim();

/** "bastu, kallbad" blir ['bastu', 'kallbad']: utan tomma, utan dubbletter, högst TOPICS_MAX. */
export function parseTopics(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]/)) {
    const topic = tidy(raw).slice(0, TOPIC_MAX).trim();
    const key = topic.toLowerCase();
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
    if (out.length === TOPICS_MAX) break;
  }
  return out;
}

export const isFollowed = (people: FollowedPerson[], name: string) => people.some((p) => personKey(p.name) === personKey(name));

/** Rösten efter en tryckning: samma knapp en gång till tar bort rösten. */
export const nextVote = (current: 1 | -1 | undefined, pressed: 1 | -1): 1 | -1 | null => (current === pressed ? null : pressed);

export type Filter = 'alla' | CardType | 'gillade';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'citat', label: 'Citat' },
  { id: 'insikt', label: 'Insikter' },
  { id: 'protokoll', label: 'Protokoll' },
  { id: 'gillade', label: 'Gillade' },
];

/**
 * Korten i flödet. Följer du ingen visas alla kort (exempel), annars bara kort från dem du följer, plus
 * upptäcktskorten. Gillade visar det du gillat, oavsett vem du följer just nu.
 */
export function feed(cards: KunskapCard[], people: FollowedPerson[], votes: Map<string, 1 | -1>, filter: Filter): KunskapCard[] {
  if (filter === 'gillade') return cards.filter((c) => votes.get(c.id) === 1);
  const followed = new Set(people.map((p) => personKey(p.name)));
  const mine = followed.size === 0 ? cards : cards.filter((c) => c.discovery || followed.has(personKey(c.person)));
  return filter === 'alla' ? mine : mine.filter((c) => c.type === filter);
}

/**
 * Ordningen på de genererade korten medan Kunskap är öppen. Första gången: nyast först. Kort som kommer till
 * senare läggs sist, alltså precis där man är när man bläddrat förbi de förra, i stället för att hoppa in överst.
 * Kort som försvunnit tas bort. Nästa gång appen öppnas är det nyast först igen.
 */
export function sessionOrder(prev: string[] | null, cards: KunskapCard[]): string[] {
  const newest = [...cards].sort((a, b) => (b.created ?? 0) - (a.created ?? 0)).map((c) => c.id);
  if (!prev) return newest;
  const have = new Set(newest);
  const kept = prev.filter((id) => have.has(id));
  const known = new Set(kept);
  return [...kept, ...newest.filter((id) => !known.has(id))];
}

/**
 * Genererade kort före exempelkorten. Utan `order` nyast först, annars i den ordningen (se sessionOrder).
 * Ett genererat kort som också finns som exempel visas en gång.
 */
export function allCards(generated: KunskapCard[], examples: KunskapCard[], order?: string[]): KunskapCard[] {
  const rank = new Map((order ?? []).map((id, i) => [id, i]));
  const mine = [...generated].sort((a, b) =>
    order ? (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length) : (b.created ?? 0) - (a.created ?? 0),
  );
  const ids = new Set(mine.map((c) => c.id));
  return [...mine, ...examples.filter((c) => !ids.has(c.id))];
}

/** Personer du följer som inte har några kort än (de får kort vid nästa generering). */
export function waiting(cards: KunskapCard[], people: FollowedPerson[]): FollowedPerson[] {
  const have = new Set(cards.map((c) => personKey(c.person)));
  return people.filter((p) => !have.has(personKey(p.name)));
}

export const voteMap = (votes: Vote[]) => new Map(votes.map((v) => [v.cardId, v.value]));

// Kostnadsloggen

/** Batcharna nyast först. En batch som stått som pågående för länge visas som avbruten. */
export function batchLog(batches: Batch[], now: number): (Batch & { stale: boolean })[] {
  return [...batches].sort((a, b) => b.created - a.created).map((b) => ({ ...b, stale: b.status === 'pagar' && now - b.created > STALE_MS }));
}

/** Summan i USD för batcharna i samma månad som `now` (lokal tid). */
export function monthCost(batches: Batch[], now: number): number {
  const d = new Date(now);
  const sum = batches
    .filter((b) => {
      const c = new Date(b.created);
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
    })
    .reduce((total, b) => total + (b.costUsd || 0), 0);
  return Math.round(sum * 10_000) / 10_000;
}

/** "0,31 USD". Under en cent visas tre decimaler, så att små belopp inte ser ut som noll. */
export function formatUsd(amount: number): string {
  const digits = amount > 0 && amount < 0.01 ? 3 : 2;
  return `${amount.toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} USD`;
}

/** "2026-11-14 04:10" i lokal tid. */
export function formatWhen(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// Smak: "Vad Claude tror du gillar"

const TYPES = [
  { kind: 'type' as const, label: 'citat' },
  { kind: 'type' as const, label: 'insikt' },
  { kind: 'type' as const, label: 'protokoll' },
];

/** Viktningen som den visas och skickas till servern: rösterna, det du ställt in, dem du följer och de tre korttyperna. */
export function tasteOf(votes: Vote[], prefs: KunskapPrefs, people: FollowedPerson[]): Weight[] {
  const known = [...people.flatMap((p) => [{ kind: 'person' as const, label: p.name }, ...p.topics.map((t) => ({ kind: 'topic' as const, label: t }))]), ...TYPES];
  return weights(votes, prefs, known);
}

/** Smaken med en rad ändrad. `null` tar bort ditt eget val, så att rösterna gäller igen. */
export function withManual(prefs: KunskapPrefs, kind: PrefKind, label: string, key: string, level: ManualLevel | null): KunskapPrefs {
  const manual = { ...prefs.manual };
  if (level === null) delete manual[key];
  else manual[key] = { kind, label, level };
  return { id: 'prefs', manual };
}

/** "Gillar", "Gillar mindre" eller "Neutralt", och varför: ditt eget val eller antalet röster. */
export function describeWeight(w: Weight): string {
  const lean = leaning(w);
  const head = lean === 'mer' ? 'Gillar' : lean === 'mindre' ? 'Gillar mindre' : 'Neutralt';
  if (w.manual) return `${head}, valt av dig`;
  if (w.likes + w.dislikes === 0) return 'Inga röster än';
  return `${head}: ${w.likes} gilla, ${w.dislikes} ogilla`;
}

// Egna personer i biblioteket

/** Personer du följer som inte har en granskad sida i biblioteket. `library` är namnen som har det. */
export function ownPeople(people: FollowedPerson[], library: string[]): FollowedPerson[] {
  const reviewed = new Set(library.map(personKey));
  return people.filter((p) => !reviewed.has(personKey(p.name)));
}

/** Korten om en person, i flödets ordning. */
export const cardsOf = (cards: KunskapCard[], name: string) => cards.filter((c) => personKey(c.person) === personKey(name));

// Nya kort när man bläddrar

export type MoreKind = 'off' | 'nopeople' | 'busy' | 'error' | 'limit' | 'ready';

/**
 * Vad som gäller för "nya kort när du bläddrar" just nu. Bara `ready` får starta en omgång.
 * off: inte påslaget. nopeople: följer ingen. busy: en omgång pågår (här eller på en annan telefon).
 * error: förra försöket misslyckades, och inget nytt görs förrän man trycker. limit: dygnets omgångar är slut.
 */
export function moreKind(input: {
  auto: boolean;
  people: number;
  batches: Batch[];
  now: number;
  busy: boolean;
  error: boolean;
}): MoreKind {
  if (!input.auto) return 'off';
  if (input.people === 0) return 'nopeople';
  const running = input.batches.some((b) => b.status === 'pagar' && b.trigger !== 'profil' && input.now - b.created <= STALE_MS);
  if (input.busy || running) return 'busy';
  if (input.error) return 'error';
  if (batchesLastDay(input.batches, input.now) >= MAX_BATCHES_PER_DAY) return 'limit';
  return 'ready';
}

// Presentationer skrivs av sig själva

/**
 * Nästa egna person som ska få en presentation skriven, eller null. En i taget, bara de som saknar presentation
 * och inte redan prövats den här gången, inte medan en presentation skrivs (här eller på en annan telefon), och
 * inte när dygnets presentationer är slut. `people` är de egna personerna, i den ordning de lades till.
 */
export function nextToPresent(people: FollowedPerson[], tried: Set<string>, batches: Batch[], now: number): FollowedPerson | null {
  if (profilesLastDay(batches, now) >= MAX_PROFILES_PER_DAY) return null;
  if (batches.some((b) => b.trigger === 'profil' && !b.search && b.status === 'pagar' && now - b.created <= STALE_MS)) return null;
  return people.find((p) => !p.profile && !tried.has(p.id)) ?? null;
}
