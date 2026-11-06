import { useState } from 'react';
import { ItemRow, PaidCheck, SortableList, isPaid } from './Categories';
import { budgetMonth, deleteWish, getWishes, monthName, newId, saveWish } from './db';
import { formatKr } from './money';
import { offerUndo } from './undo';
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

/**
 * Delar en lista i önskningar som går att bocka den här månaden (inte köpta, eller köpta den här
 * månaden) och sådant som köptes en annan månad. Det som köptes en annan månad ligger kvar på
 * den månaden: det går inte att bocka i igen, så att den månadens utgifter inte ändras.
 */
export function splitWishes(items: Wish[], month: string): { open: Wish[]; bought: Wish[] } {
  const open = items.filter((wish) => !wish.paidMonth || wish.paidMonth === month);
  const bought = items
    .filter((wish) => wish.paidMonth && wish.paidMonth !== month)
    .sort((a, b) => b.paidMonth!.localeCompare(a.paidMonth!) || byOrder(a, b));
  return { open, bought };
}

/** Summan av det som inte är köpt (ingen månad alls). Det som är köpt, den här eller en annan månad, räknas inte. */
export function sumLeftToBuy(wishes: Wish[]): number {
  return wishes.filter((wish) => !wish.paidMonth).reduce((sum, wish) => sum + wish.amount, 0);
}

/** Något är köpt. Annars är "Kvar att köpa" samma som summan och visas inte. */
export function hasBought(wishes: Wish[]): boolean {
  return wishes.some((wish) => !!wish.paidMonth);
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

  /**
   * Bocken på en lista kryssar i alla saker som går att bocka den här månaden, eller kryssar ur
   * alla om alla redan är ikryssade. Sådant som köptes en annan månad rörs inte.
   */
  async function toggleList(items: Wish[]) {
    const checked = !items.every(isPaid);
    for (const wish of items) {
      const paidMonth = checked ? budgetMonth() : undefined;
      if (wish.paidMonth !== paidMonth) await saveWish({ ...wish, paidMonth });
    }
    await onChanged();
  }

  /** Köpt en annan månad, men inte köpt ändå: tillbaka på listan. Går att ångra. */
  async function unbuy(wish: Wish) {
    await save({ ...wish, paidMonth: undefined });
    offerUndo(`${wish.name.trim() || 'Önskan'} är tillbaka på listan`, () => save(wish));
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
        {hasBought(wishes) && <p className="paid-summary">Kvar att köpa: {formatKr(sumLeftToBuy(wishes))}</p>}
        <ul className="category-list">
          {WISH_LISTS.map(({ id, label }) => {
            const items = wishes.filter((wish) => wish.list === id).sort(byOrder);
            const { open: current, bought } = splitWishes(items, budgetMonth());
            const open = expanded.has(id);
            const allChecked = current.length > 0 && current.every(isPaid);
            return (
              <li key={id}>
                <div className={allChecked ? 'category-row paid' : 'category-row'}>
                  <PaidCheck paid={allChecked} label={label} onToggle={() => current.length && toggleList(current)} />
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
                {hasBought(items) && <p className="wish-left">Kvar att köpa: {formatKr(sumLeftToBuy(items))}</p>}
                {open && current.length > 0 && (
                  <SortableList
                    items={current}
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
                          // Senast sparade versionen, så att ett namn som just skrivits följer med vid Ångra.
                          const latest = (await getWishes()).find((other) => other.id === wish.id) ?? wish;
                          await deleteWish(wish.id);
                          await onChanged();
                          // Ångra sparar tillbaka önskan precis som den var (samma id, pris, plats och bock).
                          offerUndo(`${latest.name.trim() || 'Önskan'} togs bort`, () => save(latest));
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
                {open && bought.length > 0 && (
                  <details className="wish-bought">
                    <summary>Köpt andra månader ({bought.length})</summary>
                    <ul>
                      {bought.map((wish) => (
                        <li key={wish.id}>
                          <span className="wish-bought-name">
                            {wish.name.trim() || 'Utan namn'}
                            <small>Köpt {monthName(wish.paidMonth!)} · räknas den månaden</small>
                          </span>
                          <span className="wish-bought-amount">{formatKr(wish.amount)}</span>
                          <button
                            type="button"
                            className="link-button"
                            aria-label={`${wish.name.trim() || 'Önskan'} köptes inte, tillbaka på listan`}
                            onClick={() => unbuy(wish)}
                          >
                            Inte köpt
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
