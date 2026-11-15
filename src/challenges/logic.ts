// Reglerna för Challenges, utan sidoeffekter: vad som är klart en dag, vilken dag man är på,
// och vad som händer när en dag missas. Appen sparar det evaluate() lämnar tillbaka.
//
// - En dag är missad om inte alla uppgifter är klara vid midnatt. Dagens datum bedöms alltså aldrig som missad.
// - Missar räknas per kalendervecka (måndag–söndag). Fler än max_misses_per_week utlöser on_fail.
// - restart_challenge: försöket sparas och ett nytt börjar samma dag som appen upptäcker missen.
// - restart_week: veckans dagar fram till och med missen räknas inte (settings.voided), så de görs om.
// - Pausade dagar räknas inte heller.

import { addDays, weekStart, type DateKey } from '../vanor/dates';
import {
  attemptId,
  checkinId,
  type Attempt,
  type Challenge,
  type ChallengeTask,
  type Checkin,
  type Notice,
  type VoidRange,
} from './types';

export type CheckinMap = Map<string, Checkin>;
export type DayState = 'done' | 'partial' | 'missed';

export const toMap = (checkins: Checkin[]): CheckinMap => new Map(checkins.map((c) => [c.id, c]));

const REQUIREMENT_TEXT = { outdoor: 'Inget pass utomhus', morning_run: 'Ingen morgonlöpning' } as const;

/** Är uppgiften klar med de här värdena? Används när en bockning sparas, så att `done` alltid stämmer. */
export function isComplete(task: ChallengeTask, c: Pick<Checkin, 'done' | 'value' | 'data'>): boolean {
  if (task.type === 'counter') return (c.value ?? 0) >= (task.target ?? 1) - 1e-9;
  if (task.type === 'reading') return (c.data.pages ?? 0) >= (task.target ?? 1);
  if (task.type === 'photo') return !!c.data.photo;
  return c.done;
}

/** Hur dagen gick, och vad som saknas. */
export function dayResult(challenge: Challenge, tasks: ChallengeTask[], map: CheckinMap, date: DateKey): { state: DayState; missing: string[] } {
  const missing: string[] = [];
  let done = 0;
  for (const task of tasks) {
    if (map.get(checkinId(task.id, date))?.done) done++;
    else missing.push(task.title);
  }
  const workouts = tasks
    .filter((t) => t.type === 'workout')
    .map((t) => map.get(checkinId(t.id, date)))
    .filter((c): c is Checkin => !!c?.done);
  if (tasks.some((t) => t.type === 'workout')) {
    for (const flag of challenge.rules.workout_requires ?? []) {
      if (!workouts.some((c) => c.data[flag])) missing.push(REQUIREMENT_TEXT[flag]);
    }
  }
  if (tasks.length > 0 && missing.length === 0) return { state: 'done', missing };
  return { state: done > 0 ? 'partial' : 'missed', missing };
}

const isVoid = (voided: VoidRange[], date: DateKey) => voided.some((v) => date >= v.from && date <= v.to);

export interface Cell {
  date: DateKey;
  /** void = räknas inte (omstartad vecka eller paus), today = idag och inte klar än, future = inte kommit. */
  state: DayState | 'void' | 'today' | 'future';
  /** Dagens nummer i utmaningen, saknas för dagar som inte räknas. */
  day?: number;
}

export interface Progress {
  /** Dag X av length_days. 0 = inte börjat. */
  day: number;
  /** Klara dagar i rad fram till och med igår, plus idag om den är klar. */
  streak: number;
  doneDays: number;
  cells: Cell[];
  endDate: DateKey;
  today: { state: DayState; missing: string[] } | null;
}

/** Läget just nu: dag, streak och en ruta per dag i försöket. Ändrar ingenting. */
export function progress(challenge: Challenge, tasks: ChallengeTask[], map: CheckinMap, today: DateKey): Progress {
  const voided = challenge.settings.voided ?? [];
  const pausedFrom = challenge.status === 'paused' ? (challenge.settings.paused_from ?? today) : null;
  const cells: Cell[] = [];
  let day = 0;
  let current = 0;
  let streak = 0;
  let doneDays = 0;
  let todayResult: Progress['today'] = null;
  let date = challenge.start_date;
  // Säkerhetsgräns: längden plus alla dagar som inte räknas kan aldrig bli fler än så här.
  for (let guard = 0; day < challenge.length_days && guard < 5000; guard++, date = addDays(date, 1)) {
    if (isVoid(voided, date) || (pausedFrom && date >= pausedFrom && date <= today)) {
      cells.push({ date, state: 'void' });
      continue;
    }
    day++;
    if (date > today) {
      cells.push({ date, state: 'future', day });
      continue;
    }
    const result = dayResult(challenge, tasks, map, date);
    if (date === today) {
      current = day;
      todayResult = result;
      if (result.state === 'done') {
        streak++;
        doneDays++;
      }
      cells.push({ date, state: result.state === 'done' ? 'done' : 'today', day });
      continue;
    }
    current = day;
    if (result.state === 'done') {
      streak++;
      doneDays++;
    } else streak = 0;
    cells.push({ date, state: result.state, day });
  }
  return { day: current, streak, doneDays, cells, endDate: cells.length ? cells[cells.length - 1].date : challenge.start_date, today: todayResult };
}

