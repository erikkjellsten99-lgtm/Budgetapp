import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newCompany } from './akademinStore';
import { CompanyForm, CompanyList, CompaniesRow, DeleteConfirm } from './Companies';
import { fromDraft, sortCompanies, toDraft, validateDraft } from './companyDraft';
import type { Company } from './types';

const TODAY = '2026-11-20';
const noop = () => {};
const co = (name: string, patch: Partial<Company> = {}): Company => ({ ...newCompany(name), ...patch });
const HOLDINGS = [
  { id: 'h1', name: 'Volvo B' },
  { id: 'h2', name: 'Investor B' },
];

const list = (companies: Company[]) => renderToStaticMarkup(<CompanyList companies={companies} today={TODAY} onOpen={noop} onAdd={noop} />);
const form = (company: Company, extra: Partial<Parameters<typeof CompanyForm>[0]> = {}) =>
  renderToStaticMarkup(
    <CompanyForm company={company} isNew={false} holdings={HOLDINGS} reportCount={0} onSave={async () => {}} onRemove={async () => {}} onClose={noop} {...extra} />,
  );

describe('Bolagslistan', () => {
  it('tom lista: designat tomt läge med Lägg till bolag', () => {
    const html = list([]);
    expect(html).toContain('Inga bolag än');
    expect(html).toContain('Lägg till bolag');
    expect(html).not.toContain('<ul');
  });

  it('ett nytt bolag hamnar i listan med status Bevakar', () => {
    const saved = fromDraft(newCompany(''), { ...toDraft(newCompany('')), name: '  Nytt Bolag  ' });
    const html = list([saved]);
    expect(saved.name).toBe('Nytt Bolag');
    expect(html).toContain('Nytt Bolag');
    expect(html).toContain('Bevakar');
  });

  it('status visas som Bevakar, Äger, Sålt', () => {
    const html = list([co('A', { status: 'bevakar' }), co('B', { status: 'ager' }), co('C', { status: 'salt' })]);
    for (const label of ['Bevakar', 'Äger', 'Sålt']) expect(html).toContain(label);
  });

  it('listan visar nästa rapportdatum', () => {
    expect(list([co('A', { nextReport: '2026-12-03' })])).toContain('Rapport 2026-12-03');
    expect(list([co('A')])).not.toContain('Rapport 20');
  });

  it('sorterar närmast kommande rapport först, sedan efter namn', () => {
    const sorted = sortCompanies(
      [
        co('Ö-bolaget'),
        co('Sent', { nextReport: '2027-02-01' }),
        co('Passerad', { nextReport: '2026-10-01' }),
        co('Snart', { nextReport: '2026-11-25' }),
        co('Åkeri'),
        co('Idag', { nextReport: TODAY }),
      ],
      TODAY,
    );
    expect(sorted.map((c) => c.name)).toEqual(['Idag', 'Snart', 'Sent', 'Passerad', 'Åkeri', 'Ö-bolaget']);
  });

  it('startsidans rad visar de tre första bolagen med rapportdatum eller status', () => {
    const html = renderToStaticMarkup(
      <CompaniesRow
        companies={[co('A', { nextReport: '2026-12-01' }), co('B', { status: 'ager' }), co('C'), co('D', { nextReport: '2027-05-01' })]}
        today={TODAY}
        onOpen={noop}
      />,
    );
    expect(html).toContain('Mina bolag');
    expect(html).toContain('2026-12-01');
    expect(html).toContain('2027-05-01');
    expect(html).toContain('Äger');
    expect(html).not.toContain('>C<');
  });

  it('startsidans rad utan bolag säger att inga finns än', () => {
    expect(renderToStaticMarkup(<CompaniesRow companies={[]} today={TODAY} onOpen={noop} />)).toContain('Inga än');
  });
});

