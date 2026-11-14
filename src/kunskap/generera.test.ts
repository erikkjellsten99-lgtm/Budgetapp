import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  checkCards,
  collectSources,
  htmlToText,
  normalizeUrl,
  PROFILE_TOOL,
  profileSystemPrompt,
  profileUserPrompt,
  quoteInText,
  SAVE_TOOL,
  systemPrompt,
  taste,
  toCandidate,
  toProfile,
  userPrompt,
  type Person,
} from '../../supabase/functions/kunskap-generera/generate.ts';
import {
  batchesLastDay,
  cleanPrefs,
  cleanSettings,
  costUsd,
  discoveryCount,
  isDue,
  leaning,
  MAX_BATCHES_PER_DAY,
  NO_PREFS,
  NO_USAGE,
  prefKey,
  profilesLastDay,
  weights,
  type Batch,
  type VoteRow,
} from '../../supabase/functions/kunskap-generera/shared.ts';
import { EXAMPLE_CARDS } from './cards';
import { MAX_PROFILES_PER_DAY } from '../../supabase/functions/kunskap-generera/shared.ts';
import { allCards, batchLog, moreKind, nextToPresent, sessionOrder, describeWeight, feed, formatUsd, formatWhen, monthCost, tasteOf, withManual } from './kunskapState';
import { loadKunskap, readGenerateReply, savePrefs, saveSettings } from './kunskapStore';

const PEOPLE: Person[] = [{ name: 'Susanna Søberg', topics: ['bastu', 'kallbad'] }];
const URL_A = 'https://example.org/podd/avsnitt-12';
const search = (...urls: string[]) => [
  { type: 'text', text: 'Jag söker.' },
  { type: 'web_search_tool_result', content: urls.map((url) => ({ type: 'web_search_result', url, title: 't' })) },
];
const SOURCES = collectSources(search(URL_A, 'https://www.example.org/studie/?utm_source=x#resultat'));

const raw = (over: Record<string, unknown> = {}) => ({
  person: 'susanna soberg',
  topic: 'kallbad',
  type: 'insikt',
  discovery: false,
  text: 'Vinterbadare i hennes studie reglerade kroppstemperaturen bättre än kontrollgruppen.',
  sv: null,
  steps: null,
  fallback: null,
  source_url: URL_A,
  source_title: 'Podden, avsnitt 12',
  ...over,
});

describe('källor', () => {
  it('samlar adresserna ur sökresultaten och hoppar över fel', () => {
    expect([...SOURCES.keys()]).toEqual(['https://example.org/podd/avsnitt-12', 'https://example.org/studie']);
    expect(collectSources([{ type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } }]).size).toBe(0);
    expect(collectSources([null, 'x', { type: 'text' }]).size).toBe(0);
  });

  it('bara https, och samma sida känns igen trots www, fragment och spårning', () => {
    expect(normalizeUrl('http://example.org/a')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('inte en adress')).toBeNull();
    expect(normalizeUrl('https://WWW.Example.org/a/?utm_campaign=x&id=3#top')).toBe('https://example.org/a?id=3');
  });
});

