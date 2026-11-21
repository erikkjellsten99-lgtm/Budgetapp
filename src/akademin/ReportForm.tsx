// Akademin: rapportmallen. En rapport per bolag och period, ifylld för hand. Appen räknar rörelsemarginal och
// omsättningstillväxt och visar uträkningen. Ingenting hämtas utifrån och ingenting kostar något.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { describeGrowth, describeMargin, PERIOD_LABEL, type Described } from './logic';
import { fromDraft, emptyDraft, FIELD_HELP, PERIOD_TYPES, prepareSave, toDraft, validateReport, type NumberKey, type ReportDraft, type ReportErrors } from './reportDraft';
import type { PeriodType, Report } from './types';

const THESIS_LABEL = { ja: 'Ja', nej: 'Nej', osaker: 'Osäker' } as const;

function Field({ id, label, help, error, children }: { id: keyof typeof FIELD_HELP; label: string; help: string; error?: string; children: ReactNode }) {
  return (
    <div className="akademin-field">
      <label>
        {label}
        {children}
      </label>
      {error && (
        <span id={`akademin-err-${id}`} className="error" role="alert">
          {error}
        </span>
      )}
      <details className="akademin-help">
        <summary aria-label={`Förklaring: ${label}`}>Förklaring</summary>
        <p>{help}</p>
      </details>
    </div>
  );
}

const CalcRow = ({ label, result }: { label: string; result: Described }) => (
  <div className="akademin-calc-row">
    <dt>{label}</dt>
    <dd>
      {'text' in result ? (
        result.text
      ) : (
        <>
          <strong>saknas</strong>
          <span className="akademin-meta">{result.missing}</span>
        </>
      )}
    </dd>
  </div>
);

/** Rörelsemarginal och omsättningstillväxt med uträkningen utskriven, eller varför de saknas. */
export function ReportCalculations({ report, reports }: { report: Report; reports: Report[] }) {
  return (
    <section className="akademin-calc" aria-label="Uträkningar">
      <h4>Det här räknar appen</h4>
      <dl>
        <CalcRow label="Rörelsemarginal" result={describeMargin(report)} />
        <CalcRow label="Omsättningstillväxt mot samma period året före" result={describeGrowth(report, reports)} />
      </dl>
    </section>
  );
}

