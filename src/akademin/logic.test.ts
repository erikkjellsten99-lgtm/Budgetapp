import { describe, expect, it } from 'vitest';
import {
  answerQuiz,
  continueQuiz,
  describeGrowth,
  describeMargin,
  dueQuestions,
  growth,
  margin,
  nextAnswer,
  parseNumber,
  PERIOD_LABEL,
  previousYear,
  quizDone,
  reviewToday,
  sortReports,
  startQuiz,
} from './logic';
import type { Answer, Report } from './types';

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

const rep = (patch: Partial<Report> = {}): Report => ({ id: 'r', companyId: 'c1', year: '2026', type: 'Q3', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '', ...patch });

describe('parseNumber', () => {
  it('tar tusentalsavskiljare och decimalkomma', () => {
    expect(parseNumber('1 234,5')).toBe(1234.5);
    expect(parseNumber('1\u00a0234,5')).toBe(1234.5);
    expect(parseNumber('1\u202f234,5')).toBe(1234.5);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('12')).toBe(12);
  });
  it('negativa tal, med bindestreck och riktigt minustecken', () => {
    expect(parseNumber('-12')).toBe(-12);
    expect(parseNumber('\u221212')).toBe(-12);
    expect(parseNumber('-1 234,5')).toBe(-1234.5);
  });
  it('tomt är null', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
  });
  it('allt annat är fel, och aldrig NaN eller Infinity', () => {
    for (const bad of ['abc', '12 kr', '1,2,3', '-', '1.234,5', '+5', '5,', '1e5', '--1', '9'.repeat(400)]) expect(parseNumber(bad)).toBe('fel');
  });
});

describe('previousYear', () => {
  it('kalenderår och brutet år', () => {
    expect(previousYear('2026')).toBe('2025');
    expect(previousYear('2025/26')).toBe('2024/25');
    expect(previousYear('2000/01')).toBe('1999/00');
    expect(previousYear(' 2026 ')).toBe('2025');
  });
  it('går det inte att tolka är det null', () => {
    expect(previousYear('i år')).toBeNull();
    expect(previousYear('')).toBeNull();
    expect(previousYear('26')).toBeNull();
  });
});

describe('margin', () => {
  it('rörelseresultat delat på omsättning, som andel', () => {
    expect(margin(rep({ ebit: 25, revenue: 200 }))).toBe(0.125);
    expect(margin(rep({ ebit: -20, revenue: 200 }))).toBe(-0.1);
  });
  it('null när något saknas eller omsättningen är noll', () => {
    expect(margin(rep({ ebit: 25, revenue: 0 }))).toBeNull();
    expect(margin(rep({ ebit: 25 }))).toBeNull();
    expect(margin(rep({ revenue: 200 }))).toBeNull();
  });
});

describe('growth', () => {
  const prev = rep({ id: 'p', year: '2025', revenue: 100 });
  const cur = rep({ revenue: 110 });
  it('mot samma periodtyp året före, samma bolag och enhet', () => {
    expect(growth(cur, [cur, prev])).toEqual({ value: 0.1 });
    expect(growth(rep({ year: '2025/26', revenue: 120 }), [rep({ id: 'q', year: '2024/25', revenue: 100 })])).toEqual({ value: 0.2 });
  });
  it('saknas något står det vad', () => {
    const missing = (r: Report, all: Report[]) => {
      const g = growth(r, all);
      expect('missing' in g).toBe(true);
      return 'missing' in g ? g.missing : '';
    };
    expect(missing(cur, [cur])).toBe('Lägg in Q3 2025 för att se tillväxten');
    expect(missing(cur, [rep({ ...prev, type: 'Q2' })])).toContain('Q3 2025');
    expect(missing(cur, [rep({ ...prev, companyId: 'c2' })])).toContain('Q3 2025');
    expect(missing(cur, [rep({ ...prev, unit: 'MUSD' })])).toBe('Enheten skiljer sig från Q3 2025');
    expect(missing(cur, [rep({ ...prev, revenue: 0 })])).toContain('Q3 2025');
    expect(missing(cur, [rep({ ...prev, revenue: undefined })])).toContain('Q3 2025');
    expect(missing(rep({ year: 'i år', revenue: 110 }), [prev])).toContain('i år');
    expect(missing(rep({ revenue: undefined }), [prev])).toContain('omsättning');
    expect(missing(rep({ type: 'H1', year: '2026', revenue: 5 }), [prev])).toBe('Lägg in Halvår 1 2025 för att se tillväxten');
  });
  it('samma enhet går före en annan om båda finns', () => {
    expect(growth(cur, [rep({ ...prev, id: 'x', unit: 'MUSD' }), prev])).toEqual({ value: 0.1 });
  });
});

describe('uträkningarna i text', () => {
  it('marginal med svenskt decimalkomma och uträkningen', () => {
    expect(describeMargin(rep({ ebit: 25, revenue: 200 }))).toEqual({ text: '25 / 200 = 12,5 %' });
    expect(describeMargin(rep({ ebit: -20, revenue: 200 }))).toEqual({ text: '\u221220 / 200 = \u221210,0 %' });
    expect(describeMargin(rep({ ebit: 0.4, revenue: 1000 }))).toEqual({ text: '0,4 / 1\u00a0000 = 0,0 %' });
  });
  it('marginal som inte går att räkna säger varför, aldrig 0 %', () => {
    for (const r of [rep(), rep({ ebit: 5 }), rep({ ebit: 5, revenue: 0 })]) {
      const d = describeMargin(r);
      expect('missing' in d && d.missing.length > 0).toBe(true);
    }
  });
  it('tillväxt med uträkning, eller skälet', () => {
    const prev = rep({ id: 'p', year: '2025', revenue: 100 });
    expect(describeGrowth(rep({ revenue: 110 }), [prev])).toEqual({ text: '(110 \u2212 100) / 100 = 10,0 %' });
    expect(describeGrowth(rep({ revenue: 110 }), [])).toEqual({ missing: 'Lägg in Q3 2025 för att se tillväxten' });
  });
});

describe('sortReports', () => {
  it('nyast först: år, sedan Q1 < Q2 = H1 < Q3 < Q4 = H2 < FY', () => {
    const r = (id: string, year: string, type: Report['type']) => rep({ id, year, type });
    const sorted = sortReports([r('a', '2025', 'FY'), r('b', '2026', 'Q1'), r('c', '2025/26', 'Q4'), r('d', '2026', 'Q3'), r('e', '2026', 'Q2'), r('f', '2024', 'Q4')]);
    expect(sorted.map((x) => x.id)).toEqual(['d', 'e', 'b', 'c', 'a', 'f']);
  });
  it('rör inte ursprungslistan och tar årtal som inte går att tolka sist', () => {
    const input = [rep({ id: 'x', year: 'i år' }), rep({ id: 'y', year: '2020' })];
    expect(sortReports(input).map((x) => x.id)).toEqual(['y', 'x']);
    expect(input[0].id).toBe('x');
  });
  it('etiketterna', () => {
    expect(Object.values(PERIOD_LABEL)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Halvår 1', 'Halvår 2', 'Helår']);
  });
});
