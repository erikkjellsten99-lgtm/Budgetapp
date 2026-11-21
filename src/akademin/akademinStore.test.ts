import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayKey } from '../vanor/dates';
import type { Answer, JournalEntry, Progress, Report } from './types';

/** Nytt modulläge med färsk databas: store.ts håller sin anslutning på modulnivå. */
/** failAt: vilken sparning (räknat från 1 efter nollställning) som ska misslyckas, 0 för ingen. */
const hook = { failAt: 0, saves: 0, session: false };

async function freshStore() {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
  vi.resetModules();
  hook.failAt = 0;
  hook.saves = 0;
  hook.session = false;
  // Kontot: inloggad eller inte styrs av hook.session.
  vi.doMock('../sync', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: hook.session ? {} : null } }) } } }));
  // Låter en viss sparning misslyckas, för att pröva delvis misslyckade skrivningar.
  vi.doMock('../vanor/store', async (orig) => {
    const real = await orig<typeof import('../vanor/store')>();
    return {
      ...real,
      saveAkademinRecord: (...args: Parameters<typeof real.saveAkademinRecord>) => {
        hook.saves++;
        if (hook.saves === hook.failAt) {
          return Promise.reject(new Error('skrivning misslyckades'));
        }
        return real.saveAkademinRecord(...args);
      },
    };
  });
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  return import('./akademinStore');
}

const FIRST = { 'k1-01-q1': true, 'k1-01-q2': false, 'k1-01-q3': true, 'k1-01-q4': true };
const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

