import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newCompany, newJournalEntry as newEntry, type AkademinData } from './akademinStore';
import { AkademinBody } from './Akademin';
import { JournalBody, JournalForm, JournalList, JournalRow, journalBack } from './Journal';
import { changeCompany, changeType, entryTrades, fromDraft, pendingFollowUp, sortJournal, toDraft, validateDraft } from './journalDraft';
import type { EconomyLinks } from './economyLinks';
import type { Company, JournalEntry } from './types';

const TODAY = '2026-11-20';
const noop = () => {};
const co = (name: string, patch: Partial<Company> = {}): Company => ({ ...newCompany(name), ...patch });
const entry = (id: string, date: string, patch: Partial<JournalEntry> = {}): JournalEntry => ({ id, date, companyId: 'c1', companyName: 'Volvo B', type: 'kopte', why: 'Skäl', change: 'Ändring', ...patch });
const COMPANIES = [co('Volvo B', { id: 'c1', holdingId: 'h1' }), co('Investor B', { id: 'c2' })];
const LINKS: EconomyLinks = {
  holdings: [{ id: 'h1', name: 'Volvo B' }],
  trades: [
    { id: 't1', holdingId: 'h1', date: '2026-03-02', side: 'buy' },
    { id: 't2', holdingId: 'h1', date: '2026-09-10', side: 'sell' },
    { id: 't3', holdingId: 'h9', date: '2026-05-05', side: 'buy' },
  ],
};
const DATA: AkademinData = { progress: [], answers: [], companies: COMPANIES, reports: [], journal: [], habit: null };

const list = (entries: JournalEntry[]) => renderToStaticMarkup(<JournalList entries={entries} today={TODAY} onOpen={noop} onAdd={noop} />);
const form = (e: JournalEntry, extra: Partial<Parameters<typeof JournalForm>[0]> = {}) =>
  renderToStaticMarkup(
    <JournalForm entry={e} isNew={false} today={TODAY} companies={COMPANIES} links={LINKS} onSave={async () => {}} onRemove={async () => {}} onClose={noop} {...extra} />,
  );

