import type { Loan } from './forecast';
import type { Asset, Category, Debt, MonthBudget, MonthlyIncome, SavingsGoal, Transaction, Wish } from './types';

const DB_NAME = 'budget';
const DB_VERSION = 11;

/** Listorna med appens data. Det är dessa som synkas mellan telefonerna. */
export const DATA_STORES = ['categories', 'budgets', 'transactions', 'income', 'debts', 'assets', 'goals', 'wishes', 'loans'] as const;
export type DataStore = (typeof DATA_STORES)[number];
type StoreName = DataStore | 'outbox' | 'meta';

/** En lokal ändring som väntar på att skickas till servern. Bara den senaste per post sparas. */
export interface OutboxEntry {
  /** "store:id" */
  key: string;
  store: DataStore;
  id: string;
  /** Posten, eller null om den är borttagen. */
  data: unknown;
  deleted: boolean;
  /** När ändringen gjordes (ms). Den senaste ändringen vinner om två ändrar samma post. */
  ts: number;
}

/** Nyckeln för en post: inkomster och månadsbudgetar nycklas på månad, allt annat på id. */
function keyOf(store: DataStore, record: Record<string, unknown>): string {
  return String(store === 'income' || store === 'budgets' ? record.month : record.id);
}

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

/** Hushållskontot är dit matpengarna sätts in. */
const SPENDING_ACCOUNT = 'Hushållskonto';
const MY_ACCOUNTS = [SPENDING_ACCOUNT, 'Erik spar', 'Cassandra spar'];

const MY_INCOME = { csn: 18156, other: 29852 };

/** Billånet 2026-10-25: 100 000 kr kvar, 1 586 kr/mån varav 750 kr amortering (≈ 10 % ränta). */
const MY_CAR_LOAN: Loan = {
  id: 'billan',
  name: 'Billån',
  balance: 100000,
  annualRate: 10,
  monthlyPayment: 1586,
  amortization: 750,
  categoryName: 'Billån',
  startMonth: '2026-11',
  payExtra: true,
};

/** Det gemensamma sparmålet. Räknar konton med "gemensam" i namnet, t.ex. Avanza (gemensamt). */
const MY_GOAL = { name: 'Gemensamt sparmål', target: 300000, monthlyDeposit: 0, annualReturn: 7 };

