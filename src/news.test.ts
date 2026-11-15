import { describe, expect, it } from 'vitest';
import { blindspotLine, countLine, NEWS_URL, usd, weekLine, type Story } from './news';

const story = (positive: boolean): Story => ({ id: positive ? 'a' : 'b', title: 'Rubrik', summary: 'Text.', positive, sources: [], angles: [], blindspot: null });

describe('veckonyheter i appen', () => {
  it('adressen går till funktionen nyheter', () => {
    expect(NEWS_URL).toMatch(/\/functions\/v1\/nyheter$/);
  });

  it('veckans rad', () => {
    expect(weekLine({ week: '2026-W47', created: Date.parse('2026-11-16T03:00:00Z'), updated: 0, sections: {} })).toBe('Vecka 47, skriven 2026-11-16');
  });

  it('räknar nyheter och positiva', () => {
    expect(countLine([story(true), story(false), story(true)])).toBe('3 nyheter, 2 positiva');
    expect(countLine([story(true)])).toBe('1 nyhet, 1 positiv');
  });

  it('blind fläck i klartext', () => {
    expect(blindspotLine('hoger')).toBe('Blind fläck: högermedier har inte bevakat nyheten.');
    expect(blindspotLine('vanster')).toBe('Blind fläck: vänstermedier har inte bevakat nyheten.');
  });

  it('kostnad med svenskt decimalkomma', () => {
    expect(usd(3.4)).toBe('3,40');
  });
});
