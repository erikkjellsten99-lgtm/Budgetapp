import { describe, expect, it } from 'vitest';

// Läser stilfilerna med Nodes inbyggda fs. Projektet har inte @types/node, därför går det via process.
type Fs = { existsSync(path: string): boolean; readFileSync(path: string, encoding: 'utf8'): string };
const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): Fs } }).process.getBuiltinModule('node:fs');
const read = (path: string) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '');
const styles = read('src/styles.css');
const room = read('src/room.css');

// Färgerna i designspecen "Två rum" (docs/design/designspec-tva-rum.md). Ändras de här, ändra specen också.
const LIGHT = {
  '--bg': '#f2f4f5',
  '--surface': '#ffffff',
  '--line': '#dce2e6',
  '--ink': '#1a1f24',
  '--muted': '#56616b',
  '--pine': '#23614f',
  '--cobalt': '#2e4fd8',
  '--lingon': '#c2362f',
};
const DARK = {
  '--bg': '#111518',
  '--surface': '#1a2025',
  '--line': '#2a333a',
  '--ink': '#e8ecef',
  '--muted': '#9ba7b1',
  '--pine': '#6fc4a2',
  '--cobalt': '#9aaeff',
  '--lingon': '#ff8f86',
};

/** Variablerna i första blocket som börjar med selektorn. */
function tokensIn(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) return {};
  const body = css.slice(start + selector.length, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[match[1]] = match[2].trim().toLowerCase();
  return tokens;
}

const pick = (tokens: Record<string, string>, wanted: Record<string, string>) =>
  Object.fromEntries(Object.keys(wanted).map((key) => [key, tokens[key]]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('vardagsrummets färger', () => {
  it('ljusa tokens är specens', () => {
    expect(pick(tokensIn(styles, ':root {'), LIGHT)).toEqual(LIGHT);
  });

  it('mörka tokens är lika i systemläge och valt läge', () => {
    expect(pick(tokensIn(styles, ":root:not([data-theme='light']) {"), DARK)).toEqual(DARK);
    expect(pick(tokensIn(styles, ":root[data-theme='dark'] {"), DARK)).toEqual(DARK);
  });

  it.each([
    ['ljust', LIGHT],
    ['mörkt', DARK],
  ])('all text klarar 4,5:1 i %s läge', (_, t: Record<string, string>) => {
    for (const fg of ['--ink', '--muted', '--pine', '--cobalt', '--lingon'])
      for (const bg of ['--bg', '--surface']) expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('specialrummets stil', () => {
  it('room.css finns och har innehåll', () => {
    expect(room.length).toBeGreaterThan(0);
  });

  it('room.css rör inget utanför rummet', () => {
    expect(room).not.toMatch(/(^|[},]\s*)(body|html|:root)\b/m);
    expect(room).not.toMatch(/(^|}\s*)\.(?!room)[\w-]+[^{]*\{/m);
  });
});
