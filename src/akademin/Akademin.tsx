// Akademin: kursen i aktier, ett läge i Mindhub. Startsidan, repetitionen och vägen till lektionerna och ordlistan.
// Läser och sparar bara framsteg och svar (akademinStore). Ingenting här rör ekonomin.
import { useEffect, useState } from 'react';
import { todayKey } from '../vanor/dates';
import { useToday } from '../vanor/useToday';
import { doneToday, nextLesson, recordReview, useAkademin, type AkademinData } from './akademinStore';
import Companies, { CompaniesRow } from './Companies';
import Glossary, { glossaryEntries } from './Glossary';
import { COURSES, PLANNED, lessonById, questionById } from './kurser';
import { LessonView } from './LessonView';
import { reviewToday } from './logic';
import Quiz, { createQuiz } from './Quiz';
import type { Answer, DateKey, Lesson, Progress } from './types';
import './akademin.css';

export type TodayCard = { kind: 'next'; lesson: Lesson } | { kind: 'done'; next: Lesson | null } | { kind: 'review' } | { kind: 'coming' };

/** Vad kortet Dagens lektion ska säga: nästa lektion, klar för idag, repetition eller att nästa kurs kommer. */
export function todayCard(progress: Progress[], answers: Answer[], today: string): TodayCard {
  const next = nextLesson(progress);
  if (doneToday(progress, today)) return { kind: 'done', next };
  if (next) return { kind: 'next', lesson: next };
  return reviewToday(answers, today).length > 0 ? { kind: 'review' } : { kind: 'coming' };
}

/** Meningen om nästa kurs som kommer, eller tom text om ingen kurs är planerad. */
export function comingNote(planned: { id: number }[] = PLANNED): string {
  return planned.length > 0 ? ` Kurs ${planned[0].id} kommer.` : '';
}

