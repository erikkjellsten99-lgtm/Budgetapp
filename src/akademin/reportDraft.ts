// Akademin: rapportmallens rena delar (formulärets text, kontroller och förklaringar). Ingen React här.
import { parseNumber, PERIOD_LABEL } from './logic';
import type { PeriodType, Report } from './types';

export const PERIOD_TYPES: PeriodType[] = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'FY'];

export const NUMBER_KEYS = ['revenue', 'ebit', 'eps', 'cashflow', 'cash', 'netDebt', 'reaction'] as const;
export type NumberKey = (typeof NUMBER_KEYS)[number];

/** Formuläret arbetar med text, och sparar först när allt är giltigt. */
export interface ReportDraft extends Record<NumberKey, string> {
  year: string;
  type: PeriodType;
  date: string;
  unit: string;
  outlook: string;
  good: string;
  bad: string;
  thesis: '' | 'ja' | 'nej' | 'osaker';
  thesisWhy: string;
  url: string;
}

export function emptyDraft(): ReportDraft {
  return { year: '', type: 'Q1', date: '', unit: 'MSEK', revenue: '', ebit: '', eps: '', cashflow: '', cash: '', netDebt: '', outlook: '', good: '', bad: '', thesis: '', thesisWhy: '', url: '', reaction: '' };
}

const numberText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

export function toDraft(r: Report): ReportDraft {
  return {
    year: r.year,
    type: r.type,
    date: r.date ?? '',
    unit: r.unit,
    revenue: numberText(r.revenue),
    ebit: numberText(r.ebit),
    eps: numberText(r.eps),
    cashflow: numberText(r.cashflow),
    cash: numberText(r.cash),
    netDebt: numberText(r.netDebt),
    outlook: r.outlook,
    good: r.good,
    bad: r.bad,
    thesis: r.thesis ?? '',
    thesisWhy: r.thesisWhy,
    reaction: numberText(r.reaction),
    url: r.url ?? '',
  };
}

const orUndefined = (s: string) => (s.trim() === '' ? undefined : s.trim());
const num = (s: string) => {
  const n = parseNumber(s);
  return n === 'fel' || n === null ? undefined : n;
};

/** Rapporten med formulärets värden. Tomma valfria fält tas bort, och text som inte är ett tal blir saknad (kontrolleras av validateReport). */
export function fromDraft(base: Report, d: ReportDraft): Report {
  return {
    id: base.id,
    companyId: base.companyId,
    year: d.year.trim(),
    type: d.type,
    date: orUndefined(d.date),
    unit: d.unit.trim(),
    revenue: num(d.revenue),
    ebit: num(d.ebit),
    eps: num(d.eps),
    cashflow: num(d.cashflow),
    cash: num(d.cash),
    netDebt: num(d.netDebt),
    outlook: d.outlook,
    good: d.good,
    bad: d.bad,
    thesis: d.thesis === '' ? undefined : d.thesis,
    thesisWhy: d.thesisWhy,
    reaction: num(d.reaction),
    url: orUndefined(d.url),
  };
}

export type ReportErrors = Partial<Record<NumberKey | 'year' | 'unit' | 'date' | 'url', string>>;

const NUMBER_ERROR = 'Skriv ett tal, till exempel 1 234,5 eller −12.';

/** Fel per fält. `others` är bolagets övriga rapporter (den som redigeras får gärna vara med, den räknas inte som dubblett). */
export function validateReport(d: ReportDraft, others: Report[], base: Report): ReportErrors {
  const errors: ReportErrors = {};
  const year = d.year.trim();
  if (year === '') errors.year = 'Skriv räkenskapsåret, till exempel 2026 eller 2025/26.';
  else {
    const dup = others.find((r) => r.id !== base.id && r.companyId === base.companyId && r.type === d.type && r.year.trim() === year);
    if (dup) errors.year = `${PERIOD_LABEL[dup.type]} ${dup.year.trim()} finns redan för det här bolaget. Öppna den rapporten i stället.`;
  }
  if (d.unit.trim() === '') errors.unit = 'Skriv enheten, till exempel MSEK.';
  if (d.date.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(d.date.trim())) errors.date = 'Skriv datumet som 2026-11-20.';
  for (const k of NUMBER_KEYS) if (parseNumber(d[k]) === 'fel') errors[k] = NUMBER_ERROR;
  const url = d.url.trim();
  if (url !== '' && !url.startsWith('https://')) errors.url = 'Länken måste börja med https://';
  return errors;
}

/** Kontrollerar och bygger rapporten. Vid fel finns ingen rapport att spara. */
export function prepareSave(base: Report, d: ReportDraft, others: Report[]): { report: Report } | { errors: ReportErrors } {
  const errors = validateReport(d, others, base);
  return Object.keys(errors).length > 0 ? { errors } : { report: fromDraft(base, d) };
}

/** En mening per fält, egna ord. Inga siffror som kan bli fel och inga råd. */
export const FIELD_HELP = {
  year: 'Räkenskapsåret rapporten tillhör, skrivet som bolaget skriver det. Ett år som inte följer kalendern skrivs med snedstreck.',
  type: 'Vilken del av året siffrorna gäller. Halvår och helår är hela den perioden, inte bara det sista kvartalet.',
  date: 'Dagen då bolaget publicerade rapporten.',
  unit: 'Enheten bolaget redovisar i. Tillväxten räknas bara mellan rapporter som har samma enhet.',
  revenue: 'Vad bolaget sålde för under perioden, innan några kostnader dragits av.',
  ebit: 'Det som blev kvar av intäkterna efter bolagets rörelsekostnader, före ränta och skatt. Det kan vara negativt.',
  eps: 'Periodens vinst fördelad på bolagets aktier. Bolaget anger själv vilken vinst och vilket antal aktier som används.',
  cashflow: 'Pengarna som den vanliga verksamheten gav eller förbrukade under perioden, före investeringar och finansiering.',
  cash: 'Pengar och tillgångar som snabbt går att göra om till pengar, vid periodens slut.',
  netDebt: 'Bolagets lån minus dess likvida medel vid periodens slut. Bolagen räknar olika, så följ rapportens egen uppställning.',
  outlook: 'Vad ledningen säger om tiden framåt, kort sammanfattat.',
  good: 'Det som gick bra i rapporten, med dina egna ord.',
  bad: 'Det som gick dåligt eller oroade dig i rapporten, med dina egna ord.',
  thesis: 'Ditt eget svar på om rapporten stämmer med skälen du skrev i Min tes på bolagskortet.',
  reaction: 'Hur aktiekursen rörde sig dagen efter rapporten, i procent. Du skriver in den själv.',
  url: 'Länk till bolagets egen rapport.',
} as const;