describe('Bolagskortet', () => {
  it('visar Min tes och Mina säljregler', () => {
    const html = form(co('A', { thesis: 'Därför', sellRules: 'Då säljer jag' }));
    expect(html).toContain('Min tes');
    expect(html).toContain('Mina säljregler');
    expect(html).toContain('Därför');
    expect(html).toContain('Då säljer jag');
  });

  it('fälten för nylistade visas först efter Nylistat bolag', () => {
    const plain = form(co('A'));
    expect(plain).toContain('Nylistat bolag');
    for (const f of ['Noteringsdatum', 'Teckningskurs', 'Vad prospektet lovade']) expect(plain).not.toContain(f);
    const listed = form(co('A', { ipo: { date: '2026-06-01', price: '55 kr', promised: 'Tillväxt' } }));
    for (const f of ['Noteringsdatum', 'Teckningskurs', 'Vad prospektet lovade', '55 kr', 'Tillväxt']) expect(listed).toContain(f);
  });

  it('innehavsväljaren listar innehaven från loadEconomyLinks', () => {
    const html = form(co('A'));
    expect(html).toContain('Ingen koppling');
    for (const h of HOLDINGS) expect(html).toContain(h.name);
  });

  it('medan innehaven läses går det att spara utan att koppla om', () => {
    const html = form(co('A', { holdingId: 'h1' }), { holdings: null });
    expect(html).toContain('Läser innehav');
    expect(html).not.toContain('Innehavet finns inte längre');
  });

  it('ett bolag vars holdingId inte finns visar Innehavet finns inte längre och går att spara om', () => {
    const gone = co('A', { holdingId: 'borta' });
    const html = form(gone);
    expect(html).toContain('Innehavet finns inte längre');
    expect(validateDraft(toDraft(gone))).toEqual({});
    expect(fromDraft(gone, toDraft(gone)).holdingId).toBe('borta');
    expect(fromDraft(gone, { ...toDraft(gone), holdingId: '' }).holdingId).toBeUndefined();
  });

  it('när innehaven inte gick att läsa står det, och kopplingen kallas inte borttagen och behålls vid sparande', () => {
    const linked = co('A', { holdingId: 'h1' });
    const html = form(linked, { holdings: null, linksFailed: true });
    expect(html).toContain('Innehaven i Investeringar gick inte att läsa');
    expect(html).not.toContain('finns inte längre');
    expect(html).not.toContain('är borttaget');
    expect(fromDraft(linked, toDraft(linked)).holdingId).toBe('h1');
  });

  it('ett namn på bara mellanslag går inte att spara', () => {
    expect(validateDraft({ ...toDraft(co('')), name: '   ' }).name).toBeTruthy();
    expect(validateDraft({ ...toDraft(co('')), name: 'Volvo' }).name).toBeUndefined();
    const html = form(co('   '), { submitted: true });
    expect(html).toContain('Skriv ett namn');
    expect(html).toContain('aria-invalid="true"');
  });

  it('irUrl som inte börjar med https:// ger fältfel', () => {
    const d = toDraft(co('A'));
    expect(validateDraft({ ...d, irUrl: 'http://example.se' }).irUrl).toBeTruthy();
    expect(validateDraft({ ...d, irUrl: 'example.se' }).irUrl).toBeTruthy();
    expect(validateDraft({ ...d, irUrl: 'https://example.se/ir' }).irUrl).toBeUndefined();
    expect(validateDraft({ ...d, irUrl: '' }).irUrl).toBeUndefined();
    const html = form(co('A', { irUrl: 'http://example.se' }), { submitted: true });
    expect(html).toContain('Länken måste börja med https://');
  });

  it('fel visas inte innan användaren försökt spara', () => {
    expect(form(co('   ', { irUrl: 'ftp://x' }))).not.toContain('Skriv ett namn');
  });

  it('ett fel vid sparande eller borttagning syns', () => {
    expect(form(co('A'), { failed: 'save' })).toContain('Det gick inte att spara');
    expect(form(co('A'), { failed: 'remove' })).toContain('Det gick inte att ta bort');
  });

  it('ett nytt kort har ingen Ta bort-knapp', () => {
    expect(form(co('A'), { isNew: true })).not.toContain('Ta bort');
    expect(form(co('A'))).toContain('Ta bort');
  });

  it('Ta bort frågar först och nämner hur många rapporter som följer med', () => {
    const html = form(co('A'), { confirmingDelete: true, reportCount: 3 });
    expect(html).toContain('3 rapporter följer med');
    expect(html).toContain('Ja, ta bort');
    expect(html).toContain('Avbryt');
    const ask = renderToStaticMarkup(<DeleteConfirm name="A" reportCount={1} busy={false} onConfirm={noop} onCancel={noop} />);
    expect(ask).toContain('1 rapport följer med');
    expect(ask).not.toContain('1 rapporter');
    expect(renderToStaticMarkup(<DeleteConfirm name="A" reportCount={0} busy={false} onConfirm={noop} onCancel={noop} />)).toContain('Inga rapporter');
  });

  it('utan bekräftelse visas ingen fråga', () => {
    expect(form(co('A'), { reportCount: 3 })).not.toContain('Ja, ta bort');
  });
});
