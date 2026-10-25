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
  /** Ordinarie amortering per månad. */
  amortization: number;
  /** Budgetkategorin som betalar lånet. Kostnaden frigörs när lånet är betalt. */
  categoryName: string;
  /** Månaden saldot gäller, t.ex. "2026-11". */
  startMonth: string;
  /** Lägg det som blir över varje månad på lånet tills det är betalt. */
  payExtra: boolean;
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
  /** Kvar på lånet efter månaden. */
  loanLeft: number;
  /** Till sparande denna månad (planerat + det som blir över). Kan vara negativt. */
  toSavings: number;
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
 * i budgeten). Med payExtra går allt som blir över till lånet tills det är betalt, därefter till sparande.
 * När lånet är betalt läggs dess månadskostnad till det som blir över.
 */
export function forecast(inputs: MonthInput[], startSavings: number, loan: Loan | null, goalTarget = 0): Forecast {
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
    if (loan && active && balance > 0) {
      interest = (balance * loan.annualRate) / 100 / 12;
      const regular = Math.min(balance, loan.amortization);
      balance -= regular;
      if (loan.payExtra && left > 0) extra = Math.min(left, balance);
      balance -= extra;
      if (balance <= 0.5) {
        balance = 0;
        loanPaidIn ??= input.month;
      }
    }
    const toSavings = input.plannedSavings + left - extra;
    savings += toSavings;
    if (goalTarget > 0 && !goalReachedIn && savings >= goalTarget) goalReachedIn = input.month;
    if (savings < lowest.savings) lowest = { savings, month: input.month };
    months.push({ ...input, left, freed, extraToLoan: extra, interest, loanLeft: balance, toSavings, savings });
  }
  return { months, loanPaidIn, goalReachedIn, lowest };
}

/**
 * CSN-utbetalningarna 2026–2027 från csn.se, flyttade till månaden de används
 * (utbetalningen den 25:e räknas till nästa månad, 11/1 till januari).
 */
export const CSN_PLAN: { month: string; csn: number }[] = [
  { month: '2026-12', csn: 18280 },
  { month: '2027-01', csn: 13653 },
  { month: '2027-02', csn: 18404 },
  { month: '2027-03', csn: 18404 },
  { month: '2027-04', csn: 18404 },
  { month: '2027-05', csn: 18404 },
  { month: '2027-06', csn: 9202 },
  { month: '2027-07', csn: 0 },
];
