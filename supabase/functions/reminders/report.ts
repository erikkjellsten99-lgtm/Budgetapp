// Vecko- och månadsrapporter för Vanor. Rena funktioner utan Deno-beroenden, så att de kan testas med vitest
// (report.test.ts). Räknar som appen (src/vanor/progress.ts): veckomålet sänks för pausade dagar och dagar
// innan vanan fanns, och extra dagar över målet räknas inte. En månad är de ISO-veckor vars torsdag ligger i månaden.

export interface ReportHabit {
  id: string;
  name: string;
  goal: number;
  created?: string;
  order?: number;
}
export interface ReportCheck {
  date: string;
  habitId: string;
}
export interface Report {
  key: string;
  title: string;
  body: string;
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
/** 0 = måndag … 6 = söndag. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
export function isoWeek(date: string): number {
  const thursday = addDays(date, 3 - weekday(date));
  const [y] = thursday.split('-').map(Number);
  const jan1 = Date.UTC(y, 0, 1);
  const [ty, tm, td] = thursday.split('-').map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - jan1) / 864e5 / 7) + 1;
}
const monthOfWeek = (monday: string) => addDays(monday, 3).slice(0, 7);

const nameList = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

interface Ctx {
  habits: ReportHabit[];
  done: (id: string, date: string) => boolean;
  paused: Set<string>;
}

function habitWeek(ctx: Ctx, h: ReportHabit, monday: string) {
  let active = 0;
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    if ((!h.created || day >= h.created) && !ctx.paused.has(day)) active++;
    if (ctx.done(h.id, day)) count++;
  }
  const goal = Math.min(h.goal, Math.round((h.goal * active) / 7));
  return { done: Math.min(count, goal), goal, count };
}

function weekScore(ctx: Ctx, monday: string) {
  let done = 0;
  let goal = 0;
  const rows = ctx.habits.map((h) => {
    const w = habitWeek(ctx, h, monday);
    done += w.done;
    goal += w.goal;
    return { h, ...w };
  });
  return { done, goal, pct: goal > 0 ? Math.round((done / goal) * 100) : null, rows };
}

/** Antal hela 7-dagarsserier bland dagarna. Pausade dagar bryter inte serien. */
function sevenDayRuns(ctx: Ctx, id: string, days: string[]) {
  let run = 0;
  let runs = 0;
  for (const day of days) {
    if (ctx.done(id, day)) {
      run++;
      if (run === 7) {
        runs++;
        run = 0;
      }
    } else if (!ctx.paused.has(day)) run = 0;
  }
  return runs;
}

function monthMondays(month: string): string[] {
  let monday = addDays(`${month}-01`, -weekday(`${month}-01`));
  const out: string[] = [];
  for (; monthOfWeek(monday) <= month; monday = addDays(monday, 7)) if (monthOfWeek(monday) === month) out.push(monday);
  return out;
}

function monthScore(ctx: Ctx, month: string) {
  let done = 0;
  let goal = 0;
  const weeks = monthMondays(month).map((monday) => {
    const w = weekScore(ctx, monday);
    done += w.done;
    goal += w.goal;
    return { monday, pct: w.pct };
  });
  return { pct: goal > 0 ? Math.round((done / goal) * 100) : null, weeks };
}

/**
 * Rapporten som ska skickas på söndagen `date` (veckans sista dag), eller null om det inte är söndag
 * eller inga vanor hade mål. Är det månadens sista vecka blir det en månadsrapport i stället.
 */
export function sundayReport(habits: ReportHabit[], checks: ReportCheck[], paused: Set<string>, date: string): Report | null {
  if (weekday(date) !== 6) return null;
  const doneSet = new Set(checks.map((c) => `${c.date}|${c.habitId}`));
  const ctx: Ctx = {
    habits: [...habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((h) => !h.created || h.created <= date),
    done: (id, day) => doneSet.has(`${day}|${id}`),
    paused,
  };
  const monday = addDays(date, -6);
  const week = weekScore(ctx, monday);
  if (week.pct === null) return null;
  const month = monthOfWeek(monday);
  const monthEnds = monthOfWeek(addDays(monday, 7)) !== month;

  if (monthEnds) {
    const score = monthScore(ctx, month);
    const prevMonth = monthOfWeek(addDays(monthMondays(month)[0], -7));
    const prev = monthScore(ctx, prevMonth);
    const days = monthMondays(month).flatMap((m) => Array.from({ length: 7 }, (_, i) => addDays(m, i)));
    const comets = ctx.habits.reduce((n, h) => n + sevenDayRuns(ctx, h.id, days), 0);
    const best = score.weeks.filter((w) => w.pct !== null).reduce<{ monday: string; pct: number | null } | null>(
      (a, b) => (!a || (b.pct ?? 0) > (a.pct ?? 0) ? b : a),
      null,
    );
    const name = MONTHS[Number(month.slice(5)) - 1];
    const parts = [
      best ? `Bästa veckan v. ${isoWeek(best.monday)} (${best.pct} %).` : '',
      comets > 0 ? `☄ ${comets} ${comets === 1 ? 'komet' : 'kometer'}.` : '',
      prev.pct !== null && score.pct !== null ? `${signed(score.pct - prev.pct)} mot ${MONTHS[Number(prevMonth.slice(5)) - 1]}.` : '',
      'Ett nytt solsystem i din galax.',
    ];
    return {
      key: `report-month:${month}`,
      title: `${name[0].toUpperCase()}${name.slice(1)} är klar: ${score.pct ?? 0} %`,
      body: parts.filter(Boolean).join(' '),
    };
  }

  const last = weekScore(ctx, addDays(monday, -7));
  const goalRows = week.rows.filter((r) => r.goal > 0);
  const met = goalRows.filter((r) => r.done >= r.goal);
  const short = goalRows.filter((r) => r.done < r.goal).sort((a, b) => b.goal - b.done - (a.goal - a.done));
  const streaks = goalRows.filter((r) => r.count === 7).map((r) => r.h.name);
  const parts = [
    week.pct >= 100 ? 'Perfekt vecka – planeten lyser.' : met.length ? `Klarade: ${nameList(met.map((r) => r.h.name))}.` : '',
    short.length ? `Drog ner: ${short.slice(0, 2).map((r) => `${r.h.name} (${r.done} av ${r.goal})`).join(', ')}.` : '',
    streaks.length ? `☄ 7 dagar i rad: ${nameList(streaks)}.` : '',
    last.pct !== null ? `${signed(week.pct - last.pct)} mot förra veckan.` : '',
  ];
  return {
    key: `report-week:${monday}`,
    title: `Vecka ${isoWeek(monday)}: ${week.pct} % av målen`,
    body: parts.filter(Boolean).join(' '),
  };
}
