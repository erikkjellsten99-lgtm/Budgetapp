import { describe, expect, it } from 'vitest';
import { answerQuiz, continueQuiz, dueQuestions, nextAnswer, quizDone, reviewToday, startQuiz } from './logic';
import type { Answer } from './types';

const TODAY = '2026-11-20';

describe('quiz', () => {
  it('rätt svar på främsta frågan tar bort den ur kön', () => {
    const s = answerQuiz(startQuiz(['a', 'b']), 'a', true);
    expect(s.queue).toEqual(['b']);
    expect(s.firstTry.a).toBe(true);
    expect(s.showingWhy).toBeNull();
  });

  it('fel svar visar förklaringen och frågan hamnar sist efter continueQuiz', () => {
    const wrong = answerQuiz(startQuiz(['a', 'b']), 'a', false);
    expect(wrong.showingWhy).toBe('a');
    expect(wrong.firstTry.a).toBe(false);
    const next = continueQuiz(wrong);
    expect(next.queue).toEqual(['b', 'a']);
    expect(next.showingWhy).toBeNull();
  });

  it('fel och sedan rätt behåller firstTry false', () => {
    let s = continueQuiz(answerQuiz(startQuiz(['a']), 'a', false));
    s = answerQuiz(s, 'a', true);
    expect(s.firstTry.a).toBe(false);
    expect(s.queue).toEqual([]);
  });

  it('svar på en fråga som inte är främst ger samma objekt', () => {
    const s = startQuiz(['a', 'b']);
    expect(answerQuiz(s, 'b', true)).toBe(s);
  });

  it('svar medan förklaringen visas ger samma objekt, continueQuiz utan förklaring också', () => {
    const s = startQuiz(['a']);
    expect(continueQuiz(s)).toBe(s);
    const wrong = answerQuiz(s, 'a', false);
    expect(answerQuiz(wrong, 'a', true)).toBe(wrong);
  });

  it('quizDone är sant först när kön är tom och förklaringen stängd', () => {
    expect(quizDone(startQuiz(['a']))).toBe(false);
    const right = answerQuiz(startQuiz(['a']), 'a', true);
    expect(quizDone(right)).toBe(true);
    const wrong = answerQuiz(startQuiz(['a']), 'a', false);
    expect(quizDone({ ...wrong, queue: [] })).toBe(false);
  });
});

describe('nextAnswer', () => {
  it('första rätta svaret', () => {
    expect(nextAnswer(undefined, 'q', true, TODAY)).toEqual({ id: 'q', streak: 1, due: '2026-11-21', last: TODAY });
  });

  it('rätt i rad ger växande intervall och sedan 30 dagar', () => {
    const dues = ['2026-11-21', '2026-11-23', '2026-11-27', '2026-12-04', '2026-12-20', '2026-12-20'];
    let a: Answer | undefined;
    dues.forEach((due, i) => {
      a = nextAnswer(a, 'q', true, TODAY);
      expect(a.streak).toBe(i + 1);
      expect(a.due).toBe(due);
    });
  });

  it('fel nollställer och ger i morgon', () => {
    const prev: Answer = { id: 'q', streak: 4, due: TODAY, last: '2026-11-10' };
    expect(nextAnswer(prev, 'q', false, TODAY)).toEqual({ id: 'q', streak: 0, due: '2026-11-21', last: TODAY });
  });
});

describe('dueQuestions', () => {
  const ans = (id: string, due: string): Answer => ({ id, streak: 1, due, last: '2026-11-01' });

  it('bara förfallna, äldst först, id som tiebreak, högst 3', () => {
    const list = [
      ans('d', '2026-11-18'),
      ans('z', '2026-11-19'),
      ans('b', '2026-11-19'),
      ans('x', '2026-11-21'),
      ans('a', '2026-11-20'),
    ];
    expect(dueQuestions(list, TODAY)).toEqual(['d', 'b', 'z']);
    expect(dueQuestions(list, TODAY, 10)).toEqual(['d', 'b', 'z', 'a']);
  });
});

describe('reviewToday', () => {
  const known = (id: string) => id.startsWith('k');
  const due = (id: string, reviewedOn?: string): Answer => ({ id, streak: 0, due: '2026-11-20', last: '2026-11-19', ...(reviewedOn ? { reviewedOn } : {}) });
  const reviewed = (id: string, on: string): Answer => ({ id, streak: 1, due: '2026-11-23', last: on, reviewedOn: on });

  it('fyra förfallna och inget repeterat idag ger tre', () => {
    expect(reviewToday([due('k1'), due('k2'), due('k3'), due('k4')], TODAY, known)).toEqual(['k1', 'k2', 'k3']);
  });

  it('tre repeterade idag ger inga fler, nästa dag erbjuds de igen', () => {
    const answers = [reviewed('k1', TODAY), reviewed('k2', TODAY), { ...reviewed('k3', TODAY), streak: 0, due: '2026-11-21' }, due('k4')];
    expect(reviewToday(answers, TODAY, known)).toEqual([]);
    expect(reviewToday(answers, '2026-11-21', known)).toEqual(['k4', 'k3']);
  });

  it('en repeterad idag lämnar två platser', () => {
    expect(reviewToday([reviewed('k0', TODAY), due('k1'), due('k2'), due('k3')], TODAY, known)).toEqual(['k1', 'k2']);
  });

  it('svar på okända frågor räknas inte, varken som förfallna eller som repeterade idag', () => {
    const answers = [due('x-okand'), reviewed('y-okand', TODAY), reviewed('z-okand', TODAY), due('k1')];
    expect(reviewToday(answers, TODAY, known)).toEqual(['k1']);
  });

  it('utan egen kontroll känns frågorna igen ur kurserna', () => {
    expect(reviewToday([due('k1-01-q1'), due('k9-99-q1')], TODAY)).toEqual(['k1-01-q1']);
  });
});