const Chevron = () => (
  <svg className="akademin-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = () => (
  <svg className="akademin-check" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="Klar">
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function TodayLesson({ card, onOpenLesson, onReview }: { card: TodayCard; onOpenLesson: (id: string) => void; onReview: () => void }) {
  return (
    <section className="card akademin-today" aria-labelledby="akademin-today-title">
      <h3 id="akademin-today-title">Dagens lektion</h3>
      {card.kind === 'next' && (
        <>
          <p className="akademin-meta">
            Kurs {card.lesson.course} · {card.lesson.number} av {COURSES.find((c) => c.id === card.lesson.course)?.lessons.length}
          </p>
          <p className="akademin-today-lesson">{card.lesson.title}</p>
          <button type="button" className="primary" onClick={() => onOpenLesson(card.lesson.id)}>
            Börja
          </button>
        </>
      )}
      {card.kind === 'done' && (
        <>
          <p className="akademin-today-lesson akademin-done">Klar för idag</p>
          {card.next ? (
            <p className="akademin-meta">
              Nästa lektion:{' '}
              <button type="button" className="akademin-link" onClick={() => onOpenLesson(card.next!.id)}>
                {card.next.title}
              </button>
            </p>
          ) : (
            <p className="akademin-meta">Du har läst alla lektionerna.{comingNote()}</p>
          )}
        </>
      )}
      {card.kind === 'review' && (
        <>
          <p className="akademin-meta">Alla lektioner är lästa. Några frågor är värda en repetition.</p>
          <button type="button" className="primary" onClick={onReview}>
            Repetera nu
          </button>
        </>
      )}
      {card.kind === 'coming' && <p className="akademin-meta">Alla lektioner är lästa och inget väntar på repetition.{comingNote()}</p>}
    </section>
  );
}

export function StartPage({
  data,
  today,
  onOpenLesson,
  onReview,
  onGlossary,
  onCompanies,
}: {
  data: AkademinData;
  today: string;
  onOpenLesson: (id: string) => void;
  onReview: () => void;
  onGlossary: () => void;
  onCompanies: () => void;
}) {
  const doneIds = new Set(data.progress.map((p) => p.id));
  const due = reviewToday(data.answers, today).length;
  const words = glossaryEntries(data.progress, '').length;
  return (
    <div className="akademin-start">
      <TodayLesson card={todayCard(data.progress, data.answers, today)} onOpenLesson={onOpenLesson} onReview={onReview} />

      <div className="group akademin-rows">
        {due > 0 && (
          <button type="button" className="akademin-row" onClick={onReview}>
            <span>Repetition · {due === 1 ? '1 fråga' : `${due} frågor`}</span>
            <Chevron />
          </button>
        )}
        <button type="button" className="akademin-row" onClick={onGlossary}>
          <span>Ordlista{words > 0 && <span className="akademin-muted"> · {words} ord</span>}</span>
          <Chevron />
        </button>
      </div>

      <section className="group-block">
        <h3 className="group-title">Kurser</h3>
        <div className="group">
          {COURSES.map((course) => {
            const n = course.lessons.filter((l) => doneIds.has(l.id)).length;
            return (
              <div key={course.id} className="akademin-course">
                <div className="akademin-course-head">
                  <span className="akademin-course-title">
                    {course.id} {course.title}
                  </span>
                  <span className="akademin-bar" aria-hidden="true">
                    <span style={{ width: `${(n / course.lessons.length) * 100}%` }} />
                  </span>
                  <span className="akademin-count">
                    {n}/{course.lessons.length}
                  </span>
                </div>
                <ul className="akademin-lessons">
                  {course.lessons.map((l) => (
                    <li key={l.id}>
                      <button type="button" className="akademin-row" onClick={() => onOpenLesson(l.id)}>
                        <span className="akademin-lesson-num">{l.number}</span>
                        <span className="akademin-lesson-name">{l.title}</span>
                        {doneIds.has(l.id) ? <Check /> : <Chevron />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {PLANNED.map((c) => (
            <div key={c.id} className="akademin-row akademin-soon">
              <span>
                {c.id} {c.title}
              </span>
              <span className="akademin-muted">kommer</span>
            </div>
          ))}
        </div>
      </section>

      <div className="group akademin-rows">
        <CompaniesRow companies={data.companies} today={today} onOpen={onCompanies} />
        <div className="akademin-row akademin-soon">
          <span>Beslutsdagbok</span>
          <span className="akademin-muted">kommer</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Repetitionens quiz: varje fråga sparas med `record` vid första svaret, och onDone anropas när alla är rätt. Frågor
 * som inte finns i den här versionen av appen hoppas över. Dagen läses med `now` när frågan besvaras.
 */
export function reviewQuiz(
  ids: string[],
  now: () => DateKey,
  onSaveFailed: () => void,
  onDone: () => void,
  record: (id: string, right: boolean, today: DateKey) => Promise<void> = recordReview,
) {
  return createQuiz(knownIds(ids), onDone, (id, right) => void record(id, right, now()).catch(onSaveFailed));
}

const knownIds = (ids: string[]) => ids.filter((id) => questionById(id) !== undefined);

export function ReviewFinished({ saveFailed, onClose }: { saveFailed: boolean; onClose: () => void }) {
  return (
    <section className="akademin-finish" role="status">
      <p className="akademin-finish-title">Repetitionen är klar för idag.</p>
      {saveFailed && <p className="akademin-error">Något svar gick inte att spara.</p>}
      <button type="button" className="primary akademin-wide" onClick={onClose}>
        Klar
      </button>
    </section>
  );
}

/** Repetitionen: dagens förfallna frågor i samma quiz som lektionerna. `record` sparar varje första svar. */
export function Review({ ids, onClose, record }: { ids: string[]; onClose: () => void; record?: (id: string, right: boolean, today: DateKey) => Promise<void> }) {
  const [finished, setFinished] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [quiz] = useState(() => reviewQuiz(ids, todayKey, () => setSaveFailed(true), () => setFinished(true), record));
  const questions = knownIds(ids).flatMap((id) => questionById(id)?.question ?? []);
  if (finished) return <ReviewFinished saveFailed={saveFailed} onClose={onClose} />;
  return (
    <div>
      <h3 className="akademin-lesson-title">Repetition</h3>
      <Quiz questions={questions} quiz={quiz} />
    </div>
  );
}

export type View = { kind: 'start' } | { kind: 'lesson'; id: string; from: 'start' | 'glossary' } | { kind: 'review'; ids: string[] } | { kind: 'glossary' } | { kind: 'companies' };

/** Vart Tillbaka leder: en lektion som öppnats från ordlistan går tillbaka dit, allt annat till startsidan. */
export function backFrom(view: View): View {
  return view.kind === 'lesson' && view.from === 'glossary' ? { kind: 'glossary' } : { kind: 'start' };
}

export default function Akademin() {
  const { data, failed } = useAkademin();
  return <AkademinBody data={data} failed={failed} />;
}

/** Laddar, fel eller innehåll. Felet visas bara när det inte finns något att visa, så att ett misslyckat omläsande inte tar bort en pågående lektion. */
export function AkademinBody({ data, failed, initialView = { kind: 'start' } }: { data: AkademinData | null; failed: boolean; initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  // Byter vid midnatt och när appen visas igen, så att kortet och repetitionen följer dagen.
  const today = useToday();
  const back = () => setView(backFrom(view));
  // Varje ny vy börjar överst.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [view]);

  if (failed && !data)
    return (
      <div className="akademin">
        <div className="empty" role="alert">
          <p>Det gick inte att läsa dina framsteg i Akademin. Stäng appen helt och öppna den igen.</p>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="akademin" role="status" aria-busy="true" aria-label="Laddar Akademin">
        <div className="card kunskap-skeleton" />
        <div className="card kunskap-skeleton" />
      </div>
    );

  const lesson = view.kind === 'lesson' ? lessonById(view.id) : undefined;
  return (
    <div className="akademin">
      {view.kind !== 'start' && view.kind !== 'companies' && (
        <button type="button" className="akademin-back" onClick={back}>
          Tillbaka
        </button>
      )}
      {view.kind === 'start' && (
        <StartPage
          data={data}
          today={today}
          onOpenLesson={(id) => setView({ kind: 'lesson', id, from: 'start' })}
          onReview={() => setView({ kind: 'review', ids: reviewToday(data.answers, today) })}
          onGlossary={() => setView({ kind: 'glossary' })}
          onCompanies={() => setView({ kind: 'companies' })}
        />
      )}
      {lesson && <LessonView key={lesson.id} lesson={lesson} onClose={back} />}
      {view.kind === 'lesson' && !lesson && (
        <div className="empty" role="status">
          <p>Lektionen finns inte i den här versionen av appen.</p>
        </div>
      )}
      {view.kind === 'review' && <Review ids={view.ids} onClose={back} />}
      {view.kind === 'companies' && <Companies data={data} onExit={back} />}
      {view.kind === 'glossary' && <Glossary progress={data.progress} onOpenLesson={(id) => setView({ kind: 'lesson', id, from: 'glossary' })} />}
    </div>
  );
}
