import { describe, expect, it } from 'vitest';
import { larReducer, visiblePerson, type LarState } from './larState';

const start: LarState = { area: 'alla', openId: null };

describe('larReducer', () => {
  it('öppna och tillbaka behåller filtret', () => {
    let s = larReducer(start, { type: 'filter', area: 'meditation' });
    s = larReducer(s, { type: 'open', id: 'wim-hof' });
    expect(s.openId).toBe('wim-hof');
    s = larReducer(s, { type: 'back' });
    expect(s).toEqual({ area: 'meditation', openId: null });
  });

  it('filter byter område', () => {
    expect(larReducer(start, { type: 'filter', area: 'andning' }).area).toBe('andning');
  });

  it('visiblePerson ger personen, och undefined för okänt id eller inget id', () => {
    expect(visiblePerson({ area: 'alla', openId: 'wim-hof' })?.name).toBe('Wim Hof');
    expect(visiblePerson({ area: 'alla', openId: 'finns-inte' })).toBeUndefined();
    expect(visiblePerson(start)).toBeUndefined();
  });
});
