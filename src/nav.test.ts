import { describe, expect, it } from 'vitest';
import { ECONOMY, ECONOMY_TABS, isEconomy, restoreView, sectionOf, SECTIONS, tabOf } from './nav';

describe('huvudmenyn', () => {
  it('fem flikar i rätt ordning', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['idag', 'ekonomi', 'vanor', 'nyheter', 'kunskap']);
  });

  it('Kunskap hör till sin egen flik', () => {
    expect(sectionOf('kunskap')).toBe('kunskap');
  });
});

describe('restoreView', () => {
  it('gammal sparad Jarvis-flik öppnar Idag', () => {
    expect(restoreView('jarvis')).toBe('idag');
  });

  it('gammal sparad Lär-flik öppnar Kunskap, där biblioteket bor', () => {
    expect(restoreView('lar')).toBe('kunskap');
  });

  it('okänd eller saknad vy öppnar Idag', () => {
    expect(restoreView(null)).toBe('idag');
    expect(restoreView('galax')).toBe('idag');
  });

  it('giltiga vyer behålls', () => {
    for (const v of ['idag', 'vanor', 'nyheter', 'kunskap', 'account', 'overview', 'budget', 'goal', 'assets', 'investments', 'wishlist'])
      expect(restoreView(v)).toBe(v);
  });
});

describe('Ekonomins underflikar', () => {
  it('tre underflikar', () => {
    expect(ECONOMY_TABS.map((t) => t.label)).toEqual(['Översikt', 'Budget', 'Prognos']);
  });

  it('Konton och Önskelista hör till Översikt', () => {
    expect(tabOf('assets')).toBe('overview');
    expect(tabOf('wishlist')).toBe('overview');
    expect(tabOf('budget')).toBe('budget');
    expect(tabOf('goal')).toBe('goal');
  });

  it('Investeringar öppnas från Översikt, efter Konton', () => {
    expect(tabOf('investments')).toBe('overview');
    expect(isEconomy('investments')).toBe(true);
    expect(ECONOMY.map((e) => e.id).indexOf('investments')).toBe(ECONOMY.map((e) => e.id).indexOf('assets') + 1);
  });
});
