import { useState } from 'react';
import { ItemRow, PaidCheck, SortableList, isPaid } from './Categories';
import { budgetMonth, deleteWish, newId, saveWish } from './db';
import { formatKr } from './money';
import { WISH_LISTS, type Wish, type WishList } from './types';

interface WishlistProps {
  wishes: Wish[];
  /** Anropas efter varje ändring, så att App kan läsa in önskelistan och summorna igen. */
  onChanged: () => Promise<void>;
}

/** Summan av det som är ikryssat denna månad. Det räknas in i rörliga utgifter. */
export function sumCheckedWishes(wishes: Wish[]): number {
  return wishes.filter(isPaid).reduce((sum, wish) => sum + wish.amount, 0);
}

function byOrder(a: Wish, b: Wish): number {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'sv');
}

const EXPANDED_KEY = 'expandedWishlists';

/** Vilka listor som är utfällda. Båda är utfällda från början. Sparas bara på den här enheten. */
function loadExpanded(): Set<WishList> {
  try {
    const saved = localStorage.getItem(EXPANDED_KEY);
    if (saved) return new Set(JSON.parse(saved) as WishList[]);
  } catch {
    // Lagring avstängd: visa båda listorna.
  }
  return new Set(WISH_LISTS.map((list) => list.id));
}

/** Önskelistan: en lista för Erik och en för Cassandra. Ikryssade saker räknas in i rörliga utgifter. */
export default function Wishlist({ wishes, onChanged }: WishlistProps) {
  const [expanded, setExpanded] = useState<Set<WishList>>(loadExpanded);
  const [focus, setFocus] = useState<string | null>(null);

  function setOpen(list: WishList, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(list);
      else next.delete(list);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {
        // Inget att göra, valet glöms bara när appen stängs.
      }
      return next;
    });
  }

  async function save(wish: Wish) {
    await saveWish(wish);
    await onChanged();
  }

  async function add(list: WishList, items: Wish[]) {
    const wish: Wish = { id: newId(), list, name: '', amount: 0, order: items.length };
    setFocus(wish.id);
    setOpen(list, true);
    await save(wish);
  }

  /** Bocken på en lista kryssar i alla saker på den, eller kryssar ur alla om alla redan är ikryssade. */
  async function toggleList(items: Wish[]) {
    const checked = !items.every(isPaid);
    for (const wish of items) await saveWish({ ...wish, paidMonth: checked ? budgetMonth() : undefined });
    await onChanged();
  }

  async function reorder(items: Wish[]) {
    for (const [index, wish] of items.entries()) {
      if (wish.order !== index) await saveWish({ ...wish, order: index });
    }
    await onChanged();
  }

  const checkedTotal = sumCheckedWishes(wishes);
  const total = wishes.reduce((sum, wish) => sum + wish.amount, 0);

  return (
    <>
      <h2>Önskelista</h2>
      <p className="hint">
        Bocka i det ni köper. Det som är ikryssat räknas in i rörliga utgifter den här månaden. Tryck på ett namn för
        att fälla in eller ut listan.
      </p>

      <section className="card">
        <h3>
          Önskningar <span>{formatKr(total)}</span>
        </h3>
        <p className="paid-summary">
          {checkedTotal > 0
            ? `Ikryssat ${formatKr(checkedTotal)} · räknas i rörliga utgifter`
            : 'Inget ikryssat den här månaden'}
        </p>
        <ul className="category-list">
          {WISH_LISTS.map(({ id, label }) => {
            const items = wishes.filter((wish) => wish.list === id).sort(byOrder);
            const open = expanded.has(id);
            const allChecked = items.length > 0 && items.every(isPaid);
            return (
              <li key={id}>
                <div className={allChecked ? 'category-row paid' : 'category-row'}>
                  <PaidCheck paid={allChecked} label={label} onToggle={() => items.length && toggleList(items)} />
                  <button className="row" aria-expanded={open} onClick={() => setOpen(id, !open)}>
                    <span>{label}</span>
                    <span className="row-amount">
                      {formatKr(items.reduce((sum, wish) => sum + wish.amount, 0))}
                      <svg className={open ? 'chevron open' : 'chevron'} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 10l4 4 4-4" />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="item-add"
                    aria-label={`Lägg till önskan för ${label}`}
                    onClick={() => add(id, items)}
                  >
                    +
                  </button>
                </div>
                {open && items.length > 0 && (
                  <SortableList
                    items={items}
                    listClass="items"
                    onReorder={reorder}
                    renderItem={(wish, handle) => (
                      <ItemRow
                        key={wish.id}
                        item={wish}
                        handle={handle}
                        placeholder="Vad önskar du?"
                        autoFocus={wish.id === focus}
                        onChange={(changed) => save({ ...wish, name: changed.name, amount: changed.amount })}
                        onDelete={async () => {
                          await deleteWish(wish.id);
                          await onChanged();
                        }}
                        onTogglePaid={() => save({ ...wish, paidMonth: isPaid(wish) ? undefined : budgetMonth() })}
                      />
                    )}
                  />
                )}
                {open && (
                  <div className="category-actions">
                    <button type="button" className="link-button" onClick={() => add(id, items)}>
                      + Lägg till önskan
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
