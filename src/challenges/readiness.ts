// Dagens form: ett råd inför dagens pass, räknat ur hälsodatan från Apple Hälsa (samma poster som Vanor visar).
// Bara ett råd: reglerna i logic.ts känner inte till formen, och ingenting bockas eller ändras av den.
//
// Poäng för det som tyder på trötthet. 0 = pigg, 1–2 = okej, 3 eller fler = sliten.
// Utan nattens sömn ges ingen form alls, hellre än en som ser säkrare ut än den är.

import { formatHealth, type HealthDay } from '../../supabase/functions/inbox/health';
import { addDays, type DateKey } from '../vanor/dates';

export type Form = 'pigg' | 'okej' | 'sliten';

export interface Readiness {
  /** null = nattens sömn har inte kommit in än. */
  form: Form | null;
  points: number;
  /** Siffrorna som avgjorde, i den ordning de visas. */
  facts: string[];
}

export const FORM_LABEL: Record<Form, string> = { pigg: 'Pigg', okej: 'Okej', sliten: 'Sliten' };

const SLEEP_SHORT_H = 6;
const SLEEP_OK_H = 7;
const HR_HIGH = 7;
const HR_RAISED = 4;
const HARD_DAY_MIN = 90;
const LOW_SLEEP_SCORE = 60;
const BASELINE_DAYS = 14;
const BASELINE_MIN_DAYS = 5;

export function readiness(health: HealthDay[], today: DateKey): Readiness {
  const byDate = new Map(health.map((d) => [d.date, d.values]));
  const now = byDate.get(today);
  const yesterday = addDays(today, -1);
  const sleepH = now?.sleepH;
  if (sleepH === undefined) return { form: null, points: 0, facts: [] };

  let points = sleepH < SLEEP_SHORT_H ? 2 : sleepH < SLEEP_OK_H ? 1 : 0;
  const facts = [`${formatHealth('sleepH', sleepH)} sömn`];

  const score = now?.sleepScore;
  if (score !== undefined) {
    if (score < LOW_SLEEP_SCORE) points += 1;
    facts.push(`sömnpoäng ${Math.round(score)}`);
  }

  // Vilopulsen: dagens värde, annars gårdagens, jämfört med dagarna före det värdet
  const hrDate = now?.restingHr !== undefined ? today : byDate.get(yesterday)?.restingHr !== undefined ? yesterday : null;
  if (hrDate) {
    const hr = byDate.get(hrDate)!.restingHr!;
    const earlier = health
      .filter((d) => d.date < hrDate && d.values.restingHr !== undefined)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, BASELINE_DAYS)
      .map((d) => d.values.restingHr!);
    if (earlier.length >= BASELINE_MIN_DAYS) {
      const mean = earlier.reduce((a, b) => a + b, 0) / earlier.length;
      const over = hr - mean;
      points += over >= HR_HIGH ? 2 : over >= HR_RAISED ? 1 : 0;
      facts.push(`vilopuls ${Math.round(hr)} (snitt ${Math.round(mean)})`);
    } else facts.push(`vilopuls ${Math.round(hr)}`);
  }

  const trained = byDate.get(yesterday)?.exerciseMin;
  if (trained !== undefined && trained >= HARD_DAY_MIN) {
    points += 1;
    facts.push(`${Math.round(trained)} min träning igår`);
  }

  return { form: points >= 3 ? 'sliten' : points >= 1 ? 'okej' : 'pigg', points, facts };
}

const SUGGESTIONS: Record<Form, { easy: string; hard: string }> = {
  pigg: { easy: 'Lugn jogg eller promenad utomhus.', hard: 'Kör hårt: intervaller, tempolöpning eller tungt gym.' },
  okej: { easy: 'Promenad eller lugn jogg.', hard: 'Gym eller distans i jämnt tempo. Spara intervallerna.' },
  sliten: { easy: 'Promenad eller rörlighet, låg puls.', hard: 'Lugn styrka eller zon 2 i 45 min. Inga intervaller.' },
};

/** Förslag för ett pass som heter "Lätt …" eller "Tufft …" (mallen 75 Hard). Andra pass får inget. */
export function suggestion(form: Form, taskTitle: string): string | null {
  const title = taskTitle.trim().toLowerCase();
  if (title.startsWith('lätt')) return SUGGESTIONS[form].easy;
  if (title.startsWith('tufft')) return SUGGESTIONS[form].hard;
  return null;
}
