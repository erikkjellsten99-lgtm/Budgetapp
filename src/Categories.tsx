import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { currentMonth, deleteCategory, newId, saveCategory } from './db';
import { formatKr, parseKr, toInputKr } from './money';
import { CATEGORY_TYPES, type Category, type CategoryItem, type CategoryType } from './types';

interface CategoriesProps {
  categories: Category[];
  /** Anropas efter varje ändring, så att App kan läsa in kategorierna igen. */
  onChanged: () => Promise<void>;
}

export default function Categories({ categories, onChanged }: CategoriesProps) {
  // Id på kategorin som redigeras, 'new' när en ny läggs till, annars null.
  const [editing, setEditing] = useState<string | null>(null);

  async function handleSave(category: Category) {
    await saveCategory(category);
    setEditing(null);
    await onChanged();
  }

  /** Sparar raderna och sätter kategorins budget till deras summa. */
  async function saveItems(category: Category, items: CategoryItem[]) {
    const monthlyBudget = items.reduce((sum, item) => sum + item.amount, 0);
    await saveCategory({ ...category, items, monthlyBudget: items.length ? monthlyBudget : category.monthlyBudget });
    await onChanged();
  }

  /** Lägger till en tom rad. Första gången blir kategorins nuvarande budget en egen rad, så att summan inte ändras. */
  async function addItem(category: Category) {
    const items = [...(category.items ?? [])];
    if (!items.length && category.monthlyBudget > 0) items.push({ id: newId(), name: 'Övrigt', amount: category.monthlyBudget });
    items.push({ id: newId(), name: '', amount: 0 });
    setFocusItem(items[items.length - 1].id);
    setOpen(category.id, true);
    await saveItems(category, items);
  }

  const [focusItem, setFocusItem] = useState<string | null>(null);

  // Vilka kategorier som är utfällda. Sparas bara på den här enheten.
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);

  function setOpen(id: string, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      saveExpanded(next);
      return next;
    });
  }

  /** Sparar ny ordning för kategorierna i en grupp. */
  async function reorderCategories(list: Category[]) {
    for (const [index, category] of list.entries()) {
      if (category.order !== index) await saveCategory({ ...category, order: index });
    }
    await onChanged();
  }

  /** Markerar kategorin som betald eller obetald denna månad. Har den rader gäller det alla rader. */
  async function togglePaid(category: Category) {
    const month = currentMonth();
    const paid = !isCategoryPaid(category);
    if (category.items?.length) {
      await saveItems(category, category.items.map((item) => ({ ...item, paidMonth: paid ? month : undefined })));
    } else {
      await saveCategory({ ...category, paidMonth: paid ? month : undefined });
      await onChanged();
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Ta bort kategorin ${category.name}?`)) return;
    if (await deleteCategory(category.id)) {
      setEditing(null);
      await onChanged();
    } else {
      alert(`${category.name} har transaktioner och kan inte tas bort.`);
    }
  }

  return (
    <>
      <h2>Kategorier</h2>
      <p className="hint">Månadsbudget per kategori. Tryck på en kategori för att visa raderna under den, på + för att lägga till en rad, och dra i ⠿ för att flytta en kategori eller rad.</p>

      {CATEGORY_TYPES.map(({ type, label }) => {
        const items = categories
          .filter((category) => category.type === type)
          .sort(byOrder);
        return (
          <section key={type} className="card">
            <h3>
              {label} <span>{formatKr(sumBudgets(items))}</span>
            </h3>
            {sumBudgets(items) > 0 && (
              <p className="paid-summary">
                Betalt {formatKr(sumPaid(items))} · kvar {formatKr(sumBudgets(items) - sumPaid(items))}
              </p>
            )}
            <SortableList
              items={items}
              listClass="category-list"
              onReorder={reorderCategories}
              renderItem={(category, categoryHandle) => (
                <>
                  {editing === category.id ? (
                    <CategoryForm
                      category={category}
                      onSave={handleSave}
                      onCancel={() => setEditing(null)}
                      onDelete={() => handleDelete(category)}
                    />
                  ) : (
                    <div className={isCategoryPaid(category) ? 'category-row paid' : 'category-row'}>
                      <PaidCheck
                        paid={isCategoryPaid(category)}
                        label={category.name}
                        onToggle={() => togglePaid(category)}
                      />
                      <button
                        className="row"
                        aria-expanded={expanded.has(category.id)}
                        onClick={() => setOpen(category.id, !expanded.has(category.id))}
                      >
                        <span>{category.name}</span>
                        <span className="row-amount">
                          {formatKr(category.monthlyBudget)}
                          <svg className={expanded.has(category.id) ? 'chevron open' : 'chevron'} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 10l4 4 4-4" />
                          </svg>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="item-add"
                        aria-label={`Lägg till rad under ${category.name}`}
                        onClick={() => addItem(category)}
                      >
                        +
                      </button>
                      {categoryHandle}
                    </div>
                  )}
                  {editing !== category.id && !!category.items?.length && expanded.has(category.id) && (
                    <SortableList
                      items={category.items}
                      listClass="items"
                      onReorder={(items) => saveItems(category, items)}
                      renderItem={(item, handle) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          handle={handle}
                          autoFocus={item.id === focusItem}
                          onChange={(changed) =>
                            saveItems(category, category.items!.map((other) => (other.id === item.id ? changed : other)))
                          }
                          onDelete={() => saveItems(category, category.items!.filter((other) => other.id !== item.id))}
                          onTogglePaid={() =>
                            saveItems(
                              category,
                              category.items!.map((other) =>
                                other.id === item.id
                                  ? { ...other, paidMonth: isPaid(other) ? undefined : currentMonth() }
                                  : other,
                              ),
                            )
                          }
                        />
                      )}
                    />
                  )}
                  {editing !== category.id && expanded.has(category.id) && (
                    <div className="category-actions">
                      <button type="button" className="link-button" onClick={() => addItem(category)}>
                        + Lägg till rad
                      </button>
                      <button type="button" className="link-button" onClick={() => setEditing(category.id)}>
                        Ändra namn och typ
                      </button>
                    </div>
                  )}
                </>
              )}
            />
            {editing === `new:${type}` ? (
              <div className="new-in-group">
                <CategoryForm defaultType={type} onSave={handleSave} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <button type="button" className="group-add" onClick={() => setEditing(`new:${type}`)}>
                + Ny kategori i {label.toLowerCase()}
              </button>
            )}
          </section>
        );
      })}

      <p className="total">
        <span>Totalt per månad</span>
        <strong>{formatKr(sumBudgets(categories))}</strong>
      </p>

    </>
  );
}

/** Sorterar efter vald ordning. Kategorier som aldrig flyttats hamnar sist, i bokstavsordning. */
function byOrder(a: Category, b: Category): number {
  return (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name, 'sv');
}

const EXPANDED_KEY = 'expandedCategories';

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveExpanded(ids: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
  } catch {
    // Lagring avstängd: utfällningen glöms när appen stängs, inget annat händer.
  }
}

/** Är posten markerad som betald denna månad? */
function isPaid(entry: { paidMonth?: string }): boolean {
  return entry.paidMonth === currentMonth();
}

/** En kategori är betald när den själv är markerad, eller när alla dess rader är det. */
function isCategoryPaid(category: Category): boolean {
  return category.items?.length ? category.items.every(isPaid) : isPaid(category);
}

/** Hur mycket som är betalt denna månad. */
export function sumPaid(categories: Category[]): number {
  return categories.reduce((sum, category) => {
    if (category.items?.length) return sum + category.items.filter(isPaid).reduce((s, item) => s + item.amount, 0);
    return sum + (isPaid(category) ? category.monthlyBudget : 0);
  }, 0);
}

/** Rund bock-knapp som markerar något som betalt denna månad. */
function PaidCheck({ paid, label, onToggle }: { paid: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={paid ? 'paid-check checked' : 'paid-check'}
      role="checkbox"
      aria-checked={paid}
      aria-label={`${label || 'Raden'} betald denna månad`}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        {paid && <path d="M8 12.5l2.7 2.7L16 9.8" />}
      </svg>
    </button>
  );
}

export function sumBudgets(categories: Category[]): number {
  return categories.reduce((sum, category) => sum + category.monthlyBudget, 0);
}

interface SortableListProps<T extends { id: string; name: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  /** CSS-klass för listan, t.ex. "items" för raderna under en kategori. */
  listClass: string;
}

/**
 * En lista där raderna kan flyttas genom att dra i handtaget (⠿): kategorier i en grupp och raderna under en kategori.
 * Byggt med pointer-händelser, så att det fungerar med finger, mus och penna utan bibliotek.
 */
function SortableList<T extends { id: string; name: string }>({ items, onReorder, renderItem, listClass }: SortableListProps<T>) {
  const [order, setOrder] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Följ ändringar utifrån (t.ex. från den andra telefonen) när ingen rad dras.
  useEffect(() => {
    if (!dragging) setOrder(items);
  }, [items, dragging]);

  // Senaste ordningen, så att lyssnarna nedan alltid ser den aktuella listan.
  const orderRef = useRef(order);
  orderRef.current = order;

  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    setDragging(id);
  }

  // Under dragningen lyssnar fönstret på fingret. Raden flyttas i listan medan man drar,
  // och då skulle en lyssnare på själva handtaget tappa fingret.
  useEffect(() => {
    if (!dragging) return;

    function move(event: globalThis.PointerEvent) {
      if (!listRef.current) return;
      event.preventDefault();
      const current = orderRef.current;
      const rows = [...listRef.current.children] as HTMLElement[];
      // Raden hamnar före första raden vars mitt ligger under fingret.
      let target = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      if (target === -1) target = rows.length;
      const from = current.findIndex((item) => item.id === dragging);
      // När raden flyttas nedåt försvinner den först från sin gamla plats, så platsen blir ett steg tidigare.
      const to = target > from ? target - 1 : target;
      if (to === from) return;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      setOrder(next);
    }

    function end() {
      setDragging(null);
      const final = orderRef.current;
      if (final.some((item, index) => item.id !== items[index]?.id)) onReorder(final);
    }

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging]);

  return (
    <ul className={dragging ? `${listClass} sorting` : listClass} ref={listRef}>
      {order.map((item) => (
        <li key={item.id} className={item.id === dragging ? 'item-wrap dragging' : 'item-wrap'}>
          {renderItem(
            item,
            <button
              type="button"
              className="item-handle"
              aria-label={`Flytta ${item.name || 'raden'}`}
              onPointerDown={(event) => start(event, item.id)}
              onKeyDown={(event) => {
                // Med tangentbord: pil upp/ned flyttar raden ett steg.
                const from = order.findIndex((other) => other.id === item.id);
                const to = event.key === 'ArrowUp' ? from - 1 : event.key === 'ArrowDown' ? from + 1 : -1;
                if (to < 0 || to >= order.length) return;
                event.preventDefault();
                const next = [...order];
                next.splice(to, 0, next.splice(from, 1)[0]);
                setOrder(next);
                onReorder(next);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="6" r="1.4" />
                <circle cx="15" cy="6" r="1.4" />
                <circle cx="9" cy="12" r="1.4" />
                <circle cx="15" cy="12" r="1.4" />
                <circle cx="9" cy="18" r="1.4" />
                <circle cx="15" cy="18" r="1.4" />
              </svg>
            </button>,
          )}
        </li>
      ))}
    </ul>
  );
}

interface ItemRowProps {
  item: CategoryItem;
  /** Handtaget som raden dras i. */
  handle: ReactNode;
  autoFocus: boolean;
  onChange: (item: CategoryItem) => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}

/** En rad under en kategori: namn och belopp som skrivs direkt i listan. Sparas medan du skriver. */
function ItemRow({ item, handle, autoFocus, onChange, onDelete, onTogglePaid }: ItemRowProps) {
  const [name, setName] = useState(item.name);
  const [amountText, setAmountText] = useState(toInputKr(item.amount));

  // Hämta nya värden om raden har ändrats på den andra telefonen.
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => {
    if (parseKr(amountText) !== item.amount) setAmountText(toInputKr(item.amount));
  }, [item.amount]);

  const amount = parseKr(amountText);
  const amountOk = Number.isFinite(amount) && amount >= 0;

  return (
    <div className={isPaid(item) ? 'item-row paid' : 'item-row'}>
      <PaidCheck paid={isPaid(item)} label={name} onToggle={onTogglePaid} />
      <input
        className="item-name"
        value={name}
        placeholder="Namn, t.ex. Claude"
        aria-label="Namn på raden"
        autoFocus={autoFocus}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => name !== item.name && onChange({ ...item, name: name.trim() })}
      />
      <input
        className="item-amount"
        value={amountText}
        placeholder="0"
        inputMode="decimal"
        aria-label={`Belopp för ${name || 'raden'}`}
        aria-invalid={!amountOk}
        onChange={(event) => {
          setAmountText(event.target.value);
          const next = parseKr(event.target.value);
          if (Number.isFinite(next) && next >= 0) onChange({ ...item, name: name.trim(), amount: next });
        }}
      />
      <button type="button" className="item-delete" aria-label={`Ta bort ${name || 'raden'}`} onClick={onDelete}>
        ×
      </button>
      {handle}
    </div>
  );
}

interface CategoryFormProps {
  /** Kategorin som ändras. Saknas när en ny läggs till. */
  category?: Category;
  /** Typ för en ny kategori, när den läggs till inifrån en grupp. */
  defaultType?: CategoryType;
  onSave: (category: Category) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function CategoryForm({ category, defaultType, onSave, onCancel, onDelete }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? defaultType ?? 'variable');
  const [budget, setBudget] = useState(
    toInputKr(category?.monthlyBudget),
  );

  const hasItems = !!category?.items?.length;
  const amount = parseKr(budget);
  const budgetOk = Number.isFinite(amount) && amount >= 0;
  const valid = name.trim() !== '' && budgetOk;

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave({ ...category, id: category?.id ?? newId(), name: name.trim(), type, monthlyBudget: amount });
      }}
    >
      <label>
        Namn
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus={!category} />
      </label>
      <label>
        Typ
        <select value={type} onChange={(event) => setType(event.target.value as CategoryType)}>
          {CATEGORY_TYPES.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Månadsbudget (kr){hasItems && ' – summan av raderna'}
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          disabled={hasItems}
        />
      </label>
      {!budgetOk && <p className="error">Skriv ett belopp, till exempel 1500 eller 49,90.</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={!valid}>
          Spara
        </button>
        <button type="button" onClick={onCancel}>
          Avbryt
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Ta bort
          </button>
        )}
      </div>
    </form>
  );
}