describe('kort från modellen', () => {
  it('ett kort utan källa bland sökresultaten kastas', () => {
    expect(toCandidate(raw(), PEOPLE, SOURCES)?.card).toMatchObject({ person: 'Susanna Søberg', type: 'insikt', source: { url: URL_A, title: 'Podden, avsnitt 12' } });
    expect(toCandidate(raw({ source_url: 'https://pahittad.se/sida' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ source_url: '' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ source_title: ' ' }), PEOPLE, SOURCES)).toBeNull();
  });

  it('okänd person, okänd typ, tom text och för långa kort kastas', () => {
    expect(toCandidate(raw({ person: 'Någon Annan' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ type: 'reklam' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ text: '  ' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ text: Array(81).fill('ord').join(' ') }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ text: Array(80).fill('ord').join(' ') }), PEOPLE, SOURCES)).not.toBeNull();
    expect(toCandidate(null, PEOPLE, SOURCES)).toBeNull();
  });

  it('protokoll kräver minst två steg', () => {
    expect(toCandidate(raw({ type: 'protokoll', text: 'Kallbad', steps: ['Ett steg'] }), PEOPLE, SOURCES)).toBeNull();
    const ok = toCandidate(raw({ type: 'protokoll', text: 'Kallbad', steps: ['Gå i lugnt.', ' ', 'Sluta med kyla.'] }), PEOPLE, SOURCES);
    expect(ok?.card.steps).toEqual(['Gå i lugnt.', 'Sluta med kyla.']);
  });

  it('citattecken runt citatet tas bort, och översättningen följer med', () => {
    const c = toCandidate(raw({ type: 'citat', text: '“We expected more brown fat.”', sv: 'Vi väntade oss mer brunt fett.', fallback: 'Hon väntade sig mer brunt fett.' }), PEOPLE, SOURCES);
    expect(c?.card).toMatchObject({ type: 'citat', text: 'We expected more brown fat.', sv: 'Vi väntade oss mer brunt fett.' });
    expect(c?.fallback).toBe('Hon väntade sig mer brunt fett.');
  });
});

describe('citat måste stå ordagrant i källan', () => {
  const page = htmlToText('<html><script>var x = "We expected";</script><p>She said: &ldquo;We expected winter swimmers to have\n more brown&nbsp;fat &mdash; but no.&rdquo;</p></html>');

  it('bara blanksteg, citattecken och tankstreck får skilja', () => {
    expect(quoteInText('We expected winter swimmers to have more brown fat – but no.', page)).toBe(true);
    expect(quoteInText('We expected winter swimmers to have more brown fat', page)).toBe(true);
    expect(quoteInText('We expected winter swimmers to have less brown fat', page)).toBe(false);
    expect(quoteInText('we expected winter swimmers', page)).toBe(false);
    expect(quoteInText('var x', page)).toBe(false);
    expect(quoteInText('but no', page)).toBe(false); // för kort för att bevisa något
  });

  const quote = raw({ type: 'citat', text: 'We expected winter swimmers to have more brown fat', sv: 'Vi väntade oss mer brunt fett hos vinterbadare.', fallback: 'Hon väntade sig mer brunt fett hos vinterbadarna.' });
  const run = (cards: unknown[], pageText: (url: string) => Promise<string | null>, existing = new Set<string>(), count = 5) =>
    checkCards({ cards }, PEOPLE, SOURCES, existing, count, pageText, 1000, 'b-1');

  it('bekräftat citat behålls som citat', async () => {
    const out = await run([quote], async () => page);
    expect(out).toMatchObject({ quotesVerified: 1, quotesRewritten: 0, dropped: 0 });
    expect(out.cards[0]).toMatchObject({ type: 'citat', verified: true, batch: 'b-1', created: 1000 });
  });

  it('obekräftat citat blir en insikt med egna ord, utan originaltext', async () => {
    for (const pageText of [async () => 'En helt annan text.', async () => null]) {
      const out = await run([quote], pageText);
      expect(out).toMatchObject({ quotesVerified: 0, quotesRewritten: 1, dropped: 0 });
      expect(out.cards[0]).toMatchObject({ type: 'insikt', text: 'Hon väntade sig mer brunt fett hos vinterbadarna.' });
      expect(out.cards[0].sv).toBeUndefined();
      expect(out.cards[0].verified).toBeUndefined();
    }
  });

  it('obekräftat citat utan egna ord kastas', async () => {
    const out = await run([{ ...quote, fallback: null }], async () => null);
    expect(out).toMatchObject({ cards: [], dropped: 1 });
  });

  it('dubbletter, kort som redan finns och kort över antalet kastas', async () => {
    const first = await run([raw()], async () => null);
    const out = await run([raw(), raw(), raw({ text: 'En annan insikt.' }), raw({ text: 'En tredje insikt.' })], async () => null, new Set<string>(), 2);
    expect(out.cards.map((c) => c.text)).toEqual([raw().text, 'En annan insikt.']);
    expect(out.dropped).toBe(2);
    expect(out.cards[0].created).toBeGreaterThan(out.cards[1].created!);
    expect((await run([raw()], async () => null, new Set([first.cards[0].id]))).cards).toEqual([]);
    expect((await checkCards('skräp', PEOPLE, SOURCES, new Set(), 5, async () => null, 1, 'b')).cards).toEqual([]);
  });
});

