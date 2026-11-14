import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  checkCards,
  collectSources,
  htmlToText,
  normalizeUrl,
  preferences,
  quoteInText,
  SAVE_TOOL,
  systemPrompt,
  toCandidate,
  userPrompt,
  type Person,
} from '../../supabase/functions/kunskap-generera/generate.ts';
import {
  batchesLastDay,
  cleanSettings,
  costUsd,
  isDue,
  MAX_BATCHES_PER_DAY,
  NO_USAGE,
  type Batch,
} from '../../supabase/functions/kunskap-generera/shared.ts';
import { EXAMPLE_CARDS } from './cards';
import { allCards, batchLog, feed, formatUsd, formatWhen, monthCost } from './kunskapState';
import { loadKunskap, readGenerateReply, saveSettings } from './kunskapStore';

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

describe('prompten', () => {
  it('nämner personerna, antalet, smaken och det som redan finns', () => {
    const votes = [
      { value: 1 as const, person: 'Susanna Søberg', topic: 'bastu', type: 'protokoll' as const },
      { value: -1 as const, person: 'Wim Hof', topic: 'andning', type: 'citat' as const },
    ];
    const text = userPrompt(PEOPLE, 5, votes, [{ person: 'Susanna Søberg', text: 'Ett kort som finns.' }], '2026-11-14');
    for (const part of ['Gör 5 nya kort', 'Susanna Søberg: bastu, kallbad', 'Gillar mest', 'typen protokoll', 'Ogillar mest', 'Ett kort som finns.']) expect(text).toContain(part);
    expect(preferences([])).toBe('');
    expect(systemPrompt()).toContain('spara_kort');
    expect(SAVE_TOOL.input_schema.properties.cards.items.required).toEqual(Object.keys(SAVE_TOOL.input_schema.properties.cards.items.properties));
  });
});

describe('inställningar, schema och kostnad', () => {
  const HOUR = 3_600_000;
  const now = Date.UTC(2026, 10, 14, 4, 10);

  it('utan inställning genereras ingenting, och värdena hålls inom gränserna', () => {
    expect(cleanSettings(undefined)).toEqual({ id: 'settings', frequency: 'av', count: 5 });
    expect(cleanSettings({ frequency: 'ofta', count: 99 })).toEqual({ id: 'settings', frequency: 'av', count: 10 });
    expect(cleanSettings({ frequency: 'vecka', count: 0 })).toEqual({ id: 'settings', frequency: 'vecka', count: 1 });
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
    expect(batchesLastDay([{ created: now - HOUR }, { created: now - 23 * HOUR }, { created: now - 25 * HOUR }], now)).toBe(2);
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
    expect((await loadKunskap()).settings).toEqual({ id: 'settings', frequency: 'av', count: 5 });
    await saveSettings({ frequency: 'vecka', count: 42 });
    expect((await loadKunskap()).settings).toEqual({ id: 'settings', frequency: 'vecka', count: 10 });
  });

  it('svaret från servern tolkas, även när funktionen inte är utlagd', () => {
    expect(readGenerateReply(200, { batches: [{ cards: 4, costUsd: 0.21 }] })).toEqual({ ok: true, cards: 4, costUsd: 0.21 });
    expect(readGenerateReply(401, null)).toMatchObject({ ok: false, message: expect.stringContaining('Logga in') });
    expect(readGenerateReply(404, { code: 'NOT_FOUND' })).toMatchObject({ ok: false, message: expect.stringContaining('inte påslagen') });
    expect(readGenerateReply(429, { message: 'Högst 3 batchar per dygn.' })).toEqual({ ok: false, message: 'Högst 3 batchar per dygn.' });
    expect(readGenerateReply(200, { batches: [] })).toMatchObject({ ok: false });
  });
});
