import { describe, expect, it } from 'vitest';
import { CSN_PLAN, csnPayouts, forecast, planCsn, type Loan, type MonthInput } from './forecast';

const loan: Loan = {
  id: 'billan',
  name: 'Billån',
  balance: 100000,
  annualRate: 10.03,
  monthlyPayment: 1586,
  amortization: 750,
  categoryName: 'Billån',
  startMonth: '2026-11',
  payExtra: true,
};

/** Samma siffror som i hushållskalkylen (2026-10-24). */
function kalkyl(): MonthInput[] {
  const rows: [string, number, number][] = [
    ['2026-11', 18280, 29822],
    ['2026-12', 18280, 31970],
    ['2027-01', 13653, 31970],
    ['2027-02', 18404, 31970],
    ['2027-03', 18404, 31970],
    ['2027-04', 18404, 31970],
    ['2027-05', 18404, 31970],
    ['2027-06', 9202, 31970],
    ['2027-07', 0, 31970],
    ['2027-08', 0, 31970],
  ];
  return rows.map(([month, csn, other]) => ({
    month,
    income: csn + other,
    costs: 24003 + (month >= '2026-12' ? 11000 : 0),
    plannedSavings: 0,
  }));
}

describe('prognos', () => {
  it('stämmer med hushållskalkylen: lånet betalt i april, ~74 400 kr sparat i augusti', () => {
    const f = forecast(kalkyl(), 52000, loan, 300000);
    expect(f.loanPaidIn).toBe('2027-04');
    expect(f.months[0].left).toBe(24099);
    expect(f.months[0].loanLeft).toBeCloseTo(75151, 0);
    expect(f.months.at(-1)!.savings).toBeCloseTo(74397, -1);
    expect(f.lowest.savings).toBeLessThanOrEqual(52000);
  });

  it('frigör lånets kostnad när det är betalt', () => {
    const f = forecast(kalkyl(), 52000, loan);
    const may = f.months.find((m) => m.month === '2027-05')!;
    expect(may.freed).toBe(1586);
    expect(may.toSavings).toBe(15371 + 1586);
  });

  it('utan extra betalning amorteras bara 750 kr i månaden', () => {
    const f = forecast(kalkyl(), 52000, { ...loan, payExtra: false });
    expect(f.loanPaidIn).toBeNull();
    expect(f.months.at(-1)!.loanLeft).toBe(100000 - 750 * 10);
  });

  it('en minusmånad tas från sparandet', () => {
    const f = forecast([{ month: '2027-07', income: 10000, costs: 15000, plannedSavings: 0 }], 20000, null);
    expect(f.months[0].savings).toBe(15000);
    expect(f.lowest).toEqual({ savings: 15000, month: '2027-07' });
  });

  it('planerat sparande räknas till sparandet och sparmålet', () => {
    const inputs = Array.from({ length: 3 }, (_, i) => ({ month: `2027-0${i + 1}`, income: 30000, costs: 20000, plannedSavings: 5000 }));
    const f = forecast(inputs, 0, null, 20000);
    expect(f.months.map((m) => m.savings)).toEqual([10000, 20000, 30000]);
    expect(f.goalReachedIn).toBe('2027-02');
  });

  it('lånet börjar inte räknas före sin startmånad', () => {
    const f = forecast([{ month: '2026-10', income: 1000, costs: 0, plannedSavings: 0 }], 0, loan);
    expect(f.months[0].loanLeft).toBe(100000);
    expect(f.months[0].extraToLoan).toBe(0);
  });
});

describe('annuitetslån med avgifter (LF Finans-avin)', () => {
  // Avi 2026-09-10: 97 446,12 kr, 8,45 %, 1 586 kr = amortering + ränta + 40 kr avgift + 103 kr låneskydd.
  const lf: Loan = { ...loan, balance: 96689.63, annualRate: 8.45, amortization: 0, fees: 143, startMonth: '2026-10', payExtra: false };
  const month = (m: string) => ({ month: m, income: 0, costs: 0, plannedSavings: 0 });

  it('stämmer med avin: oktober ger ca 681 kr ränta och 762 kr amortering', () => {
    const f = forecast([month('2026-10')], 0, lf);
    expect(f.months[0].interest).toBeCloseTo(680.86, 1);
    expect(f.months[0].amortized).toBeCloseTo(762.14, 1);
    expect(f.months[0].loanLeft).toBeCloseTo(95927.49, 1);
  });

  it('amorteringen ökar när räntan minskar', () => {
    const f = forecast([month('2026-10'), month('2026-11'), month('2026-12')], 0, lf);
    expect(f.months[2].amortized).toBeGreaterThan(f.months[0].amortized);
  });

  it('utan extra betalning tar det över sju år', () => {
    const months = Array.from({ length: 120 }, (_, i) => month(`${2026 + Math.floor((9 + i) / 12)}-${String(((9 + i) % 12) + 1).padStart(2, '0')}`));
    const f = forecast(months, 0, lf);
    expect(f.loanPaidIn! > '2033-12').toBe(true);
  });
});

describe('eget belopp extra på lånet', () => {
  it('10 000 kr på lånet och resten till sparande', () => {
    const f = forecast(kalkyl().slice(0, 2), 52000, { ...loan, extraAmount: 10000 });
    expect(f.months[0].extraToLoan).toBe(10000);
    expect(f.months[0].toSavings).toBe(24099 - 10000);
  });
  it('lägger bara det som finns en månad med mindre över', () => {
    const f = forecast([{ month: '2026-11', income: 30000, costs: 25000, plannedSavings: 0 }], 0, { ...loan, extraAmount: 10000 });
    expect(f.months[0].extraToLoan).toBe(5000);
    expect(f.months[0].toSavings).toBe(0);
  });
});

describe('CSN-planen', () => {
  it('följer utbetalningsdagarna på csn.se: inget i december, två gånger i januari', () => {
    expect(planCsn(CSN_PLAN.find((p) => p.month === '2026-12')!)).toBe(0);
    expect(planCsn(CSN_PLAN.find((p) => p.month === '2027-01')!)).toBe(13653 + 18404);
    expect(csnPayouts('2027-01', 32057)!.map((p) => p.day)).toEqual(['11/1', '25/1']);
    expect(csnPayouts('2027-01', 13653)).toBeNull();
  });
});

describe('avkastning', () => {
  const flat = Array.from({ length: 12 }, (_, i) => ({ month: `2027-${String(i + 1).padStart(2, '0')}`, income: 0, costs: 0, plannedSavings: 0 }));
  it('7 % per år ger 7 % på ett år, ränta på ränta', () => {
    const f = forecast(flat, 100000, null, 0, 7);
    expect(f.months.at(-1)!.savings).toBeCloseTo(107000, 0);
  });
  it('utan avkastning växer inget', () => {
    expect(forecast(flat, 100000, null).months.at(-1)!.savings).toBe(100000);
  });
  it('ger ingen avkastning på ett negativt saldo', () => {
    const f = forecast([{ month: '2027-01', income: 0, costs: 1000, plannedSavings: 0 }], -500, null, 0, 7);
    expect(f.months[0].returnEarned).toBe(0);
  });
});
