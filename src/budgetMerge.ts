// Sammanslagning av en månads budget när två telefoner har ändrat samma månad.
//
// Budgeten för en månad sparas som en enda post (alla kategorier och rader). Utan sammanslagning
// vinner den som sparar sist, och den andras ändringar försvinner. Här jämförs båda versionerna
// med den senaste gemensamma versionen (base), fält för fält:
// - Ändrade bara den ena något behålls ändringen.
// - Ändrade båda samma fält vinner den här telefonens ändring.
// - Lade någon till en kategori eller rad finns den med.
// - Tog någon bort en kategori eller rad tas den bort, om inte den andra har ändrat den under tiden.
// Inga belopp räknas om, utom kategorins summa när raderna har ändrats på båda telefonerna:
// då blir den summan av raderna, precis som när du ändrar en rad i appen.

import type { Category, CategoryItem } from './types';

type Plain = Record<string, unknown>;

/** Lika, där ett fält som saknas räknas som ett fält som är undefined. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => same(value, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = new Set([...Object.keys(a as Plain), ...Object.keys(b as Plain)]);
  for (const key of keys) if (!same((a as Plain)[key], (b as Plain)[key])) return false;
  return true;
}

/** Fält för fält: den här telefonens ändring om den har ändrat fältet, annars den andras. */
function mergeFields<T extends object>(base: T | undefined, local: T, remote: T, skip: string[] = []): T {
  const result: Plain = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base ?? {})]);
  for (const key of keys) {
    if (skip.includes(key)) continue;
    const l = (local as Plain)[key];
    const r = (remote as Plain)[key];
    const b = base ? (base as Plain)[key] : undefined;
    const value = base ? (same(l, b) ? r : l) : l !== undefined ? l : r;
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

/**
 * Slår ihop två listor (kategorier eller rader) med id. Ordningen följer den här telefonen,
 * eller den andra om bara den har flyttat om. Nytt från den andra hamnar sist.
 */
function mergeList<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  mergeOne: (base: T | undefined, local: T, remote: T) => T,
): T[] {
  const inBase = new Map(base.map((x) => [x.id, x]));
  const inLocal = new Map(local.map((x) => [x.id, x]));
  const inRemote = new Map(remote.map((x) => [x.id, x]));
  const merged = new Map<string, T>();

  for (const id of new Set([...inLocal.keys(), ...inRemote.keys()])) {
    const b = inBase.get(id);
    const l = inLocal.get(id);
    const r = inRemote.get(id);
    if (l && r) merged.set(id, mergeOne(b, l, r));
    // Finns bara på den här telefonen: ny här, eller borttagen där (behålls om den ändrats här).
    else if (l) {
      if (!b || !same(l, b)) merged.set(id, l);
    } else if (r) {
      if (!b || !same(r, b)) merged.set(id, r);
    }
  }

  const ids = (list: T[]) => list.map((x) => x.id);
  const localKept = ids(local).filter((id) => inBase.has(id));
  const baseKept = ids(base).filter((id) => inLocal.has(id));
  const localMoved = !same(localKept, baseKept);
  const [first, second] = localMoved ? [local, remote] : [remote, local];
  const order = [...ids(first), ...ids(second)].filter((id, i, all) => merged.has(id) && all.indexOf(id) === i);
  return order.map((id) => merged.get(id)!);
}

const sumItems = (items: CategoryItem[]) => items.reduce((total, item) => total + item.amount, 0);

function mergeCategory(base: Category | undefined, local: Category, remote: Category): Category {
  const fields = mergeFields(base, local, remote, ['items', 'monthlyBudget']);
  const noItems = !local.items && !remote.items && !base?.items;
  if (noItems) {
    return { ...fields, monthlyBudget: base && same(local.monthlyBudget, base.monthlyBudget) ? remote.monthlyBudget : local.monthlyBudget };
  }
  const items = mergeList(base?.items ?? [], local.items ?? [], remote.items ?? [], (b, l, r) => mergeFields(b, l, r));
  // Raderna och summan hör ihop: blev raderna som på en av telefonerna följer den telefonens summa med.
  if (same(items, local.items ?? [])) return { ...fields, items: local.items, monthlyBudget: local.monthlyBudget };
  if (same(items, remote.items ?? [])) return { ...fields, items: remote.items, monthlyBudget: remote.monthlyBudget };
  const monthlyBudget = items.length
    ? sumItems(items)
    : base && same(local.monthlyBudget, base.monthlyBudget)
      ? remote.monthlyBudget
      : local.monthlyBudget;
  return { ...fields, items, monthlyBudget };
}

/**
 * Slår ihop en månads budget. base är den senaste versionen båda telefonerna kände till.
 * Saknas den räknas den andra telefonens version som base, och då vinner den här telefonen
 * allt som skiljer (samma som innan sammanslagningen fanns).
 */
export function mergeBudget(base: Category[] | undefined, local: Category[], remote: Category[]): Category[] {
  return mergeList(base ?? remote, local, remote, mergeCategory);
}
