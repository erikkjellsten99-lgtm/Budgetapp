// Akademin: läser och sparar framsteg och svar. Lagringen delas med Vanor (samma lokala databas och samma
// privata synk, se ../vanor/store.ts), så allt fungerar utan nät. Skriver aldrig i ekonomidatan.

import { useEffect, useState } from 'react';
import { supabase } from '../sync';
import { todayKey } from '../vanor/dates';
import { sameName } from '../vanor/habits';
import { addHabit, deleteAkademinRecords, getMeta, loadAkademinRecords, loadHabitData, onHabitChange, saveAkademinRecord, setCheck } from '../vanor/store';
import { nextAnswer, reviewToday } from './logic';
import { ALL_LESSONS } from './kurser';
import type { Answer, Company, DateKey, HabitSetting, JournalEntry, Lesson, Progress, Report } from './types';

export interface AkademinData {
  progress: Progress[];
  answers: Answer[];
  companies: Company[];
  reports: Report[];
  journal: JournalEntry[];
  /** Posten med id 'habit' i akademin_settings, annars null. */
  habit: HabitSetting | null;
}

export async function loadAkademin(): Promise<AkademinData> {
  const [progress, answers, companies, reports, journal, settings] = await Promise.all([
    loadAkademinRecords<Progress>('akademin_progress'),
    loadAkademinRecords<Answer>('akademin_answers'),
    loadAkademinRecords<Company>('akademin_companies'),
    loadAkademinRecords<Report>('akademin_reports'),
    loadAkademinRecords<JournalEntry>('akademin_journal'),
    loadAkademinRecords<{ id?: string }>('akademin_settings'),
  ]);
  const habit = (settings.find((r) => r.id === 'habit') as HabitSetting | undefined) ?? null;
  return { progress, answers, companies, reports, journal, habit };
}

// Skrivningar görs en i taget, så att ett dubbelklick ser det första anropets poster och inte räknar svaren två gånger.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/**
 * Markerar en lektion som klar och uppdaterar svaren efter quizet. `firstTry` säger om varje fråga blev rätt på
 * första försöket. Redan klar idag: gör ingenting. Klar en tidigare dag: doneAt behålls och svaren uppdateras.
 * En fråga vars svar redan har last idag hoppas alltid över (också på en lektion utan Progress, t.ex. om frågan
 * repeterats idag), så att inget räknas två gånger. Svaren sparas före Progress: om något skrivs fel går samma
 * anrop att göra om samma dag, eftersom spärren "klar idag" bara slår till när allt är sparat.
 */
export function completeLesson(lessonId: string, firstTry: Record<string, boolean>, today: DateKey): Promise<void> {
  return serial(async () => {
    const [progress, answers] = await Promise.all([loadAkademinRecords<Progress>('akademin_progress'), loadAkademinRecords<Answer>('akademin_answers')]);
    const done = progress.find((p) => p.id === lessonId);
    if (done?.doneAt === today) return tickStudied(today);
    for (const [questionId, right] of Object.entries(firstTry)) {
      const prev = answers.find((a) => a.id === questionId);
      if (prev?.last === today) continue;
      await saveAkademinRecord('akademin_answers', nextAnswer(prev, questionId, right, today));
    }
    if (!done) await saveAkademinRecord('akademin_progress', { id: lessonId, doneAt: today } satisfies Progress);
    await tickStudied(today);
  });
}

/** Sparar resultatet av en repetitionsfråga och att den repeterats idag (också vid fel svar). Rör bara den frågans svar. */
export function recordReview(questionId: string, right: boolean, today: DateKey): Promise<void> {
  return serial(async () => {
    const prev = (await loadAkademinRecords<Answer>('akademin_answers')).find((a) => a.id === questionId);
    await saveAkademinRecord('akademin_answers', { ...nextAnswer(prev, questionId, right, today), reviewedOn: today } satisfies Answer);
    // Dagens sista fråga besvarad (rätt eller fel): inget mer väntar i dagens repetition.
    try {
      if (reviewToday(await loadAkademinRecords<Answer>('akademin_answers'), today).length === 0) await tickStudied(today);
    } catch {
      // Frågan är sparad. Bockningen får aldrig få repetitionen att se misslyckad ut.
    }
  });
}

// Vanan "Studera aktier". Den bockas med vanornas vanliga funktioner (addHabit, setCheck): inget nytt slags regel.

export const HABIT_NAME = 'Studera aktier';

/**
 * Får erbjudandet visas? Ja när inget svar sparats, och användaren är utloggad eller kontots poster har hämtats en gång
 * (samma villkor som followLibraryWhenReady i Kunskap). Annars kunde två telefoner skapa var sin vana.
 */
export async function habitOfferReady(): Promise<boolean> {
  const settings = await loadAkademinRecords<{ id?: string }>('akademin_settings');
  if (settings.some((r) => r.id === 'habit')) return false;
  const { data } = await supabase.auth.getSession();
  if (data.session && !(await getMeta<{ lastPull: string | null }>('sync'))?.lastPull) return false;
  return true;
}

