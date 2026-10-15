import type { Category, MonthlyIncome, Transaction } from './types';

const DB_NAME = 'budget';
const DB_VERSION = 1;

type StoreName = 'categories' | 'transactions' | 'income';

/** Läggs in när databasen skapas första gången. Sedan kan du ändra dem fritt i appen. */
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Boende', type: 'fixed', monthlyBudget: 0 },
  { name: 'Mat', type: 'variable', monthlyBudget: 0 },
  { name: 'Transport', type: 'variable', monthlyBudget: 0 },
  { name: 'Nöje', type: 'variable', monthlyBudget: 0 },
  { name: 'Abonnemang', type: 'fixed', monthlyBudget: 0 },
  { name: 'Sparande', type: 'savings', monthlyBudget: 0 },
  { name: 'Övrigt', type: 'variable', monthlyBudget: 0 },
];

export function newId(): string {
  // randomUUID finns bara över https och på localhost, inte när mobilen når datorn via http.
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Körs när databasen skapas, och senare när DB_VERSION höjs.
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const categories = db.createObjectStore('categories', { keyPath: 'id' });
        for (const category of DEFAULT_CATEGORIES) categories.add({ ...category, id: newId() });

        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('date', 'date');
        transactions.createIndex('categoryId', 'categoryId');

        db.createObjectStore('income', { keyPath: 'month' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function read<T>(storeName: StoreName, query: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = query(db.transaction(storeName).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Gör en ändring och väntar tills den är sparad. */
async function write(storeName: StoreName, change: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    change(tx.objectStore(storeName));
    tx.oncomplete = () => resolve();
    // Ett fel avbryter transaktionen, så det räcker att lyssna på onabort.
    tx.onabort = () => reject(tx.error);
  });
}

// Kategorier

export function getCategories(): Promise<Category[]> {
  return read('categories', (store) => store.getAll());
}

export function saveCategory(category: Category): Promise<void> {
  return write('categories', (store) => store.put(category));
}

/** Tar bort kategorin och svarar true, eller låter bli och svarar false om den har transaktioner. */
export async function deleteCategory(id: string): Promise<boolean> {
  const count = await read('transactions', (store) => store.index('categoryId').count(id));
  if (count > 0) return false;
  await write('categories', (store) => store.delete(id));
  return true;
}

// Transaktioner

/** Alla transaktioner i en månad ("2026-10"), sorterade på datum. */
export function getTransactions(month: string): Promise<Transaction[]> {
  return read('transactions', (store) =>
    store.index('date').getAll(IDBKeyRange.bound(`${month}-01`, `${month}-31`)),
  );
}

export function saveTransaction(transaction: Transaction): Promise<void> {
  return write('transactions', (store) => store.put(transaction));
}

export function deleteTransaction(id: string): Promise<void> {
  return write('transactions', (store) => store.delete(id));
}

// Inkomst

/** Inkomsten för en månad ("2026-10"), eller undefined om den inte är ifylld. */
export function getIncome(month: string): Promise<MonthlyIncome | undefined> {
  return read('income', (store) => store.get(month));
}

export function saveIncome(income: MonthlyIncome): Promise<void> {
  return write('income', (store) => store.put(income));
}
