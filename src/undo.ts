// "Ångra" efter en borttagning. Den som tar bort något erbjuder en ångra-funktion, och rutan
// längst ner (UndoToast) visar den en stund. Borttagningar medan rutan syns ångras tillsammans.

export interface UndoOffer {
  id: number;
  /** T.ex. "Netflix togs bort". */
  message: string;
  undo: () => Promise<void>;
  /** Antal borttagningar som ångras tillsammans. */
  count?: number;
}

/** Hur länge Ångra visas. */
export const UNDO_MS = 8000;

let current: UndoOffer | null = null;
let nextId = 1;
const listeners = new Set<(offer: UndoOffer | null) => void>();

function publish(offer: UndoOffer | null) {
  current = offer;
  for (const listener of listeners) listener(offer);
}

/**
 * Visar Ångra för en borttagning. Syns rutan redan (t.ex. två snabba tryck på ×) slås
 * borttagningarna ihop, och Ångra lägger tillbaka alla, den senaste först så att platserna stämmer.
 */
export function offerUndo(message: string, undo: () => Promise<void>): void {
  if (current) {
    const earlier = current;
    const count = (earlier.count ?? 1) + 1;
    publish({
      id: nextId++,
      message: `${count} saker togs bort`,
      count,
      undo: async () => {
        await undo();
        await earlier.undo();
      },
    });
    return;
  }
  publish({ id: nextId++, message, undo });
}

/** Lyssnar på vad som kan ångras. Svarar med en funktion som slutar lyssna. */
export function onUndoOffer(listener: (offer: UndoOffer | null) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/** Stänger rutan, men bara om det fortfarande är samma borttagning. */
export function dismissUndo(id: number): void {
  if (current?.id === id) publish(null);
}

/**
 * Ångrar borttagningen. Körs högst en gång, även vid dubbelklick: rutan stängs innan
 * ångringen börjar. Svarar false om den redan var ångrad eller ersatt.
 */
export async function runUndo(id: number): Promise<boolean> {
  if (current?.id !== id) return false;
  const { undo } = current;
  publish(null);
  await undo();
  return true;
}

/**
 * Lägger tillbaka en borttagen rad på samma plats. Finns raden redan (t.ex. ångrad
 * på annat sätt) ändras inget. Platsen begränsas till listans längd.
 */
export function restoreAt<T extends { id: string }>(list: T[], item: T, index: number): T[] {
  if (list.some((other) => other.id === item.id)) return list;
  const next = [...list];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}
