import { describe, expect, it } from 'vitest';
import { dayResult, evaluate, isComplete, pause, progress, resume, toMap, workoutSummary } from './logic';
import { checkinId, type Challenge, type ChallengeTask, type Checkin, type CheckinData } from './types';

// Måndag 2 november 2026. Veckan efter börjar måndag 9 november.
const MON = '2026-11-02';

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  id: 'c',
  title: 'Test',
  description: '',
  length_days: 10,
  start_date: MON,
  status: 'active',
  attempt_number: 1,
  best_streak: 0,
  settings: {},
  rules: { max_misses_per_week: 0, on_fail: 'restart_challenge' },
  created_at: '2026-11-01T00:00:00Z',
  ...over,
});

const task = (id: string, type: ChallengeTask['type'] = 'check', target: number | null = null): ChallengeTask => ({
  id,
  challenge_id: 'c',
  title: id,
  subtitle: '',
  type,
  target,
  sort_order: 0,
});

const check = (taskId: string, date: string, data: CheckinData = {}, done = true): Checkin => ({
  id: checkinId(taskId, date),
  challenge_id: 'c',
  task_id: taskId,
  date,
  done,
  value: null,
  data,
});

const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-11-${String(from + i).padStart(2, '0')}`);

describe('när en uppgift är klar', () => {
  it('räknaren är klar vid målet, även med decimaler som summerats', () => {
    const water = task('vatten', 'counter', 3.8);
    expect(isComplete(water, { done: false, value: 3.5, data: {} })).toBe(false);
    expect(isComplete(water, { done: false, value: 0.5 * 8, data: {} })).toBe(true);
    expect(isComplete(water, { done: false, value: 3.8, data: {} })).toBe(true);
  });

  it('läsning är klar vid minst 10 sidor, bild när det finns en bild', () => {
    expect(isComplete(task('läs', 'reading', 10), { done: false, value: null, data: { pages: 9 } })).toBe(false);
    expect(isComplete(task('läs', 'reading', 10), { done: false, value: null, data: { pages: 10 } })).toBe(true);
    expect(isComplete(task('bild', 'photo'), { done: false, value: null, data: {} })).toBe(false);
    expect(isComplete(task('bild', 'photo'), { done: false, value: null, data: { photo: 'c/bild/2026-11-02.jpg' } })).toBe(true);
  });
});

describe('dagens pass', () => {
  const tasks = [task('lätt', 'workout'), task('tufft', 'workout')];
  const c = challenge({ rules: { max_misses_per_week: 0, on_fail: 'restart_challenge', workout_requires: ['outdoor', 'morning_run'] } });

  it('båda passen bockade räcker inte utan utomhus och morgonlöpning', () => {
    const result = dayResult(c, tasks, toMap([check('lätt', MON), check('tufft', MON)]), MON);
    expect(result.state).toBe('partial');
    expect(result.missing).toEqual(['Inget pass utomhus', 'Ingen morgonlöpning']);
  });

  it('samma pass får uppfylla båda kraven', () => {
    const map = toMap([check('lätt', MON, { outdoor: true, morning_run: true }), check('tufft', MON)]);
    expect(dayResult(c, tasks, map, MON).state).toBe('done');
  });

  it('kraven får delas mellan passen', () => {
    const map = toMap([check('lätt', MON, { outdoor: true }), check('tufft', MON, { morning_run: true })]);
    expect(dayResult(c, tasks, map, MON).state).toBe('done');
  });

  it('ett pass som inte är bockat räknas inte, även om det är markerat utomhus', () => {
    const map = toMap([check('lätt', MON, { outdoor: true, morning_run: true }, false), check('tufft', MON)]);
    expect(dayResult(c, tasks, map, MON).missing).toEqual(['lätt', 'Inget pass utomhus', 'Ingen morgonlöpning']);
  });

  it('veckosummeringen räknar pass per typ', () => {
    const map = toMap([
      check('tufft', '2026-11-02', { kind: 'Gym' }),
      check('tufft', '2026-11-03', { kind: 'Löpning' }),
      check('tufft', '2026-11-05', { kind: 'Gym' }),
      check('tufft', '2026-11-09', { kind: 'Gym' }), // nästa vecka
    ]);
    const tough = workoutSummary(tasks, map, MON)[1];
    expect(tough.total).toBe(3);
    expect(tough.kinds).toEqual([['Gym', 2], ['Löpning', 1]]);
  });
});

describe('dag, streak och rutor', () => {
  const tasks = [task('a'), task('b')];

  it('dag 1 på startdagen, och dagen bedöms inte som missad förrän efter midnatt', () => {
    const p = progress(challenge(), tasks, toMap([check('a', MON)]), MON);
    expect(p.day).toBe(1);
    expect(p.streak).toBe(0);
    expect(p.cells[0].state).toBe('today');
    expect(p.cells).toHaveLength(10);
    expect(p.endDate).toBe('2026-11-11');
  });

  it('klar, delvis och missad dag', () => {
    const map = toMap([check('a', '2026-11-02'), check('b', '2026-11-02'), check('a', '2026-11-03')]);
    const p = progress(challenge(), tasks, map, '2026-11-05');
    expect(p.cells.slice(0, 4).map((c) => c.state)).toEqual(['done', 'partial', 'missed', 'today']);
    expect(p.day).toBe(4);
  });

  it('utmaning som inte börjat är på dag 0', () => {
    expect(progress(challenge({ start_date: '2026-11-20' }), tasks, toMap([]), MON).day).toBe(0);
  });
});

describe('reglerna', () => {
  const tasks = [task('a')];
  const allDone = (dates: string[]) => toMap(dates.map((d) => check('a', d)));

  it('inget händer så länge alla dagar är klara', () => {
    const result = evaluate(challenge(), tasks, allDone(days(2, 4)), '2026-11-05');
    expect(result.attempts).toEqual([]);
    expect(result.challenge.attempt_number).toBe(1);
    expect(result.challenge.best_streak).toBe(3);
  });

  it('dagens datum räknas aldrig som missat', () => {
    expect(evaluate(challenge(), tasks, toMap([]), MON).changed).toBe(false);
  });

  it('restart_challenge: en miss sparar försöket och börjar om idag, längsta streak finns kvar', () => {
    // Klart mån–ons, missat torsdag, appen öppnas lördag.
    const result = evaluate(challenge(), tasks, allDone(days(2, 4)), '2026-11-07');
    expect(result.attempts).toEqual([
      { id: 'c|1', challenge_id: 'c', attempt_number: 1, started_at: MON, ended_at: '2026-11-05', days_completed: 3 },
    ]);
    expect(result.challenge.attempt_number).toBe(2);
    expect(result.challenge.start_date).toBe('2026-11-07');
    expect(result.challenge.best_streak).toBe(3);
    expect(result.challenge.status).toBe('active');
    expect(result.challenge.settings.notice).toMatchObject({ type: 'restart_challenge', date: '2026-11-05', missing: ['a'], attempt: 1 });
  });

  it('att köra reglerna igen ändrar ingenting', () => {
    const map = allDone(days(2, 4));
    const first = evaluate(challenge(), tasks, map, '2026-11-07');
    const second = evaluate(first.challenge, tasks, map, '2026-11-07');
    expect(second.changed).toBe(false);
    expect(second.attempts).toEqual([]);
  });

  it('tillåtna missar per vecka utlöser ingenting, men den som går över gör det', () => {
    const lenient = challenge({ rules: { max_misses_per_week: 1, on_fail: 'restart_challenge' } });
    // Missar onsdag 4 nov (tillåtet), och sedan fredag 6 nov (en för mycket samma vecka).
    const one = evaluate(lenient, tasks, allDone(['2026-11-02', '2026-11-03']), '2026-11-05');
    expect(one.attempts).toEqual([]);
    const two = evaluate(lenient, tasks, allDone(['2026-11-02', '2026-11-03', '2026-11-05']), '2026-11-07');
    expect(two.attempts[0].ended_at).toBe('2026-11-06');
  });

  it('missar räknas per kalendervecka: en miss i varje vecka går bra med max 1', () => {
    const lenient = challenge({ rules: { max_misses_per_week: 1, on_fail: 'restart_challenge' }, length_days: 30 });
    // Missar söndag 8 nov och måndag 9 nov: två dagar i rad, men olika veckor.
    const result = evaluate(lenient, tasks, allDone(days(2, 7)), '2026-11-10');
    expect(result.attempts).toEqual([]);
  });

  it('restart_week: veckans dagar görs om, försöket fortsätter', () => {
    const weekly = challenge({ rules: { max_misses_per_week: 0, on_fail: 'restart_week' } });
    // Start måndag. Klart mån–tis, missat onsdag 4 nov. Idag torsdag.
    const result = evaluate(weekly, tasks, allDone(days(2, 3)), '2026-11-05');
    expect(result.attempts).toEqual([]);
    expect(result.challenge.attempt_number).toBe(1);
    expect(result.challenge.settings.voided).toEqual([{ from: MON, to: '2026-11-04', reason: 'restart_week' }]);
    const p = progress(result.challenge, tasks, allDone(days(2, 3)), '2026-11-05');
    expect(p.day).toBe(1);
    expect(p.cells.slice(0, 4).map((c) => c.state)).toEqual(['void', 'void', 'void', 'today']);
    // Tre dagar räknas inte, så slutdatumet flyttas tre dagar.
    expect(p.endDate).toBe('2026-11-14');
  });

  it('restart_week mitt i utmaningen rör inte tidigare veckor', () => {
    const weekly = challenge({ rules: { max_misses_per_week: 0, on_fail: 'restart_week' }, length_days: 30 });
    // Klart hela första veckan och måndag 9 nov, missat tisdag 10 nov.
    const map = allDone(days(2, 9));
    const result = evaluate(weekly, tasks, map, '2026-11-11');
    expect(result.challenge.settings.voided).toEqual([{ from: '2026-11-09', to: '2026-11-10', reason: 'restart_week' }]);
    expect(progress(result.challenge, tasks, map, '2026-11-11').day).toBe(8);
  });

  it('klar när sista dagen är avbockad', () => {
    const short = challenge({ length_days: 3 });
    const result = evaluate(short, tasks, allDone(days(2, 4)), '2026-11-04');
    expect(result.challenge.status).toBe('completed');
    expect(result.challenge.best_streak).toBe(3);
    expect(result.attempts[0]).toMatchObject({ attempt_number: 1, ended_at: '2026-11-04', days_completed: 3 });
  });

  it('pausade och avklarade utmaningar bedöms inte', () => {
    expect(evaluate(challenge({ status: 'paused' }), tasks, toMap([]), '2026-11-20').changed).toBe(false);
    expect(evaluate(challenge({ status: 'completed' }), tasks, toMap([]), '2026-11-20').changed).toBe(false);
  });

  it('paus: dagarna räknas inte och ger ingen miss', () => {
    const map = allDone(days(2, 3));
    const paused = pause(challenge(), '2026-11-04');
    expect(progress(paused, tasks, map, '2026-11-06').day).toBe(2);
    const resumed = resume(paused, '2026-11-07');
    expect(resumed.status).toBe('active');
    expect(resumed.settings.voided).toEqual([{ from: '2026-11-04', to: '2026-11-06', reason: 'paused' }]);
    expect(evaluate(resumed, tasks, map, '2026-11-07').attempts).toEqual([]);
    expect(progress(resumed, tasks, map, '2026-11-07').day).toBe(3);
  });
});
