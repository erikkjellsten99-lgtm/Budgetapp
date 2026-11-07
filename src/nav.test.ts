import { describe, expect, it } from 'vitest';
import { restoreView, SECTIONS } from './nav';

describe('huvudmenyn', () => {
  it('fyra flikar i rätt ordning', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['idag', 'ekonomi', 'vanor', 'nyheter']);
  });
});

describe('restoreView', () => {
  it('gammal sparad Jarvis-flik öppnar Idag', () => {
    expect(restoreView('jarvis')).toBe('idag');
  });

  it('okänd eller saknad vy öppnar Idag', () => {
    expect(restoreView(null)).toBe('idag');
    expect(restoreView('galax')).toBe('idag');
  });

  it('giltiga vyer behålls', () => {
    for (const v of ['idag', 'vanor', 'nyheter', 'account', 'overview', 'budget', 'goal', 'assets', 'wishlist'])
      expect(restoreView(v)).toBe(v);
  });
});
