import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { dayQuote, QUOTES } from './quotes';

describe('dagens citat', () => {
  it('är samma hela dagen och byts nästa dag', () => {
    expect(dayQuote('2026-10-29')).toBe(dayQuote('2026-10-29'));
    expect(dayQuote('2026-10-30')).not.toBe(dayQuote('2026-10-29'));
  });

  it('visar alla citat en gång innan något upprepas', () => {
    const seen = new Set(Array.from({ length: QUOTES.length }, (_, i) => dayQuote(addDays('2026-01-01', i))));
    expect(seen.size).toBe(QUOTES.length);
  });

  it('bläddrar vidare med offset', () => {
    expect(dayQuote('2026-10-29', 1)).toBe(dayQuote('2026-10-30'));
  });

  it('inga tomma eller dubbla citat', () => {
    const texts = QUOTES.map((q) => q.text.trim());
    expect(texts.every(Boolean)).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
