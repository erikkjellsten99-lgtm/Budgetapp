import { useEffect, useState } from 'react';
import { deleteCategory, getCategories, newId, saveCategory } from './db';
import { formatKr, parseKr } from './money';
import { CATEGORY_TYPES, type Category, type CategoryType } from './types';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  // Id på kategorin som redigeras, 'new' när en ny läggs till, annars null.
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setCategories(await getCategories());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSave(category: Category) {
    await saveCategory(category);
    setEditing(null);
    await reload();
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Ta bort kategorin ${category.name}?`)) return;
    if (await deleteCategory(category.id)) {
      setEditing(null);
      await reload();
    } else {
      alert(`${category.name} har transaktioner och kan inte tas bort.`);
    }
  }

  return (
    <>
      <h2>Kategorier</h2>
      <p className="hint">Månadsbudget per kategori. Tryck på en kategori för att ändra den.</p>

      {CATEGORY_TYPES.map(({ type, label }) => {
        const items = categories
          .filter((category) => category.type === type)
          .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        return (
          <section key={type} className="card">
            <h3>
              {label} <span>{formatKr(sumBudgets(items))}</span>
            </h3>
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
                    <button className="row" onClick={() => setEditing(category.id)}>
                      <span>{category.name}</span>
                      <span>{formatKr(category.monthlyBudget)}</span>
                    </button>
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

function sumBudgets(categories: Category[]): number {
  return categories.reduce((sum, category) => sum + category.monthlyBudget, 0);
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
    category?.monthlyBudget ? String(category.monthlyBudget).replace('.', ',') : '',
  );

  const amount = parseKr(budget);
  const budgetOk = Number.isFinite(amount) && amount >= 0;
  const valid = name.trim() !== '' && budgetOk;

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave({ id: category?.id ?? newId(), name: name.trim(), type, monthlyBudget: amount });
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
        Månadsbudget (kr)
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          inputMode="decimal"
          placeholder="0"
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