/**
 * Svaret på frågan om vanan. Ja skapar vanan (eller länkar en aktiv med samma namn) och sparar dess id, nej sparar bara
 * svaret. Ett sparat svar ändras aldrig, så ett dubbeltryck eller två vyer ger en vana. Misslyckas sparningen kan
 * frågan besvaras igen.
 */
export function answerHabitOffer(yes: boolean): Promise<void> {
  return serial(async () => {
    const settings = await loadAkademinRecords<{ id?: string }>('akademin_settings');
    if (settings.some((r) => r.id === 'habit')) return;
    if (!yes) return saveAkademinRecord('akademin_settings', { id: 'habit', answer: 'nej' } satisfies HabitSetting);
    const existing = (await loadHabitData()).habits.find((h) => !h.archived && sameName(h.name, HABIT_NAME));
    const habitId = existing?.id ?? (await addHabit(HABIT_NAME, 7));
    await saveAkademinRecord('akademin_settings', { id: 'habit', answer: 'ja', habitId } satisfies HabitSetting);
  });
}

/** Bockar vanan för dagen. Rör ingenting utan sparat ja och en aktiv vana, och tar aldrig bort en bock. Kastar aldrig. */
async function tickStudied(today: DateKey): Promise<void> {
  try {
    const setting = (await loadAkademinRecords<HabitSetting>('akademin_settings')).find((r) => r.id === 'habit');
    if (setting?.answer !== 'ja' || !setting.habitId) return;
    const { habits, checks } = await loadHabitData();
    const habit = habits.find((h) => h.id === setting.habitId);
    if (!habit || habit.archived) return;
    if (checks.some((c) => c.habitId === habit.id && c.date === today)) return;
    await setCheck(habit.id, today, 'done');
  } catch {
    // Lektionen, svaret eller texten är redan sparad och går före bockningen.
  }
}

/** Bockar vanan Studera aktier för dagen. Gör ingenting utan ja och en aktiv vana. Kastar aldrig. */
export function markStudied(today: DateKey): Promise<void> {
  return serial(() => tickStudied(today));
}

const newId = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Ett nytt bolagskort: bevakar, tomma texter. Sparas först när användaren trycker Spara. */
export function newCompany(name: string): Company {
  return {
    id: newId(),
    name,
    status: 'bevakar',
    about: '',
    earns: '',
    competitors: '',
    risks: '',
    thesis: '',
    sellRules: '',
    created: Date.now(),
  };
}

export function saveCompany(company: Company): Promise<void> {
  return serial(() => saveAkademinRecord('akademin_companies', company));
}

/** Tar bort bolaget och dess rapporter i en transaktion. Dagboksinlägg rörs inte: de är användarens egna anteckningar. */
export function removeCompany(id: string): Promise<void> {
  return serial(async () => {
    const reports = await loadAkademinRecords<Report>('akademin_reports');
    await deleteAkademinRecords([
      { store: 'akademin_companies', id },
      ...reports.filter((r) => r.companyId === id).map((r) => ({ store: 'akademin_reports' as const, id: r.id })),
    ]);
  });
}

/** En ny, tom rapport för bolaget. Sparas först när användaren trycker Spara. */
export function newReport(companyId: string): Report {
  return { id: newId(), companyId, year: '', type: 'Q1', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '' };
}

export function saveReport(report: Report): Promise<void> {
  return serial(async () => {
    await saveAkademinRecord('akademin_reports', report);
    await tickStudied(todayKey());
  });
}

export function removeReport(id: string): Promise<void> {
  return serial(() => deleteAkademinRecords([{ store: 'akademin_reports', id }]));
}

/** Ett nytt, tomt dagboksinlägg för dagen. Sparas först när användaren trycker Spara. */
export function newJournalEntry(today: DateKey): JournalEntry {
  return { id: newId(), date: today, companyName: '', type: 'kopte', why: '', change: '' };
}

export function saveJournalEntry(entry: JournalEntry): Promise<void> {
  return serial(async () => {
    await saveAkademinRecord('akademin_journal', entry);
    await tickStudied(todayKey());
  });
}

export function removeJournalEntry(id: string): Promise<void> {
  return serial(() => deleteAkademinRecords([{ store: 'akademin_journal', id }]));
}

/** Första olästa lektionen i kursordning, eller null när alla är klara. */
export function nextLesson(progress: Progress[]): Lesson | null {
  const done = new Set(progress.map((p) => p.id));
  return ALL_LESSONS.find((l) => !done.has(l.id)) ?? null;
}

/** Har någon lektion blivit klar idag? */
export const doneToday = (progress: Progress[], today: DateKey): boolean => progress.some((p) => p.doneAt === today);

/** Framsteg, svar, bolag, rapporter och journal, uppdaterade när något ändras här eller kommer in via synken. Null medan de laddas. */
export function useAkademin(): { data: AkademinData | null; failed: boolean } {
  const [data, setData] = useState<AkademinData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      loadAkademin().then(
        (next) => alive && (setData(next), setFailed(false)),
        () => alive && setFailed(true),
      );
    load();
    const off = onHabitChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { data, failed };
}
