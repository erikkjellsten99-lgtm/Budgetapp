import { describe, expect, it } from 'vitest';
import { formatPct } from './money';

const nb = ' ';

describe('formatPct', () => {
  it('plustecken, decimalkomma och en decimal', () => {
    expect(formatPct(0.042)).toBe(`+4,2${nb}%`);
    expect(formatPct(1.5)).toBe(`+150,0${nb}%`);
  });

  it('minus är U+2212', () => {
    expect(formatPct(-0.013)).toBe(`−1,3${nb}%`);
  });

  it('noll och det som avrundas till noll får inget tecken', () => {
    expect(formatPct(0)).toBe(`0,0${nb}%`);
    expect(formatPct(-0.0001)).toBe(`0,0${nb}%`);
    expect(formatPct(0.0004)).toBe(`0,0${nb}%`);
  });
});
