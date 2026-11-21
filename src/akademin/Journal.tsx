// Akademin: beslutsdagboken. Varför jag köpte, sålde eller avstod, och en uppföljning efter 90 dagar. Sparas bara i
// akademin_journal (akademinStore). Affärer i Investeringar läses bara för id, datum och sida, via economyLinks.
import { useEffect, useRef, useState } from 'react';
import { useToday } from '../vanor/useToday';
import { newJournalEntry, removeJournalEntry, saveJournalEntry, type AkademinData } from './akademinStore';
import { loadEconomyLinks, type EconomyLinks } from './economyLinks';
import { entryTrades, fromDraft, hasTrade, JOURNAL_TYPES, listOrder, pendingFollowUp, toDraft, validateDraft, type JournalDraft } from './journalDraft';
import { JOURNAL_LABEL, needsFollowUp } from './logic';
import type { DateKey, JournalEntry, JournalType } from './types';

export const FOLLOW_UP_QUESTION = 'Hade du rätt, och av rätt skäl?';

const Chevron = () => (
  <svg className="akademin-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SIDE_LABEL = { buy: 'Köp', sell: 'Sälj' } as const;

/** Startsidans rad: Beslutsdagbok, antalet inlägg och hur många som väntar på uppföljning. */
export function JournalRow({ entries, today, onOpen }: { entries: JournalEntry[]; today: DateKey; onOpen: () => void }) {
  const waiting = pendingFollowUp(entries, today).length;
  return (
    <button type="button" className="akademin-row" onClick={onOpen}>
      <span>
        Beslutsdagbok
        <span className="akademin-muted"> · {entries.length === 0 ? 'Inga än' : `${entries.length} inlägg`}</span>
        {waiting > 0 && <span className="akademin-muted"> · {waiting} väntar på uppföljning</span>}
      </span>
      <Chevron />
    </button>
  );
}

function EntryRow({ entry, onOpen }: { entry: JournalEntry; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="akademin-row akademin-company-row" onClick={() => onOpen(entry.id)}>
        <span className="akademin-company-main">
          <span className="akademin-company-name">{entry.companyName}</span>
          <span className="akademin-meta">
            {entry.date} · {JOURNAL_LABEL[entry.type]}
          </span>
        </span>
        <Chevron />
      </button>
    </li>
  );
}

export function JournalList({ entries, today, onOpen, onAdd }: { entries: JournalEntry[]; today: DateKey; onOpen: (id: string) => void; onAdd: () => void }) {
  const { pending, rest } = listOrder(entries, today);
  return (
    <section className="akademin-companies" aria-labelledby="akademin-journal-title">
      <h3 id="akademin-journal-title" className="akademin-focus-target" tabIndex={-1}>
        Beslutsdagbok
      </h3>
      {entries.length === 0 ? (
        <div className="empty">
          <p>Inga inlägg än. Skriv ner varför du köper, säljer eller avstår, så kan du följa upp ditt eget resonemang senare.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="akademin-pending">
              <h4>Väntar på uppföljning</h4>
              <p>{FOLLOW_UP_QUESTION}</p>
              <ul className="akademin-company-list group">
                {pending.map((e) => (
                  <EntryRow key={e.id} entry={e} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <ul className="akademin-company-list group">
              {rest.map((e) => (
                <EntryRow key={e.id} entry={e} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" className="primary akademin-wide" onClick={onAdd}>
        Nytt inlägg
      </button>
    </section>
  );
}

function DeleteConfirm({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  // Fokus till Avbryt när frågan öppnas, och Escape avbryter.
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="akademin-confirm" role="alertdialog" aria-label="Ta bort inlägget" onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}>
      <p className="akademin-confirm-title">Ta bort inlägget?</p>
      <p>Det går inte att ångra.</p>
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

export interface JournalFormProps {
  entry: JournalEntry;
  isNew: boolean;
  today: DateKey;
  companies: AkademinData['companies'];
  /** Namn och id på innehav och affärer, null medan de läses eller när de inte gick att läsa. */
  links: EconomyLinks | null;
  linksFailed?: boolean;
  onSave: (entry: JournalEntry) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
  // Startläge, så att lägena går att visa utan webbläsare.
  submitted?: boolean;
  confirmingDelete?: boolean;
  failed?: 'save' | 'remove';
  initialFollowUp?: string;
}

export function JournalForm(props: JournalFormProps) {
  const { entry, isNew, today, companies, links, linksFailed } = props;
  const [draft, setDraft] = useState<JournalDraft>(() => {
    const d = toDraft(entry);
    return props.initialFollowUp === undefined ? d : { ...d, followUp: props.initialFollowUp };
  });
  const [submitted, setSubmitted] = useState(props.submitted ?? false);
  const [confirming, setConfirming] = useState(props.confirmingDelete ?? false);
  const [failed, setFailed] = useState<'save' | 'remove' | null>(props.failed ?? null);
  const [busy, setBusy] = useState(false);
  // Ref, så att två tryck i samma tick inte båda tar sig förbi spärren.
  const working = useRef(false);
  const errors = submitted ? validateDraft(draft) : {};
  const set = <K extends keyof JournalDraft>(key: K, value: JournalDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: 'date' | 'why' | 'change' | 'followUp') => ({ value: draft[key], onChange: (e: { target: { value: string } }) => set(key, e.target.value) });

  const company = companies.find((c) => c.id === draft.companyId);
  const missingCompany = draft.companyId !== '' && !company;
  const showFollowUp = !isNew && (needsFollowUp(entry, today) || entry.followUp !== undefined);
  const trades = links && draft.companyId !== '' ? entryTrades(links, companies, draft.companyId) : [];
  const missingTrade = links !== null && draft.tradeId !== '' && !links.trades.some((t) => t.id === draft.tradeId);
  const tradeSelect = hasTrade(draft.type) && draft.companyId !== '' && (company?.holdingId !== undefined || draft.tradeId !== '');

  const save = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (working.current) return;
    setSubmitted(true);
    if (Object.keys(validateDraft(draft)).length > 0) return;
    working.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await props.onSave(fromDraft(entry, draft, companies, today));
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
    <form className="akademin-company-form" onSubmit={save} noValidate aria-label={isNew ? 'Nytt inlägg' : `Inlägg om ${entry.companyName}`}>
      <h3 className="akademin-focus-target" tabIndex={-1}>
        {isNew ? 'Nytt inlägg' : entry.companyName || 'Inlägg'}
      </h3>

      <div className="akademin-field">
        <label>
          Datum
          <input type="date" {...text('date')} aria-invalid={errors.date ? 'true' : undefined} aria-describedby={errors.date ? 'akademin-err-date' : undefined} />
        </label>
        {errors.date && (
          <span id="akademin-err-date" className="error" role="alert">
            {errors.date}
          </span>
        )}
      </div>

      <div className="akademin-field">
        {companies.length === 0 && !missingCompany ? (
          <>
            <span>Bolag</span>
            <p className="akademin-note">
              Inga bolag i biblioteket än. Lägg till bolaget under Mina bolag först, så går det att välja här.
            </p>
          </>
        ) : (
          <label>
            Bolag
            <select value={draft.companyId} onChange={(e) => set('companyId', e.target.value)} aria-invalid={errors.company ? 'true' : undefined} aria-describedby={errors.company ? 'akademin-err-company' : undefined}>
              <option value="">Välj bolag</option>
              {missingCompany && <option value={draft.companyId}>{entry.companyName}</option>}
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {missingCompany && <span className="akademin-meta">Bolaget finns inte längre i biblioteket. Inlägget behåller namnet.</span>}
        {errors.company && (
          <span id="akademin-err-company" className="error" role="alert">
            {errors.company}
          </span>
        )}
      </div>

      <label>
        Typ
        <select value={draft.type} onChange={(e) => set('type', e.target.value as JournalType)}>
          {JOURNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {JOURNAL_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      {tradeSelect ? (
        <label>
          Affär i Investeringar (valfritt)
          <select value={draft.tradeId} disabled={links === null} onChange={(e) => set('tradeId', e.target.value)}>
            {links === null ? (
              <option value={draft.tradeId}>{linksFailed ? 'Affärerna gick inte att läsa just nu' : 'Läser affärer'}</option>
            ) : (
              <>
                <option value="">Ingen koppling</option>
                {missingTrade && <option value={draft.tradeId}>Affären finns inte längre</option>}
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.date} {SIDE_LABEL[t.side]}
                  </option>
                ))}
              </>
            )}
          </select>
          {missingTrade && <span className="akademin-meta">Affären är borttagen i Investeringar. Välj Ingen koppling, eller spara som det är.</span>}
        </label>
      ) : (
        hasTrade(draft.type) &&
        draft.companyId !== '' && <p className="akademin-meta">Bolaget är inte kopplat till något innehav, så ingen affär går att välja. Koppla innehavet på bolagskortet i Mina bolag.</p>
      )}

      <div className="akademin-field">
        <label>
          Varför?
          <textarea rows={4} {...text('why')} aria-invalid={errors.why ? 'true' : undefined} aria-describedby={errors.why ? 'akademin-err-why' : undefined} />
        </label>
        {errors.why && (
          <span id="akademin-err-why" className="error" role="alert">
            {errors.why}
          </span>
        )}
      </div>
      <label>
        Vad skulle få mig att ändra mig?
        <textarea rows={3} {...text('change')} />
      </label>

      {showFollowUp && (
        <div className="akademin-field akademin-followup">
          <label>
            {FOLLOW_UP_QUESTION}
            <textarea rows={4} {...text('followUp')} aria-invalid={errors.followUp ? 'true' : undefined} aria-describedby={errors.followUp ? 'akademin-err-followup' : undefined} />
          </label>
          {errors.followUp && (
            <span id="akademin-err-followup" className="error" role="alert">
              {errors.followUp}
            </span>
          )}
        </div>
      )}

      {failed === 'save' && (
        <p className="error" role="alert">
          Det gick inte att spara. Försök igen.
        </p>
      )}
      {failed === 'remove' && (
        <p className="error" role="alert">
          Det gick inte att ta bort inlägget. Försök igen.
        </p>
      )}

      {confirming ? (
        <DeleteConfirm busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
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

export type JournalView = { kind: 'list' } | { kind: 'entry'; id: string } | { kind: 'new'; entry: JournalEntry };

/** Vart Tillbaka leder i dagboken: formuläret till listan, listan ut till startsidan. */
export function journalBack(view: JournalView): JournalView | 'exit' {
  return view.kind === 'list' ? 'exit' : { kind: 'list' };
}

/** Dagboken. Affärerna läses en gång när vyn öppnas. */
export default function Journal({ data, onExit }: { data: AkademinData; onExit: () => void }) {
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
  return <JournalBody data={data} today={today} links={links} linksFailed={linksFailed} onExit={onExit} />;
}

export function JournalBody({ data, today, links, linksFailed, initialView = { kind: 'list' }, onExit }: { data: AkademinData; today: DateKey; links: EconomyLinks | null; linksFailed: boolean; initialView?: JournalView; onExit: () => void }) {
  const [view, setView] = useState<JournalView>(initialView);
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const toList = () => setView({ kind: 'list' });
  const back = () => {
    const to = journalBack(view);
    if (to === 'exit') onExit();
    else setView(to);
  };
  // Ny vy: fokus till dess rubrik.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
    root.current?.querySelector<HTMLElement>('.akademin-focus-target')?.focus();
  }, [view.kind]);

  const existing = view.kind === 'entry' ? data.journal.find((e) => e.id === view.id) : undefined;
  return (
    <div ref={root}>
      <button type="button" className="akademin-back" onClick={back}>
        Tillbaka
      </button>
      {view.kind === 'list' && <JournalList entries={data.journal} today={today} onOpen={(id) => setView({ kind: 'entry', id })} onAdd={() => setView({ kind: 'new', entry: newJournalEntry(today) })} />}
      {view.kind === 'entry' && !existing && (
        <div className="empty" role="status">
          <p>Inlägget finns inte längre.</p>
          <button type="button" onClick={toList}>
            Till dagboken
          </button>
        </div>
      )}
      {(view.kind === 'new' || existing) && (
        <JournalForm
          key={view.kind === 'new' ? view.entry.id : existing!.id}
          entry={view.kind === 'new' ? view.entry : existing!}
          isNew={view.kind === 'new'}
          today={today}
          companies={data.companies}
          links={links}
          linksFailed={linksFailed}
          onSave={async (e) => {
            await saveJournalEntry(e);
            toList();
          }}
          onRemove={async () => {
            await removeJournalEntry((view.kind === 'new' ? view.entry : existing!).id);
            toList();
          }}
          onClose={toList}
        />
      )}
    </div>
  );
}
