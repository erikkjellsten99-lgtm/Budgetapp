import { describe, expect, it } from 'vitest';
import type { HealthDay, HealthMetric } from '../../supabase/functions/inbox/health';
import { addDays } from '../vanor/dates';
import { FORM_LABEL, readiness, suggestion } from './readiness';

const TODAY = '2026-11-16';
const day = (date: string, values: Partial<Record<HealthMetric, number>>): HealthDay => ({ date, updated: 0, values });
/** 14 dagar före igår med samma vilopuls. */
const baseline = (hr: number, days = 14) => Array.from({ length: days }, (_, i) => day(addDays(TODAY, -2 - i), { restingHr: hr }));

describe('dagens form', () => {
  it('ger ingen form utan nattens sömn', () => {
    expect(readiness([], TODAY)).toEqual({ form: null, points: 0, facts: [] });
    expect(readiness([day(addDays(TODAY, -1), { sleepH: 8 })], TODAY).form).toBeNull();
  });

  it('räknar sömnen: under 6 h två poäng, 6–7 h en, annars ingen', () => {
    const points = (sleepH: number) => readiness([day(TODAY, { sleepH })], TODAY).points;
    expect([5.99, 6, 6.99, 7, 8].map(points)).toEqual([2, 1, 1, 0, 0]);
  });

  it('räknar vilopulsen mot ditt eget snitt', () => {
    const points = (hr: number) => readiness([...baseline(60), day(TODAY, { sleepH: 8, restingHr: hr })], TODAY).points;
    expect([63, 64, 66, 67, 80].map(points)).toEqual([0, 1, 1, 2, 2]);
  });

  it('tar gårdagens vilopuls när dagens saknas, med snittet före gårdagen', () => {
    const r = readiness([...baseline(60), day(addDays(TODAY, -1), { restingHr: 70 }), day(TODAY, { sleepH: 8 })], TODAY);
    expect(r.points).toBe(2);
    expect(r.facts).toContain('vilopuls 70 (snitt 60)');
  });

  it('räknar inte vilopulsen med färre än fem dagar att jämföra med', () => {
    const r = readiness([...baseline(60, 4), day(TODAY, { sleepH: 8, restingHr: 90 })], TODAY);
    expect(r.points).toBe(0);
    expect(r.facts).toEqual(['8 h sömn', 'vilopuls 90']);
  });

  it('räknar gårdagens träning från 90 minuter', () => {
    const points = (exerciseMin: number) => readiness([day(addDays(TODAY, -1), { exerciseMin }), day(TODAY, { sleepH: 8 })], TODAY).points;
    expect([89, 90, 135].map(points)).toEqual([0, 1, 1]);
  });

  it('räknar sömnpoäng under 60', () => {
    const points = (sleepScore: number) => readiness([day(TODAY, { sleepH: 8, sleepScore })], TODAY).points;
    expect([59, 60, 95].map(points)).toEqual([1, 0, 0]);
  });

  it('0 poäng är pigg, 1–2 okej och 3 eller fler sliten', () => {
    expect(readiness([day(TODAY, { sleepH: 8 })], TODAY).form).toBe('pigg');
    expect(readiness([day(TODAY, { sleepH: 6.5 })], TODAY).form).toBe('okej');
    expect(readiness([day(TODAY, { sleepH: 5 })], TODAY).form).toBe('okej');
    const worn = readiness([day(addDays(TODAY, -1), { exerciseMin: 135 }), day(TODAY, { sleepH: 5.03, sleepScore: 84 })], TODAY);
    expect(worn).toEqual({ form: 'sliten', points: 3, facts: ['5 h 2 min sömn', 'sömnpoäng 84', '135 min träning igår'] });
  });
});

describe('förslag på pass', () => {
  it('ger en text per form för Lätt och Tufft pass', () => {
    expect(suggestion('pigg', 'Lätt pass (45 min)')).toBe('Lugn jogg eller promenad utomhus.');
    expect(suggestion('pigg', 'Tufft pass (45 min)')).toBe('Kör hårt: intervaller, tempolöpning eller tungt gym.');
    expect(suggestion('okej', 'Lätt pass (45 min)')).toBe('Promenad eller lugn jogg.');
    expect(suggestion('okej', 'Tufft pass (45 min)')).toBe('Gym eller distans i jämnt tempo. Spara intervallerna.');
    expect(suggestion('sliten', 'lätt pass')).toBe('Promenad eller rörlighet, låg puls.');
    expect(suggestion('sliten', 'TUFFT pass')).toBe('Lugn styrka eller zon 2 i 45 min. Inga intervaller.');
  });

  it('ger inget för andra pass', () => {
    expect(suggestion('sliten', 'Morgonlöpning')).toBeNull();
  });

  it('har ett namn per form', () => {
    expect(FORM_LABEL).toEqual({ pigg: 'Pigg', okej: 'Okej', sliten: 'Sliten' });
  });
});
