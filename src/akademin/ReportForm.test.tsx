import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newCompany } from './akademinStore';
import { CompanyForm, CompaniesBody } from './Companies';
import { emptyDraft, FIELD_HELP, prepareSave, toDraft, validateReport, type ReportDraft } from './reportDraft';
import { ReportCalculations, ReportForm } from './ReportForm';
import type { AkademinData } from './akademinStore';
import type { Company, Report } from './types';

const noop = () => {};
const COMPANY: Company = { ...newCompany('Volvo B'), id: 'c1' };
const rep = (patch: Partial<Report> = {}): Report => ({ id: 'r1', companyId: 'c1', year: '2026', type: 'Q3', unit: 'MSEK', outlook: '', good: '', bad: '', thesisWhy: '', ...patch });
const draft = (patch: Partial<ReportDraft> = {}): ReportDraft => ({ ...emptyDraft(), year: '2026', type: 'Q3', ...patch });

const form = (report: Report, all: Report[] = [], extra: Partial<Parameters<typeof ReportForm>[0]> = {}) =>
  renderToStaticMarkup(<ReportForm report={report} isNew={false} companyName="Volvo B" reports={all} onSave={async () => {}} onRemove={async () => {}} onClose={noop} {...extra} />);

describe('Rapportmallen: att spara', () => {
  it('går att spara med bara år, typ och enhet', () => {
    const d = draft({ unit: 'MSEK' });
    expect(validateReport(d, [], rep())).toEqual({});
    const r = prepareSave(rep({ id: 'ny' }), d, []);
    expect('report' in r).toBe(true);
    if ('report' in r) {
      expect(r.report).toMatchObject({ id: 'ny', companyId: 'c1', year: '2026', type: 'Q3', unit: 'MSEK' });
      for (const k of ['revenue', 'ebit', 'eps', 'cashflow', 'cash', 'netDebt', 'reaction', 'thesis', 'date', 'url'] as const) expect(r.report[k]).toBeUndefined();
    }
  });

  it('enheten MSEK är förvald', () => {
    expect(emptyDraft().unit).toBe('MSEK');
    expect(form(rep({ unit: 'MSEK' }))).toContain('value="MSEK"');
  });

  it('ett fält med abc ger fältfel och sparar inget', () => {
    const d = draft({ revenue: 'abc' });
    expect(validateReport(d, [], rep()).revenue).toBeTruthy();
    const r = prepareSave(rep(), d, []);
    expect('errors' in r && r.errors.revenue).toBeTruthy();
    expect('report' in r).toBe(false);
    const html = form(rep(), [], { initialDraft: d, submitted: true });
    expect(html).toContain('Skriv ett tal');
    expect(html).toContain('aria-invalid="true"');
  });

  it('varje sifferfält kontrolleras, men tomma går bra', () => {
    for (const k of ['revenue', 'ebit', 'eps', 'cashflow', 'cash', 'netDebt', 'reaction'] as const) {
      expect(validateReport(draft({ [k]: '1 234,5' }), [], rep())[k]).toBeUndefined();
      expect(validateReport(draft({ [k]: '' }), [], rep())[k]).toBeUndefined();
      expect(validateReport(draft({ [k]: '12 kr' }), [], rep())[k]).toBeTruthy();
    }
  });

  it('siffrorna sparas som tal, tomma som saknade', () => {
    const r = prepareSave(rep(), draft({ revenue: '1 234,5', ebit: '−20', eps: '', reaction: '-3,5' }), []);
    expect('report' in r && r.report).toMatchObject({ revenue: 1234.5, ebit: -20, reaction: -3.5 });
    expect('report' in r && r.report.eps).toBeUndefined();
  });

  it('år och enhet krävs', () => {
    expect(validateReport(draft({ year: '  ' }), [], rep()).year).toBeTruthy();
    expect(validateReport(draft({ unit: ' ' }), [], rep()).unit).toBeTruthy();
  });

  it('länken måste börja med https://', () => {
    expect(validateReport(draft({ url: 'http://x.se' }), [], rep()).url).toBe('Länken måste börja med https://');
    expect(validateReport(draft({ url: 'x.se' }), [], rep()).url).toBeTruthy();
    expect(validateReport(draft({ url: 'https://x.se/q3.pdf' }), [], rep()).url).toBeUndefined();
    expect(validateReport(draft({ url: '' }), [], rep()).url).toBeUndefined();
    expect(form(rep(), [], { initialDraft: draft({ url: 'http://x.se' }), submitted: true })).toContain('Länken måste börja med https://');
  });

  it('två rapporter med samma bolag, år och typ går inte att spara, och felet nämner den som finns', () => {
    const existing = rep({ id: 'a' });
    const err = validateReport(draft(), [existing], rep({ id: 'b' }));
    expect(err.year).toContain('Q3 2026');
    expect('errors' in prepareSave(rep({ id: 'b' }), draft(), [existing])).toBe(true);
    // en annan typ, ett annat år eller ett annat bolag är inget problem
    expect(validateReport(draft({ type: 'Q2' }), [existing], rep({ id: 'b' }))).toEqual({});
    expect(validateReport(draft({ year: '2025' }), [existing], rep({ id: 'b' }))).toEqual({});
    expect(validateReport(draft(), [rep({ id: 'a', companyId: 'c2' })], rep({ id: 'b' }))).toEqual({});
    // rapporten som redigeras räknas inte som sin egen dubblett
    expect(validateReport(draft(), [existing], existing)).toEqual({});
    // mellanslag runt året spelar ingen roll
    expect(validateReport(draft({ year: ' 2026 ' }), [existing], rep({ id: 'b' })).year).toBeTruthy();
    expect(form(rep({ id: 'b' }), [existing], { submitted: true })).toContain('Q3 2026 finns redan');
  });

  it('datumet måste vara ett riktigt datum', () => {
    expect(validateReport(draft({ date: '2026-11-05' }), [], rep()).date).toBeUndefined();
    expect(validateReport(draft({ date: '5 november' }), [], rep()).date).toBeTruthy();
  });

  it('toDraft och prepareSave bevarar en fylld rapport', () => {
    const full = rep({ date: '2026-11-05', revenue: 1234.5, ebit: -20, eps: 1.25, cashflow: 300, cash: 50, netDebt: -10, outlook: 'Ljust', good: 'a', bad: 'b', thesis: 'osaker', thesisWhy: 'c', reaction: -3.5, url: 'https://x.se' });
    const r = prepareSave(full, toDraft(full), []);
    expect('report' in r && r.report).toEqual(full);
  });
});

