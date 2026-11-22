// Akademin: beslutsdagbokens rena delar (formulärets text, kontroller, sortering och uppföljning). Ingen React här.
import { needsFollowUp } from './logic';
import type { EconomyLinks } from './economyLinks';
import type { Company, DateKey, JournalEntry, JournalType } from './types';

export const JOURNAL_TYPES: JournalType[] = ['kopte', 'salde', 'avstod', 'annat'];

/** Bara köp och försäljning har en affär i Investeringar att länka till. */
export const hasTrade = (type: JournalType): boolean => type === 'kopte' || type === 'salde';

/** Nyast först (datum, sedan id så att ordningen är stabil). */
export function sortJournal(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Inlägg som väntar på uppföljning, nyast först. */
export const pendingFollowUp = (entries: JournalEntry[], today: DateKey): JournalEntry[] => sortJournal(entries.filter((e) => needsFollowUp(e, today)));

/** Listans ordning: de som väntar på uppföljning överst, sedan resten, nyast först i båda. */
export function listOrder(entries: JournalEntry[], today: DateKey): { pending: JournalEntry[]; rest: JournalEntry[] } {
  return { pending: pendingFollowUp(entries, today), rest: sortJournal(entries.filter((e) => !needsFollowUp(e, today))) };
}

export interface TradeOption {
  id: string;
  date: DateKey;
  side: 'buy' | 'sell';
}

/** Affärerna i bolagets innehav, nyast först. Tomt när bolaget saknar innehav. Bara id, datum och sida. */
export function entryTrades(links: EconomyLinks, companies: Company[], companyId: string): TradeOption[] {
  const holdingId = companies.find((c) => c.id === companyId)?.holdingId;
  if (!holdingId) return [];
  return links.trades
    .filter((t) => t.holdingId === holdingId)
    .map(({ id, date, side }) => ({ id, date, side }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
}

export interface JournalDraft {
  date: string;
  companyId: string;
  type: JournalType;
  why: string;
  change: string;
  tradeId: string;
  followUp: string;
  /** Inlägget har redan ett sparat svar, som då inte får tömmas. */
  hadFollowUp: boolean;
}

export function toDraft(e: JournalEntry): JournalDraft {
  return {
    date: e.date,
    companyId: e.companyId ?? '',
    type: e.type,
    why: e.why,
    change: e.change,
    tradeId: e.tradeId ?? '',
    followUp: e.followUp?.text ?? '',
    hadFollowUp: e.followUp !== undefined,
  };
}

/**
 * Inlägget med formulärets värden. Bolagets namn kopieras från biblioteket; är bolaget borttaget behålls det gamla
 * namnet. Affären behålls bara för Köpte och Sålde. Ett nytt eller ändrat svar får dagens datum, ett oförändrat behåller sitt.
 */
export function fromDraft(base: JournalEntry, d: JournalDraft, companies: Company[], today: DateKey, links: EconomyLinks | null = null): JournalEntry {
  const company = companies.find((c) => c.id === d.companyId);
  // En affär som finns men hör till ett annat innehav än bolagets släpps. Okända länkar eller en affär som inte finns rör vi inte.
  const trade = links?.trades.find((t) => t.id === d.tradeId);
  const foreign = company !== undefined && trade !== undefined && trade.holdingId !== company.holdingId;
  const text = d.followUp.trim();
  const followUp = text === '' ? undefined : base.followUp && base.followUp.text === text ? base.followUp : { date: today, text };
  return {
    id: base.id,
    date: d.date,
    companyId: d.companyId === '' ? undefined : d.companyId,
    companyName: company?.name ?? base.companyName,
    type: d.type,
    why: d.why.trim(),
    change: d.change.trim(),
    tradeId: hasTrade(d.type) && d.tradeId !== '' && !foreign ? d.tradeId : undefined,
    followUp,
  };
}

export interface JournalErrors {
  date?: string;
  company?: string;
  why?: string;
  followUp?: string;
}

/** Bolag och skäl krävs, datumet får inte vara tomt, och ett sparat svar får inte tömmas. */
export function validateDraft(d: JournalDraft): JournalErrors {
  const errors: JournalErrors = {};
  if (d.date.trim() === '') errors.date = 'Välj ett datum.';
  if (d.companyId === '') errors.company = 'Välj ett bolag.';
  if (d.why.trim() === '') errors.why = 'Skriv ett skäl.';
  if (d.hadFollowUp && d.followUp.trim() === '') errors.followUp = 'Skriv ett svar.';
  return errors;
}

/** Byte av bolag: affären behålls bara om det nya bolagets innehav har den. Medan affärerna är okända rörs den inte. */
export function changeCompany(d: JournalDraft, companyId: string, companies: Company[], links: EconomyLinks | null): JournalDraft {
  const keep = links === null || entryTrades(links, companies, companyId).some((t) => t.id === d.tradeId);
  return { ...d, companyId, tradeId: keep ? d.tradeId : '' };
}

/** Byte av typ: Avstod och Annat har ingen affär. */
export function changeType(d: JournalDraft, type: JournalType): JournalDraft {
  return { ...d, type, tradeId: hasTrade(type) ? d.tradeId : '' };
}
