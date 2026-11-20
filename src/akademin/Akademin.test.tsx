import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Kunskap, { AkademinUnavailable, EYEBROW, MODES } from '../kunskap/Kunskap';
import { AkademinBody, backFrom, Review, ReviewFinished, reviewQuiz, StartPage, todayCard } from './Akademin';
import type { AkademinData } from './akademinStore';
import { glossaryEntries } from './Glossary';
import { createQuiz, QuizView } from './Quiz';
import { LessonDone, LessonView, lessonQuiz } from './LessonView';
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
    for (const name of ['Mina bolag', 'Beslutsdagbok']) expect(html).toContain(`<span>${name}</span><span class="akademin-muted">kommer</span>`);
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
    const html = renderToStaticMarkup(<LessonView lesson={l} onClose={noop} />);
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

describe('lägesväljaren', () => {
  it('Akademin är sist, har en rubrik, och knappen är intryckt bara när läget är valt', () => {
    expect(MODES.at(-1)).toEqual({ id: 'akademin', label: 'Akademin' });
    expect(EYEBROW.akademin).toBe('Akademin');
    const button = (html: string) => html.match(/<button[^>]*aria-pressed="(true|false)"[^>]*>Akademin<\/button>/)?.[1];
    expect(button(renderToStaticMarkup(<Kunskap />))).toBe('false');
    expect(button(renderToStaticMarkup(<Kunskap initialMode="akademin" />))).toBe('true');
  });

  it('en Akademin-fil som inte gick att hämta ger ett felmeddelande med ny försök-knapp', () => {
    const html = renderToStaticMarkup(<AkademinUnavailable />);
    expect(html).toContain('Akademin kunde inte laddas. Kontrollera nätet och försök igen.');
    expect(html).toContain('Försök igen');
    expect(html).toContain('role="alert"');
  });
});