describe('Beslutsdagbokens lista', () => {
  it('tomt läge är designat och har Nytt inlägg', () => {
    const html = list([]);
    expect(html).toContain('Inga inlägg än');
    expect(html).toContain('Nytt inlägg');
    expect(html).not.toContain('<ul');
  });

  it('listan är nyast först', () => {
    const html = list([entry('a', '2026-10-01', { companyName: 'Äldre AB' }), entry('b', '2026-11-10', { companyName: 'Nyare AB' })]);
    expect(html.indexOf('Nyare AB')).toBeLessThan(html.indexOf('Äldre AB'));
    expect(sortJournal([entry('a', '2026-10-01'), entry('b', '2026-11-10'), entry('c', '2026-11-10')]).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('inlägg som väntar på uppföljning visas överst med frågan', () => {
    const html = list([entry('ny', '2026-11-10', { companyName: 'Nyare AB' }), entry('gammal', '2026-08-22', { companyName: 'Gamla AB' })]);
    expect(html).toContain('Hade du rätt, och av rätt skäl?');
    expect(html.indexOf('Gamla AB')).toBeLessThan(html.indexOf('Nyare AB'));
    expect((html.match(/Hade du rätt, och av rätt skäl\?/g) ?? []).length).toBe(1);
  });

  it('utan inlägg som väntar visas ingen fråga, och ett besvarat inlägg räknas inte', () => {
    expect(list([entry('a', '2026-11-10')])).not.toContain('Hade du rätt');
    const answered = entry('b', '2026-08-01', { followUp: { date: TODAY, text: 'Ja' } });
    expect(list([answered])).not.toContain('Hade du rätt');
    expect(pendingFollowUp([answered, entry('c', '2026-08-01')], TODAY).map((e) => e.id)).toEqual(['c']);
  });

  it('ett inlägg vars bolag tagits bort visar companyName', () => {
    const html = list([entry('a', '2026-11-10', { companyId: 'borta', companyName: 'Nedlagda AB' })]);
    expect(html).toContain('Nedlagda AB');
  });

  it('visar typen med svensk etikett', () => {
    const html = list([entry('a', '2026-11-10', { type: 'avstod' })]);
    expect(html).toContain('Avstod');
  });
});

describe('Startsidans rad', () => {
  const row = (entries: JournalEntry[]) => renderToStaticMarkup(<JournalRow entries={entries} today={TODAY} onOpen={noop} />);

  it('visar Beslutsdagbok och att inget finns än', () => {
    const html = row([]);
    expect(html).toContain('Beslutsdagbok');
    expect(html).toContain('Inga än');
  });

  it('visar antalet inlägg och hur många som väntar på uppföljning', () => {
    const html = row([entry('a', '2026-08-22'), entry('b', '2026-11-10'), entry('c', '2026-07-01')]);
    expect(html).toContain('3 inlägg');
    expect(html).toContain('2 väntar på uppföljning');
    expect(row([entry('a', '2026-11-10')])).toContain('1 inlägg');
    expect(row([entry('a', '2026-11-10')])).not.toContain('väntar');
  });
});

describe('Inläggsformuläret', () => {
  it('har frågorna ordagrant', () => {
    const html = form(newEntry(TODAY), { isNew: true });
    expect(html).toContain('Varför?');
    expect(html).toContain('Vad skulle få mig att ändra mig?');
  });

  it('bolaget väljs ur biblioteket', () => {
    const html = form(newEntry(TODAY), { isNew: true });
    expect(html).toContain('Volvo B');
    expect(html).toContain('Investor B');
  });

  it('tomt bibliotek: formuläret säger det och pekar på Mina bolag', () => {
    const html = form(newEntry(TODAY), { isNew: true, companies: [] });
    expect(html).toContain('Inga bolag i biblioteket');
    expect(html).toContain('Mina bolag');
  });

  it('kräver bolag och text i Varför?, och fel visas först efter försök', () => {
    const base = toDraft(newEntry(TODAY));
    expect(validateDraft(base).company).toBeTruthy();
    expect(validateDraft(base).why).toBeTruthy();
    expect(validateDraft({ ...base, companyId: 'c1', why: '   ' }).why).toBeTruthy();
    expect(validateDraft({ ...base, companyId: 'c1', why: 'Skäl' })).toEqual({});
    expect(form(newEntry(TODAY), { isNew: true })).not.toContain('Skriv ett skäl');
    const html = form(newEntry(TODAY), { isNew: true, submitted: true });
    expect(html).toContain('Välj ett bolag');
    expect(html).toContain('Skriv ett skäl');
    expect(html).toContain('aria-invalid="true"');
  });

  it('datumet är idag från början och får inte vara tomt', () => {
    expect(newEntry(TODAY).date).toBe(TODAY);
    expect(validateDraft({ ...toDraft(newEntry(TODAY)), companyId: 'c1', why: 'x', date: '' }).date).toBeTruthy();
  });

  it('namnet kopieras från bolaget vid sparande och companyId sparas', () => {
    const d = { ...toDraft(newEntry(TODAY)), companyId: 'c2', why: ' Skäl ', change: 'Ändring' };
    const saved = fromDraft(newEntry(TODAY), d, COMPANIES, TODAY);
    expect(saved).toMatchObject({ companyId: 'c2', companyName: 'Investor B', why: 'Skäl', change: 'Ändring', type: 'kopte', date: TODAY });
  });

  it('ett inlägg vars bolag tagits bort behåller companyName och går att spara om', () => {
    const e = entry('a', '2026-11-01', { companyId: 'borta', companyName: 'Nedlagda AB' });
    const html = form(e);
    expect(html).toContain('Nedlagda AB');
    expect(html).toContain('Bolaget finns inte längre i biblioteket');
    expect(validateDraft(toDraft(e))).toEqual({});
    expect(fromDraft(e, toDraft(e), COMPANIES, TODAY)).toMatchObject({ companyId: 'borta', companyName: 'Nedlagda AB' });
  });
});

describe('Koppling till en affär', () => {
  it('för Köpte listas bolagets innehavs affärer som datum och Köp eller Sälj, utan belopp', () => {
    const html = form(entry('a', '2026-11-01', { type: 'kopte' }));
    expect(html).toContain('2026-03-02 Köp');
    expect(html).toContain('2026-09-10 Sälj');
    expect(html).not.toContain('2026-05-05');
    expect(html).not.toMatch(/\bkr\b|SEK/);
    expect(entryTrades(LINKS, COMPANIES, 'c1').map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('för Sålde också, men inte för Avstod och Annat', () => {
    expect(form(entry('a', '2026-11-01', { type: 'salde' }))).toContain('2026-09-10 Sälj');
    for (const type of ['avstod', 'annat'] as const) expect(form(entry('a', '2026-11-01', { type }))).not.toContain('2026-09-10');
  });

  it('inget val när bolaget saknar innehav', () => {
    const html = form(entry('a', '2026-11-01', { companyId: 'c2', companyName: 'Investor B' }));
    expect(html).not.toContain('2026-09-10');
    expect(html).toContain('inte kopplat till något innehav');
  });

  it('ett tradeId som inte finns visar Affären finns inte längre och behålls vid sparande', () => {
    const e = entry('a', '2026-11-01', { tradeId: 'borta' });
    const html = form(e);
    expect(html).toContain('Affären finns inte längre');
    expect(fromDraft(e, toDraft(e), COMPANIES, TODAY).tradeId).toBe('borta');
  });

  it('en affär som finns kallas inte borttagen', () => {
    expect(form(entry('a', '2026-11-01', { tradeId: 't1' }))).not.toContain('finns inte längre');
  });

  it('när affärerna inte gick att läsa står det, och kopplingen kallas inte borttagen och behålls', () => {
    const e = entry('a', '2026-11-01', { tradeId: 't1' });
    const html = form(e, { links: null, linksFailed: true });
    expect(html).toContain('Affärerna gick inte att läsa');
    expect(html).not.toContain('Affären finns inte längre');
    expect(fromDraft(e, toDraft(e), COMPANIES, TODAY).tradeId).toBe('t1');
  });

  it('medan affärerna läses kallas ingen koppling borttagen', () => {
    const html = form(entry('a', '2026-11-01', { tradeId: 't1' }), { links: null });
    expect(html).toContain('Läser affärer');
    expect(html).not.toContain('finns inte längre');
  });

  it('byte till Avstod tar bort kopplingen vid sparande', () => {
    const e = entry('a', '2026-11-01', { tradeId: 't1' });
    expect(fromDraft(e, { ...toDraft(e), type: 'avstod' }, COMPANIES, TODAY).tradeId).toBeUndefined();
  });
});

describe('Affärslänken följer bolaget', () => {
  const LINKS2: EconomyLinks = { ...LINKS, holdings: [...LINKS.holdings, { id: 'h2', name: 'Investor B' }], trades: [...LINKS.trades, { id: 't4', holdingId: 'h2', date: '2026-06-01', side: 'buy' }] };
  const COS = [co('Volvo B', { id: 'c1', holdingId: 'h1' }), co('Investor B', { id: 'c2', holdingId: 'h2' }), co('Utan', { id: 'c3' })];
  const e = entry('a', '2026-11-01', { tradeId: 't1' });

  it('byte av bolag och sparande ger tradeId undefined', () => {
    const d = changeCompany(toDraft(e), 'c2', COS, LINKS2);
    expect(d.tradeId).toBe('');
    expect(fromDraft(e, d, COS, TODAY, LINKS2).tradeId).toBeUndefined();
  });

  it('en affär som hör till det nya bolagets innehav behålls vid bolagsbyte', () => {
    expect(changeCompany(toDraft(e), 'c1', COS, LINKS2).tradeId).toBe('t1');
  });

  it('fromDraft behåller en giltig affär som hör till bolagets eget innehav när länkarna är kända', () => {
    expect(fromDraft(e, toDraft(e), COS, TODAY, LINKS2).tradeId).toBe('t1');
  });

  it('fromDraft släpper en affär som hör till ett annat innehav än bolagets', () => {
    expect(fromDraft(e, { ...toDraft(e), companyId: 'c2' }, COS, TODAY, LINKS2).tradeId).toBeUndefined();
    expect(fromDraft(e, { ...toDraft(e), companyId: 'c3' }, COS, TODAY, LINKS2).tradeId).toBeUndefined();
  });

  it('en affär som inte finns någonstans behålls vid sparande men släpps vid bolagsbyte', () => {
    const gone = entry('a', '2026-11-01', { tradeId: 'borta' });
    expect(fromDraft(gone, toDraft(gone), COS, TODAY, LINKS2).tradeId).toBe('borta');
    expect(changeCompany(toDraft(gone), 'c2', COS, LINKS2).tradeId).toBe('');
  });

  it('okända affärer: bolagsbyte och sparande rör inte tradeId', () => {
    expect(changeCompany(toDraft(e), 'c2', COS, null).tradeId).toBe('t1');
    expect(fromDraft(e, { ...toDraft(e), companyId: 'c2' }, COS, TODAY, null).tradeId).toBe('t1');
  });

  it('Köpte till Avstod och Annat tar bort tradeId', () => {
    expect(fromDraft(e, changeType(toDraft(e), 'avstod'), COS, TODAY, LINKS2).tradeId).toBeUndefined();
    expect(changeType(toDraft(e), 'annat').tradeId).toBe('');
    expect(changeType(toDraft(e), 'salde').tradeId).toBe('t1');
  });

  it('tipset om en borttagen affär ligger utanför etiketten och är kopplat med aria-describedby', () => {
    const html = form(entry('a', '2026-11-01', { tradeId: 'borta' }));
    expect(html).toContain('aria-describedby="akademin-hint-trade"');
    expect(html).toMatch(/<\/label><span id="akademin-hint-trade"/);
  });
});

describe('Uppföljning', () => {
  it('formuläret visar frågan när 90 dagar gått och inget svar finns', () => {
    const html = form(entry('a', '2026-08-22'));
    expect(html).toContain('Hade du rätt, och av rätt skäl?');
  });

  it('ingen uppföljning före dag 90, och inte på ett nytt inlägg', () => {
    expect(form(entry('a', '2026-08-23'))).not.toContain('Hade du rätt');
    expect(form(newEntry(TODAY), { isNew: true })).not.toContain('Hade du rätt');
  });

  it('ett sparat svar visas och går att ändra', () => {
    const html = form(entry('a', '2026-08-22', { followUp: { date: '2026-11-19', text: 'Delvis' } }));
    expect(html).toContain('Hade du rätt, och av rätt skäl?');
    expect(html).toContain('Delvis');
  });

  it('svaret sparas som followUp med dagens datum', () => {
    const e = entry('a', '2026-08-22');
    const saved = fromDraft(e, { ...toDraft(e), followUp: '  Ja, men av fel skäl  ' }, COMPANIES, TODAY);
    expect(saved.followUp).toEqual({ date: TODAY, text: 'Ja, men av fel skäl' });
  });

  it('ett oförändrat svar behåller sitt datum, ett ändrat får dagens', () => {
    const e = entry('a', '2026-08-22', { followUp: { date: '2026-11-01', text: 'Delvis' } });
    expect(fromDraft(e, toDraft(e), COMPANIES, TODAY).followUp).toEqual({ date: '2026-11-01', text: 'Delvis' });
    expect(fromDraft(e, { ...toDraft(e), followUp: 'Nej' }, COMPANIES, TODAY).followUp).toEqual({ date: TODAY, text: 'Nej' });
  });

  it('ett tomt svar sparar ingen uppföljning, men ett sparat svar får inte tömmas', () => {
    const e = entry('a', '2026-08-22');
    expect(fromDraft(e, { ...toDraft(e), followUp: '  ' }, COMPANIES, TODAY).followUp).toBeUndefined();
    const answered = entry('b', '2026-08-22', { followUp: { date: TODAY, text: 'Ja' } });
    expect(validateDraft({ ...toDraft(answered), followUp: ' ' }).followUp).toBeTruthy();
    expect(validateDraft({ ...toDraft(e), followUp: ' ' }).followUp).toBeUndefined();
    expect(form(answered, { submitted: true, initialFollowUp: ' ' })).toContain('Skriv ett svar');
  });
});

describe('Ta bort och fel', () => {
  it('Ta bort frågar först och Avbryt finns', () => {
    const html = form(entry('a', '2026-11-01'), { confirmingDelete: true });
    expect(html).toContain('Ja, ta bort');
    expect(html).toContain('Avbryt');
    expect(html).toContain('Det går inte att ångra');
    expect(form(entry('a', '2026-11-01'))).not.toContain('Ja, ta bort');
  });

  it('ett nytt inlägg har ingen Ta bort', () => {
    expect(form(newEntry(TODAY), { isNew: true })).not.toContain('Ta bort');
    expect(form(entry('a', '2026-11-01'))).toContain('Ta bort');
  });

  it('fel vid sparande eller borttagning syns', () => {
    expect(form(entry('a', '2026-11-01'), { failed: 'save' })).toContain('Det gick inte att spara');
    expect(form(entry('a', '2026-11-01'), { failed: 'remove' })).toContain('Det gick inte att ta bort');
  });
});

describe('Dagbokens vyer', () => {
  it('Tillbaka går formulär, lista, startsida', () => {
    expect(journalBack({ kind: 'new', entry: newEntry(TODAY) })).toEqual({ kind: 'list' });
    expect(journalBack({ kind: 'entry', id: 'a' })).toEqual({ kind: 'list' });
    expect(journalBack({ kind: 'list' })).toBe('exit');
  });

  it('JournalBody visar listan med en enda Tillbaka', () => {
    const html = renderToStaticMarkup(<JournalBody data={DATA} today={TODAY} links={LINKS} linksFailed={false} onExit={noop} />);
    expect(html).toContain('Inga inlägg än');
    expect(html.match(/>Tillbaka</g)?.length).toBe(1);
  });

  it('ett inlägg som inte finns längre får ett eget besked', () => {
    const html = renderToStaticMarkup(<JournalBody data={DATA} today={TODAY} links={LINKS} linksFailed={false} initialView={{ kind: 'entry', id: 'borta' }} onExit={noop} />);
    expect(html).toContain('Inlägget finns inte längre');
  });

  it('Akademin öppnar dagboken med en enda Tillbaka', () => {
    const html = renderToStaticMarkup(<AkademinBody data={DATA} failed={false} initialView={{ kind: 'journal' }} />);
    expect(html).toContain('Inga inlägg än');
    expect(html.match(/>Tillbaka</g)?.length).toBe(1);
  });
});