const vote = (value: 1 | -1, person: string, topic: string, type: VoteRow['type']): VoteRow => ({ value, person, topic, type });

describe('viktningen', () => {
  const votes = [
    vote(1, 'Susanna Søberg', 'Bastu', 'protokoll'),
    vote(1, 'susanna soberg', 'bastu', 'protokoll'),
    vote(1, 'Susanna Søberg', 'kallbad', 'insikt'),
    vote(-1, 'Wim Hof', 'andning', 'citat'),
    vote(-1, 'Wim Hof', 'andning', 'insikt'),
  ];
  const by = (all: ReturnType<typeof weights>, kind: string, label: string) => all.find((w) => w.key === prefKey(kind as 'person', label))!;

  it('räknas per person, ämne och korttyp, dämpad så att en röst inte väger för tungt', () => {
    const all = weights(votes, NO_PREFS);
    expect(by(all, 'person', 'Susanna Søberg')).toMatchObject({ likes: 3, dislikes: 0, weight: 0.6 });
    expect(by(all, 'person', 'Wim Hof')).toMatchObject({ likes: 0, dislikes: 2, weight: -0.5 });
    expect(by(all, 'topic', 'bastu')).toMatchObject({ label: 'Bastu', likes: 2, weight: 0.5 });
    expect(by(all, 'type', 'insikt')).toMatchObject({ likes: 1, dislikes: 1, weight: 0 });
    expect(by(weights([vote(1, 'A', 'b', 'citat')], NO_PREFS), 'person', 'A').weight).toBe(0.33);
    expect(all.filter((w) => w.kind === 'person').map((w) => w.label)).toEqual(['Susanna Søberg', 'Wim Hof']);
    expect(all.map((w) => w.kind).join()).toMatch(/^(person,)+(topic,)+(type,?)+$/);
    expect([leaning({ weight: 0.33 }), leaning({ weight: 0 }), leaning({ weight: -0.5 })]).toEqual(['mer', 'neutral', 'mindre']);
  });

  it('det du själv valt går före rösterna, och Auto lämnar tillbaka till rösterna', () => {
    let prefs = withManual(NO_PREFS, 'person', 'Wim Hof', prefKey('person', 'Wim Hof'), 'mer');
    prefs = withManual(prefs, 'topic', 'sömn', prefKey('topic', 'sömn'), 'mer');
    const all = weights(votes, prefs);
    expect(by(all, 'person', 'Wim Hof')).toMatchObject({ manual: 'mer', weight: 1, dislikes: 2 });
    expect(by(all, 'topic', 'sömn')).toMatchObject({ manual: 'mer', weight: 1, likes: 0 });
    expect(describeWeight(by(all, 'person', 'Wim Hof'))).toBe('Gillar, valt av dig');
    expect(describeWeight(by(all, 'person', 'Susanna Søberg'))).toBe('Gillar: 3 gilla, 0 ogilla');
    const back = withManual(prefs, 'person', 'Wim Hof', prefKey('person', 'Wim Hof'), null);
    expect(by(weights(votes, back), 'person', 'Wim Hof')).toMatchObject({ weight: -0.5 });
    expect(describeWeight(by(weights(votes, back), 'person', 'Wim Hof'))).toBe('Gillar mindre: 0 gilla, 2 ogilla');
  });

  it('dem du följer och de tre korttyperna finns med även utan röster', () => {
    const all = tasteOf([], NO_PREFS, [{ id: '1', name: 'Naval Ravikant', topics: ['lycka'], created: 0 }]);
    expect(all.map((w) => `${w.kind}:${w.label}`)).toEqual(['person:Naval Ravikant', 'topic:lycka', 'type:citat', 'type:insikt', 'type:protokoll']);
    expect(describeWeight(all[0])).toBe('Inga röster än');
  });

  it('trasiga sparade val städas bort', () => {
    expect(cleanPrefs(null)).toEqual({ id: 'prefs', manual: {} });
    const clean = cleanPrefs({ manual: { a: { kind: 'topic', label: '  Sömn ', level: 'mer' }, b: { kind: 'x', label: 'y', level: 'mer' }, c: { kind: 'person', label: '', level: 'mer' }, d: { kind: 'type', label: 'citat', level: 'mest' }, e: 'skräp' } });
    expect(clean.manual).toEqual({ 'topic:sömn': { kind: 'topic', label: 'Sömn', level: 'mer' } });
  });

  it('ungefär vart femte kort är upptäckt', () => {
    expect([1, 2, 3, 5, 7, 8, 10].map(discoveryCount)).toEqual([0, 0, 1, 1, 1, 2, 2]);
  });
});

