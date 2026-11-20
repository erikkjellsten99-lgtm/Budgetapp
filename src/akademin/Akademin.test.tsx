import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Kunskap from '../kunskap/Kunskap';
import { StartPage, todayCard } from './Akademin';
import type { AkademinData } from './akademinStore';
import { glossaryEntries } from './Glossary';
import { createQuiz, QuizView } from './Quiz';
import { LessonView } from './LessonView';
import { ALL_LESSONS, lessonById } from './kurser';
import type { Answer, Progress } from './types';

const TODAY = '2026-11-20';
const EMPTY: AkademinData = { progress: [], answers: [], companies: [], reports: [], journal: [], habit: null };
const done = (...ids: string[]): Progress[] => ids.map((id) => ({ id, doneAt: '2026-11-01' }));
const withData = (patch: Partial<AkademinData>): AkademinData => ({ ...EMPTY, ...patch });
const noop = () => {};
const start = (data: AkademinData) =>
  renderToStaticMarkup(<StartPage data={data} today={TODAY} onOpenLesson={noop} onReview={noop} onGlossary={noop} />);

const lesson1 = lessonById('k1-01')!;

describe('Akademins startsida', () => {
  it('med tom databas: Dagens lektion, första lektionen och Börja, ingen Repetition', () => {
    const html = start(EMPTY);
    expect(html).toContain('Dagens lektion');
    expect(html).toContain('Vad en aktie är');
    expect(html).toContain('Börja');
    expect(html).not.toContain('Repetition');
  });

  it('kurslistan visar Grunderna med 0/7 och kurs 2 till 10 som kommer', () => {
    const html = start(EMPTY);
    expect(html).toContain('Grunderna');
    expect(html).toContain('0/7');
    for (const title of ['Företagets ekonomi', 'Examensarbete']) expect(html).toContain(title);
    expect((html.match(/kommer/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it('alla lektioner går att öppna från kurslistan, och klara har en bock', () => {
    const html = start(withData({ progress: done('k1-01') }));
    for (const l of ALL_LESSONS) expect(html).toContain(l.title);
    expect(html).toContain('1/7');
    expect((html.match(/akademin-check/g) ?? []).length).toBe(1);
    expect(html).toContain('Index och vad marknaden är');
  });

  it('Mina bolag och Beslutsdagbok är rader som kommer', () => {
    const html = start(EMPTY);
    expect(html).toContain('Mina bolag');
    expect(html).toContain('Beslutsdagbok');
  });

  it('en lektion klar idag: Klar för idag och en länk till nästa lektion', () => {
    const html = start(withData({ progress: [{ id: 'k1-01', doneAt: TODAY }] }));
    expect(html).toContain('Klar för idag');
    expect(html).toContain('Hur börsen fungerar och hur kursen sätts');
    expect(html).not.toContain('>Börja<');
  });

  it('en Answer som förfaller idag ger raden Repetition · 1 fråga, flera ger frågor', () => {
    const due = (id: string): Answer => ({ id, streak: 0, due: TODAY, last: '2026-11-19' });
    expect(start(withData({ answers: [due('k1-01-q1')] }))).toContain('Repetition · 1 fråga');
    expect(start(withData({ answers: [due('k1-01-q1'), due('k1-01-q2')] }))).toContain('Repetition · 2 frågor');
    expect(start(withData({ answers: [{ id: 'k1-01-q1', streak: 1, due: '2026-12-01', last: TODAY }] }))).not.toContain('Repetition');
  });

  it('alla sju klara och inget att repetera: kortet säger att kurs 2 kommer', () => {
    const all = withData({ progress: done(...ALL_LESSONS.map((l) => l.id)) });
    expect(todayCard(all.progress, all.answers, TODAY)).toEqual({ kind: 'coming' });
    expect(start(all)).toContain('Kurs 2 kommer');
  });

  it('alla klara men något att repetera: kortet erbjuder repetitionen', () => {
    const progress = done(...ALL_LESSONS.map((l) => l.id));
    const answers: Answer[] = [{ id: 'k1-01-q1', streak: 0, due: TODAY, last: '2026-11-19' }];
    expect(todayCard(progress, answers, TODAY)).toEqual({ kind: 'review' });
    expect(start(withData({ progress, answers }))).toContain('Repetera nu');
  });

  it('kortets lägen i övrigt', () => {
    expect(todayCard([], [], TODAY)).toMatchObject({ kind: 'next', lesson: { id: 'k1-01' } });
    expect(todayCard([{ id: 'k1-01', doneAt: TODAY }], [], TODAY)).toMatchObject({ kind: 'done', next: { id: 'k1-02' } });
    const last = ALL_LESSONS.map((l) => ({ id: l.id, doneAt: TODAY }));
    expect(todayCard(last, [], TODAY)).toEqual({ kind: 'done', next: null });
  });
});

describe('Quiz', () => {
  const ids = lesson1.questions.map((q) => q.id);

  it('fyra rätt svar ger onDone en gång med allt rätt på första försöket', () => {
    const onDone = vi.fn();
    const quiz = createQuiz(ids, onDone);
    for (const q of lesson1.questions) quiz.answer(q.id, true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ [ids[0]]: true, [ids[1]]: true, [ids[2]]: true, [ids[3]]: true });
  });

  it('ett fel svar visar förklaringen, och frågan kommer igen efter de andra', () => {
    const onDone = vi.fn();
    const quiz = createQuiz(ids, onDone);
    quiz.answer(ids[0], false);
    expect(quiz.state().showingWhy).toBe(ids[0]);
    const q1 = lesson1.questions[0];
    const html = renderToStaticMarkup(<QuizView questions={lesson1.questions} state={quiz.state()} onAnswer={noop} onContinue={noop} />);
    expect(html).toContain(q1.why);
    quiz.next();
    expect(quiz.state().queue).toEqual([ids[1], ids[2], ids[3], ids[0]]);
    for (const id of ids.slice(1)) quiz.answer(id, true);
    expect(onDone).not.toHaveBeenCalled();
    quiz.answer(ids[0], true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ [ids[0]]: false, [ids[1]]: true, [ids[2]]: true, [ids[3]]: true });
  });

  it('frågorna och svaren visas i datans ordning', () => {
    const html = renderToStaticMarkup(<QuizView questions={lesson1.questions} state={{ queue: ids, firstTry: {}, showingWhy: null }} onAnswer={noop} onContinue={noop} />);
    const q = lesson1.questions[0];
    const at = q.options.map((o) => html.indexOf(o.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('Fråga 1 av 4');
  });

  it('två snabba tryck på samma svar räknas som ett, och det blir en Progress', async () => {
    const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    const store = await import('./akademinStore');
    const saved: Promise<void>[] = [];
    const quiz = createQuiz(ids, (firstTry) => saved.push(store.completeLesson('k1-01', firstTry, TODAY)));
    for (const id of ids) {
      quiz.answer(id, true);
      quiz.answer(id, true);
    }
    quiz.answer(ids[3], true);
    await Promise.all(saved);
    expect(saved).toHaveLength(1);
    const data = await store.loadAkademin();
    expect(data.progress).toEqual([{ id: 'k1-01', doneAt: TODAY }]);
    expect(data.answers).toHaveLength(4);
    expect(data.answers.every((a) => a.streak === 1)).toBe(true);
    // Efter quizet visar startsidan Klar för idag och en länk till nästa lektion.
    const html = renderToStaticMarkup(<StartPage data={data} today={TODAY} onOpenLesson={noop} onReview={noop} onGlossary={noop} />);
    expect(html).toContain('Klar för idag');
    expect(html).toContain('Hur börsen fungerar');
    vi.unstubAllGlobals();
  });
});

describe('lektionen', () => {
  it('visar text, exempel, Det viktigaste, nya ord, källor med datum och Till frågorna', () => {
    const l = lesson1;
    const html = renderToStaticMarkup(<LessonView lesson={l} today={TODAY} onClose={noop} />);
    expect(html).toContain(l.title);
    expect(html).toContain(l.example.title);
    expect(html).toContain('Det viktigaste');
    for (const k of l.key) expect(html).toContain(k.replace(/&/g, '&amp;'));
    expect(html).toContain('Nya ord');
    expect(html).toContain(l.terms[0].word);
    expect(html).toContain(l.sources[0].url);
    expect(html).toContain(`kontrollerad ${l.sources[0].checked}`);
    expect(html).toContain('Till frågorna');
  });
});

describe('ordlistan', () => {
  const progress = done('k1-01');
  it('visar bara ord från klara lektioner, med länk till lektionen', () => {
    const entries = glossaryEntries(progress, '');
    expect(entries.length).toBe(lesson1.terms.length);
    expect(entries.every((e) => e.lessonId === 'k1-01')).toBe(true);
    expect(glossaryEntries([], '')).toEqual([]);
  });

  it('går att söka i, utan hänsyn till stora bokstäver', () => {
    const word = lesson1.terms[0].word;
    expect(glossaryEntries(progress, word.toUpperCase()).map((e) => e.word)).toContain(word);
    expect(glossaryEntries(progress, 'xyzzy-finns-inte')).toEqual([]);
  });
});

describe('Akademin i Mindhub', () => {
  it('lägesväljaren har knappen Akademin sist, och Akademin visar en laddningsruta medan koden hämtas', () => {
    const html = renderToStaticMarkup(<Kunskap />);
    expect(html).toContain('>Akademin</button>');
    expect(html.indexOf('>Upptäck</button>')).toBeLessThan(html.indexOf('>Akademin</button>'));
    const open = renderToStaticMarkup(<Kunskap initialMode="akademin" />);
    expect(open).toContain('Akademin');
    expect(open).toContain('aria-label="Laddar Akademin"');
    expect(open).not.toContain('Följer');
  });
});

afterEach(() => vi.unstubAllGlobals());