describe('Akademins lagring', () => {
  let s: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => {
    s = await freshStore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../vanor/store');
    vi.doUnmock('../sync');
  });

  it('completeLesson sparar en Progress och fyra svar enligt nextAnswer', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    expect(byId(d.answers)).toEqual([
      { id: 'k1-01-q1', streak: 1, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q2', streak: 0, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q3', streak: 1, due: '2026-11-21', last: '2026-11-20' },
      { id: 'k1-01-q4', streak: 1, due: '2026-11-21', last: '2026-11-20' },
    ]);
    expect(d.habit).toBeNull();
  });

  it('samma anrop igen samma dag ändrar ingenting', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const before = await s.loadAkademin();
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const after = await s.loadAkademin();
    expect(after.progress).toEqual(before.progress);
    expect(byId(after.answers)).toEqual(byId(before.answers));
  });

  it('två överlappande anrop en senare dag räknar varje svar en gång', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    // Det andra anropet har andra svar: bara om det väntar på det första ser det att dagen redan är sparad.
    const wrong = { 'k1-01-q1': false, 'k1-01-q2': false, 'k1-01-q3': false, 'k1-01-q4': false };
    await Promise.all([s.completeLesson('k1-01', FIRST, '2026-11-22'), s.completeLesson('k1-01', wrong, '2026-11-22')]);
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    expect(d.answers).toHaveLength(4);
    const a = Object.fromEntries(d.answers.map((x: Answer) => [x.id, x]));
    expect(a['k1-01-q1'].streak).toBe(2);
    expect(a['k1-01-q3'].streak).toBe(2);
    expect(a['k1-01-q2'].streak).toBe(0);
  });

  it('ett anrop som misslyckas mitt i lämnar lektionen ogjord och kan göras om samma dag', async () => {
    // Första sparningen lyckas, den andra misslyckas: med Progress först hade doneAt redan legat sparad här.
    hook.failAt = 2;
    await expect(s.completeLesson('k1-01', FIRST, '2026-11-20')).rejects.toThrow();
    expect((await s.loadAkademin()).progress).toEqual([]);
    hook.failAt = 0;
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    expect(d.answers).toHaveLength(4);
    expect(d.answers.every((x: Answer) => x.streak <= 1 && x.last === '2026-11-20')).toBe(true);
    expect(d.answers.find((x: Answer) => x.id === 'k1-01-q1')?.streak).toBe(1);
  });

  it('en fråga som repeterats idag räknas inte igen när lektionen görs klar', async () => {
    await s.recordReview('k1-01-q1', true, '2026-11-20');
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    const d = await s.loadAkademin();
    expect(d.answers.find((x: Answer) => x.id === 'k1-01-q1')?.streak).toBe(1);
    expect(d.answers).toHaveLength(4);
    expect(d.progress).toHaveLength(1);
  });

  it('kön fortsätter efter ett misslyckat anrop', async () => {
    hook.failAt = 1;
    await expect(s.recordReview('k1-01-q1', true, '2026-11-20')).rejects.toThrow();
    await s.recordReview('k1-01-q2', true, '2026-11-20');
    expect((await s.loadAkademin()).answers.map((x: Answer) => x.id)).toEqual(['k1-01-q2']);
  });

  it('recordReview på en fråga utan svar skapar ett', async () => {
    await s.recordReview('k1-02-q1', false, '2026-11-20');
    expect((await s.loadAkademin()).answers).toEqual([{ id: 'k1-02-q1', streak: 0, due: '2026-11-21', last: '2026-11-20', reviewedOn: '2026-11-20' }]);
  });

  it('completeLesson sätter inte reviewedOn, recordReview gör det också vid fel svar', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    expect((await s.loadAkademin()).answers.every((x: Answer) => x.reviewedOn === undefined)).toBe(true);
    await s.recordReview('k1-01-q2', false, '2026-11-21');
    const a = (await s.loadAkademin()).answers.find((x: Answer) => x.id === 'k1-01-q2');
    expect(a).toEqual({ id: 'k1-01-q2', streak: 0, due: '2026-11-22', last: '2026-11-21', reviewedOn: '2026-11-21' });
  });

  it('görs lektionen om en senare dag behålls doneAt och svaren uppdateras', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    await s.completeLesson('k1-01', { 'k1-01-q1': true, 'k1-01-q2': true, 'k1-01-q3': false, 'k1-01-q4': true }, '2026-11-22');
    const d = await s.loadAkademin();
    expect(d.progress).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    const a = Object.fromEntries(d.answers.map((x: Answer) => [x.id, x]));
    expect(a['k1-01-q1']).toEqual({ id: 'k1-01-q1', streak: 2, due: '2026-11-25', last: '2026-11-22' });
    expect(a['k1-01-q2']).toEqual({ id: 'k1-01-q2', streak: 1, due: '2026-11-23', last: '2026-11-22' });
    expect(a['k1-01-q3']).toEqual({ id: 'k1-01-q3', streak: 0, due: '2026-11-23', last: '2026-11-22' });
  });

  it('nextLesson ger k1-01 utan framsteg och null när alla sju är klara', async () => {
    expect(s.nextLesson([])?.id).toBe('k1-01');
    expect(s.nextLesson([{ id: 'k1-01', doneAt: '2026-11-20' }])?.id).toBe('k1-02');
    const all: Progress[] = ['01', '02', '03', '04', '05', '06', '07'].map((n) => ({ id: `k1-${n}`, doneAt: '2026-11-20' }));
    expect(s.nextLesson(all)).toBeNull();
  });

  it('doneToday är sant bara när någon doneAt är dagens datum', () => {
    expect(s.doneToday([], '2026-11-20')).toBe(false);
    expect(s.doneToday([{ id: 'k1-01', doneAt: '2026-11-19' }], '2026-11-20')).toBe(false);
    expect(s.doneToday([{ id: 'k1-01', doneAt: '2026-11-19' }, { id: 'k1-02', doneAt: '2026-11-20' }], '2026-11-20')).toBe(true);
  });

  it('recordReview uppdaterar bara den frågans svar', async () => {
    await s.completeLesson('k1-01', FIRST, '2026-11-20');
    await s.recordReview('k1-01-q1', true, '2026-11-21');
    const d = await s.loadAkademin();
    const a = Object.fromEntries(d.answers.map((x: Answer) => [x.id, x]));
    expect(a['k1-01-q1']).toEqual({ id: 'k1-01-q1', streak: 2, due: '2026-11-24', last: '2026-11-21', reviewedOn: '2026-11-21' });
    expect(a['k1-01-q2']).toEqual({ id: 'k1-01-q2', streak: 0, due: '2026-11-21', last: '2026-11-20' });
    expect(d.answers).toHaveLength(4);
    expect(d.progress).toHaveLength(1);
  });

  it('newCompany: status Bevakar, tomma texter, id och created satta', () => {
    const before = Date.now();
    const c = s.newCompany('Volvo B');
    expect(c).toMatchObject({ name: 'Volvo B', status: 'bevakar', about: '', earns: '', competitors: '', risks: '', thesis: '', sellRules: '' });
    expect(c.id).toBeTruthy();
    expect(c.created).toBeGreaterThanOrEqual(before);
    expect(s.newCompany('Volvo B').id).not.toBe(c.id);
  });

  it('saveCompany sparar bolaget och det går att läsa tillbaka', async () => {
    const c = s.newCompany('Volvo B');
    await s.saveCompany({ ...c, thesis: 'Skäl' });
    expect((await s.loadAkademin()).companies).toEqual([{ ...c, thesis: 'Skäl' }]);
  });

  it('removeCompany tar bort bolaget och dess rapporter, men inte ett dagboksinlägg med samma companyId', async () => {
    const { saveAkademinRecord } = await import('../vanor/store');
    const a = s.newCompany('A');
    const b = s.newCompany('B');
    await s.saveCompany(a);
    await s.saveCompany(b);
    const report = (id: string, companyId: string): Report => ({ id, companyId, year: '2026', type: 'Q1', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '' });
    await saveAkademinRecord('akademin_reports', report('r1', a.id));
    await saveAkademinRecord('akademin_reports', report('r2', a.id));
    await saveAkademinRecord('akademin_reports', report('r3', b.id));
    const entry: JournalEntry = { id: 'j1', date: '2026-11-20', companyId: a.id, companyName: 'A', type: 'kopte', why: 'x', change: 'y' };
    await saveAkademinRecord('akademin_journal', entry);
    await s.removeCompany(a.id);
    const d = await s.loadAkademin();
    expect(d.companies.map((c: { id: string }) => c.id)).toEqual([b.id]);
    expect(d.reports.map((r: Report) => r.id)).toEqual(['r3']);
    expect(d.journal).toEqual([entry]);
  });
});

