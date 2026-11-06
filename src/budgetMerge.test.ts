import { describe, expect, it } from 'vitest';
import { mergeBudget, same } from './budgetMerge';
import type { Category } from './types';

const M = '2026-11';

function base(): Category[] {
  return [
    { id: 'hem', name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 8000 },
    {
      id: 'ovrigt',
      name: 'Övriga kostnader',
      type: 'fixed',
      monthlyBudget: 349.8,
      items: [
        { id: 'claude', name: 'Claude', amount: 220.5 },
        { id: 'chatgpt', name: 'ChatGPT', amount: 129.3 },
      ],
    },
    { id: 'spar', name: 'Separat sparande', type: 'savings', monthlyBudget: 10000 },
  ];
}

/** En ändrad kopia, som när en telefon ändrar sin budget. */
function edit(change: (list: Category[]) => void): Category[] {
  const list = structuredClone(base());
  change(list);
  return list;
}

const find = (list: Category[], id: string) => list.find((c) => c.id === id)!;

describe('mergeBudget', () => {
  it('Erik och Cassandra bockar var sin rad i samma kategori: båda bockarna finns kvar', () => {
    const erik = edit((l) => (find(l, 'ovrigt').items![0].paidMonth = M));
    const cassandra = edit((l) => (find(l, 'ovrigt').items![1].paidMonth = M));
    const merged = mergeBudget(base(), erik, cassandra);
    expect(find(merged, 'ovrigt').items!.map((i) => i.paidMonth)).toEqual([M, M]);
    expect(find(merged, 'ovrigt').monthlyBudget).toBe(349.8);
  });

  it('ändrade belopp i olika kategorier: båda ändringarna finns kvar', () => {
    const erik = edit((l) => (find(l, 'hem').monthlyBudget = 8500));
    const cassandra = edit((l) => (find(l, 'spar').monthlyBudget = 12000));
    const merged = mergeBudget(base(), erik, cassandra);
    expect(find(merged, 'hem').monthlyBudget).toBe(8500);
    expect(find(merged, 'spar').monthlyBudget).toBe(12000);
    expect(mergeBudget(base(), cassandra, erik)).toEqual(merged);
  });

  it('samma fält ändrat på båda: den här telefonens ändring vinner', () => {
    const erik = edit((l) => (find(l, 'hem').monthlyBudget = 8500));
    const cassandra = edit((l) => (find(l, 'hem').monthlyBudget = 9000));
    expect(find(mergeBudget(base(), erik, cassandra), 'hem').monthlyBudget).toBe(8500);
  });

  it('ny rad på den ena och ändrat belopp på den andra: båda, och summan blir raderna', () => {
    const erik = edit((l) => {
      const c = find(l, 'ovrigt');
      c.items!.push({ id: 'netflix', name: 'Netflix', amount: 129 });
      c.monthlyBudget = 478.8;
    });
    const cassandra = edit((l) => {
      const c = find(l, 'ovrigt');
      c.items![0].amount = 250;
      c.monthlyBudget = 379.3;
    });
    const c = find(mergeBudget(base(), erik, cassandra), 'ovrigt');
    expect(c.items!.map((i) => [i.id, i.amount])).toEqual([
      ['claude', 250],
      ['chatgpt', 129.3],
      ['netflix', 129],
    ]);
    expect(c.monthlyBudget).toBe(250 + 129.3 + 129);
  });

  it('borttagen rad tas bort, men inte om den andra har ändrat den', () => {
    const erik = edit((l) => {
      const c = find(l, 'ovrigt');
      c.items = c.items!.filter((i) => i.id !== 'chatgpt');
      c.monthlyBudget = 220.5;
    });
    expect(find(mergeBudget(base(), erik, base()), 'ovrigt').items!.map((i) => i.id)).toEqual(['claude']);
    expect(find(mergeBudget(base(), erik, base()), 'ovrigt').monthlyBudget).toBe(220.5);

    const cassandra = edit((l) => (find(l, 'ovrigt').items![1].amount = 140));
    const kept = find(mergeBudget(base(), erik, cassandra), 'ovrigt');
    expect(kept.items!.map((i) => [i.id, i.amount])).toEqual([
      ['claude', 220.5],
      ['chatgpt', 140],
    ]);
  });

  it('ny kategori på den andra telefonen kommer med', () => {
    const cassandra = edit((l) => l.push({ id: 'tandlakare', name: 'Tandläkare', type: 'variable', monthlyBudget: 1200 }));
    const erik = edit((l) => (find(l, 'hem').paidMonth = M));
    const merged = mergeBudget(base(), erik, cassandra);
    expect(merged.map((c) => c.id)).toEqual(['hem', 'ovrigt', 'spar', 'tandlakare']);
    expect(find(merged, 'hem').paidMonth).toBe(M);
  });

  it('borttagen kategori tas bort om den inte ändrats på den andra', () => {
    const erik = edit((l) => l.splice(2, 1));
    expect(mergeBudget(base(), erik, base()).map((c) => c.id)).toEqual(['hem', 'ovrigt']);
  });

  it('ändrade bara den andra ordningen följer den med', () => {
    const cassandra = edit((l) => {
      const c = find(l, 'ovrigt');
      c.items!.reverse();
    });
    const erik = edit((l) => (find(l, 'hem').monthlyBudget = 8100));
    const merged = mergeBudget(base(), erik, cassandra);
    expect(find(merged, 'ovrigt').items!.map((i) => i.id)).toEqual(['chatgpt', 'claude']);
    expect(find(merged, 'ovrigt').monthlyBudget).toBe(349.8);
    expect(find(merged, 'hem').monthlyBudget).toBe(8100);
  });

  it('utan base vinner den här telefonen allt, som förut', () => {
    const erik = edit((l) => (find(l, 'hem').monthlyBudget = 8500));
    const cassandra = edit((l) => {
      find(l, 'spar').monthlyBudget = 12000;
      l.push({ id: 'ny', name: 'Ny', type: 'fixed', monthlyBudget: 1 });
    });
    expect(mergeBudget(undefined, erik, cassandra)).toEqual(erik);
  });

  it('inga ändringar: samma budget, inga belopp ändrade', () => {
    expect(mergeBudget(base(), base(), base())).toEqual(base());
    const erik = edit((l) => (find(l, 'hem').name = 'Hem och hushåll å ä ö'));
    expect(mergeBudget(base(), erik, base())).toEqual(erik);
    expect(mergeBudget(base(), base(), erik)).toEqual(erik);
  });
});

describe('same', () => {
  it('ett fält som saknas är samma som undefined', () => {
    expect(same({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(same({ a: 1 }, { a: 2 })).toBe(false);
    expect(same([1, 2], [2, 1])).toBe(false);
  });
});
