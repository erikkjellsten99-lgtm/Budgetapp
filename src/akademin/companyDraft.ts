// Akademin: bolagskortets rena delar (sortering, formulärets text och kontroller). Ingen React här.
import type { Company, CompanyStatus, DateKey } from './types';

/** Närmast kommande rapport först (idag räknas), sedan resten efter namn. */
export function sortCompanies(companies: Company[], today: DateKey): Company[] {
  const byName = (a: Company, b: Company) => a.name.localeCompare(b.name, 'sv');
  const upcoming = (c: Company) => c.nextReport !== undefined && c.nextReport >= today;
  return [
    ...companies.filter(upcoming).sort((a, b) => (a.nextReport! < b.nextReport! ? -1 : a.nextReport! > b.nextReport! ? 1 : byName(a, b))),
    ...companies.filter((c) => !upcoming(c)).sort(byName),
  ];
}

// Formuläret arbetar med text, och sparar först när allt är giltigt.
export interface Draft {
  name: string;
  ticker: string;
  list: string;
  status: CompanyStatus;
  holdingId: string;
  about: string;
  earns: string;
  competitors: string;
  risks: string;
  thesis: string;
  sellRules: string;
  newlyListed: boolean;
  ipoDate: string;
  ipoPrice: string;
  ipoPromised: string;
  nextReport: string;
  irUrl: string;
}

export function toDraft(c: Company): Draft {
  return {
    name: c.name,
    ticker: c.ticker ?? '',
    list: c.list ?? '',
    status: c.status,
    holdingId: c.holdingId ?? '',
    about: c.about,
    earns: c.earns,
    competitors: c.competitors,
    risks: c.risks,
    thesis: c.thesis,
    sellRules: c.sellRules,
    newlyListed: c.ipo !== undefined,
    ipoDate: c.ipo?.date ?? '',
    ipoPrice: c.ipo?.price ?? '',
    ipoPromised: c.ipo?.promised ?? '',
    nextReport: c.nextReport ?? '',
    irUrl: c.irUrl ?? '',
  };
}

const orUndefined = (s: string) => (s.trim() === '' ? undefined : s.trim());

/** Bolaget med formulärets värden. Tomma valfria fält tas bort. Id och created behålls. */
export function fromDraft(base: Company, d: Draft): Company {
  const ipo = d.newlyListed ? { date: orUndefined(d.ipoDate), price: orUndefined(d.ipoPrice), promised: orUndefined(d.ipoPromised) } : undefined;
  return {
    id: base.id,
    created: base.created,
    name: d.name.trim(),
    ticker: orUndefined(d.ticker),
    list: orUndefined(d.list),
    status: d.status,
    holdingId: orUndefined(d.holdingId),
    about: d.about,
    earns: d.earns,
    competitors: d.competitors,
    risks: d.risks,
    thesis: d.thesis,
    sellRules: d.sellRules,
    ipo,
    nextReport: orUndefined(d.nextReport),
    irUrl: orUndefined(d.irUrl),
  };
}

export interface DraftErrors {
  name?: string;
  irUrl?: string;
}

export function validateDraft(d: Draft): DraftErrors {
  const errors: DraftErrors = {};
  if (d.name.trim() === '') errors.name = 'Skriv ett namn på bolaget.';
  const url = d.irUrl.trim();
  if (url !== '' && !url.startsWith('https://')) errors.irUrl = 'Länken måste börja med https://';
  return errors;
}
