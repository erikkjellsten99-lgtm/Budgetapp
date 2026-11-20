// Akademin: posterna som sparas i vanor-databasen (se ../vanor/store.ts) och synkas privat.
// Alla har `id: string` som nyckel.

export type DateKey = string; // 'YYYY-MM-DD', samma som ../vanor/dates

export interface Progress {
  /** Lektionens id. */
  id: string;
  doneAt: DateKey;
}

export interface Answer {
  /** Frågans id. */
  id: string;
  streak: number;
  due: DateKey;
  last: DateKey;
}

export type CompanyStatus = 'bevakar' | 'ager' | 'salt';

export interface Company {
  id: string;
  name: string;
  ticker?: string;
  list?: string;
  status: CompanyStatus;
  holdingId?: string;
  about: string;
  earns: string;
  competitors: string;
  risks: string;
  thesis: string;
  sellRules: string;
  ipo?: { date?: DateKey; price?: string; promised?: string };
  nextReport?: DateKey;
  irUrl?: string;
  created: number;
}

export type PeriodType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'FY';

export interface Report {
  id: string;
  companyId: string;
  /** '2026' eller '2025/26'. */
  year: string;
  type: PeriodType;
  date?: DateKey;
  /** T.ex. 'MSEK'. */
  unit: string;
  revenue?: number;
  ebit?: number;
  eps?: number;
  cashflow?: number;
  cash?: number;
  netDebt?: number;
  outlook: string;
  good: string;
  bad: string;
  thesis?: 'ja' | 'nej' | 'osaker';
  thesisWhy: string;
  /** Procent. */
  reaction?: number;
  url?: string;
}

export type JournalType = 'kopte' | 'salde' | 'avstod' | 'annat';

export interface JournalEntry {
  id: string;
  date: DateKey;
  companyId?: string;
  companyName: string;
  type: JournalType;
  why: string;
  change: string;
  tradeId?: string;
  followUp?: { date: DateKey; text: string };
}

export interface HabitSetting {
  id: 'habit';
  answer: 'ja' | 'nej';
  habitId?: string;
}

// Lektionerna: fast innehåll i ./kurser, inget av det sparas.

export interface Source {
  title: string;
  url: string;
  /** Dagen sidan öppnades och kontrollerades. */
  checked: DateKey;
}

export type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'list'; items: string[] };

export interface Question {
  /** T.ex. 'k1-03-q2'. Ändras aldrig efter publicering. */
  id: string;
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  why: string;
}

export interface Lesson {
  /** T.ex. 'k1-03'. Ändras aldrig efter publicering. */
  id: string;
  course: number;
  number: number;
  title: string;
  body: Block[];
  example: { title: string; text: string; source: Source };
  key: [string, string, string];
  terms: { word: string; meaning: string }[];
  sources: Source[];
  questions: [Question, Question, Question, Question];
  lab?: string;
}

export interface Course {
  id: number;
  title: string;
  lessons: Lesson[];
}
