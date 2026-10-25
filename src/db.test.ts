import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getBudget, getIncome, saveCategory, saveIncome, shiftMonth } from './db';

// Databasen delas mellan testerna, så varje test använder egna månader långt fram.

describe('ändringar gäller bara den valda månaden', () => {
  it('budget: att ändra november ändrar inte december eller oktober', async () => {
    const { categories } = await getBudget('2030-10');
    const first = categories[0];
    await saveCategory('2030-11', { ...first, monthlyBudget: 999 });
    expect((await getBudget('2030-11')).categories[0].monthlyBudget).toBe(999);
    expect((await getBudget('2030-12')).categories[0].monthlyBudget).toBe(first.monthlyBudget);
    expect((await getBudget('2031-05')).categories[0].monthlyBudget).toBe(first.monthlyBudget);
    expect((await getBudget('2030-10')).categories[0].monthlyBudget).toBe(first.monthlyBudget);
  });

  it('budget: en ny kategori i en månad finns bara där', async () => {
    await saveCategory('2032-03', { id: 'tandlakare', name: 'Tandläkare', type: 'variable', monthlyBudget: 1200 });
    const has = async (m: string) => (await getBudget(m)).categories.some((c) => c.id === 'tandlakare');
    expect(await has('2032-03')).toBe(true);
    expect(await has('2032-04')).toBe(false);
    expect(await has('2032-02')).toBe(false);
  });

  it('budget: att ändra en månad efter en annan påverkar ingen av de andra', async () => {
    await saveCategory('2033-01', { id: 'gym', name: 'Gym', type: 'fixed', monthlyBudget: 400 });
    await saveCategory('2033-02', { id: 'gym', name: 'Gym', type: 'fixed', monthlyBudget: 500 });
    const gym = async (m: string) => (await getBudget(m)).categories.find((c) => c.id === 'gym')?.monthlyBudget;
    expect(await gym('2032-12')).toBeUndefined();
    expect(await gym('2033-01')).toBe(400);
    expect(await gym('2033-02')).toBe(500);
    expect(await gym('2033-03')).toBeUndefined();
  });

  it('inkomst: att ändra en månad ändrar inte månaderna runt omkring', async () => {
    const before = (await getIncome('2034-01')).csn;
    await saveIncome({ month: '2034-02', csn: 999, other: 200 });
    expect((await getIncome('2034-01')).csn).toBe(before);
    expect((await getIncome('2034-02')).csn).toBe(999);
    expect((await getIncome('2034-03')).csn).toBe(before);
    expect((await getIncome(shiftMonth('2034-03', 12))).csn).toBe(before);
  });

  it('inkomst: CSN-planen får följa med till senare månader', async () => {
    await saveIncome({ month: '2035-06', csn: 9202, other: 1 }, true);
    await saveIncome({ month: '2035-07', csn: 0, other: 1 }, true);
    expect((await getIncome('2035-09')).csn).toBe(0);
  });
});
