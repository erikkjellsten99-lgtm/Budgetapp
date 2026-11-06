// Prognos månad för månad: inkomster, kostnader, billån och sparande framåt i tiden.
// Rena funktioner utan databas, så att de går att testa (forecast.test.ts).

/** Ett lån med avbetalningsplan, t.ex. billånet. */
export interface Loan {
  id: string;
  name: string;
  /** Kvar att betala i kronor (vid startMonth). */
  balance: number;
  /** Ränta per år i procent, t.ex. 10. */
  annualRate: number;
  /** Vad lånet kostar per månad (ränta + amortering). Ingår i budgetens kostnader. */
  monthlyPayment: number;
  /** Ordinarie amortering per månad. Används bara när fees saknas (gammalt läge). */
  amortization: number;
  /**
   * Fasta avgifter som ingår i månadskostnaden (aviavgift, låneskydd). När den finns räknas lånet
   * som ett annuitetslån: amortering = månadskostnad − avgifter − månadens ränta.
   */
  fees?: number;
  /** Budgetkategorin som betalar lånet. Kostnaden frigörs när lånet är betalt. */
  categoryName: string;
  /** Månaden saldot gäller, t.ex. "2026-11". */
  startMonth: string;
  /** Lägg det som blir över varje månad på lånet tills det är betalt. */
  payExtra: boolean;
  /**
   * Fast belopp extra per månad (kr) när payExtra är på. Saknas = allt som blir över.
   * Är det mindre över en månad läggs bara det som finns.
   */
  extraAmount?: number;
}

export interface MonthInput {
  month: string;
  /** Inkomster totalt. */
  income: number;
  /** Fasta + rörliga kostnader i budgeten (lånets månadskostnad ingår). */
  costs: number;
  /** Planerat sparande i budgeten (kategorier av typen sparande). */
  plannedSavings: number;
}

export interface MonthResult extends MonthInput {
  /** Inkomster − kostnader − planerat sparande (+ frigjord lånekostnad). */
  left: number;
  /** Frigjord lånekostnad (lånet är betalt men kostnaden ligger kvar i budgeten). */
  freed: number;
  extraToLoan: number;
  interest: number;
  /** Ordinarie amortering denna månad. */
  amortized: number;
  /** Kvar på lånet efter månaden. */
  loanLeft: number;
  /** Till sparande denna månad (planerat + det som blir över). Kan vara negativt. */
  toSavings: number;
  /** Avkastning på sparandet denna månad (0 utan avkastning). */
  returnEarned: number;
  /** Sparande totalt efter månaden. */
  savings: number;
}

export interface Forecast {
  months: MonthResult[];
  /** Månaden då lånet är betalt, eller null om det inte hinns inom prognosen. */
  loanPaidIn: string | null;
  /** Månaden då sparmålet nås, eller null. */
  goalReachedIn: string | null;
  /** Lägsta sparandet under perioden, och när. */
  lowest: { savings: number; month: string };
}

/**
 * Räknar fram prognosen. Lånets ordinarie amortering dras varje månad (kostnaden ligger redan
 * i budgeten). Med payExtra går allt som blir över (eller extraAmount kr) till lånet tills det är betalt, resten till sparande.
 * När lånet är betalt läggs dess månadskostnad till det som blir över.
 */
export function forecast(
  inputs: MonthInput[],
  startSavings: number,
  loan: Loan | null,
  goalTarget = 0,
  /** Förväntad avkastning per år i procent, t.ex. 7. Räknas som ränta på ränta varje månad. */
  annualReturn = 0,
): Forecast {
  const monthlyReturn = annualReturn ? Math.pow(1 + annualReturn / 100, 1 / 12) - 1 : 0;
  let balance = loan ? Math.max(0, loan.balance) : 0;
  let savings = startSavings;
  let loanPaidIn: string | null = loan && balance === 0 ? (inputs[0]?.month ?? null) : null;
  let goalReachedIn: string | null = goalTarget > 0 && savings >= goalTarget ? (inputs[0]?.month ?? null) : null;
  const months: MonthResult[] = [];
  let lowest = { savings, month: inputs[0]?.month ?? '' };

  for (const input of inputs) {
    const active = loan && input.month >= loan.startMonth;
    const paidOff = !!loan && active && balance <= 0;
    const freed = paidOff ? loan!.monthlyPayment : 0;
    const left = input.income - input.costs - input.plannedSavings + freed;
    let interest = 0;
    let extra = 0;
    let amortized = 0;
    if (loan && active && balance > 0) {
      interest = (balance * loan.annualRate) / 100 / 12;
      const planned = loan.fees !== undefined ? loan.monthlyPayment - loan.fees - interest : loan.amortization;
      const regular = Math.min(balance, Math.max(0, planned));
      balance -= regular;
      amortized = regular;
      if (loan.payExtra && left > 0) extra = Math.min(left, balance, loan.extraAmount ?? Infinity);
      balance -= extra;
      if (balance <= 0.5) {
        balance = 0;
        loanPaidIn ??= input.month;
      }
    }
    const toSavings = input.plannedSavings + left - extra;
    // Avkastning på det som redan låg sparat under månaden (inte på ett negativt saldo).
    const returnEarned = savings > 0 ? savings * monthlyReturn : 0;
    savings += returnEarned + toSavings;
    if (goalTarget > 0 && !goalReachedIn && savings >= goalTarget) goalReachedIn = input.month;
    if (savings < lowest.savings) lowest = { savings, month: input.month };
    months.push({ ...input, left, freed, extraToLoan: extra, interest, amortized, loanLeft: balance, toSavings, returnEarned, savings });
  }
  return { months, loanPaidIn, goalReachedIn, lowest };
}

/** En CSN-utbetalning: dag ("11/1") och belopp. */
export interface CsnPayout {
  day: string;
  amount: number;
}

/**
 * CSN-utbetalningarna 2026–2027 från csn.se, på den budgetmånad de betalar: pengarna som kommer
 * den 23–25:e betalar nästa månad. Inget kommer 25/12, så januari betalas med utbetalningen 11/1.
 */
export const CSN_PLAN: { month: string; payouts: CsnPayout[] }[] = [
  { month: '2026-11', payouts: [{ day: '23/10', amount: 18280 }] },
  { month: '2026-12', payouts: [{ day: '25/11', amount: 18280 }] },
  { month: '2027-01', payouts: [{ day: '11/1', amount: 13653 }] },
  { month: '2027-02', payouts: [{ day: '25/1', amount: 18404 }] },
  { month: '2027-03', payouts: [{ day: '25/2', amount: 18404 }] },
  { month: '2027-04', payouts: [{ day: '25/3', amount: 18404 }] },
  { month: '2027-05', payouts: [{ day: '23/4', amount: 18404 }] },
  { month: '2027-06', payouts: [{ day: '25/5', amount: 9202 }] },
  { month: '2027-07', payouts: [] },
];

export const planCsn = (p: { payouts: CsnPayout[] }) => p.payouts.reduce((s, x) => s + x.amount, 0);

/** Utbetalningarna en månad enligt CSN-planen, om beloppet i appen stämmer med planen. */
export function csnPayouts(month: string, csn: number): CsnPayout[] | null {
  const p = CSN_PLAN.find((x) => x.month === month);
  return p && planCsn(p) === csn ? p.payouts : null;
}
