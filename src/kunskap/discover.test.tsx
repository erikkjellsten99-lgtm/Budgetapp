import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PEOPLE } from '../lar/people';
import { NO_PREFS, prefKey, weights, type VoteRow } from '../../supabase/functions/kunskap-generera/shared.ts';
import { discover, GENRES, genreOfPerson, genreScore, libraryGroups, libraryPlace } from './discover';
import { Discover } from './Kunskap';
import { personKey, withManual } from './kunskapState';

const vote = (value: 1 | -1, topic: string): VoteRow => ({ value, person: 'Någon', topic, type: 'insikt' });
const all = GENRES.flatMap((g) => g.people);

describe('katalogen', () => {
  it('varje genre har namn, sökord och minst två personer', () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length);
    for (const g of GENRES) {
      expect(g.label.length, g.id).toBeGreaterThan(0);
      expect(g.words.length, g.id).toBeGreaterThan(0);
      expect(g.people.length, g.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('varje person finns en gång, har en kort beskrivning och ämnen, och finns inte redan i biblioteket', () => {
    expect(new Set(all.map((p) => personKey(p.name))).size).toBe(all.length);
    const library = new Set(PEOPLE.map((p) => personKey(p.name)));
    for (const p of all) {
      expect(p.about.length, p.name).toBeGreaterThan(10);
      expect(p.about.length, p.name).toBeLessThanOrEqual(90);
      expect(p.topics.length, p.name).toBeGreaterThan(0);
      expect(library.has(personKey(p.name)), p.name).toBe(false);
    }
  });

  it('beskrivningarna lovar ingenting: inga siffror om effekt, inga citat och inga länkar', () => {
    for (const p of all) {
      expect(p.about, p.name).not.toMatch(/https?:|%|"|“|”|bevisa|botar|garanter/i);
    }
  });
});

describe('det som passar dig kommer först', () => {
  it('utan röster visas genrerna i katalogens ordning, och ingen märks som passande', () => {
    const out = discover([], []);
    expect(out.map((m) => m.genre.id)).toEqual(GENRES.map((g) => g.id));
    expect(out.some((m) => m.fits)).toBe(false);
  });

  it('gillade ämnen lyfter sin genre, ogillade sänker den', () => {
    const taste = weights([vote(1, 'sömn'), vote(1, 'Sömn'), vote(-1, 'pengar'), vote(-1, 'pengar')], NO_PREFS);
    const out = discover(taste, []);
    expect(out[0]).toMatchObject({ genre: { id: 'somn' }, fits: true });
    expect(out.at(-1)).toMatchObject({ genre: { id: 'pengar' }, fits: false });
    expect(genreScore(GENRES.find((g) => g.id === 'somn')!, taste)).toBeGreaterThan(0);
    expect(genreScore(GENRES.find((g) => g.id === 'pengar')!, taste)).toBeLessThan(0);
    // Ämnen från biblioteket ("Kallbad och bastu") räknas mot rätt genre.
    expect(discover(weights([vote(1, 'Kallbad och bastu')], NO_PREFS), [])[0].genre.id).toBe('andning');
  });

  it('ett ämne du själv lagt till under Vad Claude tror du gillar räknas', () => {
    const prefs = withManual(NO_PREFS, 'topic', 'Framgång', prefKey('topic', 'Framgång'), 'mer');
    expect(discover(weights([], prefs), [])[0]).toMatchObject({ genre: { id: 'framgang' }, fits: true });
  });

  it('personer du valt mindre av visas inte, och de du redan följer märks', () => {
    const prefs = withManual(NO_PREFS, 'person', 'Tim Ferriss', prefKey('person', 'Tim Ferriss'), 'mindre');
    const out = discover(weights([], prefs), ['naval ravikant'], '', 'framgang');
    expect(out).toHaveLength(1);
    expect(out[0].people.some((p) => p.name === 'Tim Ferriss')).toBe(false);
    expect(out[0].people.find((p) => p.name === 'Naval Ravikant')?.followed).toBe(true);
    expect(out[0].people.find((p) => p.name === 'Paul Graham')?.followed).toBe(false);
  });
});

describe('bibliotekets filter för egna personer', () => {
  it('en person ur katalogen hamnar i sin genre, andra efter sina ämnen', () => {
    expect(genreOfPerson('alex hormozi', [])?.id).toBe('framgang');
    expect(genreOfPerson('Okänd Person', ['Sömn'])?.id).toBe('somn');
    expect(genreOfPerson('Okänd Person', ['investeringar', 'x'])?.id).toBe('pengar');
    expect(genreOfPerson('Okänd Person', ['segling'])).toBeNull();
    expect(genreOfPerson('Okänd Person', [])).toBeNull();
  });

  it('genrer som är samma sak som bibliotekets områden läggs där, resten får egna filter', () => {
    expect(libraryPlace('James Nestor', ['andning'])).toEqual({ area: 'andning' });
    expect(libraryPlace('Tara Brach', [])).toEqual({ area: 'meditation' });
    expect(libraryPlace('BJ Fogg', [])).toEqual({ area: 'utveckling' });
    expect(libraryPlace('Ramit Sethi', ['pengar'])).toEqual({ group: 'pengar' });
    expect(libraryPlace('Okänd Person', ['segling'])).toEqual({ group: 'ovrigt' });
  });

  it('bara filter som har någon person visas, i katalogens ordning, med Övrigt sist', () => {
    const people = [
      { name: 'Okänd Person', topics: ['segling'] },
      { name: 'Ramit Sethi', topics: ['pengar'] },
      { name: 'Alex Hormozi', topics: [] },
      { name: 'Tara Brach', topics: [] },
      { name: 'Morgan Housel', topics: [] },
    ];
    expect(libraryGroups(people).map((g) => g.label)).toEqual(['Framgång och företagande', 'Pengar och investeringar', 'Övrigt']);
    expect(libraryGroups([])).toEqual([]);
    expect(libraryGroups([{ name: 'Tara Brach', topics: [] }])).toEqual([]);
  });
});

describe('sökningen', () => {
  it('träffar genrens namn och ord, och visar då alla i genren', () => {
    for (const q of ['framgång', 'FRAMGANG', 'entreprenör']) {
      const out = discover([], [], q);
      expect(out.map((m) => m.genre.id), q).toContain('framgang');
      expect(out.find((m) => m.genre.id === 'framgang')!.people.length, q).toBe(GENRES.find((g) => g.id === 'framgang')!.people.length);
    }
  });

  it('träffar personens namn, beskrivning och ämnen', () => {
    expect(discover([], [], 'housel').flatMap((m) => m.people.map((p) => p.name))).toEqual(['Morgan Housel']);
    expect(discover([], [], 'nike').flatMap((m) => m.people.map((p) => p.name))).toEqual(['Phil Knight']);
    expect(discover([], [], 'stoicism').flatMap((m) => m.people.map((p) => p.name))).toContain('Ryan Holiday');
    expect(discover([], [], 'finns inte alls')).toEqual([]);
    expect(discover([], [], '   ')).toHaveLength(GENRES.length);
  });
});

describe('vyn', () => {
  it('visar sökfält, genrer, förslag med Följ och säger att det inte är granskat', () => {
    const html = renderToStaticMarkup(<Discover taste={[]} already={['Morgan Housel']} onFollow={() => {}} />);
    expect(html).toContain('type="search"');
    expect(html).toContain('inte granskade');
    for (const g of GENRES) expect(html).toContain(g.label);
    expect(html).toContain('Naval Ravikant');
    expect(html).toContain('>Följer</span>');
    expect((html.match(/class="kunskap-follow"/g) ?? []).length).toBe(all.length - 1);
  });
});

// Fråga Claude efter fler

import { collectSources, FIND_TOOL, findSystemPrompt, findUserPrompt, toFound } from '../../supabase/functions/kunskap-generera/generate.ts';
import {
  cleanFound,
  FOUND_PER_SEARCH,
  MAX_SEARCHES_PER_DAY,
  mergeFound,
  profilesLastDay,
  searchesLastDay,
  type FoundPerson,
} from '../../supabase/functions/kunskap-generera/shared.ts';
import { readSearchReply } from './kunskapStore';

const URL_A = 'https://example.org/person-a';
const URL_B = 'https://example.org/person-b';
const SOURCES = collectSources([{ type: 'web_search_tool_result', content: [URL_A, URL_B].map((url) => ({ type: 'web_search_result', url, title: 't' })) }]);
const item = (over: Record<string, unknown> = {}) => ({ name: 'Testperson Ett', about: 'Testbeskrivning av en person.', topics: ['test'], source_url: URL_A, source_title: 'Testsida', ...over });
const found = (name: string, created = 1): FoundPerson => ({ name, about: 'Testbeskrivning.', topics: ['test'], genre: 'testgenre', source: { title: 'Testsida', url: URL_A }, created });

describe('personer som Claude hittat', () => {
  it('en person utan källa bland sökresultaten kastas', () => {
    expect(toFound({ people: [item()] }, SOURCES, [], 'Framgång', 7)).toEqual([
      { name: 'Testperson Ett', about: 'Testbeskrivning av en person.', topics: ['test'], genre: 'Framgång', source: { title: 'Testsida', url: URL_A }, created: 7 },
    ]);
    expect(toFound({ people: [item({ source_url: 'https://pahittad.se/x' })] }, SOURCES, [], 'g', 7)).toEqual([]);
    expect(toFound({ people: [item({ source_url: '' })] }, SOURCES, [], 'g', 7)).toEqual([]);
    expect(toFound({ people: [item({ source_title: '' })] }, SOURCES, [], 'g', 7)).toEqual([]);
    expect(toFound(null, SOURCES, [], 'g', 7)).toEqual([]);
  });

  it('den du redan har, dubbletter, tomma och för långa beskrivningar kastas, och högst sex behålls', () => {
    expect(toFound({ people: [item()] }, SOURCES, ['testperson ett'], 'g', 7)).toEqual([]);
    expect(toFound({ people: [item(), item({ source_url: URL_B })] }, SOURCES, [], 'g', 7)).toHaveLength(1);
    expect(toFound({ people: [item({ about: ' ' })] }, SOURCES, [], 'g', 7)).toEqual([]);
    expect(toFound({ people: [item({ about: 'x'.repeat(111) })] }, SOURCES, [], 'g', 7)).toEqual([]);
    expect(toFound({ people: [item({ about: 'x'.repeat(110) })] }, SOURCES, [], 'g', 7)).toHaveLength(1);
    const many = Array.from({ length: 9 }, (_, i) => item({ name: `Person ${i}` }));
    expect(toFound({ people: many }, SOURCES, [], 'g', 7)).toHaveLength(FOUND_PER_SEARCH);
    expect(toFound({ people: [item({ topics: ['a', '', 'b', 'c', 'd'] })] }, SOURCES, [], 'g', 7)[0].topics).toEqual(['a', 'b', 'c']);
  });

  it('prompten nämner genren, smaken och vilka du redan har', () => {
    const taste = weights([vote(1, 'sömn')], NO_PREFS);
    const text = findUserPrompt('Framgång', taste, ['Naval Ravikant', 'Wim Hof']);
    for (const part of ['- Framgång', 'Mer av: ', 'Naval Ravikant, Wim Hof']) expect(text).toContain(part);
    expect(findUserPrompt('x', [], [])).not.toContain('redan har');
    expect(findSystemPrompt()).toContain('spara_personer');
    expect(findSystemPrompt()).toContain('Inga privatpersoner');
    expect(FIND_TOOL.input_schema.properties.people.items.required).toEqual(Object.keys(FIND_TOOL.input_schema.properties.people.items.properties));
  });

  it('sparade träffar städas, nya hamnar först och samma person sparas en gång', () => {
    expect(cleanFound(null)).toEqual([]);
    expect(cleanFound({ people: [found('A'), { name: 'B' }, { ...found('C'), source: { title: 't', url: 'http://osaker.se' } }, 'skräp'] }).map((p) => p.name)).toEqual(['A']);
    expect(mergeFound([found('A', 1), found('B', 1)], [found('C', 2), found('a', 2)]).map((p) => [p.name, p.created])).toEqual([['C', 2], ['a', 2], ['B', 1]]);
    expect(mergeFound(Array.from({ length: 60 }, (_, i) => found(`P${i}`)), [])).toHaveLength(40);
  });

  it('sökningar och presentationer räknas var för sig', () => {
    const now = 100 * 3_600_000;
    const day = [
      { created: now - 1, trigger: 'profil' as const, search: true },
      { created: now - 2, trigger: 'profil' as const, search: true },
      { created: now - 3, trigger: 'profil' as const },
      { created: now - 30 * 3_600_000, trigger: 'profil' as const, search: true },
    ];
    expect(searchesLastDay(day, now)).toBe(2);
    expect(profilesLastDay(day, now)).toBe(1);
    expect(MAX_SEARCHES_PER_DAY).toBe(5);
  });

  it('svaret från servern tolkas, även när funktionen inte är utlagd', () => {
    expect(readSearchReply(200, { people: [found('A')], costUsd: 0.12 })).toEqual({ ok: true, people: [found('A')], costUsd: 0.12 });
    expect(readSearchReply(200, { people: [] })).toMatchObject({ ok: false });
    expect(readSearchReply(401, null)).toMatchObject({ ok: false, message: expect.stringContaining('Logga in') });
    expect(readSearchReply(404, { code: 'NOT_FOUND' })).toMatchObject({ ok: false, message: expect.stringContaining('inte påslaget') });
    expect(readSearchReply(429, { message: 'Högst 5 sökningar per dygn.' })).toEqual({ ok: false, message: 'Högst 5 sökningar per dygn.' });
  });

  it('vyn visar träffarna med källa och knappen för att fråga Claude', () => {
    const html = renderToStaticMarkup(<Discover taste={[]} already={['Testperson Två']} found={[found('Testperson Ett'), found('Testperson Två')]} onFollow={() => {}} onSearch={async () => ({ ok: false, message: 'x' })} />);
    expect(html).toContain('Hittade av Claude');
    expect(html).toContain(`href="${URL_A}"`);
    expect(html).toContain('Inte granskade');
    expect(html).toContain('Fråga Claude efter fler');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sök med Claude<\/button>/);
    expect(html).toContain('Följ<span class="visually-hidden"> Testperson Ett</span>');
    expect(html).not.toContain('Följ<span class="visually-hidden"> Testperson Två</span>');
  });
});
