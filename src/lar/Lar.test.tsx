import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Lar, { LarList } from './Lar';
import { EVIDENCE_LABEL, PEOPLE } from './people';

const cards = (html: string) => (html.match(/class="card lar-card"/g) ?? []).length;

describe('Lär', () => {
  it('visar rubriken och ett kort per person', () => {
    const html = renderToStaticMarkup(<Lar />);
    expect(html).toContain('>Lär</h2>');
    expect(cards(html)).toBe(8);
  });

  it('personsidans rubrik kan få fokus och länkarna nämner ny flik', () => {
    const html = renderToStaticMarkup(<Lar initialOpenId="wim-hof" />);
    expect(html).toMatch(/<h2 tabindex="-1">Wim Hof<\/h2>/);
    expect(html).toContain('(öppnas i ny flik)');
  });

  it('filtret visar bara personer med området', () => {
    const html = renderToStaticMarkup(<Lar initialArea="meditation" />);
    const expected = PEOPLE.filter((p) => p.areas.includes('meditation')).length;
    expect(expected).toBeGreaterThan(0);
    expect(cards(html)).toBe(expected);
  });

  it('personsidan visar metod, påståenden, börja här, etikett, varning och säkra länkar', () => {
    const html = renderToStaticMarkup(<Lar initialOpenId="wim-hof" />);
    for (const h of ['Metod', 'Påståenden', 'Börja här']) expect(html).toContain(`>${h}</h3>`);
    expect(Object.values(EVIDENCE_LABEL).some((l) => html.includes(l))).toBe(true);
    expect(html).toContain('role="note"');
    expect(html).toContain('Tillbaka');
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a).toContain('noopener');
      expect(a).toContain('target="_blank"');
    }
  });

  it('okänt id visar listan', () => {
    const html = renderToStaticMarkup(<Lar initialOpenId="finns-inte" />);
    expect(cards(html)).toBe(8);
  });

  it('tom lista har en förklaring', () => {
    expect(renderToStaticMarkup(<LarList people={[]} onOpen={() => {}} />)).toContain(
      'Inga personer i det här området än.',
    );
  });
});
