import type { Category, Debt, MonthlyIncome, Transaction } from './types';

const DB_NAME = 'budget';
const DB_VERSION = 3;

type StoreName = 'categories' | 'transactions' | 'income' | 'debts';

/** 5 000 kr var till eget sparande. */
const SEPARATE_SAVINGS = 10000;

/** Din budget. Läggs in när databasen skapas, sedan kan du ändra allt i appen. */
const MY_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 8000 },
  { name: 'Telefoni', type: 'fixed', monthlyBudget: 2166 },
  { name: 'Försäkringar', type: 'fixed', monthlyBudget: 2072 },
  { name: 'Billån', type: 'fixed', monthlyBudget: 1586 },
  { name: 'Abonnemang', type: 'fixed', monthlyBudget: 1701 },
  { name: 'Övriga kostnader', type: 'fixed', monthlyBudget: 5625 },
  { name: 'Gemensamt sparande', type: 'savings', monthlyBudget: 0 },
  { name: 'Separat sparande', type: 'savings', monthlyBudget: SEPARATE_SAVINGS },
  { name: 'Lsfk', type: 'savings', monthlyBudget: 0 },
];

const MY_DEBTS: Omit<Debt, 'id'>[] = [
  { name: 'Mamma', amount: 17183 },
  { name: 'Filip', amount: 1000 },
];

const MY_INCOME = { csn: 18156, other: 29852 };

export function newId(): string {
  // randomUUID finns bara över https och på localhost, inte när mobilen når datorn via http.
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Innevarande månad som "2026-10". */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Körs när databasen skapas, och när DB_VERSION har höjts sedan appen användes senast.
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;

      if (event.oldVersion < 1) {
        db.createObjectStore('categories', { keyPath: 'id' });
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('date', 'date');
        transactions.createIndex('categoryId', 'categoryId');
        db.createObjectStore('income', { keyPath: 'month' });
      }

      if (event.oldVersion < 2) {
        const debts = db.createObjectStore('debts', { keyPath: 'id' });
        for (const debt of MY_DEBTS) debts.add({ ...debt, id: newId() });

        tx.objectStore('income').put({ month: currentMonth(), ...MY_INCOME });

        // Byt de gamla standardkategorierna mot din budget, men bara om du inte har ändrat i dem.
        const categories = tx.objectStore('categories');
        const existing = categories.getAll();
        existing.onsuccess = () => {
          if ((existing.result as Category[]).every((category) => category.monthlyBudget === 0)) {
            categories.clear();
            for (const category of MY_CATEGORIES) categories.add({ ...category, id: newId() });
          }
        };
      }

      if (event.oldVersion >= 2 && event.oldVersion < 3) {
        // Lägg in 5 000 kr var på separat sparande, om du inte redan har fyllt i ett belopp där.
        const categories = tx.objectStore('categories');
        const existing = categories.getAll();
        existing.onsuccess = () => {
          for (const category of existing.result as Category[]) {
            if (category.name === 'Separat sparande' && category.monthlyBudget === 0) {
              categories.put({ ...category, monthlyBudget: SEPARATE_SAVINGS });
            }
          }
        };
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

/**
 * Inkomsten för en månad ("2026-10"). Är månaden inte ifylld används den senaste
 * tidigare månaden som utgångsläge, så att du slipper skriva in samma belopp varje månad.
 */
export async function getIncome(month: string): Promise<MonthlyIncome> {
  const earlier = (await read('income', (store) => store.getAll(IDBKeyRange.upperBound(month)))) as MonthlyIncome[];
  const latest = earlier.at(-1);
  return { month, csn: latest?.csn ?? 0, other: latest?.other ?? 0 };
}

export function saveIncome(income: MonthlyIncome): Promise<void> {
  return write('income', (store) => store.put(income));
}

// Skulder

export function getDebts(): Promise<Debt[]> {
  return read('debts', (store) => store.getAll());
}

export function saveDebt(debt: Debt): Promise<void> {
  return write('debts', (store) => store.put(debt));
}

export function deleteDebt(id: string): Promise<void> {
  return write('debts', (store) => store.delete(id));
}
