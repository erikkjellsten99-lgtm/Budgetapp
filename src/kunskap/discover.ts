// Upptäck: en katalog med personer att följa, ordnad i genrer. Inget här hämtas från nätet och inget kostar.
//
// Katalogen är förslag, inte granskat innehåll som biblioteket (../lar/people.ts). Därför står bara vem personen
// är och vad hen är känd för, i en rad: inga påståenden om vad som fungerar, inga siffror, inga citat och inga
// länkar. Den som följs härifrån blir en egen person i biblioteket, och kort och presentation görs sedan av
// servern med källor.

import { leaning, prefKey, type Weight } from '../../supabase/functions/kunskap-generera/shared.ts';
import { personKey } from './kunskapState';

export interface Suggestion {
  name: string;
  /** Vem personen är och vad hen är känd för, högst 90 tecken. */
  about: string;
  /** Ämnen som följer med när man följer personen. */
  topics: string[];
}

export interface Genre {
  id: string;
  label: string;
  /** Ord som räknas som samma sak när genren jämförs med det du gillar och med sökningen. */
  words: string[];
  people: Suggestion[];
}

export const GENRES: Genre[] = [
  {
    id: 'framgang',
    label: 'Framgång och företagande',
    words: ['framgång', 'företagande', 'entreprenör', 'företag', 'karriär', 'ledarskap', 'rikedom'],
    people: [
      { name: 'Naval Ravikant', about: 'Investerare och medgrundare av AngelList. Skriver om rikedom och lycka.', topics: ['företagande', 'rikedom'] },
      { name: 'Paul Graham', about: 'Medgrundare av Y Combinator. Känd för sina essäer om startups.', topics: ['företagande', 'startups'] },
      { name: 'Tim Ferriss', about: 'Författare till The 4-Hour Workweek. Intervjuar toppresterare i sin podd.', topics: ['framgång', 'produktivitet'] },
      { name: 'Ray Dalio', about: 'Grundare av hedgefonden Bridgewater. Författare till Principles.', topics: ['ledarskap', 'beslut'] },
      { name: 'Phil Knight', about: 'Medgrundare av Nike. Skrev memoaren Shoe Dog.', topics: ['företagande'] },
      { name: 'Charlie Munger', about: 'Warren Buffetts mångårige kompanjon på Berkshire Hathaway.', topics: ['beslut', 'investeringar'] },
      { name: 'Alex Hormozi', about: 'Företagare och författare till $100M Offers.', topics: ['företagande', 'försäljning'] },
    ],
  },
  {
    id: 'pengar',
    label: 'Pengar och investeringar',
    words: ['pengar', 'investeringar', 'sparande', 'ekonomi', 'aktier', 'rikedom'],
    people: [
      { name: 'Morgan Housel', about: 'Författare till The Psychology of Money.', topics: ['pengar', 'beslut'] },
      { name: 'Warren Buffett', about: 'Investerare och ordförande i Berkshire Hathaway. Känd för sina aktieägarbrev.', topics: ['investeringar'] },
      { name: 'Howard Marks', about: 'Medgrundare av Oaktree Capital. Känd för sina memon om risk.', topics: ['investeringar', 'risk'] },
      { name: 'Ramit Sethi', about: 'Författare till I Will Teach You to Be Rich.', topics: ['pengar', 'sparande'] },
      { name: 'JL Collins', about: 'Författare till The Simple Path to Wealth.', topics: ['sparande', 'investeringar'] },
    ],
  },
  {
    id: 'prestation',
    label: 'Idrott och prestation',
    words: ['idrott', 'prestation', 'disciplin', 'mental styrka', 'träning'],
    people: [
      { name: 'David Goggins', about: 'Före detta Navy SEAL och ultralöpare. Författare till Can’t Hurt Me.', topics: ['disciplin', 'mental styrka'] },
      { name: 'Kobe Bryant', about: 'Basketspelare i Los Angeles Lakers. Skrev The Mamba Mentality.', topics: ['prestation', 'disciplin'] },
      { name: 'Eliud Kipchoge', about: 'Kenyansk maratonlöpare och olympisk mästare.', topics: ['prestation', 'löpning'] },
      { name: 'Arnold Schwarzenegger', about: 'Kroppsbyggare, skådespelare och politiker. Skrev Be Useful.', topics: ['prestation', 'disciplin'] },
      { name: 'Steve Magness', about: 'Löptränare och författare till Do Hard Things.', topics: ['prestation', 'mental styrka'] },
    ],
  },
  {
    id: 'traning',
    label: 'Träning och livslängd',
    words: ['träning', 'livslängd', 'styrka', 'kondition', 'hälsa', 'rörlighet'],
    people: [
      { name: 'Peter Attia', about: 'Läkare och författare till Outlive. Driver podden The Drive.', topics: ['träning', 'livslängd'] },
      { name: 'Andy Galpin', about: 'Forskare i träningsfysiologi. Talar om styrka och kondition.', topics: ['träning', 'styrka'] },
      { name: 'Kelly Starrett', about: 'Fysioterapeut och författare till Becoming a Supple Leopard.', topics: ['rörlighet', 'träning'] },
    ],
  },
  {
    id: 'somn',
    label: 'Sömn och återhämtning',
    words: ['sömn', 'återhämtning', 'dygnsrytm', 'vila'],
    people: [
      { name: 'Matthew Walker', about: 'Sömnforskare och författare till Why We Sleep.', topics: ['sömn'] },
      { name: 'Satchin Panda', about: 'Forskare om dygnsrytm och författare till The Circadian Code.', topics: ['dygnsrytm', 'sömn'] },
    ],
  },
  {
    id: 'hjarna',
    label: 'Hjärna och stress',
    words: ['hjärna', 'stress', 'känslor', 'psykologi'],
    people: [
      { name: 'Anders Hansen', about: 'Svensk psykiater och författare till Hjärnstark.', topics: ['hjärna', 'stress'] },
      { name: 'Robert Sapolsky', about: 'Biolog vid Stanford. Författare till Why Zebras Don’t Get Ulcers.', topics: ['stress', 'hjärna'] },
      { name: 'Lisa Feldman Barrett', about: 'Psykologiforskare och författare till How Emotions Are Made.', topics: ['känslor', 'hjärna'] },
    ],
  },
  {
    id: 'vanor',
    label: 'Vanor och beteende',
    words: ['vanor', 'beteende', 'motivation', 'personlig utveckling', 'disciplin'],
    people: [
      { name: 'BJ Fogg', about: 'Beteendeforskare vid Stanford och författare till Tiny Habits.', topics: ['vanor', 'beteende'] },
      { name: 'Charles Duhigg', about: 'Journalist och författare till The Power of Habit.', topics: ['vanor'] },
      { name: 'Katy Milkman', about: 'Professor vid Wharton och författare till How to Change.', topics: ['beteende', 'vanor'] },
      { name: 'Angela Duckworth', about: 'Psykologiprofessor och författare till Grit.', topics: ['motivation', 'uthållighet'] },
      { name: 'Carol Dweck', about: 'Psykologiprofessor vid Stanford och författare till Mindset.', topics: ['motivation', 'lärande'] },
    ],
  },
  {
    id: 'fokus',
    label: 'Fokus och arbete',
    words: ['fokus', 'arbete', 'produktivitet', 'koncentration', 'tid'],
    people: [
      { name: 'Cal Newport', about: 'Professor i datavetenskap och författare till Deep Work.', topics: ['fokus', 'arbete'] },
      { name: 'Oliver Burkeman', about: 'Journalist och författare till Four Thousand Weeks.', topics: ['tid', 'arbete'] },
      { name: 'Adam Grant', about: 'Organisationspsykolog vid Wharton och författare till Think Again.', topics: ['arbete', 'psykologi'] },
      { name: 'Tiago Forte', about: 'Författare till Building a Second Brain.', topics: ['produktivitet', 'anteckningar'] },
    ],
  },
  {
    id: 'tankande',
    label: 'Tänkande och beslut',
    words: ['tänkande', 'beslut', 'filosofi', 'stoicism', 'risk'],
    people: [
      { name: 'Daniel Kahneman', about: 'Psykolog och Nobelpristagare. Författare till Thinking, Fast and Slow.', topics: ['beslut', 'psykologi'] },
      { name: 'Nassim Taleb', about: 'Författare till The Black Swan och Antifragile.', topics: ['risk', 'beslut'] },
      { name: 'Annie Duke', about: 'Före detta pokerproffs och författare till Thinking in Bets.', topics: ['beslut'] },
      { name: 'Ryan Holiday', about: 'Författare till The Obstacle Is the Way. Skriver om stoicism.', topics: ['stoicism', 'filosofi'] },
      { name: 'Shane Parrish', about: 'Driver sajten Farnam Street och podden The Knowledge Project.', topics: ['beslut', 'tänkande'] },
    ],
  },
  {
    id: 'sinnesro',
    label: 'Meditation och sinnesro',
    words: ['meditation', 'sinnesro', 'mindfulness', 'självmedkänsla', 'närvaro'],
    people: [
      { name: 'Tara Brach', about: 'Psykolog och meditationslärare. Författare till Radical Acceptance.', topics: ['meditation', 'självmedkänsla'] },
      { name: 'Kristin Neff', about: 'Forskare om självmedkänsla och författare till Self-Compassion.', topics: ['självmedkänsla'] },
      { name: 'Thich Nhat Hanh', about: 'Vietnamesisk zenmunk och författare till The Miracle of Mindfulness.', topics: ['mindfulness', 'meditation'] },
      { name: 'Eckhart Tolle', about: 'Författare till The Power of Now.', topics: ['närvaro', 'meditation'] },
    ],
  },
  {
    id: 'andning',
    label: 'Andning och kyla',
    words: ['andning', 'kyla', 'kallbad', 'bastu'],
    people: [
      { name: 'James Nestor', about: 'Journalist och författare till Breath.', topics: ['andning'] },
      { name: 'Patrick McKeown', about: 'Andningsinstruktör och författare till The Oxygen Advantage.', topics: ['andning'] },
    ],
  },
];

