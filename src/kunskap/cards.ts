// Kunskap: korten i flödet. Ett kort är ett citat, en nyckelinsikt eller ett färdigt protokoll, högst
// MAX_WORDS ord, alltid med person, ämne och källa med länk.
//
// Exempelkorten nedan byggs av det redan granskade innehållet i Lär (../lar/people.ts), så att inget är
// påhittat: citaten är kontrollerade ordagrant, påståendena har öppnade källor. När genereringen kopplas på
// kommer korten i stället från servern, i samma form.

import { AREAS, EVIDENCE_LABEL, PEOPLE, type Person, type Source } from '../lar/people';

export type CardType = 'citat' | 'insikt' | 'protokoll';

export const TYPE_LABEL: Record<CardType, string> = { citat: 'Citat', insikt: 'Insikt', protokoll: 'Protokoll' };

export const MAX_WORDS = 80;

export interface KunskapCard {
  id: string;
  person: string;
  topic: string;
  type: CardType;
  /** Citatet på originalspråket, eller insikten. Tom för protokoll. */
  text: string;
  /** Citat: svensk översättning. */
  sv?: string;
  /** Protokoll: stegen i ordning. */
  steps?: string[];
  /** Insikt: hur väl belagd den är (Väl belagt, Svagt stöd, Egen åsikt). */
  label?: string;
  /** Varningsrad för sådant som kan vara riskabelt (andning, kyla). */
  warning?: string;
  source: { title: string; url: string };
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Orden som räknas mot gränsen: texten och stegen (inte översättningen, som är samma sak en gång till). */
export const cardWords = (card: Pick<KunskapCard, 'text' | 'steps'>) => wordCount([card.text, ...(card.steps ?? [])].join(' '));

/** Kort och stabilt id av texten, så att gilla/ogilla sitter kvar även om ordningen i Lär ändras. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const link = (s: Source) => ({ title: s.title, url: s.url });

function cardsOf(p: Person): KunskapCard[] {
  const topic = AREAS.find((a) => a.id === p.areas[0])?.label ?? 'Övrigt';
  const base = { person: p.name, topic };
  const cards: KunskapCard[] = [
    ...p.quotes.map((q) => ({ ...base, id: `${p.id}-c-${hash(q.text)}`, type: 'citat' as const, text: q.text, sv: q.sv, source: link(q.source) })),
    ...p.claims.map((c) => ({
      ...base,
      id: `${p.id}-i-${hash(c.text)}`,
      type: 'insikt' as const,
      text: c.text,
      label: EVIDENCE_LABEL[c.evidence],
      source: link(c.sources[0]),
    })),
    {
      ...base,
      id: `${p.id}-p-${hash(p.method.join('|'))}`,
      type: 'protokoll' as const,
      text: '',
      steps: p.method,
      ...(p.warning ? { warning: p.warning } : {}),
      source: link(p.startHere[0]),
    },
  ];
  return cards.filter((c) => cardWords(c) <= MAX_WORDS);
}

/** Blandar korten: en person i taget, och typerna i tur och ordning, så att flödet inte blir en lång rad av samma sak. */
function shuffle(perPerson: KunskapCard[][]): KunskapCard[] {
  const order: CardType[] = ['insikt', 'citat', 'protokoll'];
  const queues = perPerson.map((cards) => order.map((t) => cards.filter((c) => c.type === t)));
  const out: KunskapCard[] = [];
  for (let round = 0; out.length < perPerson.flat().length; round++) {
    queues.forEach((byType, person) => {
      for (let k = 0; k < order.length; k++) {
        const next = byType[(round + person + k) % order.length].shift();
        if (next) return void out.push(next);
      }
    });
  }
  return out;
}

export const EXAMPLE_CARDS: KunskapCard[] = shuffle(PEOPLE.map(cardsOf));

const AREA_TOPICS: Record<string, string[]> = {
  andning: ['andning', 'kyla'],
  kallbad: ['kallbad', 'bastu'],
  meditation: ['meditation'],
  utveckling: ['personlig utveckling'],
};

/** Förslag på personer att följa: de som redan har kort. */
export const SUGGESTED: { name: string; topics: string[] }[] = PEOPLE.map((p) => ({
  name: p.name,
  topics: [...new Set(p.areas.flatMap((a) => AREA_TOPICS[a] ?? []))],
}));
