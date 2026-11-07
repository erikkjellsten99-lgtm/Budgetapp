import { describe, expect, it } from 'vitest';
import { newsMeta } from './news';

const now = Date.parse('2026-11-07T12:00:00Z');
const item = { source: 'SVT Sport', published: now - 16 * 60000, topic: 'fotboll' as const };

describe('newsMeta', () => {
  it('källa och tid', () => {
    expect(newsMeta(item, { now })).toBe('SVT Sport, för 16 min sedan');
  });

  it('med ämne', () => {
    expect(newsMeta(item, { now, withTopic: true })).toBe('Fotboll, SVT Sport, för 16 min sedan');
  });

  it('utan tid inget komma på slutet', () => {
    expect(newsMeta({ ...item, published: 0 }, { now })).toBe('SVT Sport');
  });
});
