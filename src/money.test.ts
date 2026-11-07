import { describe, expect, it } from 'vitest';
import { formatKr, formatKrOre, formatPct } from './money';

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

describe('formatKrOre', () => {
  it('tar bort flyttalsbrus och behåller ören', () => {
    expect(formatKrOre(1042.0000000000002)).toBe(formatKr(1042));
    expect(formatKrOre(1042.0000000000002)).toBe(`1${nb}042${nb}kr`);
    expect(formatKrOre(49.9)).toBe(`49,90${nb}kr`);
    expect(formatKrOre(1432.5)).toBe(`1${nb}432,50${nb}kr`);
  });
});
