// Kunskap: korten i flödet. Ett kort är ett citat, en nyckelinsikt eller ett färdigt protokoll, högst
// MAX_WORDS ord, alltid med person, ämne och källa med länk.
//
// Exempelkorten nedan byggs av det redan granskade innehållet i Lär (../lar/people.ts), så att inget är
// påhittat: citaten är kontrollerade ordagrant, påståendena har öppnade källor. Genererade kort kommer från
// servern (supabase/functions/kunskap-generera) i samma form och visas före exemplen.

import { AREAS, EVIDENCE_LABEL, PEOPLE, type Person, type Source } from '../lar/people';
import { cardWords, hash, MAX_WORDS, type CardType, type KunskapCard } from '../../supabase/functions/kunskap-generera/shared.ts';

export { cardWords, MAX_WORDS, wordCount, type CardType, type KunskapCard } from '../../supabase/functions/kunskap-generera/shared.ts';

export const TYPE_LABEL: Record<CardType, string> = { citat: 'Citat', insikt: 'Insikt', protokoll: 'Protokoll' };

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

/** Personerna i biblioteket (Lär), med ämnen. De följs från början (se followLibrary) och visas som förslag om man tar bort dem. */
export const SUGGESTED: { id: string; name: string; topics: string[] }[] = PEOPLE.map((p) => ({
  id: p.id,
  name: p.name,
  topics: [...new Set(p.areas.flatMap((a) => AREA_TOPICS[a] ?? []))],
}));