describe('Rapportmallen: visningen', () => {
  it('fälten i specens ordning', () => {
    const html = form(rep());
    const order = ['Räkenskapsår', 'Typ', 'Rapportdatum', 'Enhet', 'Omsättning', 'Rörelseresultat', 'Resultat per aktie', 'Kassaflöde från den löpande verksamheten', 'Likvida medel', 'Nettoskuld', 'Ledningens utsikter', 'Vad var bra', 'Vad var dåligt', 'Håller min tes?', 'Kursreaktion dagen efter', 'Länk till rapporten'];
    let at = -1;
    for (const label of order) {
      const i = html.indexOf(label, at + 1);
      expect(i, label).toBeGreaterThan(at);
      at = i;
    }
  });

  it('texten vid sifferfälten säger att de gäller perioden ensam, inte ackumulerat', () => {
    const html = form(rep());
    expect(html).toContain('perioden ensam');
    expect(html).toContain('inte ackumulerat');
  });

  it('varje fält har en förklaring som går att fälla ut, utan siffror och utan råd', () => {
    const html = form(rep());
    const keys = Object.keys(FIELD_HELP);
    expect(keys.length).toBeGreaterThanOrEqual(15);
    expect(html.match(/<details/g)?.length).toBe(keys.length);
    for (const text of Object.values(FIELD_HELP)) {
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/\b(köp|sälj|bör|ska du)/i);
      expect(html).toContain(text);
    }
  });

  it('marginal och tillväxt visas med uträkningen', () => {
    const prev = rep({ id: 'p', year: '2025', revenue: 100 });
    const html = renderToStaticMarkup(<ReportCalculations report={rep({ revenue: 200, ebit: 25 })} reports={[prev]} />);
    expect(html).toContain('25 / 200 = 12,5 %');
    expect(html).toContain('(200 − 100) / 100 = 100,0 %');
    expect(html).toContain('Rörelsemarginal');
    expect(html).toContain('Omsättningstillväxt');
  });

  it('saknas något står det saknas med skälet, aldrig NaN eller 0 %', () => {
    const html = renderToStaticMarkup(<ReportCalculations report={rep({ revenue: 110 })} reports={[]} />);
    expect(html.match(/saknas/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Lägg in Q3 2025 för att se tillväxten');
    expect(html).not.toMatch(/NaN|Infinity|0,0 %/);
  });

  it('uträkningen i formuläret följer det som skrivits in', () => {
    const html = form(rep(), [], { initialDraft: draft({ revenue: '200', ebit: '25' }) });
    expect(html).toContain('25 / 200 = 12,5 %');
    expect(form(rep(), [], { initialDraft: draft({ revenue: 'abc', ebit: '25' }) })).not.toContain('NaN');
  });

  it('ett nytt formulär har ingen Ta bort, ett sparat frågar först', () => {
    expect(form(rep(), [], { isNew: true })).not.toContain('Ta bort');
    expect(form(rep())).toContain('Ta bort');
    expect(form(rep())).not.toContain('Ja, ta bort');
    const ask = form(rep(), [], { confirmingDelete: true });
    expect(ask).toContain('Ja, ta bort');
    expect(ask).toContain('Det går inte att ångra');
  });

  it('fel vid sparande och borttagning syns', () => {
    expect(form(rep(), [], { failed: 'save' })).toContain('Det gick inte att spara');
    expect(form(rep(), [], { failed: 'remove' })).toContain('Det gick inte att ta bort');
  });

  it('fel visas inte innan användaren försökt spara', () => {
    expect(form(rep(), [], { initialDraft: draft({ revenue: 'abc' }) })).not.toContain('Skriv ett tal');
  });
});

describe('Bolagskortet och rapporterna', () => {
  const card = (reports: Report[], extra: Partial<Parameters<typeof CompanyForm>[0]> = {}) =>
    renderToStaticMarkup(<CompanyForm company={COMPANY} isNew={false} holdings={[]} reportCount={reports.length} reports={reports} onOpenReport={noop} onSave={async () => {}} onRemove={async () => {}} onClose={noop} {...extra} />);

  it('listar rapporterna enligt sortReports och har en knapp för en ny', () => {
    const html = card([rep({ id: 'a', year: '2025', type: 'FY' }), rep({ id: 'b', year: '2026', type: 'Q1' }), rep({ id: 'c', year: '2026', type: 'Q3' })]);
    const at = (s: string) => html.indexOf(s);
    expect(at('Q3 2026')).toBeGreaterThan(-1);
    expect(at('Q3 2026')).toBeLessThan(at('Q1 2026'));
    expect(at('Q1 2026')).toBeLessThan(at('Helår 2025'));
    expect(html).toContain('Lägg till rapport');
  });

  it('visar om tesen höll och marginalen i listan', () => {
    const html = card([rep({ thesis: 'ja', revenue: 200, ebit: 25 })]);
    expect(html).toContain('Håller tesen: ja');
  });

  it('inga rapporter: designat tomt läge', () => {
    expect(card([])).toContain('Inga rapporter än');
  });

  it('ett nytt bolag måste sparas innan en rapport kan läggas till', () => {
    const html = card([], { isNew: true });
    expect(html).toContain('Spara bolaget först');
    expect(html).not.toContain('Lägg till rapport');
  });

  it('bolagsvyn kan visa rapportformuläret för en befintlig rapport, och det går att komma tillbaka till kortet', () => {
    const data: AkademinData = { progress: [], answers: [], companies: [COMPANY], reports: [rep()], journal: [], habit: null };
    const html = renderToStaticMarkup(<CompaniesBody data={data} today="2026-11-20" holdings={[]} linksFailed={false} initialView={{ kind: 'report', companyId: 'c1', reportId: 'r1' }} />);
    expect(html).toContain('Rapport Q3 2026');
    expect(html).toContain('Rörelsemarginal');
    const missing = renderToStaticMarkup(<CompaniesBody data={data} today="2026-11-20" holdings={[]} linksFailed={false} initialView={{ kind: 'report', companyId: 'c1', reportId: 'borta' }} />);
    expect(missing).toContain('Rapporten finns inte längre');
  });
});
