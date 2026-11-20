// Akademin: ordlistan. Bara ord från klara lektioner, sökbar, med länk till lektionen.
import { useState } from 'react';
import { lessonById } from './kurser';
import type { Progress } from './types';

export interface GlossaryEntry {
  word: string;
  meaning: string;
  lessonId: string;
  lessonTitle: string;
}

/** Orden i klara lektioner i bokstavsordning, filtrerade på sökningen (ord eller förklaring). */
export function glossaryEntries(progress: Progress[], query: string): GlossaryEntry[] {
  const q = query.trim().toLocaleLowerCase('sv');
  const entries: GlossaryEntry[] = [];
  for (const p of progress) {
    const lesson = lessonById(p.id);
    if (!lesson) continue;
    for (const t of lesson.terms) entries.push({ word: t.word, meaning: t.meaning, lessonId: lesson.id, lessonTitle: lesson.title });
  }
  return entries
    .filter((e) => !q || e.word.toLocaleLowerCase('sv').includes(q) || e.meaning.toLocaleLowerCase('sv').includes(q))
    .sort((a, b) => a.word.localeCompare(b.word, 'sv'));
}

export default function Glossary({ progress, onOpenLesson }: { progress: Progress[]; onOpenLesson: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const all = glossaryEntries(progress, '');
  const shown = glossaryEntries(progress, query);
  return (
    <section className="akademin-glossary" aria-labelledby="akademin-glossary-title">
      <h3 id="akademin-glossary-title">Ordlista</h3>
      {all.length === 0 ? (
        <div className="empty">
          <p>Orden från lektionerna du läst samlas här. Börja med dagens lektion.</p>
        </div>
      ) : (
        <>
          <input
            type="search"
            className="akademin-search"
            placeholder="Sök ord"
            aria-label="Sök i ordlistan"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {shown.length === 0 ? (
            <div className="empty">
              <p>Inget ord matchar sökningen.</p>
            </div>
          ) : (
            <ul className="akademin-terms">
              {shown.map((e) => (
                <li key={`${e.lessonId}-${e.word}`}>
                  <p className="akademin-term-word">{e.word}</p>
                  <p>{e.meaning}</p>
                  <button type="button" className="akademin-link" onClick={() => onOpenLesson(e.lessonId)}>
                    {e.lessonTitle}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
