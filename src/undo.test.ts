import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteWish, getBudget, getWishes, saveCategory, saveWish, updateBudget } from './db';
import { dismissUndo, offerUndo, onUndoOffer, restoreAt, runUndo, type UndoOffer } from './undo';
import type { Category } from './types';

describe('restoreAt', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };

  it('lägger tillbaka raden på samma plats', () => {
    expect(restoreAt([a, c], b, 1)).toEqual([a, b, c]);
    expect(restoreAt([b, c], a, 0)).toEqual([a, b, c]);
  });

  it('lägger raden sist om listan har blivit kortare', () => {
    expect(restoreAt([a], c, 5)).toEqual([a, c]);
  });

  it('ändrar inget om raden redan finns', () => {
    const list = [a, b];
    expect(restoreAt(list, b, 0)).toBe(list);
  });
});

describe('ångra', () => {
  function latest(): UndoOffer | null {
    let offer: UndoOffer | null = null;
    onUndoOffer((next) => (offer = next))();
    return offer;
  }

  // Varje test börjar utan synlig ruta.
  beforeEach(() => {
    const open = latest();
    if (open) dismissUndo(open.id);
  });

  it('körs bara en gång, även vid dubbelklick', async () => {
    let runs = 0;
    offerUndo('Netflix togs bort', async () => {
      runs++;
    });
    const { id } = latest()!;
    await Promise.all([runUndo(id), runUndo(id)]);
    expect(runs).toBe(1);
    expect(latest()).toBeNull();
  });

  it('borttagningar medan rutan syns ångras tillsammans, den senaste först', async () => {
    const order: string[] = [];
    offerUndo('A togs bort', async () => {
      order.push('A');
    });
    const old = latest()!.id;
    offerUndo('B togs bort', async () => {
      order.push('B');
    });
    expect(latest()!.message).toBe('2 saker togs bort');
    expect(await runUndo(old)).toBe(false);
    expect(order).toEqual([]);
    await runUndo(latest()!.id);
    expect(order).toEqual(['B', 'A']);
  });

  it('efter att rutan stängts börjar en ny borttagning om från början', () => {
    offerUndo('A togs bort', async () => {});
    dismissUndo(latest()!.id);
    offerUndo('B togs bort', async () => {});
    expect(latest()!.message).toBe('B togs bort');
  });

  it('att stänga en gammal ruta stänger inte en nyare', () => {
    offerUndo('A togs bort', async () => {});
    const old = latest()!.id;
    offerUndo('B togs bort', async () => {});
    dismissUndo(old);
    expect(latest()!.message).toBe('2 saker togs bort');
    dismissUndo(latest()!.id);
  });
});

describe('ångra ger tillbaka exakt samma siffror', () => {
  it('budgetrad: samma rader, belopp, bock och summa som före borttagningen', async () => {
    const month = '2040-03';
    const category: Category = {
      id: 'ovrigt-test',
      name: 'Övriga kostnader',
      type: 'fixed',
      monthlyBudget: 349.8,
      items: [
        { id: 'claude', name: 'Claude', amount: 220.5 },
        { id: 'chatgpt', name: 'ChatGPT', amount: 129.3, paidMonth: month },
      ],
    };
    await saveCategory(month, category);
    const before = (await getBudget(month)).categories;

    const sum = (items: { amount: number }[]) => items.reduce((total, item) => total + item.amount, 0);
    const change = (fn: (items: NonNullable<Category['items']>) => NonNullable<Category['items']>) =>
      updateBudget(month, (list) =>
        list.map((c) => {
          if (c.id !== category.id) return c;
          const items = fn(c.items ?? []);
          return { ...c, items, monthlyBudget: items.length ? sum(items) : c.monthlyBudget };
        }),
      );

    const removed = category.items![1];
    await change((items) => items.filter((item) => item.id !== removed.id));
    expect((await getBudget(month)).categories.find((c) => c.id === category.id)!.items).toHaveLength(1);

    await change((items) => restoreAt(items, removed, 1));
    expect((await getBudget(month)).categories).toEqual(before);

    // Två borttagningar i rad, ångrade med den senaste först, ger samma ordning som före.
    const [first, second] = category.items!;
    await change((items) => items.filter((item) => item.id !== first.id)); // plats 0
    await change((items) => items.filter((item) => item.id !== second.id)); // plats 0 i den kortare listan
    await change((items) => restoreAt(items, second, 0));
    await change((items) => restoreAt(items, first, 0));
    expect((await getBudget(month)).categories).toEqual(before);
  });

  it('önskan: samma namn, pris, plats och bock', async () => {
    const wish = { id: 'cykel-test', list: 'erik' as const, name: 'Cykel å ä ö', amount: 12499.9, paidMonth: '2040-03', order: 2 };
    await saveWish(wish);
    await deleteWish(wish.id);
    expect((await getWishes()).some((w) => w.id === wish.id)).toBe(false);
    await saveWish(wish);
    expect((await getWishes()).find((w) => w.id === wish.id)).toEqual(wish);
  });
});
