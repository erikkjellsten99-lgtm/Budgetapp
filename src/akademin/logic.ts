// Akademin: quiz och repetition. Rena funktioner, ingen I/O.
import { addDays } from '../vanor/dates';
import { questionById } from './kurser';
import type { Answer, DateKey, PeriodType, Report } from './types';

export interface QuizState {
  /** Frågorna som återstår; den främsta är den aktuella. */
  queue: string[];
  /** Om frågan blev rätt på första försöket. Sätts bara av första svaret. */
  firstTry: Record<string, boolean>;
  /** Frågan vars förklaring visas, annars null. */
  showingWhy: string | null;
}

export function startQuiz(questionIds: string[]): QuizState {
  return { queue: [...questionIds], firstTry: {}, showingWhy: null };
}

export function answerQuiz(state: QuizState, questionId: string, right: boolean): QuizState {
  // Förklaringen måste stängas först, och bara den främsta frågan går att besvara (skyddar mot dubbelklick).
  if (state.showingWhy !== null || state.queue[0] !== questionId) return state;
  const firstTry = questionId in state.firstTry ? state.firstTry : { ...state.firstTry, [questionId]: right };
  if (right) return { queue: state.queue.slice(1), firstTry, showingWhy: null };
  return { queue: state.queue, firstTry, showingWhy: questionId };
}

/** Stänger förklaringen och lägger den felsvarade frågan sist i kön. */
export function continueQuiz(state: QuizState): QuizState {
  if (state.showingWhy === null) return state;
  return { ...state, queue: [...state.queue.slice(1), state.queue[0]], showingWhy: null };
}

export function quizDone(state: QuizState): boolean {
  return state.queue.length === 0 && state.showingWhy === null;
}

/** Dagar till nästa repetition efter 1, 2, 3 … rätt i rad. Efter den sista gäller den hela tiden. */
export const INTERVALS = [1, 3, 7, 14, 30] as const;

export function nextAnswer(prev: Answer | undefined, id: string, right: boolean, today: DateKey): Answer {
  if (!right) return { id, streak: 0, due: addDays(today, 1), last: today };
  const streak = (prev?.streak ?? 0) + 1;
  return { id, streak, due: addDays(today, INTERVALS[Math.min(streak, INTERVALS.length) - 1]), last: today };
}

/** Frågor som ska repeteras idag: äldst förfallodag först, sedan id, högst `max`. */
export function dueQuestions(answers: Answer[], today: DateKey, max = 3): string[] {
  return answers
    .filter((a) => a.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, max)
    .map((a) => a.id);
}

/** Högst så många repetitionsfrågor per dag. */
export const REVIEWS_PER_DAY = 3;

const knownQuestion = (id: string) => questionById(id) !== undefined;

/**
 * Repetitionsfrågorna som erbjuds idag. Används av startsidans rad, kortet Dagens lektion och repetitionen, så att de
 * alltid säger samma sak. Svar på frågor som inte finns i den här versionen av appen (synkade från en telefon med
 * nyare kurser) räknas inte alls. Varje fråga som redan repeterats idag (reviewedOn, rätt eller fel) tar en av dagens
 * platser, så att det blir högst REVIEWS_PER_DAY om dagen.
 */
export function reviewToday(answers: Answer[], today: DateKey, known: (id: string) => boolean = knownQuestion): string[] {
  const valid = answers.filter((a) => known(a.id));
  const left = Math.max(0, REVIEWS_PER_DAY - valid.filter((a) => a.reviewedOn === today).length);
  return dueQuestions(valid, today, left);
}

// Rapportmallen: siffror, uträkningar och sortering. Rena funktioner.

export const PERIOD_LABEL: Record<PeriodType, string> = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', H1: 'Halvår 1', H2: 'Halvår 2', FY: 'Helår' };

/** Tusentalsavskiljare i det fält användaren skriver i: vanligt mellanslag, hårt mellanslag och smalt hårt mellanslag. */
const GROUP_SEPARATORS = /[ \u00a0\u202f]/g;

/**
 * Text till tal. Tom sträng är null. Tusentalsavskiljare får vara vanligt, hårt eller smalt hårt mellanslag, decimaltecknet
 * är komma eller punkt och ett minus först är negativt. Allt annat är 'fel'. Ger aldrig NaN eller Infinity.
 */
export function parseNumber(text: string): number | null | 'fel' {
  const t = text.trim();
  if (t === '') return null;
  const m = /^([-\u2212]?)(\d+(?:[.,]\d+)?)$/.exec(t.replace(GROUP_SEPARATORS, ''));
  if (!m) return 'fel';
  const n = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(n)) return 'fel';
  return m[1] === '' ? n : -n;
}

/** Året före: '2026' blir '2025', '2025/26' blir '2024/25'. Null när året inte går att tolka. */
export function previousYear(year: string): string | null {
  const y = year.trim();
  const plain = /^(\d{4})$/.exec(y);
  if (plain) return String(Number(plain[1]) - 1);
  const broken = /^(\d{4})\/(\d{2})$/.exec(y);
  if (broken) return `${Number(broken[1]) - 1}/${String((Number(broken[2]) + 99) % 100).padStart(2, '0')}`;
  return null;
}