export function newId(): string {
  // randomUUID finns bara över https och på localhost, inte när mobilen når datorn via http.
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Innevarande månad som "2026-10". */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Månaden flyttad ett antal steg, t.ex. shiftMonth("2026-12", 1) = "2027-01". */
export function shiftMonth(month: string, steps: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + steps;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** "2026-10" som "oktober 2026". */
export function monthName(month: string): string {
  return new Date(`${month}-01T12:00`).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}

const BUDGET_MONTH_KEY = 'budgetMonth';
let selectedMonth: string | undefined;

/**
 * Månaden som budgeten visar (inkomst, betalt-markeringar, önskelistan).
 * Väljs med pilarna på översikten och sparas. Har den sparade månaden passerat
 * när appen öppnas börjar den på innevarande månad, så att den aldrig fastnar på en gammal.
 */
export function budgetMonth(): string {
  if (selectedMonth) return selectedMonth;
  const now = currentMonth();
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(BUDGET_MONTH_KEY);
  } catch {
    // Lagring avstängd: visa innevarande månad.
  }
  selectedMonth = saved && /^\d{4}-\d{2}$/.test(saved) && saved > now ? saved : now;
  return selectedMonth;
}

export function setBudgetMonth(month: string): void {
  selectedMonth = month;
  try {
    if (month > currentMonth()) localStorage.setItem(BUDGET_MONTH_KEY, month);
    else localStorage.removeItem(BUDGET_MONTH_KEY);
  } catch {
    // Lagring avstängd: valet gäller bara tills appen stängs.
  }
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

      if (event.oldVersion < 4) {
        const assets = db.createObjectStore('assets', { keyPath: 'id' });
        assets.add({ id: newId(), name: 'Avanza (gemensamt)', amount: 0, updated: '' });
      }

      if (event.oldVersion < 5) {
        // Fler konton. Läggs bara till om det inte redan finns ett konto med samma namn.
        const assets = tx.objectStore('assets');
        const existing = assets.getAll();
        existing.onsuccess = () => {
          const names = (existing.result as Asset[]).map((asset) => asset.name.toLowerCase());
          for (const name of MY_ACCOUNTS) {
            if (!names.includes(name.toLowerCase())) {
              assets.add({ id: newId(), name, amount: 0, updated: '', spending: name === SPENDING_ACCOUNT });
            }
          }
        };
      }

      if (event.oldVersion >= 5 && event.oldVersion < 6) {
        // Hushållskontot är matpengar, inte sparande, och ska inte räknas i nettovärdet.
        const assets = tx.objectStore('assets');
        const existing = assets.getAll();
        existing.onsuccess = () => {
          for (const asset of existing.result as Asset[]) {
            if (asset.name.toLowerCase() === SPENDING_ACCOUNT.toLowerCase()) assets.put({ ...asset, spending: true });
          }
        };
      }

      if (event.oldVersion < 7) {
        const goals = db.createObjectStore('goals', { keyPath: 'id' });
        const existing = tx.objectStore('assets').getAll();
        existing.onsuccess = () => {
          const assetIds = (existing.result as Asset[])
            .filter((asset) => asset.name.toLowerCase().includes('gemensam'))
            .map((asset) => asset.id);
          goals.add({ ...MY_GOAL, id: newId(), assetIds });
        };
      }

      if (event.oldVersion < 8) {
        db.createObjectStore('outbox', { keyPath: 'key' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }

      if (event.oldVersion < 9) {
        db.createObjectStore('wishes', { keyPath: 'id' });
      }

      if (event.oldVersion < 10) {
        // Budget per månad. Den gamla listan 'categories' ligger kvar som utgångsläge
        // för månader före den första egna månadsbudgeten.
        db.createObjectStore('budgets', { keyPath: 'month' });
      }

      if (event.oldVersion < 11) {
        // Lån med avbetalningsplan, för prognosen. Billånet läggs in med ett fast id,
        // så att båda telefonerna skapar samma post och synken inte ger dubbletter.
        const loans = db.createObjectStore('loans', { keyPath: 'id' });
        loans.put(MY_CAR_LOAN);
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

/** Sparar en post lokalt och köar den för synk. */
async function putRecord(store: DataStore, record: object): Promise<void> {
  const db = await openDb();
  const id = keyOf(store, record as Record<string, unknown>);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([store, 'outbox'], 'readwrite');
    tx.objectStore(store).put(record);
    const entry: OutboxEntry = { key: `${store}:${id}`, store, id, data: record, deleted: false, ts: Date.now() };
    tx.objectStore('outbox').put(entry);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  emit('local');
}

/** Tar bort en post lokalt och köar borttagningen för synk. */
async function removeRecord(store: DataStore, id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([store, 'outbox'], 'readwrite');
    tx.objectStore(store).delete(id);
    const entry: OutboxEntry = { key: `${store}:${id}`, store, id, data: null, deleted: true, ts: Date.now() };
    tx.objectStore('outbox').put(entry);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  emit('local');
}

// Ändringar: 'local' när något ändrats här, 'remote' när synken har hämtat ändringar från servern.

type ChangeKind = 'local' | 'remote';
const listeners = new Set<(kind: ChangeKind) => void>();

/** Lyssnar på ändringar i datan. Svarar med en funktion som slutar lyssna. */
export function onDataChange(listener: (kind: ChangeKind) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(kind: ChangeKind) {
  for (const listener of listeners) listener(kind);
}

// För synken

export async function getOutbox(): Promise<OutboxEntry[]> {
  return read('outbox', (store) => store.getAll()) as Promise<OutboxEntry[]>;
}

/** Tar bort skickade ändringar ur kön, men bara om posten inte har ändrats igen under tiden. */
export async function clearOutbox(sent: OutboxEntry[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const outbox = tx.objectStore('outbox');
    for (const entry of sent) {
      const current = outbox.get(entry.key);
      current.onsuccess = () => {
        if ((current.result as OutboxEntry | undefined)?.ts === entry.ts) outbox.delete(entry.key);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

/** Alla lokala poster i alla listor, för första uppladdningen till ett nytt hushåll. */
export async function getAllRecords(): Promise<{ store: DataStore; id: string; data: unknown }[]> {
  const all = [];
  for (const store of DATA_STORES) {
    const records = (await read(store, (s) => s.getAll())) as Record<string, unknown>[];
    for (const record of records) all.push({ store, id: keyOf(store, record), data: record });
  }
  return all;
}

export interface RemoteRecord {
  store: string;
  id: string;
  data: unknown;
  deleted: boolean;
}

/**
 * Lägger in ändringar från servern. Poster som har en ändring här som inte skickats än hoppas över,
 * de skickas strax och servern avgör vilken som är nyast. Med replace töms listorna först
 * (används när en ny telefon går med i ett hushåll som redan har data).
 */
export async function applyRemote(rows: RemoteRecord[], replace = false): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...DATA_STORES, 'outbox'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    if (replace) {
      for (const store of DATA_STORES) tx.objectStore(store).clear();
      outbox.clear();
    }
    for (const row of rows) {
      if (!(DATA_STORES as readonly string[]).includes(row.store)) continue;
      const store = tx.objectStore(row.store);
      const pending = outbox.get(`${row.store}:${row.id}`);
      pending.onsuccess = () => {
        if (pending.result) return;
        if (row.deleted || row.data == null) store.delete(row.id);
        else store.put(row.data);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  emit('remote');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = (await read('meta', (store) => store.get(key))) as { key: string; value: T } | undefined;
  return row?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await write('meta', (store) => (value === undefined ? store.delete(key) : store.put({ key, value })));
}

// Budget per månad

/** Budgeten som gäller en månad, och varifrån den kommer. */
export interface BudgetForMonth {
  categories: Category[];
  /**
   * Månaden budgeten är sparad på. Samma som den valda månaden när månaden har en egen budget,
   * en tidigare månad när den ärvs, eller null när den kommer från tiden före budget per månad.
   */
  from: string | null;
}

/**
 * Budgeten för en månad ("2026-12"). Har månaden ingen egen budget används närmaste
 * tidigare månad som har en, så att du slipper fylla i samma sak varje månad.
 */
export async function getBudget(month: string): Promise<BudgetForMonth> {
  const earlier = (await read('budgets', (store) => store.getAll(IDBKeyRange.upperBound(month)))) as MonthBudget[];
  const latest = earlier.at(-1);
  if (latest) return { categories: latest.categories, from: latest.month };
  return { categories: await read('categories', (store) => store.getAll()), from: null };
}

// Ändringar körs en i taget, så att snabba ändringar (t.ex. medan du skriver ett belopp)
// alltid bygger på den senast sparade budgeten och inte skriver över varandra.
let budgetQueue: Promise<unknown> = Promise.resolve();

/**
 * Ändrar budgeten för en månad. Första ändringen ger månaden en egen kopia,
 * så att andra månader inte påverkas.
 */
export function updateBudget(month: string, change: (categories: Category[]) => Category[]): Promise<void> {
  const next = budgetQueue.then(async () => {
    const { categories } = await getBudget(month);
    await putRecord('budgets', { month, categories: change(categories) } satisfies MonthBudget);
  });
  budgetQueue = next.catch(() => undefined);
  return next;
}

/** Sparar en kategori (ny eller ändrad) i månadens budget. */
export function saveCategory(month: string, category: Category): Promise<void> {
  return updateBudget(month, (categories) =>
    categories.some((other) => other.id === category.id)
      ? categories.map((other) => (other.id === category.id ? category : other))
      : [...categories, category],
  );
}

/** Sparar flera ändrade kategorier i månadens budget på en gång, t.ex. en ny ordning. */
export function saveCategories(month: string, changed: Category[]): Promise<void> {
  const byId = new Map(changed.map((category) => [category.id, category]));
  return updateBudget(month, (categories) => categories.map((category) => byId.get(category.id) ?? category));
}

/** Tar bort en kategori ur månadens budget. Andra månader behåller den. */
export function deleteCategory(month: string, id: string): Promise<void> {
  return updateBudget(month, (categories) => categories.filter((category) => category.id !== id));
}

// Transaktioner

/** Alla transaktioner i en månad ("2026-10"), sorterade på datum. */
export function getTransactions(month: string): Promise<Transaction[]> {
  return read('transactions', (store) =>
    store.index('date').getAll(IDBKeyRange.bound(`${month}-01`, `${month}-31`)),
  );
}

export function saveTransaction(transaction: Transaction): Promise<void> {
  return putRecord('transactions', transaction);
}

export function deleteTransaction(id: string): Promise<void> {
  return removeRecord('transactions', id);
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

/** Alla ifyllda inkomstmånader (utan ärvda), t.ex. för prognosen. */
export function getIncomeRecords(): Promise<MonthlyIncome[]> {
  return read('income', (store) => store.getAll());
}

export function saveIncome(income: MonthlyIncome): Promise<void> {
  return putRecord('income', income);
}

// Skulder

export function getDebts(): Promise<Debt[]> {
  return read('debts', (store) => store.getAll());
}

export function saveDebt(debt: Debt): Promise<void> {
  return putRecord('debts', debt);
}

export function deleteDebt(id: string): Promise<void> {
  return removeRecord('debts', id);
}

// Tillgångar

export function getAssets(): Promise<Asset[]> {
  return read('assets', (store) => store.getAll());
}

export function saveAsset(asset: Asset): Promise<void> {
  return putRecord('assets', asset);
}

export function deleteAsset(id: string): Promise<void> {
  return removeRecord('assets', id);
}

// Önskelista

export function getWishes(): Promise<Wish[]> {
  return read('wishes', (store) => store.getAll()) as Promise<Wish[]>;
}

export function saveWish(wish: Wish): Promise<void> {
  return putRecord('wishes', wish);
}

export function deleteWish(id: string): Promise<void> {
  return removeRecord('wishes', id);
}

// Sparmål

// Lån

export function getLoans(): Promise<Loan[]> {
  return read('loans', (store) => store.getAll());
}

export function saveLoan(loan: Loan): Promise<void> {
  return putRecord('loans', loan);
}

export function getGoals(): Promise<SavingsGoal[]> {
  return read('goals', (store) => store.getAll());
}

export function saveGoal(goal: SavingsGoal): Promise<void> {
  return putRecord('goals', goal);
}

/** Dagens datum som "2026-10-18". */
export function today(): string {
  const now = new Date();
  return `${currentMonth()}-${String(now.getDate()).padStart(2, '0')}`;
}