describe('prompten', () => {
  it('nämner personerna, antalet, upptäckt, smaken och det som redan finns', () => {
    const all = weights([vote(1, 'Susanna Søberg', 'bastu', 'protokoll'), vote(1, 'Susanna Søberg', 'bastu', 'protokoll'), vote(1, 'Susanna Søberg', 'bastu', 'protokoll'), vote(-1, 'Wim Hof', 'andning', 'citat')], NO_PREFS);
    const text = userPrompt(PEOPLE, 5, 1, all, [{ person: 'Susanna Søberg', text: 'Ett kort som finns.' }], '2026-11-14');
    for (const part of ['Gör 5 nya kort', '1 av dem ska vara upptäcktskort', 'Övriga 4', 'Susanna Søberg: bastu, kallbad', 'Mer av: personen Susanna Søberg (starkt)', 'ämnet bastu', 'korttypen protokoll', 'Mindre av: personen Wim Hof', 'Ett kort som finns.'])
      expect(text).toContain(part);
    expect(userPrompt(PEOPLE, 2, 0, [], [], '2026-11-14')).toContain('Inga upptäcktskort');
    expect(userPrompt(PEOPLE, 2, 0, [], [], '2026-11-14')).not.toContain('smak');
    expect(taste([])).toBe('');
    expect(taste(weights([vote(1, 'A', 'b', 'citat'), vote(-1, 'A', 'b', 'citat')], NO_PREFS))).toBe('');
    expect(systemPrompt()).toContain('spara_kort');
    expect(systemPrompt()).toContain('Upptäcktskort');
    expect(SAVE_TOOL.input_schema.properties.cards.items.required).toEqual(Object.keys(SAVE_TOOL.input_schema.properties.cards.items.properties));
  });
});

