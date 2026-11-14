import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PEOPLE } from '../lar/people';
import { NO_PREFS, prefKey, weights, type VoteRow } from '../../supabase/functions/kunskap-generera/shared.ts';
import { discover, GENRES, genreScore } from './discover';
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