describe('rapporter', () => {
  const report = (id: string, companyId: string): Report => ({ id, companyId, year: '2026', type: 'Q3', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '' });

  it('saveReport sparar, skriver över samma id, och removeReport tar bort just den', async () => {
    const s = await freshStore();
    await s.saveReport(report('r1', 'c1'));
    await s.saveReport(report('r2', 'c1'));
    await s.saveReport({ ...report('r1', 'c1'), revenue: 5 });
    let reports = (await s.loadAkademin()).reports;
    expect(reports.map((r: Report) => r.id).sort()).toEqual(['r1', 'r2']);
    expect(reports.find((r: Report) => r.id === 'r1')?.revenue).toBe(5);
    await s.removeReport('r1');
    reports = (await s.loadAkademin()).reports;
    expect(reports.map((r: Report) => r.id)).toEqual(['r2']);
  });

  it('newReport ger tomma texter och ny id', async () => {
    const s = await freshStore();
    const r = s.newReport('c1');
    expect(r).toMatchObject({ companyId: 'c1', type: 'Q1', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '' });
    expect(s.newReport('c1').id).not.toBe(r.id);
  });
});

describe('dagboken', () => {
  const entry = (id: string): JournalEntry => ({ id, date: '2026-11-20', companyName: 'A', type: 'avstod', why: 'x', change: 'y' });

  it('saveJournalEntry sparar och skriver över samma id, och removeJournalEntry tar bort just det', async () => {
    const s = await freshStore();
    await s.saveJournalEntry(entry('j1'));
    await s.saveJournalEntry(entry('j2'));
    await s.saveJournalEntry({ ...entry('j1'), followUp: { date: '2026-11-21', text: 'Ja' } });
    let journal = (await s.loadAkademin()).journal;
    expect(journal.map((j: JournalEntry) => j.id).sort()).toEqual(['j1', 'j2']);
    expect(journal.find((j: JournalEntry) => j.id === 'j1')?.followUp?.text).toBe('Ja');
    await s.removeJournalEntry('j1');
    journal = (await s.loadAkademin()).journal;
    expect(journal.map((j: JournalEntry) => j.id)).toEqual(['j2']);
  });

  it('newJournalEntry ger dagens datum, tomma texter och ny id', async () => {
    const s = await freshStore();
    const e = s.newJournalEntry('2026-11-20');
    expect(e).toMatchObject({ date: '2026-11-20', companyName: '', type: 'kopte', why: '', change: '' });
    expect(s.newJournalEntry('2026-11-20').id).not.toBe(e.id);
  });
});

