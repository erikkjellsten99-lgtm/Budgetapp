// Vad som ska skickas just nu till en telefon. Räknar med samma kod som Vanor och morgonbeskedet
// (inbox/priority.ts), så att en notis aldrig säger annat än appen: pausade dagar sänker veckomålet,
// planerade dagar är måsten, efter-vanor gäller bara när passet är bockat, och en ny vana sent i veckan
// har inget krav än. Rena funktioner utan Deno-beroenden, tester i plan.test.ts.

import { prioritizeToday } from '../inbox/priority.ts';
import type { Habit, Log, Paused } from '../inbox/habits.ts';
import type { Task } from '../inbox/tasks.ts';
import { weekday, type DateKey } from '../inbox/dates.ts';
import { sundayReport, type ReportHabit } from './report.ts';

/** Hur länge efter vald tid en missad påminnelse fortfarande skickas (om cron var sen). */
export const LATE_MINUTES = 60;

export interface Reminder {
  /** Högst en per dag och telefon (tabellen push_sent). */
  key: string;
  title: string;
  body: string;
  tag: string;
}

export interface Check {
  date: DateKey;
  habitId: string;
}

export interface PlanInput {
  /** Alla vanor, även borttagna (de räknas bort på samma sätt som i appen). */
  habits: Habit[];
  checks: Check[];
  paused: Paused;
  /** Att göra-saker som inte är bockade. */
  tasks: Task[];
  /** Dagens datum och klockslag (minuter sedan midnatt) i telefonens tidszon. */
  date: DateKey;
  minutes: number;
  /** Kvällspåminnelsens tid, null = av. */
  evening: string | null;
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Är klockslaget inne: nu, eller för mindre än en timme sedan. */
export const isDue = (hhmm: string | null | undefined, minutes: number) => {
  if (!hhmm || !/^\d\d:\d\d$/.test(hhmm)) return false;
  const diff = minutes - toMinutes(hhmm);
  return diff >= 0 && diff < LATE_MINUTES;
};

/** Rapporten kommer en timme efter kvällspåminnelsen (högst 23:00), eller 21:00 om den är avstängd. */
export function reportTime(evening: string | null): string {
  const m = Math.min(23 * 60, (evening && /^\d\d:\d\d$/.test(evening) ? toMinutes(evening) : 20 * 60) + 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const nameList = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;

/** Loggen som appen räknar på: datum → bockade vanor. */
export function toLog(checks: Check[]): Log {
  const log: Log = {};
  for (const c of checks) (log[c.date] ??= []).push(c.habitId);
  return log;
}

/**
 * En vana som den ligger i personal_records. Fält som äldre poster kan sakna fylls i, så att
 * den delade logiken alltid får en hel vana (utan `created` skulle veckomålet bli 0).
 */
export function asHabit(data: unknown): Habit {
  const h = data as Partial<Habit>;
  return {
    ...h,
    id: String(h.id ?? ''),
    name: String(h.name ?? ''),
    goal: Number(h.goal ?? 7),
    created: typeof h.created === 'string' ? h.created : '2000-01-01',
    after: Array.isArray(h.after) ? h.after : [],
    order: Number(h.order ?? 0),
    archived: !!h.archived,
  };
}

export function asTask(data: unknown): Task {
  const t = data as Partial<Task>;
  return { ...t, id: String(t.id ?? ''), title: String(t.title ?? ''), date: String(t.date ?? ''), created: Number(t.created ?? 0) };
}

/** Påminnelserna som ska gå iväg just nu, i den ordning de skickas. */
export function plannedReminders({ habits, checks, paused, tasks, date, minutes, evening }: PlanInput): Reminder[] {
  const p = prioritizeToday(habits, toLog(checks), paused, tasks, date);
  const out: Reminder[] = [];

  // Att göra med tid: vid tiden den dagen, även pausade dagar.
  for (const t of tasks) {
    if (t.doneOn || t.date !== date || !isDue(t.time, minutes)) continue;
    out.push({ key: `task:${t.id}`, title: t.title, body: `Att göra idag ${t.time}.`, tag: `task-${t.id}` });
  }

  // Vanor: vid vald tid, de dagar påminnelsen gäller, om vanan går att göra idag och inte är bockad.
  for (const { habit, info } of p.rows) {
    if (!info.due || info.done || !isDue(habit.remind, minutes)) continue;
    const remindOn = habit.days?.length ? habit.days : habit.remindDays;
    if (remindOn?.length && !remindOn.includes(weekday(date))) continue;
    out.push({
      key: `habit:${habit.id}`,
      title: `Dags för ${habit.name}`,
      body: habit.minimum ? `En dålig dag räcker ${habit.minimum}.` : 'Tryck för att bocka av när du är klar.',
      tag: `habit-${habit.id}`,
    });
  }

  // Kvällen: Att göra (idag och försenat) plus vanorna som måste göras idag, i samma ordning som Prioritera idag.
  if (isDue(evening, minutes)) {
    const names = [...p.tasksDue.map((t) => t.title), ...p.must.map((r) => r.habit.name)];
    if (names.length) {
      out.push({
        key: 'evening',
        title: names.length === 1 ? '1 sak kvar idag' : `${names.length} saker kvar idag`,
        body: p.must.length ? `${nameList(names)} – annars hinns veckomålet inte.` : `${nameList(names)}.`,
        tag: 'evening',
      });
    }
  }

  if (isDue(reportTime(evening), minutes)) {
    const active = habits.filter((h) => !h.archived);
    const report = sundayReport(active as ReportHabit[], checks, paused, date);
    if (report) out.push({ key: report.key, title: report.title, body: report.body, tag: 'report' });
  }

  return out;
}
