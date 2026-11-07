import { describe, expect, it } from 'vitest';
import { escapeClosesRoom } from './Room';

describe('escapeClosesRoom', () => {
  it('stänger rummet när Jarvis inte är i helskärm', () => {
    expect(escapeClosesRoom({ classList: { contains: () => false } })).toBe(true);
  });

  it('låter Jarvis helskärm ta Escape först', () => {
    expect(escapeClosesRoom({ classList: { contains: (c: string) => c === 'jarvis-locked' } })).toBe(false);
  });
});
