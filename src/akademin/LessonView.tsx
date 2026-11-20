// Akademin: en lektion. Först texten, sedan frågorna, och när alla är rätt sparas lektionen som klar.
import { useEffect, useState } from 'react';
import { completeLesson } from './akademinStore';
import Quiz from './Quiz';
import type { Block, Lesson } from './types';

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'h' ? (
          <h3 key={i}>{b.text}</h3>
        ) : b.kind === 'list' ? (
          <ul key={i}>
            {b.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </>
  );
}

type Phase = 'read' | 'quiz' | 'done';

export function LessonView({ lesson, today, onClose }: { lesson: Lesson; today: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('read');
  const [saveFailed, setSaveFailed] = useState(false);

  // Varje steg börjar överst, så att man inte hamnar mitt i nästa del.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [phase]);

  function finished(firstTry: Record<string, boolean>) {
    completeLesson(lesson.id, firstTry, today).catch(() => setSaveFailed(true));
    setPhase('done');
  }

  return (
    <article className="akademin-lesson">
      <p className="akademin-meta">
        Kurs {lesson.course} · lektion {lesson.number}
      </p>
      <h3 className="akademin-lesson-title">{lesson.title}</h3>

      {phase === 'read' && (
        <>
          <div className="akademin-text">
            <Blocks blocks={lesson.body} />
          </div>
          <aside className="akademin-example">
            <p className="akademin-example-label">Exempel</p>
            <h4>{lesson.example.title}</h4>
            <p>{lesson.example.text}</p>
            <p className="akademin-source">
              <a href={lesson.example.source.url} target="_blank" rel="noopener noreferrer">
                {lesson.example.source.title}
                <span className="visually-hidden"> (öppnas i ny flik)</span>
              </a>
            </p>
          </aside>
          <section className="akademin-key">
            <h4>Det viktigaste</h4>
            <ul>
              {lesson.key.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
          {lesson.terms.length > 0 && (
            <section>
              <h4>Nya ord</h4>
              <dl className="akademin-newterms">
                {lesson.terms.map((t) => (
                  <div key={t.word}>
                    <dt>{t.word}</dt>
                    <dd>{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section>
            <h4>Källor</h4>
            <ul className="akademin-sources">
              {[lesson.example.source, ...lesson.sources.filter((s) => s.url !== lesson.example.source.url)].map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                    <span className="visually-hidden"> (öppnas i ny flik)</span>
                  </a>
                  <span className="akademin-checked">kontrollerad {s.checked}</span>
                </li>
              ))}
            </ul>
          </section>
          <button type="button" className="primary akademin-wide" onClick={() => setPhase('quiz')}>
            Till frågorna
          </button>
        </>
      )}

      {phase === 'quiz' && <Quiz questions={lesson.questions} onDone={finished} />}

      {phase === 'done' && (
        <section className="akademin-finish" role="status">
          <p className="akademin-finish-title">Lektionen är klar.</p>
          {saveFailed && <p className="akademin-error">Det gick inte att spara att lektionen är klar. Öppna den igen och svara på frågorna.</p>}
          {lesson.lab && (
            <div className="akademin-lab">
              <p className="akademin-example-label">Uppgift</p>
              <p>{lesson.lab}</p>
            </div>
          )}
          <button type="button" className="primary akademin-wide" onClick={onClose}>
            Klar
          </button>
        </section>
      )}
    </article>
  );
}

export default LessonView;