describe('vanan Studera aktier', () => {
  const DAY = '2026-11-20';
  let s: Awaited<ReturnType<typeof freshStore>>;
  let v: typeof import('../vanor/store');
  beforeEach(async () => {
    s = await freshStore();
    v = await import('../vanor/store');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../vanor/store');
    vi.doUnmock('../sync');
  });

  const habits = async () => (await v.loadHabitData()).habits;
  const checks = async () => (await v.loadHabitData()).checks;
  const adopt = async () => {
    await s.answerHabitOffer(true);
    return (await s.loadAkademin()).habit!.habitId!;
  };
  const report = (id: string): Report => ({ id, companyId: 'c1', year: '2026', type: 'Q1', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '' });

  it('HABIT_NAME är Studera aktier', () => {
    expect(s.HABIT_NAME).toBe('Studera aktier');
  });

  it('habitOfferReady: true utloggad utan svar, false när ett svar finns', async () => {
    expect(await s.habitOfferReady()).toBe(true);
    await s.answerHabitOffer(false);
    expect(await s.habitOfferReady()).toBe(false);
  });

  it('habitOfferReady: false när svaret är ja', async () => {
    await s.answerHabitOffer(true);
    expect(await s.habitOfferReady()).toBe(false);
  });

  it('habitOfferReady: false inloggad utan lastPull, true med lastPull', async () => {
    hook.session = true;
    expect(await s.habitOfferReady()).toBe(false);
    await v.setMeta('sync', { lastPull: null });
    expect(await s.habitOfferReady()).toBe(false);
    await v.setMeta('sync', { lastPull: '2026-11-20T08:00:00Z' });
    expect(await s.habitOfferReady()).toBe(true);
  });

  it('answerHabitOffer(true) skapar vanan med målet 7 och sparar dess id', async () => {
    await s.answerHabitOffer(true);
    const hs = await habits();
    expect(hs).toHaveLength(1);
    expect(hs[0]).toMatchObject({ name: 'Studera aktier', goal: 7, archived: false });
    expect((await s.loadAkademin()).habit).toEqual({ id: 'habit', answer: 'ja', habitId: hs[0].id });
  });

  it('answerHabitOffer(true) två gånger i rad (också överlappande) ger en vana', async () => {
    await Promise.all([s.answerHabitOffer(true), s.answerHabitOffer(true)]);
    await s.answerHabitOffer(true);
    expect(await habits()).toHaveLength(1);
  });

  it('en redan aktiv vana med samma namn länkas i stället för att en andra skapas', async () => {
    const id = await v.addHabit('Studera aktier', 3);
    await s.answerHabitOffer(true);
    expect(await habits()).toHaveLength(1);
    expect((await s.loadAkademin()).habit).toEqual({ id: 'habit', answer: 'ja', habitId: id });
  });

  it('answerHabitOffer(false) sparar nej och skapar ingen vana', async () => {
    await s.answerHabitOffer(false);
    expect(await habits()).toHaveLength(0);
    expect((await s.loadAkademin()).habit).toEqual({ id: 'habit', answer: 'nej' });
  });

  it('ett nej ändras inte av ett senare ja', async () => {
    await s.answerHabitOffer(false);
    await s.answerHabitOffer(true);
    expect(await habits()).toHaveLength(0);
    expect((await s.loadAkademin()).habit?.answer).toBe('nej');
  });

  it('en misslyckad sparning av svaret lämnar frågan kvar och ett nytt försök ger en vana', async () => {
    hook.failAt = 1;
    await expect(s.answerHabitOffer(true)).rejects.toThrow();
    expect(await s.habitOfferReady()).toBe(true);
    hook.failAt = 0;
    hook.saves = 0;
    await s.answerHabitOffer(true);
    expect(await habits()).toHaveLength(1);
    expect((await s.loadAkademin()).habit?.answer).toBe('ja');
  });

  it('markStudied bockar vanan för dagen, och två anrop ger en bock', async () => {
    const id = await adopt();
    await s.markStudied(DAY);
    await s.markStudied(DAY);
    expect(await checks()).toEqual([{ key: `${DAY}|${id}`, date: DAY, habitId: id }]);
  });

  it('markStudied ändrar inte en bock som bara är minimum', async () => {
    const id = await adopt();
    await v.setCheck(id, DAY, 'min');
    await s.markStudied(DAY);
    expect(await checks()).toEqual([{ key: `${DAY}|${id}`, date: DAY, habitId: id, min: true }]);
  });

  it('markStudied gör ingenting utan HabitSetting', async () => {
    await v.addHabit('Studera aktier', 7);
    await expect(s.markStudied(DAY)).resolves.toBeUndefined();
    expect(await checks()).toEqual([]);
  });

  it('markStudied gör ingenting med svaret nej', async () => {
    await s.answerHabitOffer(false);
    await expect(s.markStudied(DAY)).resolves.toBeUndefined();
    expect(await checks()).toEqual([]);
  });

  it('markStudied gör ingenting när vanan är arkiverad', async () => {
    const id = await adopt();
    await v.removeHabit(id);
    await expect(s.markStudied(DAY)).resolves.toBeUndefined();
    expect(await checks()).toEqual([]);
  });

  it('markStudied gör ingenting när vanan saknas helt', async () => {
    await v.saveAkademinRecord('akademin_settings', { id: 'habit', answer: 'ja', habitId: 'finns-inte' });
    await expect(s.markStudied(DAY)).resolves.toBeUndefined();
    expect(await checks()).toEqual([]);
  });

  it('markStudied kastar inte när lagringen misslyckas', async () => {
    await adopt();
    const spy = vi.spyOn(v, 'setCheck').mockRejectedValue(new Error('fel'));
    await expect(s.markStudied(DAY)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('completeLesson bockar vanan', async () => {
    const id = await adopt();
    await s.completeLesson('k1-01', FIRST, DAY);
    expect(await checks()).toEqual([{ key: `${DAY}|${id}`, date: DAY, habitId: id }]);
  });

  it('completeLesson på en gammal lektion en senare dag bockar den dagen', async () => {
    const id = await adopt();
    await s.completeLesson('k1-01', FIRST, DAY);
    await s.completeLesson('k1-01', FIRST, '2026-11-22');
    expect((await checks()).map((c: { date: string; habitId: string }) => c.date).sort()).toEqual([DAY, '2026-11-22']);
    expect((await checks()).every((c: { habitId: string }) => c.habitId === id)).toBe(true);
  });

  it('completeLesson lyckas även när bockningen misslyckas', async () => {
    await adopt();
    const spy = vi.spyOn(v, 'setCheck').mockRejectedValue(new Error('fel'));
    await expect(s.completeLesson('k1-01', FIRST, DAY)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect((await s.loadAkademin()).progress).toHaveLength(1);
  });

  it('recordReview bockar först när dagens sista fråga besvarats, rätt eller fel', async () => {
    const id = await adopt();
    // Tre frågor förfaller idag: dagens repetition är tre frågor.
    for (const q of ['k1-01-q1', 'k1-01-q2', 'k1-01-q3']) await v.saveAkademinRecord('akademin_answers', { id: q, streak: 1, due: '2026-11-19', last: '2026-11-18' });
    await s.recordReview('k1-01-q1', true, DAY);
    await s.recordReview('k1-01-q2', false, DAY);
    expect(await checks()).toEqual([]);
    await s.recordReview('k1-01-q3', false, DAY);
    expect(await checks()).toEqual([{ key: `${DAY}|${id}`, date: DAY, habitId: id }]);
  });

  it('recordReview bockar när en enda fråga förföll och besvarats', async () => {
    const id = await adopt();
    await v.saveAkademinRecord('akademin_answers', { id: 'k1-01-q1', streak: 1, due: '2026-11-19', last: '2026-11-18' });
    await s.recordReview('k1-01-q1', true, DAY);
    expect((await checks()).map((c: { habitId: string }) => c.habitId)).toEqual([id]);
  });

  it('recordReview lyckas även när bockningen misslyckas', async () => {
    await adopt();
    const spy = vi.spyOn(v, 'setCheck').mockRejectedValue(new Error('fel'));
    await expect(s.recordReview('k1-01-q1', true, DAY)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect((await s.loadAkademin()).answers).toHaveLength(1);
  });

  it('saveReport bockar vanan för dagens datum', async () => {
    const id = await adopt();
    await s.saveReport(report('r1'));
    expect(await checks()).toEqual([{ key: `${todayKey()}|${id}`, date: todayKey(), habitId: id }]);
  });

  it('saveReport lyckas även när bockningen misslyckas', async () => {
    await adopt();
    const spy = vi.spyOn(v, 'setCheck').mockRejectedValue(new Error('fel'));
    await expect(s.saveReport(report('r1'))).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect((await s.loadAkademin()).reports).toHaveLength(1);
  });

  it('saveJournalEntry bockar vanan för dagens datum', async () => {
    const id = await adopt();
    await s.saveJournalEntry({ id: 'j1', date: '2026-01-01', companyName: 'A', type: 'avstod', why: 'x', change: 'y' });
    expect(await checks()).toEqual([{ key: `${todayKey()}|${id}`, date: todayKey(), habitId: id }]);
  });

  it('saveJournalEntry lyckas även när bockningen misslyckas', async () => {
    await adopt();
    const spy = vi.spyOn(v, 'setCheck').mockRejectedValue(new Error('fel'));
    await expect(s.saveJournalEntry({ id: 'j1', date: DAY, companyName: 'A', type: 'avstod', why: 'x', change: 'y' })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect((await s.loadAkademin()).journal).toHaveLength(1);
  });
});
