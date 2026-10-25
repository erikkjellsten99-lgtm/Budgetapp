import { describe, expect, it } from 'vitest';
import { makeTransfer, parseTransfer } from './transfer';

const habit = { id: 'g', name: 'Gym', goal: 4, created: '2026-10-14', after: [], order: 0, archived: false, minimum: '20 min' };

describe('flyttkod', () => {
  it('går fram och tillbaka med å/ä/ö', () => {
    const data = {
      habits: [habit, { ...habit, id: 's', name: 'Stretching efter träning', after: ['g'], minimum: undefined }],
      checks: [{ date: '2026-10-20', habitId: 'g' }, { date: '2026-10-21', habitId: 'g', min: true }],
      pauses: [{ date: '2026-10-22' }],
    };
    const back = parseTransfer(makeTransfer(data));
    expect(back.habits.map((h) => [h.name, h.after])).toEqual([['Gym', []], ['Stretching efter träning', ['g']]]);
    expect(back.checks).toEqual(data.checks);
    expect(back.pauses).toEqual(data.pauses);
  });
  it('tål radbrytningar och mellanslag när koden klistras in', () => {
    const code = makeTransfer({ habits: [habit], checks: [], pauses: [] });
    expect(parseTransfer(`  ${code.slice(0, 10)}\n${code.slice(10)} `).habits).toHaveLength(1);
  });
  it('säger vad som är fel', () => {
    expect(() => parseTransfer('hej')).toThrow('flyttkod');
    expect(() => parseTransfer('VANOR1:abc')).toThrow('ofullständig');
  });
  it('rensar konstiga värden', () => {
    const code = makeTransfer({ habits: [{ ...habit, goal: 99 }], checks: [{ date: 'igår', habitId: 'g' }], pauses: [] });
    const back = parseTransfer(code);
    expect(back.habits[0].goal).toBe(7);
    expect(back.checks).toEqual([]);
  });
});
