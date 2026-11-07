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
  /** Sant om värdet kommer från innehav (aktier, fonder) och inte skrivs in för hand. */
  fromHoldings?: boolean;
  /** Kontanter på kontot i kronor, vid sidan av innehaven. */
  cash?: number;
}

export type HoldingType = 'stock' | 'fund' | 'etf';

/** Ett innehav, t.ex. en aktie eller fond. Köp och sälj ligger som affärer. */
export interface Holding {
  id: string;
  name: string;
  type: HoldingType;
  /** Kurssymbol, t.ex. "VOLV-B.ST". */
  ticker?: string;
  /** Kontot (Asset) som innehavet ligger på. */
  assetId?: string;
  /** Kurs i kronor som skrivits in för hand. */
  manualPrice?: number;
  /** Datum för den inskrivna kursen, som "2026-10-18". */
  manualPriceDate?: string;
}

/** Ett köp eller en försäljning av ett innehav. */
export interface Trade {
  id: string;
  holdingId: string;
  /** Datum som "2026-10-18". */
  date: string;
  side: 'buy' | 'sell';
  /** Antal andelar, kan ha decimaler för fonder. */
  quantity: number;
  /** Pris per andel i kronor. */
  price: number;
  /** Courtage i kronor. */
  fee: number;
}

/** En stängningskurs en dag. */
export interface PricePoint {
  date: string;
  /** Stängningskurs i kronor. */
  close: number;
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

/**
 * Budgeten (kategorier och rader) för en enskild månad. Skapas första gången något ändras
 * i månaden. Månader utan egen budget utgår från närmaste tidigare månad som har en.
 */
export interface MonthBudget {
  /** Månad som "2026-12". Fungerar som nyckel. */
  month: string;
  categories: Category[];
}

/** Ett sparmål med prognos, t.ex. gemensamt sparande till 300 000 kr. */
export interface SavingsGoal {
  id: string;
  /** T.ex. "Gemensamt sparmål". */
  name: string;
  /** Målbelopp i kronor. */
  target: number;
  /** Hur mycket som sattes in varje månad, i kronor. Används inte längre: insättningen kommer från budgeten. */
  monthlyDeposit: number;
  /** Antagen avkastning per år i procent, t.ex. 7. */
  annualReturn: number;
  /** Tillgångarna (konton) vars saldo räknas mot målet. */
  assetIds: string[];
  /**
   * Budgetkategorierna (sparande) som går till målet varje månad. Saknas = de med
   * "gemensam" i namnet, t.ex. Gemensamt sparande.
   */
  categoryIds?: string[];
}

/** Vems önskelista en önskan står på. */
export type WishList = 'erik' | 'cassandra';

/** Önskelistornas namn, i den ordning de visas. */
export const WISH_LISTS: { id: WishList; label: string }[] = [
  { id: 'erik', label: 'Erik' },
  { id: 'cassandra', label: 'Cassandra' },
];

/** En sak på önskelistan. Är den ikryssad denna månad räknas den in i rörliga utgifter. */
export interface Wish {
  id: string;
  list: WishList;
  name: string;
  /** Pris i kronor. */
  amount: number;
  /** Månaden ("2026-10") då saken bockades i. Räknas bara in i rörliga utgifter den månaden. */
  paidMonth?: string;
  /** Plats i listan. */
  order?: number;
}
