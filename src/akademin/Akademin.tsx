// Akademin: kursen i aktier, ett läge i Mindhub. Startsidan, repetitionen och vägen till lektionerna och ordlistan.
// Läser och sparar bara framsteg och svar (akademinStore). Ingenting här rör ekonomin.
import { useEffect, useState } from 'react';
import { todayKey } from '../vanor/dates';
import { doneToday, nextLesson, recordReview, useAkademin, type AkademinData } from './akademinStore';
import Glossary, { glossaryEntries } from './Glossary';
import { COURSES, PLANNED, lessonById, questionById } from './kurser';
import { LessonView } from './LessonView';
import { dueQuestions } from './logic';
import Quiz, { createQuiz } from './Quiz';
import type { Answer, Lesson, Progress } from './types';
import './akademin.css';

export type TodayCard = { kind: 'next'; lesson: Lesson } | { kind: 'done'; next: Lesson | null } | { kind: 'review' } | { kind: 'coming' };

/** Vad kortet Dagens lektion ska säga: nästa lektion, klar för idag, repetition eller att nästa kurs kommer. */
export function todayCard(progress: Progress[], answers: Answer[], today: string): TodayCard {
  const next = nextLesson(progress);
  if (doneToday(progress, today)) return { kind: 'done', next };
  if (next) return { kind: 'next', lesson: next };
  return dueQuestions(answers, today).length > 0 ? { kind: 'review' } : { kind: 'coming' };
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
            <p className="akademin-meta">Du har läst alla lektionerna i kursen. Kurs 2 kommer.</p>
          )}
        </>
      )}
      {card.kind === 'review' && (
        <>
          <p className="akademin-meta">Alla lektioner i kursen är lästa. Några frågor är värda en repetition.</p>
          <button type="button" className="primary" onClick={onReview}>
            Repetera nu
          </button>
        </>
      )}
      {card.kind === 'coming' && <p className="akademin-meta">Alla lektioner i kursen är lästa och inget väntar på repetition. Kurs 2 kommer.</p>}
    </section>
  );
}

export function StartPage({
  data,
  today,
  onOpenLesson,
  onReview,
  onGlossary,
}: {
  data: AkademinData;
  today: string;
  onOpenLesson: (id: string) => void;
  onReview: () => void;
  onGlossary: () => void;
}) {
  const doneIds = new Set(data.progress.map((p) => p.id));
  const due = dueQuestions(data.answers, today).length;
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
        <div className="akademin-row akademin-soon">
          <span>Mina bolag</span>
          <span className="akademin-muted">kommer</span>
        </div>
        <div className="akademin-row akademin-soon">
          <span>Beslutsdagbok</span>
          <span className="akademin-muted">kommer</span>
        </div>
      </div>
    </div>
  );
}

/** Repetitionens quiz: varje fråga sparas med `record` vid första svaret, och onDone anropas när alla är rätt. */
export function reviewQuiz(
  ids: string[],
  today: string,
  onSaveFailed: () => void,
  onDone: () => void,
  record: (id: string, right: boolean, today: string) => Promise<void> = recordReview,
) {
  return createQuiz(ids, onDone, (id, right) => void record(id, right, today).catch(onSaveFailed));
}

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
export function Review({ ids, today, onClose, record }: { ids: string[]; today: string; onClose: () => void; record?: (id: string, right: boolean, today: string) => Promise<void> }) {
  const [finished, setFinished] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [quiz] = useState(() => reviewQuiz(ids, today, () => setSaveFailed(true), () => setFinished(true), record));
  const questions = ids.flatMap((id) => questionById(id)?.question ?? []);
  if (finished) return <ReviewFinished saveFailed={saveFailed} onClose={onClose} />;
  return (
    <div>
      <h3 className="akademin-lesson-title">Repetition</h3>
      <Quiz questions={questions} quiz={quiz} />
    </div>
  );
}

type View = { kind: 'start' } | { kind: 'lesson'; id: string } | { kind: 'review'; ids: string[] } | { kind: 'glossary' };

export default function Akademin() {
  const { data, failed } = useAkademin();
  return <AkademinBody data={data} failed={failed} />;
}

/** Laddar, fel eller innehåll. Felet visas bara när det inte finns något att visa, så att ett misslyckat omläsande inte tar bort en pågående lektion. */
export function AkademinBody({ data, failed }: { data: AkademinData | null; failed: boolean }) {
  const [view, setView] = useState<View>({ kind: 'start' });
  const today = todayKey();
  const back = () => setView({ kind: 'start' });
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
      {view.kind !== 'start' && (
        <button type="button" className="akademin-back" onClick={back}>
          Tillbaka
        </button>
      )}
      {view.kind === 'start' && (
        <StartPage
          data={data}
          today={today}
          onOpenLesson={(id) => setView({ kind: 'lesson', id })}
          onReview={() => setView({ kind: 'review', ids: dueQuestions(data.answers, today) })}
          onGlossary={() => setView({ kind: 'glossary' })}
        />
      )}
      {lesson && <LessonView key={lesson.id} lesson={lesson} today={today} onClose={back} />}
      {view.kind === 'review' && <Review ids={view.ids} today={today} onClose={back} />}
      {view.kind === 'glossary' && <Glossary progress={data.progress} onOpenLesson={(id) => setView({ kind: 'lesson', id })} />}
    </div>
  );
}