/** Längsta raden klara dagar i försöket (idag räknas om den är klar). */
function longestStreak(challenge: Challenge, tasks: ChallengeTask[], map: CheckinMap, today: DateKey): number {
  let best = 0;
  let run = 0;
  for (const cell of progress(challenge, tasks, map, today).cells) {
    if (cell.state === 'done') best = Math.max(best, ++run);
    else if (cell.state !== 'void') run = 0;
  }
  return best;
}

export interface Evaluation {
  challenge: Challenge;
  /** Försök som tog slut och ska sparas i challenge_attempts. */
  attempts: Attempt[];
  changed: boolean;
}

/**
 * Tillämpar reglerna på alla dagar som passerat midnatt. Ger samma svar hur många gånger den än körs:
 * efter en omstart ligger de missade dagarna före startdatumet eller bland dagarna som inte räknas.
 */
export function evaluate(input: Challenge, tasks: ChallengeTask[], map: CheckinMap, today: DateKey): Evaluation {
  let challenge = input;
  const attempts: Attempt[] = [];
  if (challenge.status !== 'active' || tasks.length === 0) return { challenge, attempts, changed: false };

  const finish = (c: Challenge, endedAt: DateKey, daysCompleted: number): Attempt => ({
    id: attemptId(c.id, c.attempt_number),
    challenge_id: c.id,
    attempt_number: c.attempt_number,
    started_at: c.start_date,
    ended_at: endedAt,
    days_completed: daysCompleted,
  });

  // Varje varv hanterar högst en miss som utlöser en regel. restart_week kan behöva flera varv.
  for (let round = 0; round < 500; round++) {
    const p = progress(challenge, tasks, map, today);
    const best = Math.max(challenge.best_streak, longestStreak(challenge, tasks, map, today));
    if (best !== challenge.best_streak) challenge = { ...challenge, best_streak: best };

    const misses = new Map<DateKey, number>();
    let doneSoFar = 0;
    let failed: { cell: Cell; doneSoFar: number } | null = null;
    for (const cell of p.cells) {
      if (cell.date >= today) break;
      if (cell.state === 'void') continue;
      if (cell.state === 'done') {
        doneSoFar++;
        continue;
      }
      const week = weekStart(cell.date);
      const count = (misses.get(week) ?? 0) + 1;
      misses.set(week, count);
      if (count > challenge.rules.max_misses_per_week) {
        failed = { cell, doneSoFar };
        break;
      }
    }

    if (!failed) {
      // Alla dagar har passerat, eller den sista dagen är klar idag.
      const last = p.cells[p.cells.length - 1];
      const allPassed = !!last && (last.date < today || (last.date === today && last.state === 'done'));
      if (allPassed && p.day >= challenge.length_days) {
        const notice: Notice = { type: 'completed', date: last.date, missing: [], attempt: challenge.attempt_number, days_completed: p.doneDays };
        attempts.push(finish(challenge, last.date, p.doneDays));
        challenge = { ...challenge, status: 'completed', settings: { ...challenge.settings, notice } };
      }
      break;
    }

    const date = failed.cell.date;
    const notice: Notice = {
      type: challenge.rules.on_fail,
      date,
      missing: dayResult(challenge, tasks, map, date).missing,
      attempt: challenge.attempt_number,
      days_completed: failed.doneSoFar,
    };
    if (challenge.rules.on_fail === 'restart_challenge') {
      attempts.push(finish(challenge, date, failed.doneSoFar));
      challenge = {
        ...challenge,
        attempt_number: challenge.attempt_number + 1,
        start_date: today,
        settings: { ...challenge.settings, voided: [], notice },
      };
      break;
    }
    const from = weekStart(date) > challenge.start_date ? weekStart(date) : challenge.start_date;
    challenge = {
      ...challenge,
      settings: { ...challenge.settings, voided: [...(challenge.settings.voided ?? []), { from, to: date, reason: 'restart_week' }], notice },
    };
  }
  return { challenge, attempts, changed: challenge !== input };
}

/** Pausa: dagarna från och med idag räknas inte förrän utmaningen fortsätter. */
export function pause(challenge: Challenge, today: DateKey): Challenge {
  if (challenge.status !== 'active') return challenge;
  return { ...challenge, status: 'paused', settings: { ...challenge.settings, paused_from: today } };
}

/** Fortsätt: pausens dagar (till och med igår) räknas inte. */
export function resume(challenge: Challenge, today: DateKey): Challenge {
  if (challenge.status !== 'paused') return challenge;
  const { paused_from, ...settings } = challenge.settings;
  const from = paused_from ?? today;
  const to = addDays(today, -1);
  const voided = to >= from ? [...(settings.voided ?? []), { from, to, reason: 'paused' as const }] : (settings.voided ?? []);
  return { ...challenge, status: 'active', settings: { ...settings, voided } };
}

/** Veckans pass per uppgift och typ, t.ex. Tufft pass: Löpning 3, Gym 2. */
export function workoutSummary(tasks: ChallengeTask[], map: CheckinMap, week: DateKey): { task: ChallengeTask; total: number; kinds: [string, number][] }[] {
  return tasks
    .filter((t) => t.type === 'workout')
    .map((task) => {
      const kinds = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const c = map.get(checkinId(task.id, addDays(week, i)));
        if (c?.done) kinds.set(c.data.kind || 'Annat', (kinds.get(c.data.kind || 'Annat') ?? 0) + 1);
      }
      const list = [...kinds].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'));
      return { task, total: list.reduce((sum, [, n]) => sum + n, 0), kinds: list };
    });
}
