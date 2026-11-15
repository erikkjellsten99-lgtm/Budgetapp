import { useEffect, useRef, useState } from 'react';
import type { DateKey } from '../vanor/dates';
import { newId, saveRows } from './store';
import { TEMPLATES, type Template, type TemplateTask } from './templates';
import type { Challenge, ChallengeReminder, ChallengeTask, OnFail, TaskType, WorkoutFlag } from './types';

interface Props {
  today: DateKey;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const TYPE_NAMES: Record<TaskType, string> = {
  check: 'Bocka av',
  counter: 'Räknare',
  reading: 'Läsning (sidor)',
  workout: 'Träningspass',
  photo: 'Bild',
};
const HAS_TARGET: TaskType[] = ['counter', 'reading'];

interface DraftTask extends TemplateTask {
  key: string;
  /** Målet som text, så att "3,8" går att skriva. */
  targetText: string;
}

const draft = (task: TemplateTask): DraftTask => ({ ...task, key: newId(), targetText: task.target === null ? '' : String(task.target).replace('.', ',') });
const parseTarget = (text: string) => Number(text.replace(',', '.').replace(/\s/g, ''));

/** Ark för att skapa en utmaning, från en mall eller från tomt. */
export default function CreateSheet({ today, onClose, onCreated }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [length, setLength] = useState('30');
  const [start, setStart] = useState(today);
  const [tasks, setTasks] = useState<DraftTask[]>([draft({ title: '', subtitle: '', type: 'check', target: null })]);
  const [maxMisses, setMaxMisses] = useState('0');
  const [onFail, setOnFail] = useState<OnFail>('restart_challenge');
  const [requires, setRequires] = useState<WorkoutFlag[]>([]);
  const [dietPlan, setDietPlan] = useState('');
  const [withDiet, setWithDiet] = useState(false);
  const [reminders, setReminders] = useState<ChallengeReminder[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function applyTemplate(next: Template | null) {
    setTemplate(next);
    setTried(false);
    setTitle(next?.title ?? '');
    setDescription(next?.description ?? '');
    setLength(String(next?.length_days ?? 30));
    setTasks(next ? next.tasks.map(draft) : [draft({ title: '', subtitle: '', type: 'check', target: null })]);
    setMaxMisses(String(next?.rules.max_misses_per_week ?? 0));
    setOnFail(next?.rules.on_fail ?? 'restart_challenge');
    setRequires(next?.rules.workout_requires ?? []);
    setWithDiet(!!next?.asksDietPlan);
    setReminders(next?.settings.reminders ?? []);
    if (!next) requestAnimationFrame(() => titleRef.current?.focus());
  }

  const days = Number(length);
  const misses = Number(maxMisses);
  const named = tasks.filter((t) => t.title.trim());
  const errors = {
    title: !title.trim() ? 'Ge utmaningen ett namn.' : null,
    length: !Number.isInteger(days) || days < 1 || days > 3650 ? 'Längden ska vara mellan 1 och 3 650 dagar.' : null,
    start: !/^\d{4}-\d{2}-\d{2}$/.test(start) ? 'Välj ett startdatum.' : null,
    tasks: named.length === 0 ? 'Lägg till minst en uppgift.' : null,
    target: named.some((t) => HAS_TARGET.includes(t.type) && !(parseTarget(t.targetText) > 0)) ? 'Räknare och läsning behöver ett mål större än 0.' : null,
    misses: !Number.isInteger(misses) || misses < 0 || misses > 6 ? 'Missar per vecka ska vara mellan 0 och 6.' : null,
    reminders: reminders.some((r) => !/^\d\d:\d\d$/.test(r.time) || !r.title.trim()) ? 'Varje notis behöver en tid och en text.' : null,
  };
  const firstError = Object.values(errors).find(Boolean) ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (busy || firstError) return;
    setBusy(true);
    const id = newId();
    const hasWorkout = named.some((t) => t.type === 'workout');
    const challenge: Challenge = {
      id,
      title: title.trim(),
      description: description.trim(),
      length_days: days,
      start_date: start,
      status: 'active',
      attempt_number: 1,
      best_streak: 0,
      settings: {
        ...(template?.settings ?? {}),
        reminders: reminders.map((r) => ({ time: r.time, title: r.title.trim(), ...(r.body?.trim() ? { body: r.body.trim() } : {}) })),
        ...(withDiet ? { diet_plan: dietPlan.trim() } : {}),
      },
      rules: { max_misses_per_week: misses, on_fail: onFail, ...(hasWorkout && requires.length ? { workout_requires: requires } : {}) },
      created_at: new Date().toISOString(),
    };
    const rows: ChallengeTask[] = named.map((t, i) => ({
      id: newId(),
      challenge_id: id,
      title: t.title.trim(),
      subtitle: t.subtitle.trim(),
      type: t.type,
      target: HAS_TARGET.includes(t.type) ? parseTarget(t.targetText) : null,
      sort_order: i,
    }));
    await saveRows([{ table: 'challenges', row: challenge }, ...rows.map((row) => ({ table: 'challenge_tasks' as const, row }))]);
    onCreated(id);
  }

  const setTask = (key: string, patch: Partial<DraftTask>) => setTasks((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const setReminder = (index: number, patch: Partial<ChallengeReminder>) => setReminders((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const toggleRequire = (flag: WorkoutFlag) => setRequires((list) => (list.includes(flag) ? list.filter((f) => f !== flag) : [...list, flag]));
  const show = (error: string | null) =>
    tried && error ? (
      <p className="field-error" role="alert">
        {error}
      </p>
    ) : null;

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet ch-sheet" role="dialog" aria-modal="true" aria-labelledby="ch-create-title" onSubmit={save} noValidate>
        <div className="sheet-head">
          <h2 id="ch-create-title">Ny utmaning</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Avbryt
          </button>
        </div>

        <div>
          <p className="ch-label">Starta från mall</p>
          <div className="chips">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={template?.id === t.id} onClick={() => applyTemplate(template?.id === t.id ? null : t)}>
                {t.title} <span>{t.length_days} dagar</span>
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={!template} onClick={() => applyTemplate(null)}>
              Egen
            </button>
          </div>
        </div>

        <label className="field">
          <span>Namn</span>
          <input ref={titleRef} type="text" maxLength={80} value={title} aria-invalid={tried && !!errors.title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {show(errors.title)}

        <label className="field">
          <span>Beskrivning (valfritt)</span>
          <input type="text" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="ch-two">
          <label className="field">
            <span>Längd, dagar</span>
            <input type="number" inputMode="numeric" min={1} max={3650} value={length} aria-invalid={tried && !!errors.length} onChange={(e) => setLength(e.target.value)} />
          </label>
          <label className="field">
            <span>Startdatum</span>
            <input type="date" value={start} aria-invalid={tried && !!errors.start} onChange={(e) => setStart(e.target.value)} />
          </label>
        </div>
        {show(errors.length)}
        {show(errors.start)}

        <div>
          <h3>Uppgifter varje dag</h3>
          <ul className="ch-draft-list">
            {tasks.map((t, i) => (
              <li key={t.key} className="ch-draft">
                <div className="ch-draft-row">
                  <input type="text" aria-label={`Uppgift ${i + 1}`} placeholder="T.ex. Ingen alkohol" maxLength={80} value={t.title} onChange={(e) => setTask(t.key, { title: e.target.value })} />
                  <button type="button" className="ch-remove" aria-label={`Ta bort uppgift ${i + 1}`} onClick={() => setTasks((list) => list.filter((x) => x.key !== t.key))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="ch-draft-row">
                  <select aria-label={`Typ för uppgift ${i + 1}`} value={t.type} onChange={(e) => setTask(t.key, { type: e.target.value as TaskType })}>
                    {(Object.keys(TYPE_NAMES) as TaskType[]).map((type) => (
                      <option key={type} value={type}>
                        {TYPE_NAMES[type]}
                      </option>
                    ))}
                  </select>
                  {HAS_TARGET.includes(t.type) && (
                    <input className="ch-target" type="text" inputMode="decimal" aria-label={`Mål för uppgift ${i + 1}`} placeholder="Mål" value={t.targetText} onChange={(e) => setTask(t.key, { targetText: e.target.value })} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="text-btn" onClick={() => setTasks((list) => [...list, draft({ title: '', subtitle: '', type: 'check', target: null })])}>
            Lägg till uppgift
          </button>
          {show(errors.tasks)}
          {show(errors.target)}
        </div>

        {tasks.some((t) => t.type === 'workout') && (
          <div>
            <p className="ch-label">Dagen räknas bara om minst ett pass är</p>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={requires.includes('outdoor')} onClick={() => toggleRequire('outdoor')}>
                Utomhus
              </button>
              <button type="button" className="chip" aria-pressed={requires.includes('morning_run')} onClick={() => toggleRequire('morning_run')}>
                Morgonlöpning
              </button>
            </div>
          </div>
        )}

        <div>
          <h3>Regler</h3>
          <label className="field">
            <span>Tillåtna missar per vecka</span>
            <input type="number" inputMode="numeric" min={0} max={6} value={maxMisses} aria-invalid={tried && !!errors.misses} onChange={(e) => setMaxMisses(e.target.value)} />
          </label>
          {show(errors.misses)}
          <p className="ch-label ch-gap">Om det blir fler missar</p>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={onFail === 'restart_challenge'} onClick={() => setOnFail('restart_challenge')}>
              Börja om från dag 1
            </button>
            <button type="button" className="chip" aria-pressed={onFail === 'restart_week'} onClick={() => setOnFail('restart_week')}>
              Gör om veckan
            </button>
          </div>
        </div>

        <div>
          <label className="ch-switch">
            <input type="checkbox" checked={withDiet} onChange={(e) => setWithDiet(e.target.checked)} />
            <span>Kostplan som visas i dagvyn</span>
          </label>
          {withDiet && <textarea className="ch-textarea" aria-label="Min kostplan" placeholder="Skriv din kostplan här. Den går att ändra senare." rows={5} maxLength={4000} value={dietPlan} onChange={(e) => setDietPlan(e.target.value)} />}
        </div>

        <div>
          <h3>Notiser</h3>
          {reminders.length === 0 && <p className="field-help">Inga notiser. Lägg till en tid om du vill bli påmind varje dag.</p>}
          <ul className="ch-draft-list">
            {reminders.map((r, i) => (
              <li key={i} className="ch-draft">
                <div className="ch-draft-row">
                  <input className="ch-time" type="time" aria-label={`Tid för notis ${i + 1}`} value={r.time} onChange={(e) => setReminder(i, { time: e.target.value })} />
                  <input type="text" aria-label={`Text för notis ${i + 1}`} placeholder="Text" maxLength={80} value={r.title} onChange={(e) => setReminder(i, { title: e.target.value })} />
                  <button type="button" className="ch-remove" aria-label={`Ta bort notis ${i + 1}`} onClick={() => setReminders((list) => list.filter((_, x) => x !== i))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="text-btn" onClick={() => setReminders((list) => [...list, { time: '20:00', title: '' }])}>
            Lägg till notis
          </button>
          {show(errors.reminders)}
        </div>

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Skapar…' : 'Starta utmaningen'}
        </button>
        {tried && firstError && (
          <p className="field-error" role="alert">
            Något saknas ovan: {firstError}
          </p>
        )}
      </form>
    </div>
  );
}
