// Akademin: kurserna och lektionerna. Fast innehåll, en fil per lektion. Regler: se ../CLAUDE.md.
// Ordningen här är ordningen i appen. Ett id ändras aldrig efter publicering.
import type { Course, Lesson, Question } from '../types';
import { K1_01 } from './kurs-1/01';
import { K1_02 } from './kurs-1/02';
import { K1_03 } from './kurs-1/03';
import { K1_04 } from './kurs-1/04';
import { K1_05 } from './kurs-1/05';
import { K1_06 } from './kurs-1/06';
import { K1_07 } from './kurs-1/07';

export const COURSES: Course[] = [
  { id: 1, title: 'Grunderna', lessons: [K1_01, K1_02, K1_03, K1_04, K1_05, K1_06, K1_07] },
];

export const ALL_LESSONS: Lesson[] = COURSES.flatMap(c => c.lessons);

/** Kurserna som ännu inte är skrivna. Visas som kommer. */
export const PLANNED: { id: number; title: string }[] = [
  { id: 2, title: 'Företagets ekonomi' },
  { id: 3, title: 'Kvartalsrapporten' },
  { id: 4, title: 'Värdering' },
  { id: 5, title: 'Affärsanalys' },
  { id: 6, title: 'Makro och marknaden' },
  { id: 7, title: 'Nylistningar och småbolag' },
  { id: 8, title: 'Portfölj och risk' },
  { id: 9, title: 'Beslut och psykologi' },
  { id: 10, title: 'Examensarbete' },
];

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find(l => l.id === id);
}

export function questionById(id: string): { lesson: Lesson; question: Question } | undefined {
  for (const lesson of ALL_LESSONS) {
    const question = lesson.questions.find(q => q.id === id);
    if (question) return { lesson, question };
  }
  return undefined;
}
