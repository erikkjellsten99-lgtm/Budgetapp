import { useEffect, useRef, useState } from 'react';
import { longDate, weekStart, weekday, type DateKey } from '../vanor/dates';
import { loadHabitData, onHabitChange } from '../vanor/store';
import { METRICS, type HealthDay } from '../../supabase/functions/inbox/health.ts';
import { readiness, READINESS_TITLE, type ReadinessLevel } from '../../supabase/functions/inbox/readiness.ts';
import { currentSubscription, enablePush, PushError, pushSupport } from '../vanor/push';
import { Ring, statusLine } from './Challenges';
import { dayResult, isComplete, pause, progress, resume, workoutSummary, type Cell, type CheckinMap } from './logic';
import { deleteChallenge, saveChallenge, saveCheckin, savePhoto } from './store';
import { forgetPhotoUrl, photoUrl } from './sync';
import { checkinId, WORKOUT_KINDS, type Attempt, type Challenge, type ChallengeTask, type Checkin, type Notice } from './types';

interface Props {
  challenge: Challenge;
  tasks: ChallengeTask[];
  attempts: Attempt[];
  checkins: Checkin[];
  map: CheckinMap;
  today: DateKey;
  onBack: () => void;
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const decimal = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Sparar en bockning. `done` räknas alltid om från värdena, så att den stämmer med uppgiftens mål. */
async function write(challenge: Challenge, task: ChallengeTask, date: DateKey, existing: Checkin | undefined, patch: Partial<Pick<Checkin, 'done' | 'value' | 'data'>>) {
  const base: Checkin = existing ?? { id: checkinId(task.id, date), challenge_id: challenge.id, task_id: task.id, date, done: false, value: null, data: {} };
  const next: Checkin = { ...base, ...patch, data: { ...base.data, ...patch.data } };
  next.done = isComplete(task, next);
  await saveCheckin(next);
}

export default function ChallengeDetail({ challenge, tasks, attempts, checkins, map, today, onBack }: Props) {
  const p = progress(challenge, tasks, map, today);
  const [selected, setSelected] = useState<DateKey>(today);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Efter midnatt följer dagvyn med till den nya dagen.
  useEffect(() => setSelected(today), [today]);

  const started = challenge.start_date <= today;
  const editable = selected === today && challenge.status === 'active' && started;
  const result = dayResult(challenge, tasks, map, selected);
  const selectedCell = p.cells.find((c) => c.date === selected);
  const lastBook = [...checkins].sort((a, b) => b.date.localeCompare(a.date)).find((c) => c.data.book)?.data.book ?? '';
  const photos = checkins.filter((c) => c.data.photo).sort((a, b) => a.date.localeCompare(b.date));
  const summary = workoutSummary(tasks, map, weekStart(selected));
  const notice = challenge.settings.notice;

  return (
    <>
      <button type="button" className="back-link" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Challenges
      </button>

      <header className="ch-detail-head">
        <Ring day={p.day} length={challenge.length_days} done={challenge.status === 'completed'} />
        <div>
          <h2 className="headline">{challenge.title}</h2>
          <p className="date-line">
            Dag {p.day}/{challenge.length_days} · Försök #{challenge.attempt_number}
          </p>
          <p className="date-line">
            Streak {p.streak} · Längsta {Math.max(challenge.best_streak, p.streak)}
          </p>
        </div>
      </header>

      {notice && <NoticeBanner challenge={challenge} notice={notice} />}

      {challenge.status === 'paused' && (
        <div className="pause-banner" role="status">
          <span>Pausad sedan {challenge.settings.paused_from}. Dagarna räknas inte.</span>
          <button type="button" className="text-btn" onClick={() => saveChallenge(resume(challenge, today))}>
            Fortsätt
          </button>
        </div>
      )}

      {started && challenge.status === 'active' && tasks.some((t) => t.type === 'workout') && <ReadinessCard today={today} />}

      <section className="section" aria-labelledby="ch-day-title">
        <div className="ch-section-head">
          <h3 className="section-title" id="ch-day-title">
            {selected === today ? 'Idag' : longDate(selected)}
          </h3>
          {selected !== today ? (
            <button type="button" className="text-btn" onClick={() => setSelected(today)}>
              Till idag
            </button>
          ) : (
            started && challenge.status !== 'completed' && <span className={result.state === 'done' ? 'ch-pill ok' : 'ch-pill'}>{statusLine(challenge, p, today)}</span>
          )}
        </div>
        {!started ? (
          <p className="ch-empty">Utmaningen startar {lower(longDate(challenge.start_date))}. Då dyker dagens uppgifter upp här.</p>
        ) : (
          <>
            {selected !== today && (
              <p className="section-hint">
                {selectedCell?.state === 'void'
                  ? 'Dagen räknas inte (omstartad vecka eller paus).'
                  : result.state === 'done'
                    ? 'Alla uppgifter klara.'
                    : `Inte klart: ${result.missing.join(', ')}.`}{' '}
                Tidigare dagar går inte att ändra.
              </p>
            )}
            <ul className="ch-tasks">
              {tasks.map((task) => (
                <TaskItem key={`${task.id}-${selected}`} challenge={challenge} task={task} date={selected} checkin={map.get(checkinId(task.id, selected))} editable={editable} lastBook={lastBook} />
              ))}
            </ul>
            {editable &&
              result.missing
                .filter((m) => !tasks.some((t) => t.title === m))
                .map((m) => (
                  <p key={m} className="ch-requirement">
                    {m} än. Markera {m.includes('utomhus') ? 'Utomhus' : 'Morgonlöpning'} på ett av passen.
                  </p>
                ))}
          </>
        )}
      </section>

      {challenge.settings.diet_plan !== undefined && <DietPlan challenge={challenge} />}

      <section className="section" aria-labelledby="ch-map-title">
        <h3 className="section-title" id="ch-map-title">
          Alla dagar
        </h3>
        <Heatmap cells={p.cells} today={today} selected={selected} onSelect={setSelected} />
        <p className="ch-legend">
          <span className="ch-dot done" /> Alla klara <span className="ch-dot partial" /> Delvis <span className="ch-dot missed" /> Missad
          {p.cells.some((c) => c.state === 'void') && (
            <>
              {' '}
              <span className="ch-dot void" /> Räknas inte
            </>
          )}
        </p>
        <p className="section-hint">Sista dagen blir {lower(longDate(p.endDate))} om inget missas.</p>
      </section>

      {summary.length > 0 && (
        <section className="section" aria-labelledby="ch-week-title">
          <h3 className="section-title" id="ch-week-title">
            Veckans pass
          </h3>
          <div className="group">
            {summary.map(({ task, total, kinds }) => (
              <p key={task.id} className="group-row">
                <span className="row-main">
                  <span className="row-name">{task.title}</span>
                  <span className="row-sub">{kinds.length ? kinds.map(([kind, n]) => `${kind} ${n}`).join(' · ') : 'Inga pass än den här veckan'}</span>
                </span>
                <span className="row-value">{total}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {tasks.some((t) => t.type === 'photo') && <Gallery photos={photos} />}

      {attempts.length > 0 && (
        <section className="section" aria-labelledby="ch-attempts-title">
          <h3 className="section-title" id="ch-attempts-title">
            Tidigare försök
          </h3>
          <div className="group">
            {attempts.map((a) => (
              <p key={a.id} className="group-row">
                <span className="row-main">
                  <span className="row-name">Försök #{a.attempt_number}</span>
                  <span className="row-sub">
                    {a.started_at} till {a.ended_at}
                  </span>
                </span>
                <span className="row-value">{a.days_completed} {a.days_completed === 1 ? 'dag' : 'dagar'}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="ch-rules-title">
        <h3 className="section-title" id="ch-rules-title">
          Regler och notiser
        </h3>
        <p className="section-hint">
          En dag är missad om inte allt är klart vid midnatt.{' '}
          {challenge.rules.max_misses_per_week === 0 ? 'Ingen miss tillåts' : `Högst ${challenge.rules.max_misses_per_week} ${challenge.rules.max_misses_per_week === 1 ? 'miss' : 'missar'} per vecka`}
          {challenge.rules.on_fail === 'restart_challenge' ? ', annars börjar utmaningen om från dag 1.' : ', annars börjar veckan om.'}
        </p>
        <Reminders challenge={challenge} />
      </section>

      <div className="ch-actions">
        {challenge.status === 'active' && (
          <button type="button" className="text-btn" onClick={() => saveChallenge(pause(challenge, today))}>
            Pausa utmaningen
          </button>
        )}
        <button
          type="button"
          className="text-btn ch-danger"
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await deleteChallenge(challenge);
            onBack();
          }}
        >
          {confirmDelete ? 'Tryck igen för att ta bort allt' : 'Ta bort utmaningen'}
        </button>
      </div>
    </>
  );
}

function NoticeBanner({ challenge, notice }: { challenge: Challenge; notice: Notice }) {
  const day = lower(longDate(notice.date));
  const missing = notice.missing.join(', ');
  const days = `${notice.days_completed} ${notice.days_completed === 1 ? 'dag' : 'dagar'}`;
  return (
    <div className={notice.type === 'completed' ? 'ch-notice ok' : 'ch-notice'} role="status">
      {notice.type === 'completed' && (
        <>
          <strong>Klart! Du tog dig igenom alla {challenge.length_days} dagar.</strong>
          <span>
            Försök #{notice.attempt}, {days} helt avklarade. Sista dagen var {day}.
          </span>
        </>
      )}
      {notice.type === 'restart_challenge' && (
        <>
          <strong>Försök #{notice.attempt} tog slut efter {days}.</strong>
          <span>
            Du missade {day}: {missing}. Enligt reglerna börjar utmaningen om från dag 1. Försök #{challenge.attempt_number} startade {challenge.start_date}.
          </span>
        </>
      )}
      {notice.type === 'restart_week' && (
        <>
          <strong>Veckan började om.</strong>
          <span>
            Du missade {day}: {missing}. Veckans dagar fram till dess räknas inte och görs om, så slutdatumet har flyttats.
          </span>
        </>
      )}
      <button type="button" className="text-btn" onClick={() => saveChallenge({ ...challenge, settings: { ...challenge.settings, notice: null } })}>
        Okej
      </button>
    </div>
  );
}

function CheckButton({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={on ? 'check on' : 'check'} aria-pressed={on} aria-label={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </button>
  );
}

interface ItemProps {
  challenge: Challenge;
  task: ChallengeTask;
  date: DateKey;
  checkin: Checkin | undefined;
  editable: boolean;
  lastBook: string;
}

function TaskItem({ challenge, task, date, checkin, editable, lastBook }: ItemProps) {
  const done = !!checkin?.done;
  const save = (patch: Partial<Pick<Checkin, 'done' | 'value' | 'data'>>) => write(challenge, task, date, checkin, patch);
  const manual = task.type === 'check' || task.type === 'workout';

  return (
    <li className={done ? 'ch-task is-done' : 'ch-task'}>
      <div className="ch-task-row">
        <CheckButton
          on={done}
          label={`${task.title}: ${done ? 'klart' : 'inte klart'}`}
          disabled={!editable || !manual}
          onClick={() => save({ done: !done })}
        />
        <div className="ch-task-text">
          <span className="ch-task-title">{task.title}</span>
          {task.subtitle && <span className="ch-task-sub">{task.subtitle}</span>}
        </div>
      </div>
      {task.type === 'workout' && (editable || checkin) && <WorkoutFields checkin={checkin} editable={editable} save={save} />}
      {task.type === 'counter' && <CounterFields task={task} checkin={checkin} editable={editable} save={save} />}
      {task.type === 'reading' && (editable || checkin) && <ReadingFields task={task} checkin={checkin} editable={editable} save={save} lastBook={lastBook} />}
      {task.type === 'photo' && <PhotoField challenge={challenge} task={task} date={date} checkin={checkin} editable={editable} save={save} />}
    </li>
  );
}

type Save = (patch: Partial<Pick<Checkin, 'done' | 'value' | 'data'>>) => Promise<void>;

function WorkoutFields({ checkin, editable, save }: { checkin: Checkin | undefined; editable: boolean; save: Save }) {
  const data = checkin?.data ?? {};
  return (
    <div className="ch-fields">
      <div className="ch-toggles">
        <button type="button" className={data.outdoor ? 'ch-toggle on' : 'ch-toggle'} aria-pressed={!!data.outdoor} disabled={!editable} onClick={() => save({ data: { outdoor: !data.outdoor } })}>
          Utomhus
        </button>
        <button type="button" className={data.morning_run ? 'ch-toggle on' : 'ch-toggle'} aria-pressed={!!data.morning_run} disabled={!editable} onClick={() => save({ data: { morning_run: !data.morning_run } })}>
          Morgonlöpning (före frukost)
        </button>
      </div>
      <div className="ch-inline">
        <select aria-label="Typ av pass" value={data.kind ?? ''} disabled={!editable} onChange={(e) => save({ data: { kind: e.target.value || undefined } })}>
          <option value="">Typ av pass</option>
          {WORKOUT_KINDS.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Anteckning"
          placeholder="Kort anteckning"
          maxLength={200}
          defaultValue={data.note ?? ''}
          disabled={!editable}
          onBlur={(e) => e.target.value.trim() !== (data.note ?? '') && save({ data: { note: e.target.value.trim() } })}
        />
      </div>
    </div>
  );
}

function CounterFields({ task, checkin, editable, save }: { task: ChallengeTask; checkin: Checkin | undefined; editable: boolean; save: Save }) {
  const target = task.target ?? 1;
  const step = Number.isInteger(target) ? 1 : 0.5;
  // Enheten står i titeln ("Drick 3,8 l vatten"). Utan enhet visas bara talen.
  const unit = /\d\s?l\b/i.test(task.title) ? ' l' : '';
  const value = checkin?.value ?? 0;
  const set = (next: number) => save({ value: Math.max(0, Math.round(next * 10) / 10) });
  return (
    <div className="ch-fields ch-counter">
      <span className="ch-counter-value">
        {decimal(value)} / {decimal(target)}
        {unit}
      </span>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </span>
      {editable && (
        <span className="ch-counter-buttons">
          <button type="button" className="ch-step" aria-label={`Minska med ${decimal(step)}${unit}`} disabled={value <= 0} onClick={() => set(value - step)}>
            −
          </button>
          <button type="button" className="ch-step plus" onClick={() => set(value + step)}>
            +{decimal(step)}
            {unit}
          </button>
        </span>
      )}
    </div>
  );
}

function ReadingFields({ task, checkin, editable, save, lastBook }: { task: ChallengeTask; checkin: Checkin | undefined; editable: boolean; save: Save; lastBook: string }) {
  const [book, setBook] = useState(checkin?.data.book ?? lastBook);
  const [pages, setPages] = useState(checkin?.data.pages ? String(checkin.data.pages) : '');
  const commit = () => {
    const count = Math.min(9999, Math.max(0, Math.floor(Number(pages) || 0)));
    if (count === (checkin?.data.pages ?? 0) && book.trim() === (checkin?.data.book ?? '')) return;
    if (!checkin && count === 0) return;
    save({ data: { book: book.trim(), pages: count } });
  };
  return (
    <div className="ch-fields ch-inline">
      <input type="text" aria-label="Boktitel" placeholder="Boktitel" maxLength={120} value={book} disabled={!editable} onChange={(e) => setBook(e.target.value)} onBlur={commit} />
      <input
        className="ch-pages"
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`Sidor lästa, mål ${task.target ?? 1}`}
        placeholder="Sidor"
        value={pages}
        disabled={!editable}
        onChange={(e) => setPages(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

/** Krymper bilden till högst 1600 px på längsta sidan och sparar som JPEG, så att den går fort att ladda upp. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden gick inte att läsa'))), 'image/jpeg', 0.82));
}

function usePhoto(path: string | undefined, version = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) photoUrl(path).then((next) => alive && setUrl(next));
    return () => {
      alive = false;
    };
  }, [path, version]);
  return url;
}

function PhotoField({ challenge, task, date, checkin, editable, save }: { challenge: Challenge; task: ChallengeTask; date: DateKey; checkin: Checkin | undefined; editable: boolean; save: Save }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const url = usePhoto(checkin?.data.photo, version);

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const path = `${challenge.id}/${task.id}/${date}.jpg`;
      await savePhoto({ path, blob: await shrink(file), uploaded: false });
      forgetPhotoUrl(path);
      await save({ data: { photo: path } });
      setVersion((v) => v + 1);
    } catch {
      setError('Bilden gick inte att spara. Prova en annan bild.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="ch-fields ch-photo">
      {checkin?.data.photo && (url ? <img src={url} alt={`Progressbild ${date}`} /> : <span className="ch-photo-missing">Bilden visas när du har nät.</span>)}
      {editable && (
        <>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="ch-step plus" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Sparar…' : checkin?.data.photo ? 'Byt bild' : 'Lägg till bild'}
          </button>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Thumb({ checkin, large }: { checkin: Checkin; large?: boolean }) {
  const url = usePhoto(checkin.data.photo);
  return (
    <figure className={large ? 'ch-thumb large' : 'ch-thumb'}>
      {url ? <img src={url} alt={`Progressbild ${checkin.date}`} loading="lazy" /> : <span className="ch-thumb-empty" />}
      <figcaption>{checkin.date}</figcaption>
    </figure>
  );
}

function Gallery({ photos }: { photos: Checkin[] }) {
  return (
    <section className="section" aria-labelledby="ch-photos-title">
      <h3 className="section-title" id="ch-photos-title">
        Progressbilder <span className="count">{photos.length}</span>
      </h3>
      {photos.length === 0 ? (
        <p className="ch-empty">Inga bilder än. Dagens bild lägger du till under Progressbild.</p>
      ) : (
        <>
          {photos.length > 1 && (
            <div className="ch-compare" aria-label="Före och efter">
              <Thumb checkin={photos[0]} large />
              <Thumb checkin={photos[photos.length - 1]} large />
            </div>
          )}
          <div className="ch-gallery">
            {photos.map((c) => (
              <Thumb key={c.id} checkin={c} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DietPlan({ challenge }: { challenge: Challenge }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(challenge.settings.diet_plan ?? '');
  const plan = challenge.settings.diet_plan ?? '';
  return (
    <section className="section" aria-labelledby="ch-diet-title">
      <div className="ch-section-head">
        <h3 className="section-title" id="ch-diet-title">
          Kostplan
        </h3>
        <button
          type="button"
          className="text-btn"
          onClick={async () => {
            if (editing && text.trim() !== plan) await saveChallenge({ ...challenge, settings: { ...challenge.settings, diet_plan: text.trim() } });
            setEditing(!editing);
          }}
        >
          {editing ? 'Spara' : plan ? 'Ändra' : 'Skriv in'}
        </button>
      </div>
      {editing ? (
        <textarea className="ch-textarea" aria-label="Kostplan" rows={6} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <p className={plan ? 'ch-card ch-diet' : 'ch-empty'}>{plan || 'Ingen kostplan inskriven än.'}</p>
      )}
    </section>
  );
}

const DAY_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const CELL_TEXT: Record<Cell['state'], string> = {
  done: 'alla klara',
  partial: 'delvis klar',
  missed: 'missad',
  void: 'räknas inte',
  today: 'idag, inte klar än',
  future: 'kommande',
};

function Heatmap({ cells, today, selected, onSelect }: { cells: Cell[]; today: DateKey; selected: DateKey; onSelect: (date: DateKey) => void }) {
  if (!cells.length) return null;
  const lead = weekday(cells[0].date);
  return (
    <div className="ch-heatmap" role="group" aria-label="Alla dagar i utmaningen">
      {DAY_LETTERS.map((letter, i) => (
        <span key={i} className="ch-weekday" aria-hidden="true">
          {letter}
        </span>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`lead-${i}`} />
      ))}
      {cells.map((cell) => (
        <button
          key={cell.date}
          type="button"
          className={`ch-cell ${cell.state}${cell.date === today ? ' is-today' : ''}${cell.date === selected ? ' is-selected' : ''}`}
          disabled={cell.date > today}
          aria-label={`${longDate(cell.date)}${cell.day ? `, dag ${cell.day}` : ''}: ${CELL_TEXT[cell.state]}`}
          aria-pressed={cell.date === selected}
          onClick={() => onSelect(cell.date)}
        >
          {cell.day ?? ''}
        </button>
      ))}
    </div>
  );
}

/** Notiserna enligt utmaningens inställningar. Skickas av servern (funktionen reminders) när notiser är på i telefonen. */
function Reminders({ challenge }: { challenge: Challenge }) {
  const reminders = challenge.settings.reminders ?? [];
  const support = pushSupport();
  const [on, setOn] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (support === 'ok') currentSubscription().then((sub) => alive && setOn(!!sub));
    return () => {
      alive = false;
    };
  }, [support]);
  if (!reminders.length) return <p className="section-hint">Inga notiser för den här utmaningen.</p>;

  async function enable() {
    setMessage(null);
    try {
      await enablePush(null);
      setOn(true);
    } catch (e) {
      const reason = e instanceof PushError ? e.reason : 'failed';
      setMessage(reason === 'denied' ? 'Notiser är blockerade för appen. Tillåt dem i telefonens inställningar.' : reason === 'login' ? 'Logga in under Konto för att få notiser.' : 'Det gick inte att slå på notiser. Försök igen.');
    }
  }

  return (
    <>
      <div className="group">
        {reminders.map((r) => (
          <p key={r.time + r.title} className="group-row">
            <span className="row-main">
              <span className="row-name">{r.title}</span>
              {r.body && <span className="row-sub">{r.body}</span>}
            </span>
            <span className="row-value">{r.time}</span>
          </p>
        ))}
      </div>
      {support === 'ios-home' && <p className="section-hint">Lägg appen på hemskärmen för att få notiser på iPhone.</p>}
      {support === 'unsupported' && <p className="section-hint">Den här webbläsaren kan inte ta emot notiser.</p>}
      {support === 'ok' && on === true && <p className="section-hint">Notiser är på i den här telefonen.</p>}
      {support === 'ok' && on === false && (
        <button type="button" className="primary" onClick={enable}>
          Slå på notiser
        </button>
      )}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
    </>
  );
}

/** Vad dagsformen betyder för dagens pass. Reglerna ändras inte: allt ska fortfarande bockas av. */
const WORKOUT_ADVICE: Record<ReadinessLevel, string> = {
  go: 'Du är utvilad nog för ett tufft pass som planerat.',
  easy: 'Gör det tuffa passet, men kortare eller lite lättare än planerat. Håll det lätta passet riktigt lugnt.',
  rest: 'Håll båda passen lugna idag, till exempel promenad och rörlighet. Passen ska fortfarande göras för att dagen ska räknas.',
  unknown: 'Det finns inga hälsovärden för idag än. De kommer när genvägen "Hälsa till Groundwork" har körts.',
};

/** Dagsformen ur hälsodatan (samma lagring som Vanor), med råd för dagens pass. */
function ReadinessCard({ today }: { today: DateKey }) {
  const [days, setDays] = useState<HealthDay[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => loadHabitData().then((d) => alive && setDays(d.health));
    load();
    const stop = onHabitChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  if (!days) return null;
  const r = readiness(days, today);
  return (
    <section className={`ch-form ${r.level}`} aria-labelledby="ch-form-title">
      <p className="ch-form-eyebrow">Dagsform</p>
      <h3 className="ch-form-title" id="ch-form-title">
        {READINESS_TITLE[r.level]}
      </h3>
      <p className="ch-form-advice">{WORKOUT_ADVICE[r.level]}</p>
      {r.signals.length > 0 && (
        <ul className="ch-form-signals">
          {r.signals.map((s) => (
            <li key={s.metric} className={s.points < 0 ? 'down' : s.points > 0 ? 'up' : ''}>
              {s.text}
            </li>
          ))}
        </ul>
      )}
      {r.missing.length > 0 && (
        <p className="ch-form-missing">
          Saknas idag: {r.missing.map((m) => METRICS[m].label.toLowerCase()).join(', ')}. Bedömningen blir säkrare när genvägen skickar dem.
        </p>
      )}
    </section>
  );
}
