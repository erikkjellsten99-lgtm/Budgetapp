/** Fast kostnad, rörlig kostnad eller sparande. */
export type CategoryType = 'fixed' | 'variable' | 'savings';

/** Kategorityperna i den ordning de visas, med svenska namn. */
export const CATEGORY_TYPES: { type: CategoryType; label: string }[] = [
  { type: 'fixed', label: 'Fasta utgifter' },
  { type: 'variable', label: 'Rörliga utgifter' },
  { type: 'savings', label: 'Sparande' },
];

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  /** Månadsbudget i kronor. Har kategorin rader är det summan av raderna. */
  monthlyBudget: number;
  /** Egna rader under kategorin, t.ex. Claude och ChatGPT under Övriga kostnader. */
  items?: CategoryItem[];
  /** Plats i gruppen (0 = överst). Saknas tills kategorin har flyttats. */
  order?: number;
  /** Månaden ("2026-10") då kategorin senast markerades som betald. Används när kategorin saknar rader. */
  paidMonth?: string;
}

/** En rad under en kategori. */
export interface CategoryItem {
  id: string;
  name: string;
  /** Belopp per månad i kronor. */
  amount: number;
  /** Månaden ("2026-10") då raden senast markerades som betald. Nästa månad är den obetald igen. */
  paidMonth?: string;
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
  /** Pengar som ska användas, t.ex. matpengar på hushållskontot. Räknas inte i nettovärdet. */
  spending?: boolean;
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

/** Ett sparmål med prognos, t.ex. gemensamt sparande till 300 000 kr. */
export interface SavingsGoal {
  id: string;
  /** T.ex. "Gemensamt sparmål". */
  name: string;
  /** Målbelopp i kronor. */
  target: number;
  /** Hur mycket som sätts in varje månad, i kronor. */
  monthlyDeposit: number;
  /** Antagen avkastning per år i procent, t.ex. 7. */
  annualReturn: number;
  /** Tillgångarna (konton) vars saldo räknas mot målet. */
  assetIds: string[];
}
