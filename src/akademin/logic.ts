// Akademin: quiz och repetition. Rena funktioner, ingen I/O.
import { addDays } from '../vanor/dates';
import { questionById } from './kurser';
import type { Answer, DateKey } from './types';

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