function ReportDeleteConfirm({ title, busy, onConfirm, onCancel }: { title: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  // Fokus till Avbryt när frågan öppnas, och Escape avbryter.
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="akademin-confirm" role="alertdialog" aria-label="Ta bort rapporten" onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}>
      <p className="akademin-confirm-title">Ta bort {title}?</p>
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

export interface ReportFormProps {
  report: Report;
  isNew: boolean;
  companyName: string;
  /** Alla rapporter. Bolagets egna används för dubblettkontrollen och tillväxten. */
  reports: Report[];
  onSave: (report: Report) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
  // Startläge, så att lägena går att visa utan webbläsare.
  initialDraft?: ReportDraft;
  submitted?: boolean;
  confirmingDelete?: boolean;
  failed?: 'save' | 'remove';
}

export function ReportForm(props: ReportFormProps) {
  const { report, isNew, companyName } = props;
  const own = props.reports.filter((r) => r.companyId === report.companyId);
  const [draft, setDraft] = useState<ReportDraft>(() => props.initialDraft ?? (isNew ? { ...emptyDraft(), type: report.type, unit: report.unit, year: report.year } : toDraft(report)));
  const [submitted, setSubmitted] = useState(props.submitted ?? false);
  const [confirming, setConfirming] = useState(props.confirmingDelete ?? false);
  const [failed, setFailed] = useState<'save' | 'remove' | null>(props.failed ?? null);
  const [busy, setBusy] = useState(false);
  // Ref, så att två tryck i samma tick inte båda tar sig förbi spärren.
  const working = useRef(false);
  const errors: ReportErrors = submitted ? validateReport(draft, own, report) : {};
  const set = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: keyof ReportDraft) => ({ value: draft[key], onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) });
  const invalid = (key: keyof ReportErrors) => ({ 'aria-invalid': errors[key] ? ('true' as const) : undefined, 'aria-describedby': errors[key] ? `akademin-err-${key}` : undefined });
  const title = isNew ? 'Ny rapport' : `Rapport ${PERIOD_LABEL[report.type]} ${report.year.trim()}`;

  const number = (key: NumberKey, label: string) => (
    <Field id={key} label={label} help={FIELD_HELP[key]} error={errors[key]}>
      <input type="text" inputMode="decimal" {...text(key)} autoComplete="off" {...invalid(key)} />
    </Field>
  );

  const save = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (working.current) return;
    setSubmitted(true);
    const result = prepareSave(report, draft, own);
    if ('errors' in result) return;
    working.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await props.onSave(result.report);
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
    <form className="akademin-company-form akademin-report-form" onSubmit={save} noValidate aria-label={title}>
      <h3 className="akademin-focus-target" tabIndex={-1}>{title}</h3>
      <p className="akademin-meta">{companyName.trim() || 'Bolaget'}. Alla siffror är valfria.</p>

      <Field id="year" label="Räkenskapsår" help={FIELD_HELP.year} error={errors.year}>
        <input type="text" {...text('year')} autoComplete="off" placeholder="2026 eller 2025/26" {...invalid('year')} />
      </Field>
      <Field id="type" label="Typ" help={FIELD_HELP.type}>
        <select value={draft.type} onChange={(e) => set('type', e.target.value as PeriodType)}>
          {PERIOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {PERIOD_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="date" label="Rapportdatum" help={FIELD_HELP.date} error={errors.date}>
        <input type="date" {...text('date')} {...invalid('date')} />
      </Field>
      <Field id="unit" label="Enhet" help={FIELD_HELP.unit} error={errors.unit}>
        <input type="text" {...text('unit')} autoComplete="off" {...invalid('unit')} />
      </Field>

      <p className="akademin-note">Siffrorna gäller perioden ensam, inte ackumulerat. Ett kvartal är kvartalet självt, inte året hittills.</p>
      {number('revenue', 'Omsättning')}
      {number('ebit', 'Rörelseresultat')}
      {number('eps', 'Resultat per aktie')}
      {number('cashflow', 'Kassaflöde från den löpande verksamheten')}
      {number('cash', 'Likvida medel')}
      {number('netDebt', 'Nettoskuld')}

      <ReportCalculations report={fromDraft(report, draft)} reports={own} />

      <Field id="outlook" label="Ledningens utsikter" help={FIELD_HELP.outlook}>
        <textarea rows={3} {...text('outlook')} />
      </Field>
      <Field id="good" label="Vad var bra" help={FIELD_HELP.good}>
        <textarea rows={3} {...text('good')} />
      </Field>
      <Field id="bad" label="Vad var dåligt" help={FIELD_HELP.bad}>
        <textarea rows={3} {...text('bad')} />
      </Field>
      <Field id="thesis" label="Håller min tes?" help={FIELD_HELP.thesis}>
        <select value={draft.thesis} onChange={(e) => set('thesis', e.target.value as ReportDraft['thesis'])}>
          <option value="">Inget svar än</option>
          {(['ja', 'nej', 'osaker'] as const).map((t) => (
            <option key={t} value={t}>
              {THESIS_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <label>
        En rad om varför
        <input type="text" {...text('thesisWhy')} autoComplete="off" />
      </label>
      {number('reaction', 'Kursreaktion dagen efter (procent)')}
      <Field id="url" label="Länk till rapporten" help={FIELD_HELP.url} error={errors.url}>
        <input type="url" inputMode="url" {...text('url')} autoComplete="off" placeholder="https://" {...invalid('url')} />
      </Field>

      {failed === 'save' && (
        <p className="error" role="alert">
          Det gick inte att spara. Försök igen.
        </p>
      )}
      {failed === 'remove' && (
        <p className="error" role="alert">
          Det gick inte att ta bort rapporten. Försök igen.
        </p>
      )}

      {confirming ? (
        <ReportDeleteConfirm title={`rapporten ${PERIOD_LABEL[report.type]} ${report.year.trim()}`} busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
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
