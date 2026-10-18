import { useEffect, useState } from 'react';
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
    await saveItems(category, items);
  }

  const [focusItem, setFocusItem] = useState<string | null>(null);

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
      <p className="hint">Månadsbudget per kategori. Tryck på en kategori för att ändra den, eller på + för att lägga till egna rader under den.</p>

      {CATEGORY_TYPES.map(({ type, label }) => {
        const items = categories
          .filter((category) => category.type === type)
          .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
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
            <ul>
              {items.map((category) => (
                <li key={category.id}>
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
                      <button className="row" onClick={() => setEditing(category.id)}>
                        <span>{category.name}</span>
                        <span>{formatKr(category.monthlyBudget)}</span>
                      </button>
                      <button
                        type="button"
                        className="item-add"
                        aria-label={`Lägg till rad under ${category.name}`}
                        onClick={() => addItem(category)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {editing !== category.id && !!category.items?.length && (
                    <ul className="items">
                      {category.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
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
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="total">
        <span>Totalt per månad</span>
        <strong>{formatKr(sumBudgets(categories))}</strong>
      </p>

      {editing === 'new' ? (
        <section className="card">
          <h3>Ny kategori</h3>
          <CategoryForm onSave={handleSave} onCancel={() => setEditing(null)} />
        </section>
      ) : (
        <button className="add" onClick={() => setEditing('new')}>
          + Ny kategori
        </button>
      )}
    </>
  );
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

interface ItemRowProps {
  item: CategoryItem;
  autoFocus: boolean;
  onChange: (item: CategoryItem) => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}

/** En rad under en kategori: namn och belopp som skrivs direkt i listan. Sparas medan du skriver. */
function ItemRow({ item, autoFocus, onChange, onDelete, onTogglePaid }: ItemRowProps) {
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
    <li className={isPaid(item) ? 'item-row paid' : 'item-row'}>
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
    </li>
  );
}

interface CategoryFormProps {
  /** Kategorin som ändras. Saknas när en ny läggs till. */
  category?: Category;
  onSave: (category: Category) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function CategoryForm({ category, onSave, onCancel, onDelete }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? 'variable');
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