/** Rörelsemarginal som andel (0,125 är 12,5 %). Null när rörelseresultat eller omsättning saknas eller omsättningen inte är över noll. */
export function margin(report: Report): number | null {
  const { ebit, revenue } = report;
  if (ebit === undefined || revenue === undefined || !(revenue > 0)) return null;
  const m = ebit / revenue;
  return Number.isFinite(m) ? m : null;
}

const periodName = (year: string, type: PeriodType) => `${PERIOD_LABEL[type]} ${year}`;

/** Omsättningstillväxt mot samma periodtyp året före, samma bolag och enhet. Annars står det vad som saknas. */
export function growth(report: Report, all: Report[]): { value: number } | { missing: string } {
  if (report.revenue === undefined) return { missing: 'Lägg in omsättning för att se tillväxten' };
  const prevYear = previousYear(report.year);
  if (prevYear === null) return { missing: `Året ${report.year.trim() || '(tomt)'} går inte att tolka, så året före går inte att hitta` };
  const name = periodName(prevYear, report.type);
  const same = all.filter((r) => r.id !== report.id && r.companyId === report.companyId && r.type === report.type && r.year.trim() === prevYear);
  if (same.length === 0) return { missing: `Lägg in ${name} för att se tillväxten` };
  const prev = same.find((r) => r.unit.trim() === report.unit.trim());
  if (!prev) return { missing: `Enheten skiljer sig från ${name}` };
  if (prev.revenue === undefined) return { missing: `Omsättning saknas i ${name}` };
  if (!(prev.revenue > 0)) return { missing: `Omsättningen i ${name} är inte över noll, så tillväxten går inte att räkna` };
  const value = (report.revenue - prev.revenue) / prev.revenue;
  return Number.isFinite(value) ? { value } : { missing: `Tillväxten mot ${name} går inte att räkna` };
}

/** Tal med decimalkomma, hårt mellanslag som tusentalsavskiljare och riktigt minustecken. */
export function formatNumber(n: number): string {
  const [int, dec] = String(Number(n.toFixed(6))).replace('-', '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${n < 0 ? '\u2212' : ''}${grouped}${dec ? `,${dec}` : ''}`;
}

/** Andel som procent med en decimal och decimalkomma: 0,125 blir '12,5 %'. Aldrig minus på noll. */
export function formatPercent(share: number): string {
  const p = Number((share * 100).toFixed(1));
  return `${p < 0 ? '\u2212' : ''}${Math.abs(p).toFixed(1).replace('.', ',')} %`;
}

export type Described = { text: string } | { missing: string };

/** Rörelsemarginalen med uträkningen utskriven, eller varför den saknas. */
export function describeMargin(report: Report): Described {
  const m = margin(report);
  if (m === null || report.ebit === undefined || report.revenue === undefined) {
    if (report.revenue === undefined || report.ebit === undefined) return { missing: 'Fyll i omsättning och rörelseresultat' };
    return { missing: 'Omsättningen måste vara över noll' };
  }
  return { text: `${formatNumber(report.ebit)} / ${formatNumber(report.revenue)} = ${formatPercent(m)}` };
}

/** Tillväxten med uträkningen utskriven, eller vad som saknas. */
export function describeGrowth(report: Report, all: Report[]): Described {
  const g = growth(report, all);
  if ('missing' in g) return g;
  const prev = all.find((r) => r.id !== report.id && r.companyId === report.companyId && r.type === report.type && r.year.trim() === previousYear(report.year) && r.unit.trim() === report.unit.trim())!;
  return { text: `(${formatNumber(report.revenue!)} \u2212 ${formatNumber(prev.revenue!)}) / ${formatNumber(prev.revenue!)} = ${formatPercent(g.value)}` };
}

const TYPE_RANK: Record<PeriodType, number> = { Q1: 0, Q2: 1, H1: 1, Q3: 2, Q4: 3, H2: 3, FY: 4 };

/** Räkenskapsårets ordning: ett brutet år (2025/26) slutar efter kalenderåret med samma första år. Null när det inte går att tolka. */
function yearKey(year: string): number | null {
  const m = /^(\d{4})(\/\d{2})?$/.exec(year.trim());
  return m ? Number(m[1]) + (m[2] ? 0.5 : 0) : null;
}

/** Nyast först: år, sedan Q1 före Q2 och Halvår 1, före Q3, före Q4 och Halvår 2, före Helår. Årtal som inte går att tolka sist. */
export function sortReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    const ya = yearKey(a.year);
    const yb = yearKey(b.year);
    if (ya === null || yb === null) return ya === yb ? a.year.localeCompare(b.year, 'sv') : ya === null ? 1 : -1;
    return yb - ya || TYPE_RANK[b.type] - TYPE_RANK[a.type] || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
  });
}