const norm = (text: string) => personKey(text);

/**
 * Hur väl en genre passar det du gillar: summan av vikterna för ämnen (från gilla/ogilla och dina egna val) som
 * nämner något av genrens ord. Över noll passar den, under noll har du valt bort den.
 */
export function genreScore(genre: Genre, taste: Weight[]): number {
  const words = [genre.label, ...genre.words].map(norm);
  let score = 0;
  for (const w of taste) {
    if (w.kind !== 'topic') continue;
    const topic = norm(w.label);
    if (words.some((word) => topic.includes(word) || word.includes(topic))) score += w.weight;
  }
  return Math.round(score * 100) / 100;
}

export interface GenreMatch {
  genre: Genre;
  /** Passar det du gillar. */
  fits: boolean;
  people: (Suggestion & { followed: boolean })[];
}

/**
 * Det som visas i Upptäck: genrerna som passar dig först, sedan resten i katalogens ordning. Personer du valt
 * mindre av visas inte. `query` söker i genrens namn och ord, och i personens namn, beskrivning och ämnen; träffar
 * genren visas alla i den. `already` är namnen på dem som redan finns hos dig (följda eller i biblioteket).
 */
export function discover(taste: Weight[], already: string[], query = '', only?: string): GenreMatch[] {
  const have = new Set(already.map(norm));
  const less = new Set(taste.filter((w) => w.kind === 'person' && leaning(w) === 'mindre').map((w) => w.key));
  const q = norm(query);
  const out: (GenreMatch & { score: number; index: number })[] = [];
  GENRES.forEach((genre, index) => {
    if (only && genre.id !== only) return;
    const genreHit = !q || [genre.label, ...genre.words].some((word) => norm(word).includes(q));
    const people = genre.people
      .filter((p) => !less.has(prefKey('person', p.name)))
      .filter((p) => genreHit || [p.name, p.about, ...p.topics].some((text) => norm(text).includes(q)))
      .map((p) => ({ ...p, followed: have.has(norm(p.name)) }));
    if (people.length === 0) return;
    const score = genreScore(genre, taste);
    out.push({ genre, fits: score > 0, people, score, index });
  });
  return out.sort((a, b) => b.score - a.score || a.index - b.index).map(({ genre, fits, people }) => ({ genre, fits, people }));
}

