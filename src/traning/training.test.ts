import { describe, expect, it } from 'vitest';
import {
  best5k,
  cleanWorkout,
  exerciseNames,
  exerciseSummaries,
  fiveKTime,
  formatDuration,
  formatPace,
  lastSets,
  parseDuration,
  parseNumber,
  records,
  topSet,
  weekStats,
  workoutSummary,
  type Workout,
} from './training';

let n = 0;
const gym = (date: string, exercises: [string, [number, number][]][]): Workout => ({
  id: `g${++n}`,
  date,
  kind: 'gym',
  created: n,
  exercises: exercises.map(([name, sets]) => ({ name, sets: sets.map(([kg, reps]) => ({ kg, reps })) })),
});
const run = (date: string, km: number, seconds: number): Workout => ({ id: `r${++n}`, date, kind: 'run', km, seconds, created: n });

describe('tal och tider', () => {
  it('läser kg med komma eller punkt', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber(' 80 ')).toBe(80);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-5')).toBeNull();
  });

  it('läser tider', () => {
    expect(parseDuration('24:30')).toBe(1470);
    expect(parseDuration('25')).toBe(1500);
    expect(parseDuration('1:02:10')).toBe(3730);
    expect(parseDuration('24.30')).toBe(1470);
    expect(parseDuration('24:75')).toBeNull();
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('skriver tider och tempo', () => {
    expect(formatDuration(1470)).toBe('24:30');
    expect(formatDuration(3730)).toBe('1:02:10');
    expect(formatPace(5, 1500)).toBe('5:00 /km');
  });
});

describe('löpning', () => {
  it('räknar 5 km-tid bara på pass som är minst 5 km', () => {
    expect(fiveKTime(run('2026-10-01', 5, 1600))).toBe(1600);
    expect(fiveKTime(run('2026-10-01', 10, 3000))).toBe(1500);
    expect(fiveKTime(run('2026-10-01', 3, 900))).toBeNull();
  });

  it('hittar bästa 5 km', () => {
    const all = [run('2026-10-01', 5, 1650), run('2026-10-08', 6, 1860), run('2026-10-15', 2, 500)];
    expect(best5k(all)).toEqual({ seconds: 1550, date: '2026-10-08' });
    expect(best5k([])).toBeNull();
  });
});

describe('gym', () => {
  const all = [
    gym('2026-10-01', [['Bänkpress', [[60, 8], [60, 8]]]]),
    gym('2026-10-05', [['Bänkpress', [[62.5, 8], [62.5, 6]]], ['Knäböj', [[80, 5]]]]),
    gym('2026-10-08', [['bänkpress', [[62.5, 9]]]]),
  ];

  it('tyngsta setet', () => {
    expect(topSet([{ kg: 60, reps: 8 }, { kg: 65, reps: 3 }, { kg: 65, reps: 5 }])).toEqual({ kg: 65, reps: 5 });
    expect(topSet([{ kg: 100, reps: 0 }])).toBeNull();
  });

  it('fyller i förra passets set, även med annan stavning', () => {
    expect(lastSets(all, 'Bänkpress')).toEqual([{ kg: 62.5, reps: 9 }]);
    expect(lastSets(all, 'Bänkpress', all[2].id)).toEqual([{ kg: 62.5, reps: 8 }, { kg: 62.5, reps: 6 }]);
    expect(lastSets(all, 'Marklyft')).toBeNull();
  });

  it('senast gjorda övningar först, utan dubbletter', () => {
    const names = exerciseNames(all);
    expect(names.slice(0, 2)).toEqual(['bänkpress', 'Knäböj']);
    expect(names.filter((x) => x.toLowerCase() === 'bänkpress')).toHaveLength(1);
  });

  it('sammanfattar utveckling per övning', () => {
    const [bench, squat] = exerciseSummaries(all);
    expect(bench.name).toBe('bänkpress');
    expect(bench.change).toBe(2.5);
    expect(bench.points).toHaveLength(3);
    expect(squat.latest.top).toEqual({ kg: 80, reps: 5 });
  });

  it('rekord: tyngre eller fler reps på samma vikt än alla tidigare pass', () => {
    expect(records(all[0], all)).toEqual([]);
    expect(records(all[1], all)).toEqual(['Bänkpress']);
    expect(records(all[2], all)).toEqual(['bänkpress']);
  });
});

it('veckan räknar gymdagar, löppass och km från måndag', () => {
  const all = [
    gym('2026-10-26', [['Knäböj', [[80, 5]]]]),
    gym('2026-10-26', [['Chins', [[0, 8]]]]),
    run('2026-10-27', 5.5, 1700),
    run('2026-10-25', 5, 1600),
  ];
  expect(weekStats(all, '2026-10-28')).toEqual({ gym: 1, runs: 1, km: 5.5 });
});

it('städar bort tomma set och övningar', () => {
  const w = gym('2026-10-01', [['  Bänkpress ', [[60, 8], [60, 0]]], ['', [[10, 10]]], ['Dips', []]]);
  expect(cleanWorkout(w).exercises).toEqual([{ name: 'Bänkpress', sets: [{ kg: 60, reps: 8 }] }]);
  expect(workoutSummary(cleanWorkout(w))).toBe('Bänkpress · 1 set');
  expect(workoutSummary(run('2026-10-01', 5, 1500))).toBe('5 km · 25:00 · 5:00 /km');
});
