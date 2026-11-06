import { describe, expect, it } from 'vitest';
import type { Habit } from '../inbox/habits.ts';
import type { Task } from '../inbox/tasks.ts';
import { asHabit, asTask, isDue, plannedReminders, reportTime, toLog, type PlanInput } from './plan.ts';

// Torsdag 5 november 2026. Veckan började måndag 2 november.
const THU = '2026-11-05';
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const habit = (id: string, name: string, goal: number, extra: Partial<Habit> = {}): Habit => ({
  id, name, goal, created: '2026-10-01', after: [], order: 0, archived: false, ...extra,
});
const task = (id: string, title: string, date: string, extra: Partial<Task> = {}): Task => ({ id, title, date, created: 1, ...extra });

const plan = (over: Partial<PlanInput>) =>
  plannedReminders({ habits: [], checks: [], paused: new Set(), tasks: [], date: THU, minutes: at('12:00'), evening: null, ...over });

describe('kvällspåminnelsen räknar som appen', () => {
  const gym = habit('gym', 'Gym', 4);

  it('utan paus: 4 kvar på 4 dagar är ett måste', () => {
    const out = plan({ habits: [gym], minutes: at('20:00'), evening: '20:00' });
    expect(out.map((r) => r.key)).toEqual(['evening']);
    expect(out[0].title).toBe('1 sak kvar idag');
    expect(out[0].body).toBe('Gym – annars hinns veckomålet inte.');
  });

  it('pausade dagar sänker veckomålet, så kvällen tjatar inte i onödan', () => {
    // Mån–ons pausade: målet 4 blir 4 × 4/7 ≈ 2, och 2 kvar på 4 dagar kan vänta.
    const paused = new Set(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(plan({ habits: [gym], paused, minutes: at('20:00'), evening: '20:00' })).toEqual([]);
  });

  it('pausad dag idag: inga måsten, men Att göra nämns', () => {
    const out = plan({ habits: [gym], paused: new Set([THU]), tasks: [task('a', 'Ringa', THU)], minutes: at('20:00'), evening: '20:00' });
    expect(out.map((r) => r.body)).toEqual(['Ringa.']);
  });

  it('en planerad dag är ett måste även om veckomålet går att hinna senare', () => {
    const planned = habit('gym', 'Gym', 2, { days: [0, 3] });
    const checks = [{ date: '2026-11-02', habitId: 'gym' }];
    const out = plan({ habits: [planned], checks, minutes: at('20:00'), evening: '20:00' });
    expect(out.map((r) => r.body)).toEqual(['Gym – annars hinns veckomålet inte.']);
  });

  it('försenat Att göra kommer först, utan "annars" när inga vanor måste', () => {
    const tasks = [task('a', 'Ringa tandläkaren', THU), task('b', 'Betala hyran', '2026-11-03')];
    const out = plan({ tasks, minutes: at('20:30'), evening: '20:00' });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('2 saker kvar idag');
    expect(out[0].body).toBe('Betala hyran och Ringa tandläkaren.');
  });

  it('skickas bara inom en timme efter vald tid', () => {
    expect(plan({ habits: [gym], minutes: at('19:59'), evening: '20:00' })).toEqual([]);
    expect(plan({ habits: [gym], minutes: at('21:00'), evening: '20:00' })).toEqual([]);
  });
});

describe('påminnelse för en vana', () => {
  const med = habit('med', 'Meditation', 7, { remind: '07:00', minimum: '2 min' });

  it('vid vald tid, med minimum i texten', () => {
    const out = plan({ habits: [med], minutes: at('07:30') });
    expect(out).toEqual([{ key: 'habit:med', title: 'Dags för Meditation', body: 'En dålig dag räcker 2 min.', tag: 'habit-med' }]);
  });

  it('inte om den är bockad, dagen är pausad eller tiden passerat', () => {
    expect(plan({ habits: [med], checks: [{ date: THU, habitId: 'med' }], minutes: at('07:30') })).toEqual([]);
    expect(plan({ habits: [med], paused: new Set([THU]), minutes: at('07:30') })).toEqual([]);
    expect(plan({ habits: [med], minutes: at('08:00') })).toEqual([]);
  });

  it('inte när veckomålet redan är nått', () => {
    const run = habit('run', 'Löpning', 2, { remind: '18:00' });
    const checks = [{ date: '2026-11-02', habitId: 'run' }, { date: '2026-11-03', habitId: 'run' }];
    expect(plan({ habits: [run], checks, minutes: at('18:00') })).toEqual([]);
  });

  it('bara de valda dagarna, och planerade dagar vinner över påminnelsedagar', () => {
    // Torsdag = 3. remindDays mån/ons → inget; days tors → påminnelse.
    expect(plan({ habits: [habit('a', 'A', 7, { remind: '12:00', remindDays: [0, 2] })] })).toEqual([]);
    expect(plan({ habits: [habit('b', 'B', 2, { remind: '12:00', remindDays: [0, 2], days: [3, 5] })] }).map((r) => r.key)).toEqual(['habit:b']);
  });

  it('efter-vana bara när passet är bockat idag', () => {
    const habits = [habit('gym', 'Gym', 4), habit('str', 'Stretching', 4, { after: ['gym'], remind: '12:00' })];
    expect(plan({ habits })).toEqual([]);
    expect(plan({ habits, checks: [{ date: THU, habitId: 'gym' }] }).map((r) => r.key)).toEqual(['habit:str']);
  });

  it('borttagna vanor påminner inte', () => {
    expect(plan({ habits: [habit('x', 'X', 7, { remind: '12:00', archived: true })] })).toEqual([]);
  });

  it('ny vana utan veckomål än (lades till på söndagen) har inget krav', () => {
    const sun = '2026-11-08';
    const fresh = habit('ny', 'Ny', 1, { created: sun, remind: '12:00' });
    expect(plan({ habits: [fresh], date: sun, minutes: at('20:00'), evening: '20:00' })).toEqual([]);
  });
});

describe('Att göra med tid', () => {
  it('vid tiden den dagen, även en pausad dag', () => {
    const t = task('a', 'Ringa tandläkaren', THU, { time: '14:00' });
    const out = plan({ tasks: [t], paused: new Set([THU]), minutes: at('14:05') });
    expect(out).toEqual([{ key: 'task:a', title: 'Ringa tandläkaren', body: 'Att göra idag 14:00.', tag: 'task-a' }]);
    expect(plan({ tasks: [t], minutes: at('13:00') })).toEqual([]);
    expect(plan({ tasks: [{ ...t, doneOn: THU }], minutes: at('14:05') })).toEqual([]);
  });
});

describe('hjälpfunktioner', () => {
  it('isDue gäller en timme', () => {
    expect(isDue('20:00', at('20:00'))).toBe(true);
    expect(isDue('20:00', at('20:59'))).toBe(true);
    expect(isDue('20:00', at('21:00'))).toBe(false);
    expect(isDue('20:00', at('19:59'))).toBe(false);
    expect(isDue(null, at('20:00'))).toBe(false);
    expect(isDue('fel', at('20:00'))).toBe(false);
  });

  it('rapporten kommer en timme efter kvällen, högst 23:00, annars 21:00', () => {
    expect(reportTime(null)).toBe('21:00');
    expect(reportTime('20:00')).toBe('21:00');
    expect(reportTime('22:30')).toBe('23:00');
  });

  it('toLog samlar bockningar per dag', () => {
    expect(toLog([{ date: THU, habitId: 'a' }, { date: THU, habitId: 'b' }, { date: '2026-11-02', habitId: 'a' }])).toEqual({
      [THU]: ['a', 'b'],
      '2026-11-02': ['a'],
    });
  });

  it('asHabit och asTask fyller i fält som äldre poster saknar', () => {
    expect(asHabit({ id: 'x', name: 'X', goal: 3 })).toEqual({ id: 'x', name: 'X', goal: 3, created: '2000-01-01', after: [], order: 0, archived: false });
    expect(asTask({ id: 't', title: 'T', date: THU })).toEqual({ id: 't', title: 'T', date: THU, created: 0 });
  });
});
