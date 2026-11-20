import { describe, expect, it } from 'vitest';
import type { Lesson } from '../types';
import { ALL_LESSONS, COURSES, PLANNED, lessonById, questionById } from './index';

// Titlarna ur specens avsnitt Kurs 1. Lektion 3 står utan citattecken, eftersom `"` inte får finnas i texten.
const KURS_1 = [
  'Vad en aktie är',
  'Hur börsen fungerar och hur kursen sätts',
  'Index och vad marknaden är',
  'Aktie, fond eller ETF',
  'ISK, kapitalförsäkring och aktie- och fondkonto',
  'Avkastning, risk och ränta på ränta',
  'Så tittar du på ett bolag första gången',
];

// Titlarna ur uppdraget för kurs 2.
const KURS_2 = [
  'Resultaträkningen: från omsättning till vinst',
  'Balansräkningen: vad bolaget äger och är skyldigt',
  'Kassaflödesanalysen: vart pengarna tog vägen',
  'Så hänger de tre räkningarna ihop',
  'Marginaler och lönsamhet',
  'Skulder och finansiell styrka',
  'Årsredovisningen: var allt står',
];

const FORBIDDEN = /["”–—]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

function bodyWords(l: Lesson): number {
  const parts = l.body.flatMap(b => (b.kind === 'list' ? b.items : [b.text]));
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

function allTexts(l: Lesson): string[] {
  return [
    l.title,
    ...l.body.flatMap(b => (b.kind === 'list' ? b.items : [b.text])),
    l.example.title,
    l.example.text,
    l.example.source.title,
    ...l.key,
    ...l.terms.flatMap(t => [t.word, t.meaning]),
    ...l.sources.map(s => s.title),
    ...l.questions.flatMap(q => [q.text, ...q.options, q.why]),
    l.lab ?? '',
  ];
}

describe('Akademin: lektionernas form', () => {
  it('kurs 1 har de sju lektionerna i specens ordning', () => {
    expect(COURSES[0].id).toBe(1);
    expect(COURSES[0].title).toBe('Grunderna');
    expect(COURSES[0].lessons.map(l => l.title)).toEqual(KURS_1);
  });

  it('kurs 2 har de sju lektionerna i ordning', () => {
    expect(COURSES[1].id).toBe(2);
    expect(COURSES[1].title).toBe('Företagets ekonomi');
    expect(COURSES[1].lessons.map(l => l.title)).toEqual(KURS_2);
  });

  it('ALL_LESSONS är alla kursers lektioner i ordning', () => {
    expect(ALL_LESSONS).toEqual(COURSES.flatMap(c => c.lessons));
  });

  it('id följer k<kurs>-<nn> och k<kurs>-<nn>-q<n>, unika i hela ALL_LESSONS', () => {
    const ids = ALL_LESSONS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const qids = ALL_LESSONS.flatMap(l => l.questions.map(q => q.id));
    expect(new Set(qids).size).toBe(qids.length);
    for (const c of COURSES) {
      c.lessons.forEach((l, i) => {
        expect(l.course, l.id).toBe(c.id);
        expect(l.number, l.id).toBe(i + 1);
        expect(l.id).toBe(`k${c.id}-${pad(i + 1)}`);
        l.questions.forEach((q, j) => expect(q.id).toBe(`${l.id}-q${j + 1}`));
      });
    }
  });

  it('lessonById och questionById hittar rätt', () => {
    for (const l of ALL_LESSONS) {
      expect(lessonById(l.id)).toBe(l);
      for (const q of l.questions) expect(questionById(q.id)).toEqual({ lesson: l, question: q });
    }
    expect(lessonById('k9-99')).toBeUndefined();
    expect(questionById('k9-99-q1')).toBeUndefined();
  });

  it('texten i body har 600 till 900 ord', () => {
    for (const l of ALL_LESSONS) {
      const n = bodyWords(l);
      expect(n, `${l.id} (${n} ord)`).toBeGreaterThanOrEqual(600);
      expect(n, `${l.id} (${n} ord)`).toBeLessThanOrEqual(900);
      for (const b of l.body) {
        if (b.kind === 'list') {
          expect(b.items.length, l.id).toBeGreaterThan(0);
          for (const it of b.items) expect(it.trim().length, l.id).toBeGreaterThan(0);
        } else expect(b.text.trim().length, l.id).toBeGreaterThan(0);
      }
    }
  });

  it('exakt 4 frågor med 4 olika svar, rätt svar i 0 till 3 och en förklaring på minst 40 tecken', () => {
    for (const l of ALL_LESSONS) {
      expect(l.questions, l.id).toHaveLength(4);
      for (const q of l.questions) {
        expect(q.text.trim().length, q.id).toBeGreaterThan(0);
        expect(q.options, q.id).toHaveLength(4);
        for (const o of q.options) expect(o.trim().length, q.id).toBeGreaterThan(0);
        expect(new Set(q.options.map(o => o.trim())).size, q.id).toBe(4);
        expect([0, 1, 2, 3], q.id).toContain(q.correct);
        expect(q.why.trim().length, q.id).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('minst en källa, och varje källa (även exemplets) har https och kontrolldatum', () => {
    for (const l of ALL_LESSONS) {
      expect(l.sources.length, l.id).toBeGreaterThanOrEqual(1);
      for (const s of [...l.sources, l.example.source]) {
        expect(s.url, l.id).toMatch(/^https:\/\//);
        expect(s.checked, l.id).toMatch(DATE);
        expect(s.title.trim().length, l.id).toBeGreaterThan(0);
      }
    }
  });

  it('exempel, tre rader i key och ordlista finns', () => {
    for (const l of ALL_LESSONS) {
      expect(l.example.title.trim().length, l.id).toBeGreaterThan(0);
      expect(l.example.text.trim().length, l.id).toBeGreaterThan(0);
      expect(l.key, l.id).toHaveLength(3);
      for (const k of l.key) expect(k.trim().length, l.id).toBeGreaterThan(0);
      expect(l.terms.length, l.id).toBeGreaterThan(0);
      for (const t of l.terms) {
        expect(t.word.trim().length, l.id).toBeGreaterThan(0);
        expect(t.meaning.trim().length, l.id).toBeGreaterThan(0);
      }
    }
  });

  it('inga citattecken eller tankstreck i någon text', () => {
    for (const l of ALL_LESSONS) {
      for (const t of allTexts(l)) expect(t, `${l.id}: ${t}`).not.toMatch(FORBIDDEN);
    }
  });

  it('lektion 7 i kurs 2 har labb som inte pekar på Mina bolag', () => {
    const lab = lessonById('k2-07')?.lab ?? '';
    expect(lab.length).toBeGreaterThan(0);
    expect(lab).not.toContain('Mina bolag');
  });

  it('lektion 7 i kurs 1 har labb', () => {
    expect(lessonById('k1-07')?.lab).toBe(
      'Lägg in ditt första bolag i Mina bolag och skriv tre meningar om hur det tjänar pengar.',
    );
  });

  it('planerade kurser är 3 till 10', () => {
    expect(PLANNED.map(p => p.id)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(PLANNED.map(p => p.title)).toEqual([
      'Kvartalsrapporten',
      'Värdering',
      'Affärsanalys',
      'Makro och marknaden',
      'Nylistningar och småbolag',
      'Portfölj och risk',
      'Beslut och psykologi',
      'Examensarbete',
    ]);
  });
});
