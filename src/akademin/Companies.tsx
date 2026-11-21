// Akademin: bolagsbiblioteket. Ett kort per bolag med användarens egen tes och säljregler. Sparas bara i
// akademin_companies (akademinStore). Innehaven i Investeringar läses bara för namn och id, via economyLinks.
import { useEffect, useRef, useState } from 'react';
import { useToday } from '../vanor/useToday';
import { newCompany, removeCompany, saveCompany, type AkademinData } from './akademinStore';
import { loadEconomyLinks, type EconomyLinks } from './economyLinks';
import { fromDraft, sortCompanies, toDraft, validateDraft, type Draft } from './companyDraft';
import type { Company, CompanyStatus, DateKey } from './types';

export const STATUS_LABEL: Record<CompanyStatus, string> = { bevakar: 'Bevakar', ager: 'Äger', salt: 'Sålt' };
const STATUSES: CompanyStatus[] = ['bevakar', 'ager', 'salt'];
const LIST_SUGGESTIONS = ['Large Cap', 'Mid Cap', 'Small Cap', 'First North'];

const reportsText = (n: number) => (n === 0 ? 'Inga rapporter följer med.' : n === 1 ? '1 rapport följer med.' : `${n} rapporter följer med.`);

const Chevron = () => (
  <svg className="akademin-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StatusChip = ({ status }: { status: CompanyStatus }) => <span className={`akademin-chip akademin-chip-${status}`}>{STATUS_LABEL[status]}</span>;

/** Startsidans rad: Mina bolag och de tre första bolagen med rapportdatum eller status. */
export function CompaniesRow({ companies, today, onOpen }: { companies: Company[]; today: DateKey; onOpen: () => void }) {
  const first = sortCompanies(companies, today).slice(0, 3);
  return (
    <div className="akademin-companies-block">
      <button type="button" className="akademin-row" onClick={onOpen}>
        <span>
          Mina bolag
          <span className="akademin-muted"> · {companies.length === 0 ? 'Inga än' : companies.length}</span>
        </span>
        <Chevron />
      </button>
      {first.length > 0 && (
        <ul className="akademin-companies-preview">
          {first.map((c) => (
            <li key={c.id}>
              <span className="akademin-company-name">{c.name}</span>
              <span className="akademin-muted">{c.nextReport ? `Rapport ${c.nextReport}` : STATUS_LABEL[c.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompanyList({ companies, today, onOpen, onAdd }: { companies: Company[]; today: DateKey; onOpen: (id: string) => void; onAdd: () => void }) {
  return (
    <section className="akademin-companies" aria-labelledby="akademin-companies-title">
      <h3 id="akademin-companies-title">Mina bolag</h3>
      {companies.length === 0 ? (
        <div className="empty">
          <p>Inga bolag än. Här samlar du ett kort per bolag: vad det gör, din tes och dina säljregler.</p>
        </div>
      ) : (
        <ul className="akademin-company-list group">
          {sortCompanies(companies, today).map((c) => (
            <li key={c.id}>
              <button type="button" className="akademin-row akademin-company-row" onClick={() => onOpen(c.id)}>
                <span className="akademin-company-main">
                  <span className="akademin-company-name">
                    {c.name}
                    {c.ticker && <span className="akademin-muted"> · {c.ticker}</span>}
                  </span>
                  <span className="akademin-meta">{c.nextReport ? `Rapport ${c.nextReport}` : 'Ingen rapportdag inlagd'}</span>
                </span>
                <StatusChip status={c.status} />
                <Chevron />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="primary akademin-wide" onClick={onAdd}>
        Lägg till bolag
      </button>
    </section>
  );
}

export function DeleteConfirm({ name, reportCount, busy, onConfirm, onCancel }: { name: string; reportCount: number; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  // Fokus till Avbryt när frågan öppnas, och Escape avbryter.
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="akademin-confirm" role="alertdialog" aria-label="Ta bort bolaget" onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}>
      <p className="akademin-confirm-title">Ta bort {name.trim() || 'bolaget'}?</p>
      <p>
        {reportsText(reportCount)} Dagboksinlägg om bolaget finns kvar. Det går inte att ångra.
      </p>
      <div className="akademin-actions">
        <button type="button" className="danger akademin-confirm-yes" disabled={busy} onClick={onConfirm}>
          Ja, ta bort
        </button>
        <button type="button" ref={cancel} disabled={busy} onClick={onCancel}>
          Avbryt
        </button>
      </div>
    </div>
  );
}

export interface CompanyFormProps {
  company: Company;
  isNew: boolean;
  /** Innehav ur Investeringar, null medan de läses. */
  holdings: { id: string; name: string }[] | null;
  linksFailed?: boolean;
  reportCount: number;
  onSave: (company: Company) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
  // Startläge, så att lägena går att visa utan webbläsare.
  submitted?: boolean;
  confirmingDelete?: boolean;
  failed?: 'save' | 'remove';
}

export function CompanyForm(props: CompanyFormProps) {
  const { company, isNew, holdings, linksFailed, reportCount } = props;
  const [draft, setDraft] = useState(() => toDraft(company));
  const [submitted, setSubmitted] = useState(props.submitted ?? false);
  const [confirming, setConfirming] = useState(props.confirmingDelete ?? false);
  const [failed, setFailed] = useState<'save' | 'remove' | null>(props.failed ?? null);
  const [busy, setBusy] = useState(false);
  // Ref, så att två tryck i samma tick inte båda tar sig förbi spärren.
  const working = useRef(false);
  const errors = submitted ? validateDraft(draft) : {};
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: keyof Draft) => ({ value: draft[key] as string, onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) });
  const missingHolding = holdings !== null && draft.holdingId !== '' && !holdings.some((h) => h.id === draft.holdingId);

  const save = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (working.current) return;
    setSubmitted(true);
    if (Object.keys(validateDraft(draft)).length > 0) return;
    working.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await props.onSave(fromDraft(company, draft));
    } catch {
      setFailed('save');
      working.current = false;
      setBusy(false);
    }
  };
  const remove = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await props.onRemove();
    } catch {
      setFailed('remove');
      setConfirming(false);
      working.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="akademin-company-form" onSubmit={save} noValidate aria-label={isNew ? 'Nytt bolag' : company.name}>
      <h3>{isNew ? 'Nytt bolag' : company.name || 'Bolag'}</h3>

      <label>
        Namn
        <input type="text" {...text('name')} autoComplete="off" aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'akademin-err-name' : undefined} />
        {errors.name && (
          <span id="akademin-err-name" className="error" role="alert">
            {errors.name}
          </span>
        )}
      </label>
      <label>
        Kortnamn (valfritt)
        <input type="text" {...text('ticker')} autoComplete="off" />
      </label>
      <label>
        Lista (till exempel Large Cap eller First North)
        <input type="text" list="akademin-lists" {...text('list')} autoComplete="off" />
        <datalist id="akademin-lists">
          {LIST_SUGGESTIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </label>
      <label>
        Status
        <select value={draft.status} onChange={(e) => set('status', e.target.value as CompanyStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Innehav i Investeringar (valfritt)
        <select value={draft.holdingId} disabled={holdings === null} onChange={(e) => set('holdingId', e.target.value)}>
          {holdings === null ? (
            <option value={draft.holdingId}>{linksFailed ? 'Innehav kunde inte läsas' : 'Läser innehav'}</option>
          ) : (
            <>
              <option value="">Ingen koppling</option>
              {missingHolding && <option value={draft.holdingId}>Innehavet finns inte längre</option>}
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </>
          )}
        </select>
        {missingHolding && <span className="akademin-meta">Innehavet är borttaget i Investeringar. Välj Ingen koppling, eller spara som det är.</span>}
        {linksFailed && <span className="akademin-meta">Innehaven i Investeringar gick inte att läsa just nu.</span>}
      </label>

      <label>
        Vad bolaget gör
        <textarea rows={3} {...text('about')} />
      </label>
      <label>
        Hur bolaget tjänar pengar
        <textarea rows={3} {...text('earns')} />
      </label>
      <label>
        Konkurrenter
        <textarea rows={2} {...text('competitors')} />
      </label>
      <label>
        Risker
        <textarea rows={3} {...text('risks')} />
      </label>
      <label>
        Min tes
        <span className="akademin-hint">Varför bolaget är intressant och vad som ska hända för att jag köper.</span>
        <textarea rows={4} {...text('thesis')} />
      </label>
      <label>
        Mina säljregler
        <span className="akademin-hint">Vad som skulle få mig att sälja.</span>
        <textarea rows={4} {...text('sellRules')} />
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={draft.newlyListed} onChange={(e) => set('newlyListed', e.target.checked)} />
        Nylistat bolag
      </label>
      {draft.newlyListed && (
        <div className="akademin-ipo">
          <label>
            Noteringsdatum
            <input type="date" {...text('ipoDate')} />
          </label>
          <label>
            Teckningskurs
            <input type="text" inputMode="decimal" {...text('ipoPrice')} autoComplete="off" />
          </label>
          <label>
            Vad prospektet lovade
            <textarea rows={3} {...text('ipoPromised')} />
          </label>
        </div>
      )}

      <label>
        Nästa rapportdatum
        <input type="date" {...text('nextReport')} />
      </label>
      <label>
        Länk till bolagets sida för investerare
        <input type="url" inputMode="url" {...text('irUrl')} autoComplete="off" placeholder="https://" aria-invalid={errors.irUrl ? 'true' : undefined} aria-describedby={errors.irUrl ? 'akademin-err-ir' : undefined} />
        {errors.irUrl && (
          <span id="akademin-err-ir" className="error" role="alert">
            {errors.irUrl}
          </span>
        )}
      </label>

      {failed === 'save' && (
        <p className="error" role="alert">
          Det gick inte att spara. Försök igen.
        </p>
      )}
      {failed === 'remove' && (
        <p className="error" role="alert">
          Det gick inte att ta bort bolaget. Försök igen.
        </p>
      )}

      {confirming ? (
        <DeleteConfirm name={company.name} reportCount={reportCount} busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
      ) : (
        <div className="akademin-actions">
          <button type="submit" className="primary" disabled={busy}>
            Spara
          </button>
          <button type="button" disabled={busy} onClick={props.onClose}>
            Avbryt
          </button>
          {!isNew && (
            <button type="button" className="danger" disabled={busy} onClick={() => setConfirming(true)}>
              Ta bort
            </button>
          )}
        </div>
      )}
    </form>
  );
}

type CompaniesView = { kind: 'list' } | { kind: 'card'; id: string } | { kind: 'new'; company: Company };

/** Bolagsbiblioteket: listan och korten. Innehaven läses en gång när vyn öppnas. */
export default function Companies({ data }: { data: AkademinData }) {
  const today = useToday();
  const [links, setLinks] = useState<EconomyLinks | null>(null);
  const [linksFailed, setLinksFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadEconomyLinks().then(
      (l) => alive && setLinks(l),
      () => alive && setLinksFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);
  return <CompaniesBody data={data} today={today} holdings={links?.holdings ?? null} linksFailed={linksFailed} />;
}

export function CompaniesBody({ data, today, holdings, linksFailed, initialView = { kind: 'list' } }: { data: AkademinData; today: DateKey; holdings: { id: string; name: string }[] | null; linksFailed: boolean; initialView?: CompaniesView }) {
  const [view, setView] = useState<CompaniesView>(initialView);
  const toList = () => setView({ kind: 'list' });
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [view.kind]);

  if (view.kind === 'list')
    return <CompanyList companies={data.companies} today={today} onOpen={(id) => setView({ kind: 'card', id })} onAdd={() => setView({ kind: 'new', company: newCompany('') })} />;

  const existing = view.kind === 'card' ? data.companies.find((c) => c.id === view.id) : undefined;
  if (view.kind === 'card' && !existing)
    return (
      <div className="empty" role="status">
        <p>Bolaget finns inte längre.</p>
        <button type="button" onClick={toList}>
          Till bolagslistan
        </button>
      </div>
    );
  const company = view.kind === 'new' ? view.company : existing!;
  return (
    <CompanyForm
      key={company.id}
      company={company}
      isNew={view.kind === 'new'}
      holdings={holdings}
      linksFailed={linksFailed}
      reportCount={data.reports.filter((r) => r.companyId === company.id).length}
      onSave={async (c) => {
        await saveCompany(c);
        toList();
      }}
      onRemove={async () => {
        await removeCompany(company.id);
        toList();
      }}
      onClose={toList}
    />
  );
}