describe('Akademins tillstånd', () => {
  it('laddar: en meddelandeyta med role status', () => {
    const html = renderToStaticMarkup(<AkademinBody data={null} failed={false} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it('fel utan data visar felet, men fel med data visar innehållet', () => {
    expect(renderToStaticMarkup(<AkademinBody data={null} failed />)).toContain('Det gick inte att läsa dina framsteg');
    const html = renderToStaticMarkup(<AkademinBody data={EMPTY} failed />);
    expect(html).not.toContain('Det gick inte att läsa');
    expect(html).toContain('Dagens lektion');
  });
});

describe('repetitionen', () => {
  const q = ['k1-01-q1', 'k1-01-q2'];
  const wait = () => Promise.resolve();

  it('raden är en knapp, och repetitionen visar första frågan', () => {
    const due: Answer = { id: q[0], streak: 0, due: TODAY, last: '2026-11-19' };
    expect(start(withData({ answers: [due] }))).toMatch(/<button[^>]*akademin-row[^>]*><span>Repetition · 1 fråga<\/span>/);
    const html = renderToStaticMarkup(<Review ids={[q[0]]} onClose={noop} />);
    expect(html).toContain('Repetition');
    expect(html).toContain(lesson1.questions[0].text);
  });

  it('varje fråga sparas vid första svaret, och ett fel svar sparas som fel en gång', async () => {
    const record = vi.fn(wait);
    const onDone = vi.fn();
    const quiz = reviewQuiz(q, () => TODAY, noop, onDone, record);
    quiz.answer(q[0], false);
    quiz.next();
    quiz.answer(q[1], true);
    quiz.answer(q[0], true);
    expect(record.mock.calls).toEqual([
      [q[0], false, TODAY],
      [q[1], true, TODAY],
    ]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ett misslyckat sparande meddelas, och klart-läget säger det', async () => {
    const failed = vi.fn();
    const quiz = reviewQuiz([q[0]], () => TODAY, failed, noop, () => Promise.reject(new Error('x')));
    quiz.answer(q[0], true);
    await wait();
    await wait();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<ReviewFinished saveFailed={false} onClose={noop} />)).toContain('Repetitionen är klar för idag.');
    expect(renderToStaticMarkup(<ReviewFinished saveFailed onClose={noop} />)).toContain('Något svar gick inte att spara.');
  });
});

describe('efter lektionens quiz', () => {
  it('visar uppgiften (lab) när lektionen har en, och annars ingen', () => {
    const withLab = lessonById('k1-07')!;
    expect(renderToStaticMarkup(<LessonDone lesson={withLab} saveFailed={false} onClose={noop} />)).toContain(withLab.lab!.slice(0, 20));
    const html = renderToStaticMarkup(<LessonDone lesson={lesson1} saveFailed={false} onClose={noop} />);
    expect(html).toContain('Lektionen är klar.');
    expect(html).not.toContain('Uppgift');
  });

  it('om sparningen misslyckades säger rubriken att lektionen inte sparades', () => {
    const html = renderToStaticMarkup(<LessonDone lesson={lesson1} saveFailed onClose={noop} />);
    expect(html).toContain('Lektionen sparades inte.');
    expect(html).not.toContain('Lektionen är klar.');
  });
});

describe('repetitionen per dag', () => {
  const due = (id: string): Answer => ({ id, streak: 0, due: TODAY, last: '2026-11-19' });

  it('högst tre frågor om dagen, fel svar räknas också, och nästa dag erbjuds de igen', async () => {
    const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    const store = await import('./akademinStore');
    const { reviewToday } = await import('./logic');
    // En lektion klar 2026-11-19 ger fyra svar som förfaller 2026-11-20.
    await store.completeLesson('k1-01', { 'k1-01-q1': true, 'k1-01-q2': true, 'k1-01-q3': true, 'k1-01-q4': true }, '2026-11-19');
    let data = await store.loadAkademin();
    const ids = reviewToday(data.answers, TODAY);
    expect(ids).toEqual(['k1-01-q1', 'k1-01-q2', 'k1-01-q3']);
    const page = (d: AkademinData, day: string) =>
      renderToStaticMarkup(<StartPage data={d} today={day} onOpenLesson={noop} onReview={noop} onGlossary={noop} />);
    expect(page(data, TODAY)).toContain('Repetition · 3 frågor');

    await store.recordReview(ids[0], false, TODAY);
    await store.recordReview(ids[1], true, TODAY);
    await store.recordReview(ids[2], true, TODAY);
    data = await store.loadAkademin();
    expect(data.answers.filter((a) => a.reviewedOn === TODAY)).toHaveLength(3);
    expect(reviewToday(data.answers, TODAY)).toEqual([]);
    expect(page(data, TODAY)).not.toContain('Repetition');
    const all = ALL_LESSONS.map((l) => ({ id: l.id, doneAt: '2026-11-01' }));
    expect(todayCard(all, data.answers, TODAY)).toEqual({ kind: 'coming' });

    // Nästa dag: den fjärde och den som blev fel.
    expect(reviewToday(data.answers, '2026-11-21')).toEqual(['k1-01-q4', 'k1-01-q1']);
    expect(page(data, '2026-11-21')).toContain('Repetition · 2 frågor');
    expect(todayCard(all, data.answers, '2026-11-21')).toEqual({ kind: 'review' });
  });

  it('ett svar på en okänd fråga räknas inte, erbjuds inte, och repetitionen av de kända blir klar', () => {
    const answers = [due('k9-01-q1'), due('k1-01-q1')];
    expect(start(withData({ answers }))).toContain('Repetition · 1 fråga');
    const all = ALL_LESSONS.map((l) => ({ id: l.id, doneAt: '2026-11-01' }));
    expect(todayCard(all, [due('k9-01-q1')], TODAY)).toEqual({ kind: 'coming' });
    expect(start(withData({ answers: [due('k9-01-q1')] }))).not.toContain('Repetition');

    // Repetitionen får en okänd fråga: den hoppas över och quizet blir klart.
    const onDone = vi.fn();
    const quiz = reviewQuiz(['k9-01-q1', 'k1-01-q1'], () => TODAY, noop, onDone, vi.fn(() => Promise.resolve()));
    quiz.answer('k1-01-q1', true);
    expect(onDone).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(<Review ids={['k9-01-q1', 'k1-01-q1']} onClose={noop} />);
    expect(html).toContain(lesson1.questions[0].text);
    expect(html).toContain('Fråga 1 av 1');
  });
});

describe('dagen läses när svaret ges', () => {
  it('repetitionen sparar med datumet då frågan besvaras, inte då quizet skapades', () => {
    let day = '2026-11-20';
    const record = vi.fn(() => Promise.resolve());
    const quiz = reviewQuiz(['k1-01-q1'], () => day, noop, noop, record);
    day = '2026-11-21';
    quiz.answer('k1-01-q1', true);
    expect(record).toHaveBeenCalledWith('k1-01-q1', true, '2026-11-21');
  });

  it('lektionen sparas med datumet då quizet blir klart', () => {
    let day = '2026-11-20';
    const complete = vi.fn(() => Promise.resolve());
    const onDone = vi.fn();
    const quiz = lessonQuiz(lesson1, onDone, noop, complete, () => day);
    for (const q of lesson1.questions.slice(0, 3)) quiz.answer(q.id, true);
    day = '2026-11-21';
    quiz.answer(lesson1.questions[3].id, true);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0]).toEqual(['k1-01', Object.fromEntries(lesson1.questions.map((q) => [q.id, true])), '2026-11-21']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ett misslyckat sparande av lektionen meddelas', async () => {
    const failed = vi.fn();
    const quiz = lessonQuiz(lesson1, noop, failed, () => Promise.reject(new Error('x')), () => TODAY);
    for (const q of lesson1.questions) quiz.answer(q.id, true);
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toHaveBeenCalledTimes(1);
  });
});

describe('navigeringen', () => {
  it('en lektion öppnad från ordlistan går tillbaka till ordlistan, annars till startsidan', () => {
    expect(backFrom({ kind: 'lesson', id: 'k1-01', from: 'glossary' })).toEqual({ kind: 'glossary' });
    expect(backFrom({ kind: 'lesson', id: 'k1-01', from: 'start' })).toEqual({ kind: 'start' });
    expect(backFrom({ kind: 'glossary' })).toEqual({ kind: 'start' });
    expect(backFrom({ kind: 'review', ids: [] })).toEqual({ kind: 'start' });
  });

  it('en okänd lektion visar ett tomt läge', () => {
    const html = renderToStaticMarkup(<AkademinBody data={EMPTY} failed={false} initialView={{ kind: 'lesson', id: 'k9-01', from: 'start' }} />);
    expect(html).toContain('Lektionen finns inte i den här versionen av appen.');
    expect(html).toContain('Tillbaka');
    expect(renderToStaticMarkup(<AkademinBody data={EMPTY} failed={false} initialView={{ kind: 'lesson', id: 'k1-01', from: 'start' }} />)).not.toContain(
      'Lektionen finns inte',
    );
  });
});

afterEach(() => vi.unstubAllGlobals());