// Bibliotekets filter för personer man lagt till själv

/** Genrer som är samma sak som ett av bibliotekets egna områden (../lar/people.ts). */
export const GENRE_AREA: Record<string, 'andning' | 'kallbad' | 'meditation' | 'utveckling'> = {
  andning: 'andning',
  sinnesro: 'meditation',
  vanor: 'utveckling',
};

/**
 * Genren en person hör till: den hen står under i katalogen, annars den första genren vars ord nämns i personens
 * ämnen. Null om ingen passar.
 */
export function genreOfPerson(name: string, topics: string[]): Genre | null {
  const key = norm(name);
  const listed = GENRES.find((g) => g.people.some((p) => norm(p.name) === key));
  if (listed) return listed;
  const mine = topics.map(norm).filter(Boolean);
  return (
    GENRES.find((g) => {
      const words = [g.label, ...g.words].map(norm);
      return mine.some((t) => words.some((w) => w === t || w.includes(t) || t.includes(w)));
    }) ?? null
  );
}

export const OTHER_GROUP = { id: 'ovrigt', label: 'Övrigt' };

/**
 * Var en egen person hamnar bland bibliotekets filter: i ett av bibliotekets områden, i en egen genre, eller
 * under Övrigt.
 */
export function libraryPlace(name: string, topics: string[]): { area?: 'andning' | 'kallbad' | 'meditation' | 'utveckling'; group?: string } {
  const genre = genreOfPerson(name, topics);
  if (!genre) return { group: OTHER_GROUP.id };
  const area = GENRE_AREA[genre.id];
  return area ? { area } : { group: genre.id };
}

/** Filtren som behövs utöver bibliotekets egna, i katalogens ordning, för de personer man har. Övrigt sist. */
export function libraryGroups(people: { name: string; topics: string[] }[]): { id: string; label: string }[] {
  const used = new Set(people.map((p) => libraryPlace(p.name, p.topics).group).filter(Boolean));
  return [...GENRES.filter((g) => used.has(g.id)).map((g) => ({ id: g.id, label: g.label })), ...(used.has(OTHER_GROUP.id) ? [OTHER_GROUP] : [])];
}
