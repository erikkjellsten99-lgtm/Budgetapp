// Akademin: läser och sparar framsteg och svar. Lagringen delas med Vanor (samma lokala databas och samma
// privata synk, se ../vanor/store.ts), så allt fungerar utan nät. Skriver aldrig i ekonomidatan.

import { useEffect, useState } from 'react';
import { loadAkademinRecords, onHabitChange, saveAkademinRecord } from '../vanor/store';
import { nextAnswer } from './logic';
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
    if (done?.doneAt === today) return;
    for (const [questionId, right] of Object.entries(firstTry)) {
      const prev = answers.find((a) => a.id === questionId);
      if (prev?.last === today) continue;
      await saveAkademinRecord('akademin_answers', nextAnswer(prev, questionId, right, today));
    }
    if (!done) await saveAkademinRecord('akademin_progress', { id: lessonId, doneAt: today } satisfies Progress);
  });
}

/** Sparar resultatet av en repetitionsfråga och att den repeterats idag (också vid fel svar). Rör bara den frågans svar. */
export function recordReview(questionId: string, right: boolean, today: DateKey): Promise<void> {
  return serial(async () => {
    const prev = (await loadAkademinRecords<Answer>('akademin_answers')).find((a) => a.id === questionId);
    await saveAkademinRecord('akademin_answers', { ...nextAnswer(prev, questionId, right, today), reviewedOn: today } satisfies Answer);
  });
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
