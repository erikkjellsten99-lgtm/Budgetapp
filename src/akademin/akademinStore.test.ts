import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Answer, Progress } from './types';

/** Nytt modulläge med färsk databas: store.ts håller sin anslutning på modulnivå. */
async function freshStore() {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  return import('./akademinStore');
}

const FIRST = { 'k1-01-q1': true, 'k1-01-q2': false, 'k1-01-q3': true, 'k1-01-q4': true };
const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

describe('Akademins lagring', () => {
  let s: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    s = await freshStore();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('completeLesson sparar en Progress och fyra svar enligt nextAnswer', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    expect(byId(d.answers)).toEqual([
      { id: 'k1-01-q1', streak: 1, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q2', streak: 0, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q3', streak: 1, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q4', streak: 1, due: '2026-11-21', last: '2026-11-20' },
    ]);
    expect(d.habit).toBeNull();
  });

  it('samma anrop igen samma dag ändrar ingenting', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const before = await s.loadAkademin();
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const after = await s.loadAkademin();
    expect(after.progress).toEqual(before.progress);
    expect(byId(after.answers)).toEqual(byId(before.answers));
  });

  it('två överlappande anrop ger en Progress och fyra svar som räknats en gång', async () => {
    await Promise.all([s.completeLesson('k1-01', FIRST, '2026-11-20'), s.completeLesson('k1-01', FIRST, '2026-11-20')]);
    const d = await s.loadAkademin();
    expect(d.progress).toHaveLength(1);
    expect(d.answers).toHaveLength(4);
    expect(d.answers.every((a: Answer) => a.streak <= 1)).toBe(true);
    expect(d.answers.find((a: Answer) => a.id === 'k1-01-q1')?.streak).toBe(1);
  });

  it('görs lektionen om en senare dag behålls doneAt och svaren uppdateras', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    await s.completeLesson('k1-01', { 'k1-01-q1': true, 'k1-01-q2': true, 'k1-01-q3': false, 'k1-01-q4': true }, '2026-11-22');
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    const a = Object.fromEntries(d.answers.map((x: Answer) => [x.id, x]));
    expect(a['k1-01-q1']).toEqual({ id: 'k1-01-q1', streak: 2, due: '2026-11-25', last: '2026-11-22' });
    expect(a['k1-01-q2']).toEqual({ id: 'k1-01-q2', streak: 1, due: '2026-11-23', last: '2026-11-22' });
    expect(a['k1-01-q3']).toEqual({ id: 'k1-01-q3', streak: 0, due: '2026-11-23', last: '2026-11-22' });
  });

  it('nextLesson ger k1-01 utan framsteg och null när alla sju är klara', async () => {
    expect(s.nextLesson([])?.id).toBe('k1-01');
    expect(s.nextLesson([{ id: 'k1-01', doneAt: '2026-11-20' }])?.id).toBe('k1-02');
    const all: Progress[] = ['01', '02', '03', '04', '05', '06', '07'].map((n) => ({ id: `k1-${n}`, doneAt: '2026-11-20' }));
    expect(s.nextLesson(all)).toBeNull();
  });

  it('doneToday är sant bara när någon doneAt är dagens datum', () => {
    expect(s.doneToday([], '2026-11-20')).toBe(false);
    expect(s.doneToday([{ id: 'k1-01', doneAt: '2026-11-19' }], '2026-11-20')).toBe(false);
    expect(s.doneToday([{ id: 'k1-01', doneAt: '2026-11-19' }, { id: 'k1-02', doneAt: '2026-11-20' }], '2026-11-20')).toBe(true);
  });

  it('recordReview uppdaterar bara den frågans svar', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    await s.recordReview('k1-01-q1', true, '2026-11-21');
    const d = await s.loadAkademin();
    const a = Object.fromEntries(d.answers.map((x: Answer) => [x.id, x]));
    expect(a['k1-01-q1']).toEqual({ id: 'k1-01-q1', streak: 2, due: '2026-11-24', last: '2026-11-21' });
    expect(a['k1-01-q2']).toEqual({ id: 'k1-01-q2', streak: 0, due: '2026-11-21', last: '2026-11-20' });
    expect(d.answers).toHaveLength(4);
    expect(d.progress).toHaveLength(1);
  });
});
