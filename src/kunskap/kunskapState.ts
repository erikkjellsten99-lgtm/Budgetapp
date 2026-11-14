// Kunskap: ren logik för personer att följa, gilla/ogilla och vilka kort som visas. Inget här rör lagringen.

import type { CardType, KunskapCard } from './cards';

/** En person du följer. Sparas i kunskap_people och synkas privat till kontot. */
export interface FollowedPerson {
  id: string;
  name: string;
  topics: string[];
  created: number;
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

/** Jämför namn utan hänsyn till stora bokstäver och accenter: "Susanna Soberg" är samma som "Susanna Søberg". */
export const personKey = (name: string) =>
  tidy(name)
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

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
 * Korten i flödet. Följer du ingen visas alla kort (exempel), annars bara kort från dem du följer.
 * Gillade visar det du gillat, oavsett vem du följer just nu.
 */
export function feed(cards: KunskapCard[], people: FollowedPerson[], votes: Map<string, 1 | -1>, filter: Filter): KunskapCard[] {
  if (filter === 'gillade') return cards.filter((c) => votes.get(c.id) === 1);
  const followed = new Set(people.map((p) => personKey(p.name)));
  const mine = followed.size === 0 ? cards : cards.filter((c) => followed.has(personKey(c.person)));
  return filter === 'alla' ? mine : mine.filter((c) => c.type === filter);
}

/** Personer du följer som inte har några kort än (de får kort när genereringen kopplas på). */
export function waiting(cards: KunskapCard[], people: FollowedPerson[]): FollowedPerson[] {
  const have = new Set(cards.map((c) => personKey(c.person)));
  return people.filter((p) => !have.has(personKey(p.name)));
}

export const voteMap = (votes: Vote[]) => new Map(votes.map((v) => [v.cardId, v.value]));
