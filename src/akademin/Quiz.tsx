// Akademin: quizet, för både lektionens fyra frågor och repetitionen. Frågor och svar visas i datans ordning.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { answerQuiz, continueQuiz, quizDone, startQuiz, type QuizState } from './logic';
import type { Question } from './types';

/**
 * Quizets tillstånd utanför React, så att ett andra tryck på samma svar ser det första trycket direkt (inte först efter
 * nästa rendering) och `onDone` anropas exakt en gång. `onFirstAnswer` anropas en gång per fråga, vid första svaret.
 */
export function createQuiz(
  questionIds: string[],
  onDone: (firstTry: Record<string, boolean>) => void,
  onFirstAnswer?: (questionId: string, right: boolean) => void,
) {
  let state = startQuiz(questionIds);
  const listeners = new Set<() => void>();
  const set = (next: QuizState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  return {
    state: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    answer(questionId: string, right: boolean) {
      const next = answerQuiz(state, questionId, right);
      if (next === state) return;
      if (!(questionId in state.firstTry)) onFirstAnswer?.(questionId, right);
      set(next);
      if (quizDone(next)) onDone(next.firstTry);
    },
    next() {
      const next = continueQuiz(state);
      if (next !== state) set(next);
    },
  };
}

export function QuizView({
  questions,
  state,
  onAnswer,
  onContinue,
}: {
  questions: Question[];
  state: QuizState;
  onAnswer: (questionId: string, right: boolean) => void;
  onContinue: () => void;
}) {
  const current = questions.find((q) => q.id === state.queue[0]);
  const heading = useRef<HTMLHeadingElement>(null);
  const cont = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const currentId = current?.id;
  const showingWhy = state.showingWhy !== null;
  // Förklaringen scrollas fram och får fokus; nästa fråga flyttar fokus till frågan (inte vid första visningen).
  useEffect(() => {
    if (showingWhy) {
      cont.current?.scrollIntoView?.({ block: 'nearest' });
      cont.current?.focus({ preventScroll: true });
    } else if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [currentId, showingWhy]);
  if (!current) return null;
  const total = questions.length;
  const number = Math.min(total, total - state.queue.length + 1);
  const again = state.firstTry[current.id] === false;
  const why = state.showingWhy === current.id;
  return (
    <section className="akademin-quiz" aria-labelledby="akademin-q">
      <p className="akademin-meta">
        Fråga {number} av {total}
        {again && ' · en gång till'}
      </p>
      <h3 id="akademin-q" ref={heading} tabIndex={-1}>{current.text}</h3>
      <div className="akademin-options">
        {current.options.map((option, i) => (
          <button
            key={option}
            type="button"
            className={why && i === current.correct ? 'akademin-option right' : 'akademin-option'}
            disabled={why}
            onClick={() => onAnswer(current.id, i === current.correct)}
          >
            {option}
          </button>
        ))}
      </div>
      {why && (
        <div className="akademin-why" role="status">
          <p className="akademin-why-title">Inte riktigt. Rätt svar är markerat.</p>
          <p>{current.why}</p>
          <button type="button" className="primary" ref={cont} onClick={onContinue}>
            Fortsätt
          </button>
        </div>
      )}
    </section>
  );
}

export default function Quiz({
  questions,
  onDone,
  onFirstAnswer,
}: {
  questions: Question[];
  onDone: (firstTry: Record<string, boolean>) => void;
  onFirstAnswer?: (questionId: string, right: boolean) => void;
}) {
  const latest = useRef({ onDone, onFirstAnswer });
  useEffect(() => {
    latest.current = { onDone, onFirstAnswer };
  });
  const quiz = useRef<ReturnType<typeof createQuiz> | null>(null);
  quiz.current ??= createQuiz(
    questions.map((q) => q.id),
    (firstTry) => latest.current.onDone(firstTry),
    (id, right) => latest.current.onFirstAnswer?.(id, right),
  );
  const q = quiz.current;
  const state = useSyncExternalStore(q.subscribe, q.state, q.state);
  return <QuizView questions={questions} state={state} onAnswer={q.answer} onContinue={q.next} />;
}