describe('upptäcktskort', () => {
  const run = (cards: unknown[], max: number, count = 5) => checkCards({ cards }, PEOPLE, SOURCES, new Set(), count, async () => null, 1000, 'b-1', max);
  const found = (over: Record<string, unknown> = {}) => raw({ person: 'Rhonda Patrick', topic: 'värme', discovery: true, text: 'En insikt från en ny person.', ...over });

  it('en person du inte följer släpps bara in på ett kort märkt som upptäckt', () => {
    expect(toCandidate(found(), PEOPLE, SOURCES)?.card).toMatchObject({ person: 'Rhonda Patrick', topic: 'värme', discovery: true });
    expect(toCandidate(found({ discovery: false }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(found({ discovery: 'true' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(found({ source_url: 'https://pahittad.se/x' }), PEOPLE, SOURCES)).toBeNull();
    expect(toCandidate(raw({ discovery: true }), PEOPLE, SOURCES)?.card).toMatchObject({ person: 'Susanna Søberg', discovery: true });
    expect(toCandidate(raw(), PEOPLE, SOURCES)?.card.discovery).toBeUndefined();
  });

  it('högst så många upptäcktskort som batchen ska ha', async () => {
    const out = await run([found(), raw(), found({ text: 'En andra upptäckt.' }), raw({ text: 'En vanlig till.' })], 1);
    expect(out.cards.map((c) => !!c.discovery)).toEqual([true, false, false]);
    expect(out).toMatchObject({ discovery: 1, dropped: 1 });
    expect((await run([found()], 0)).cards).toEqual([]);
  });

  it('visas i flödet fast personen inte följs', () => {
    const card = { ...EXAMPLE_CARDS[0], id: 'g-9', person: 'Rhonda Patrick', discovery: true, created: 5 };
    const me = [{ id: 'x', name: 'Wim Hof', topics: [], created: 0 }];
    expect(feed(allCards([card], EXAMPLE_CARDS), me, new Map(), 'alla')[0]).toEqual(card);
    expect(feed(allCards([{ ...card, discovery: false }], EXAMPLE_CARDS), me, new Map(), 'alla').some((c) => c.id === 'g-9')).toBe(false);
  });
});

describe('presentation av en egen person', () => {
  const ok = { paragraphs: ['Naval Ravikant är investerare och författare.', 'Han skriver om lycka och rikedom.'], sources: [{ url: URL_A, title: 'Hans sajt' }] };

  it('kräver text och minst en källa ur sökresultaten', () => {
    expect(toProfile(ok, SOURCES, 5)).toEqual({ text: ok.paragraphs, sources: [{ title: 'Hans sajt', url: URL_A }], created: 5, model: 'claude-sonnet-5-5' });
    expect(toProfile({ ...ok, sources: [{ url: 'https://pahittad.se/x', title: 'Påhittad' }] }, SOURCES, 5)).toBeNull();
    expect(toProfile({ ...ok, sources: [] }, SOURCES, 5)).toBeNull();
    expect(toProfile({ ...ok, paragraphs: [] }, SOURCES, 5)).toBeNull();
    expect(toProfile({ ...ok, paragraphs: ['  '] }, SOURCES, 5)).toBeNull();
    expect(toProfile(null, SOURCES, 5)).toBeNull();
  });

  it('för lång text kastas, påhittade och dubbla källor rensas bort', () => {
    expect(toProfile({ ...ok, paragraphs: [Array(121).fill('ord').join(' ')] }, SOURCES, 5)).toBeNull();
    expect(toProfile({ ...ok, paragraphs: [Array(120).fill('ord').join(' ')] }, SOURCES, 5)).not.toBeNull();
    const mixed = toProfile({ ...ok, sources: [{ url: 'https://pahittad.se/x', title: 'Påhittad' }, { url: URL_A, title: 'Ett' }, { url: URL_A + '#del', title: 'Samma igen' }, { url: URL_A, title: '' }] }, SOURCES, 5);
    expect(mixed?.sources).toEqual([{ title: 'Ett', url: URL_A }]);
    expect(toProfile({ ...ok, paragraphs: ['a', 'b', 'c', 'd'] }, SOURCES, 5)?.text).toEqual(['a', 'b', 'c']);
  });

  it('prompten nämner personen och ämnena och förbjuder hälsopåståenden', () => {
    expect(profileUserPrompt({ name: 'Naval Ravikant', topics: ['lycka', 'rikedom'] })).toContain('- Naval Ravikant: lycka, rikedom');
    expect(profileSystemPrompt()).toContain('spara_presentation');
    expect(profileSystemPrompt()).toContain('Inga påståenden om hälsoeffekter');
    expect(PROFILE_TOOL.input_schema.required).toEqual(['paragraphs', 'sources']);
  });
});

describe('inställningar, schema och kostnad', () => {
  const HOUR = 3_600_000;
  const now = Date.UTC(2026, 10, 14, 4, 10);

  it('utan inställning genereras ingenting, och värdena hålls inom gränserna', () => {
    expect(cleanSettings(undefined)).toEqual({ id: 'settings', frequency: 'av', count: 5, auto: false });
    expect(cleanSettings({ frequency: 'ofta', count: 99 })).toEqual({ id: 'settings', frequency: 'av', count: 10, auto: false });
    expect(cleanSettings({ frequency: 'vecka', count: 0 })).toEqual({ id: 'settings', frequency: 'vecka', count: 1, auto: false });
    expect(cleanSettings({ frequency: 'dag', count: 'tre' }).count).toBe(5);
  });

  it('dagligen och veckovis körs när senaste schemalagda batchen är gammal nog', () => {
    const schema = (ago: number) => [{ created: now - ago, trigger: 'schema' as const }];
    expect(isDue(cleanSettings({ frequency: 'av' }), [], now)).toBe(false);
    expect(isDue(cleanSettings({ frequency: 'dag' }), [], now)).toBe(true);
    expect(isDue(cleanSettings({ frequency: 'dag' }), schema(24 * HOUR), now)).toBe(true);
    expect(isDue(cleanSettings({ frequency: 'dag' }), schema(3 * HOUR), now)).toBe(false);
    expect(isDue(cleanSettings({ frequency: 'vecka' }), schema(3 * 24 * HOUR), now)).toBe(false);
    expect(isDue(cleanSettings({ frequency: 'vecka' }), schema(7 * 24 * HOUR), now)).toBe(true);
    // En manuell batch flyttar inte schemat, men räknas mot dygnets gräns.
    expect(isDue(cleanSettings({ frequency: 'dag' }), [{ created: now - HOUR, trigger: 'manuell' }], now)).toBe(true);
    const day = [
      { created: now - HOUR, trigger: 'manuell' as const },
      { created: now - 23 * HOUR, trigger: 'schema' as const },
      { created: now - 25 * HOUR, trigger: 'schema' as const },
      { created: now - 2 * HOUR, trigger: 'profil' as const },
    ];
    // Presentationer räknas för sig och tar inte av dygnets batchar.
    expect(batchesLastDay(day, now)).toBe(2);
    expect(profilesLastDay(day, now)).toBe(1);
    expect(isDue(cleanSettings({ frequency: 'dag' }), [{ created: now - HOUR, trigger: 'profil' }], now)).toBe(true);
    expect(MAX_BATCHES_PER_DAY).toBe(3);
  });

  it('kostnaden räknas från token och sökningar', () => {
    expect(costUsd(NO_USAGE)).toBe(0);
    expect(costUsd({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 })).toBe(2);
    expect(costUsd({ input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0, searches: 0 })).toBe(10);
    expect(costUsd({ input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 1_000_000, searches: 0 })).toBe(2.6);
    expect(costUsd({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 8 })).toBe(0.08);
    expect(costUsd({ input: 60_000, output: 3_000, cacheRead: 0, cacheWrite: 0, searches: 8 })).toBe(0.23);
  });

  const batch = (over: Partial<Batch>): Batch => ({
    id: 'b',
    created: now,
    status: 'klar',
    trigger: 'schema',
    requested: 5,
    cards: 5,
    quotesVerified: 0,
    quotesRewritten: 0,
    dropped: 0,
    model: 'm',
    usage: NO_USAGE,
    costUsd: 0.25,
    ...over,
  });

  it('loggen visas nyast först, månaden summeras och en hängande batch visas som avbruten', () => {
    const batches = [
      batch({ id: 'a', created: now - 40 * 24 * HOUR, costUsd: 9 }),
      batch({ id: 'b', created: now - HOUR, costUsd: 0.25 }),
      batch({ id: 'c', created: now - 20 * 60_000, status: 'pagar', costUsd: 0 }),
      batch({ id: 'd', created: now - 60_000, status: 'pagar', costUsd: 0.1 }),
    ];
    expect(batchLog(batches, now).map((b) => [b.id, b.stale])).toEqual([['d', false], ['c', true], ['b', false], ['a', false]]);
    expect(monthCost(batches, now)).toBe(0.35);
    expect(formatUsd(0.3149).replace(/\s/g, ' ')).toBe('0,31 USD');
    expect(formatUsd(0.004).replace(/\s/g, ' ')).toBe('0,004 USD');
    expect(formatUsd(0).replace(/\s/g, ' ')).toBe('0,00 USD');
    expect(formatWhen(new Date(2026, 10, 4, 4, 5).getTime())).toBe('2026-11-04 04:05');
  });
});

describe('presentationer skrivs av sig själva', () => {
  const now = Date.UTC(2026, 10, 15, 12);
  const p = (id: string, profile = false) => ({ id, name: id, topics: [], created: 0, ...(profile ? { profile: { text: ['x'], sources: [{ title: 't', url: 'https://a.se' }], created: 1, model: 'm' } } : {}) });
  const prof = (ago: number, over: Partial<Batch> = {}): Batch => ({
    id: `p${ago}`, created: now - ago, status: 'klar', trigger: 'profil', requested: 0, cards: 0, quotesVerified: 0, quotesRewritten: 0, dropped: 0, model: 'm', usage: NO_USAGE, costUsd: 0.05, ...over,
  });

  it('nästa är den första som saknar presentation och inte prövats', () => {
    const people = [p('a', true), p('b'), p('c')];
    expect(nextToPresent(people, new Set(), [], now)?.id).toBe('b');
    expect(nextToPresent(people, new Set(['b']), [], now)?.id).toBe('c');
    expect(nextToPresent(people, new Set(['b', 'c']), [], now)).toBeNull();
    expect(nextToPresent([p('a', true)], new Set(), [], now)).toBeNull();
    expect(nextToPresent([], new Set(), [], now)).toBeNull();
  });

  it('inte när dygnets presentationer är slut, och inte medan en presentation skrivs', () => {
    expect(MAX_PROFILES_PER_DAY).toBe(20);
    const full = Array.from({ length: MAX_PROFILES_PER_DAY }, (_, i) => prof((i + 1) * 1000));
    const people = [p('b')];
    expect(nextToPresent(people, new Set(), full, now)).toBeNull();
    expect(nextToPresent(people, new Set(), full.slice(1), now)?.id).toBe('b');
    expect(nextToPresent(people, new Set(), [prof(30_000, { status: 'pagar' })], now)).toBeNull();
    expect(nextToPresent(people, new Set(), [prof(20 * 60_000, { status: 'pagar' })], now)?.id).toBe('b');
    // Sökningar i Upptäck och vanliga omgångar hindrar inte.
    expect(nextToPresent(people, new Set(), Array.from({ length: 30 }, (_, i) => prof((i + 1) * 1000, { search: true })), now)?.id).toBe('b');
    expect(nextToPresent(people, new Set(), [prof(1000, { trigger: 'manuell', status: 'pagar' })], now)?.id).toBe('b');
  });
});

describe('nya kort när man bläddrar', () => {
  const now = Date.UTC(2026, 10, 15, 12);
  const card = (id: string, created: number) => ({ ...EXAMPLE_CARDS[0], id, created });
  const b = (ago: number, over: Partial<Batch> = {}): Batch => ({
    id: `b${ago}`, created: now - ago, status: 'klar', trigger: 'manuell', requested: 5, cards: 5, quotesVerified: 0, quotesRewritten: 0, dropped: 0, model: 'm', usage: NO_USAGE, costUsd: 0.2, ...over,
  });
  const base = { auto: true, people: 3, batches: [] as Batch[], now, busy: false, error: false };

  it('kort som kommer till under tiden läggs efter de förra, och nästa gång är det nyast först', () => {
    const first = [card('a', 1), card('b', 3), card('c', 2)];
    const order = sessionOrder(null, first);
    expect(order).toEqual(['b', 'c', 'a']);
    const later = [...first, card('e', 9), card('d', 10)];
    expect(sessionOrder(order, later)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(sessionOrder(order, later.filter((c) => c.id !== 'c'))).toEqual(['b', 'a', 'd', 'e']);
    expect(sessionOrder(null, later)).toEqual(['d', 'e', 'b', 'c', 'a']);
    expect(allCards(later, [], sessionOrder(order, later)).map((c) => c.id)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(allCards(later, []).map((c) => c.id)).toEqual(['d', 'e', 'b', 'c', 'a']);
  });

  it('bara påslaget, med någon att följa, utan fel och under dygnets gräns får starta en omgång', () => {
    expect(moreKind(base)).toBe('ready');
    expect(moreKind({ ...base, auto: false })).toBe('off');
    expect(moreKind({ ...base, people: 0 })).toBe('nopeople');
    expect(moreKind({ ...base, busy: true })).toBe('busy');
    expect(moreKind({ ...base, error: true })).toBe('error');
    expect(moreKind({ ...base, batches: [b(3_600_000), b(7_200_000), b(10_800_000)] })).toBe('limit');
    expect(moreKind({ ...base, batches: [b(3_600_000), b(7_200_000), b(90_000_000)] })).toBe('ready');
  });

  it('en omgång som pågår på en annan telefon räknas, men inte en som hängt sig eller en presentation', () => {
    expect(moreKind({ ...base, batches: [b(60_000, { status: 'pagar' })] })).toBe('busy');
    expect(moreKind({ ...base, batches: [b(20 * 60_000, { status: 'pagar' })] })).toBe('ready');
    expect(moreKind({ ...base, batches: [b(60_000, { status: 'pagar', trigger: 'profil' })] })).toBe('ready');
    // Presentationer tar inte av dygnets omgångar.
    expect(moreKind({ ...base, batches: [b(1, { trigger: 'profil' }), b(2, { trigger: 'profil' }), b(3, { trigger: 'profil' })] })).toBe('ready');
  });

  it('inställningen är av tills man slår på den, och följer med när annat ändras', async () => {
    expect(cleanSettings({ frequency: 'dag', count: 3 }).auto).toBe(false);
    expect(cleanSettings({ auto: 'ja' }).auto).toBe(false);
    expect(cleanSettings({ auto: true })).toEqual({ id: 'settings', frequency: 'av', count: 5, auto: true });
  });
});

describe('appen', () => {
  it('genererade kort visas före exemplen, nyast först', () => {
    const mine = [
      { ...EXAMPLE_CARDS[5], id: 'g-1', created: 1 },
      { ...EXAMPLE_CARDS[6], id: 'g-2', created: 2 },
    ];
    const all = allCards(mine, EXAMPLE_CARDS);
    expect(all.slice(0, 3).map((c) => c.id)).toEqual(['g-2', 'g-1', EXAMPLE_CARDS[0].id]);
    expect(all).toHaveLength(EXAMPLE_CARDS.length + 2);
    const naval = { ...mine[0], id: 'g-3', person: 'Naval Ravikant' };
    expect(feed(allCards([naval], EXAMPLE_CARDS), [{ id: 'x', name: 'naval ravikant', topics: [], created: 0 }], new Map(), 'alla')).toEqual([naval]);
  });

  it('inställningen sparas städad och läses tillbaka', async () => {
    expect((await loadKunskap()).settings).toEqual({ id: 'settings', frequency: 'av', count: 5, auto: false });
    await saveSettings({ frequency: 'vecka', count: 42 });
    expect((await loadKunskap()).settings).toEqual({ id: 'settings', frequency: 'vecka', count: 10, auto: false });
    // Smaken ligger i samma store med eget id, och de två skriver inte över varandra.
    expect((await loadKunskap()).prefs).toEqual(NO_PREFS);
    await savePrefs(withManual(NO_PREFS, 'topic', 'Sömn', prefKey('topic', 'Sömn'), 'mer'));
    await saveSettings({ frequency: 'dag', count: 3 });
    expect(await loadKunskap()).toMatchObject({ settings: { frequency: 'dag', count: 3 }, prefs: { manual: { 'topic:sömn': { label: 'Sömn', level: 'mer' } } } });
  });

  it('svaret från servern tolkas, även när funktionen inte är utlagd', () => {
    expect(readGenerateReply(200, { batches: [{ cards: 4, costUsd: 0.21 }] })).toEqual({ ok: true, cards: 4, costUsd: 0.21 });
    expect(readGenerateReply(401, null)).toMatchObject({ ok: false, message: expect.stringContaining('Logga in') });
    expect(readGenerateReply(404, { code: 'NOT_FOUND' })).toMatchObject({ ok: false, message: expect.stringContaining('inte påslaget') });
    expect(readGenerateReply(429, { message: 'Högst 3 batchar per dygn.' })).toEqual({ ok: false, message: 'Högst 3 batchar per dygn.' });
    expect(readGenerateReply(200, { batches: [] })).toMatchObject({ ok: false });
  });
});
