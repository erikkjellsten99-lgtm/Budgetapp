/** Fast kostnad, rörlig kostnad eller sparande. */
export type CategoryType = 'fixed' | 'variable' | 'savings';

/** Kategorityperna i den ordning de visas, med svenska namn. */
export const CATEGORY_TYPES: { type: CategoryType; label: string }[] = [
  { type: 'fixed', label: 'Fast' },
  { type: 'variable', label: 'Rörlig' },
  { type: 'savings', label: 'Sparande' },
];

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  /** Månadsbudget i kronor. */
  monthlyBudget: number;
}

export interface Transaction {
  id: string;
  /** Datum som "2026-10-15". */
  date: string;
  /** Utgift i kronor. */
  amount: number;
  categoryId: string;
  note: string;
}

/** Pengar du är skyldig någon. */
export interface Debt {
  id: string;
  /** Vem du är skyldig, t.ex. "Mamma". */
  name: string;
  /** Kvar att betala i kronor. */
  amount: number;
}

/** Något du äger, t.ex. ett sparkonto. Saldot uppdaterar du själv. */
export interface Asset {
  id: string;
  /** T.ex. "Avanza (gemensamt)". */
  name: string;
  /** Saldo i kronor. */
  amount: number;
  /** Datum då saldot senast uppdaterades, som "2026-10-18". Tomt om det aldrig har fyllts i. */
  updated: string;
}

/** Inkomsten för en månad. Det finns högst en post per månad. */
export interface MonthlyIncome {
  /** Månad som "2026-10". Fungerar som nyckel. */
  month: string;
  /** CSN i kronor. */
  csn: number;
  /** Övriga inkomster i kronor. */
  other: number;
}
