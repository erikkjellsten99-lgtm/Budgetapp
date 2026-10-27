import { useEffect, useRef, useState } from 'react';
import { todayKey } from '../vanor/dates';
import { sameName, type Habit } from '../vanor/habits';
import { deleteWorkoutRecord, ensureCheck, newId, saveWorkoutRecord } from '../vanor/store';
import {
  cleanWorkout,
  exerciseNames,
  formatDuration,
  formatNumber,
  formatPace,
  lastSets,
  newestFirst,
  parseDuration,
  parseNumber,
  sameExercise,
  type WorkSet,
  type Workout,
  type WorkoutKind,
} from './training';

// Ett gympass loggas ofta under en timme med telefonen i fickan. Utkastet sparas därför
// hela tiden, så att inget försvinner om appen laddas om eller telefonen låser sig.
const DRAFT_KEY = 'traning-utkast';

interface SetRow {
  kg: string;
  reps: string;
}

interface ExerciseRow {
  key: string;
  name: string;
  sets: SetRow[];
}

interface Draft {
  date: string;
  exercises: ExerciseRow[];
  note: string;
}

export function hasDraft(): boolean {
  return !!readDraft()?.exercises.length;
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft && draft.exercises.length) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Utan lagring sparas inget utkast – passet går ändå att spara.
  }
}

const toRows = (sets: WorkSet[]): SetRow[] => sets.map((s) => ({ kg: formatNumber(s.kg), reps: String(s.reps) }));
const emptySet = (): SetRow => ({ kg: '', reps: '' });

interface Props {
  kind: WorkoutKind;
  /** Passet som ändras. Saknas = nytt pass. */
  workout?: Workout;
  workouts: Workout[];
  habits: Habit[];
  onSaved: (workout: Workout, all: Workout[]) => void;
  onClose: () => void;
}

/** Ark som glider upp: logga eller ändra ett gym- eller löppass. */
export default function WorkoutSheet({ kind, workout, workouts, habits, onSaved, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const today = todayKey();
  const draft = !workout && kind === 'gym' ? readDraft() : null;

  const [date, setDate] = useState(workout?.date ?? draft?.date ?? today);
  const [note, setNote] = useState(workout?.note ?? draft?.note ?? '');
  const [exercises, setExercises] = useState<ExerciseRow[]>(
    workout?.exercises?.map((e) => ({ key: newId(), name: e.name, sets: toRows(e.sets) })) ?? draft?.exercises ?? [],
  );
  const [km, setKm] = useState(workout?.km ? formatNumber(workout.km) : '');
  const [time, setTime] = useState(workout?.seconds ? formatDuration(workout.seconds) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Spara utkastet för ett nytt gympass vid varje ändring.
  useEffect(() => {
    if (kind === 'gym' && !workout) writeDraft({ date, exercises, note });
  }, [kind, workout, date, exercises, note]);

  const isGym = kind === 'gym';
  const title = workout ? (isGym ? 'Ändra gympass' : 'Ändra löppass') : isGym ? 'Gympass' : 'Löppass';

  async function save() {
    if (busy) return;
    setError('');
    let next: Workout;
    if (isGym) {
      next = cleanWorkout({
        id: workout?.id ?? newId(),
        date,
        kind,
        created: workout?.created ?? Date.now(),
        note,
        exercises: exercises.map((e) => ({
          name: e.name,
          sets: e.sets
            .map((s) => ({ kg: parseNumber(s.kg) ?? 0, reps: parseNumber(s.reps) ?? 0 }))
            .filter((s) => s.reps > 0),
        })),
      });
      if (!next.exercises?.length) {
        setError('Lägg till en övning och fyll i reps på minst ett set.');
        return;
      }
    } else {
      const distance = parseNumber(km);
      const seconds = parseDuration(time);
      if (!distance || distance > 200) {
        setError('Skriv hur långt du sprang, t.ex. 5,2 km.');
        return;
      }
      if (!seconds) {
        setError('Skriv tiden som min:sek, t.ex. 26:40.');
        return;
      }
      next = cleanWorkout({
        id: workout?.id ?? newId(),
        date,
        kind,
        created: workout?.created ?? Date.now(),
        km: distance,
        seconds,
        note,
      });
    }
    if (!date || date > today) {
      setError('Välj ett datum som inte har varit än.');
      return;
    }
    setBusy(true);
    try {
      await saveWorkoutRecord(next);
      // Bocka av vanan (Gym eller Löpning) den dagen, om du har den.
      const habit = habits.find((h) => !h.archived && sameName(h.name, isGym ? 'Gym' : 'Löpning'));
      if (habit && !workout) await ensureCheck(habit.id, date);
      if (isGym && !workout) writeDraft(null);
      onSaved(next, [...workouts.filter((w) => w.id !== next.id), next]);
      onClose();
    } catch {
      setError('Kunde inte spara. Försök igen.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!workout) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    await deleteWorkoutRecord(workout.id);
    onClose();
  }

  function discardDraft() {
    writeDraft(null);
    onClose();
  }

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet t-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-title">
        <div className="sheet-head">
          <h2 id="workout-title">{title}</h2>
          <button ref={closeRef} type="button" className="text-btn" onClick={onClose}>
            {isGym && !workout && exercises.length ? 'Stäng' : 'Avbryt'}
          </button>
        </div>

        <label className="field">
          Datum
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>

        {isGym ? (
          <GymForm
            exercises={exercises}
            setExercises={setExercises}
            workouts={workouts}
            editingId={workout?.id}
          />
        ) : (
          <RunForm km={km} setKm={setKm} time={time} setTime={setTime} />
        )}

        <label className="field">
          Anteckning (valfri)
          <input
            value={note}
            maxLength={200}
            placeholder={isGym ? 't.ex. Tungt i dag, sov dåligt' : 't.ex. Intervaller 4 × 1 km'}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && (
          <p className="field-error t-error" role="alert">
            {error}
          </p>
        )}

        <div className="t-actions">
          <button type="button" className="primary t-save" disabled={busy} onClick={save}>
            {workout ? 'Spara ändringar' : 'Spara passet'}
          </button>
          {workout && (
            <button type="button" className="text-btn danger-text" disabled={busy} onClick={remove}>
              {confirmDelete ? 'Tryck igen för att ta bort' : 'Ta bort passet'}
            </button>
          )}
          {isGym && !workout && exercises.length > 0 && (
            <button type="button" className="text-btn quiet" onClick={discardDraft}>
              Släng passet
            </button>
          )}
        </div>
        {isGym && !workout && exercises.length > 0 && (
          <p className="hint center">Passet sparas som utkast medan du tränar, även om du stänger appen.</p>
        )}
      </div>
    </div>
  );
}

function RunForm({
  km,
  setKm,
  time,
  setTime,
}: {
  km: string;
  setKm: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
}) {
  const distance = parseNumber(km);
  const seconds = parseDuration(time);
  return (
    <>
      <div className="t-two">
        <label className="field">
          Distans (km)
          <input value={km} inputMode="decimal" placeholder="5,0" onChange={(e) => setKm(e.target.value)} />
        </label>
        <label className="field">
          Tid (min:sek)
          <input value={time} inputMode="numeric" placeholder="26:40" onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <p className="t-pace" aria-live="polite">
        {distance && seconds ? (
          <>
            Tempo <b>{formatPace(distance, seconds)}</b>
            {distance >= 5 && (
              <>
                {' '}
                · 5 km på <b>{formatDuration((seconds / distance) * 5)}</b>
              </>
            )}
          </>
        ) : (
          'Tempot räknas ut när du fyllt i distans och tid.'
        )}
      </p>
    </>
  );
}

function GymForm({
  exercises,
  setExercises,
  workouts,
  editingId,
}: {
  exercises: ExerciseRow[];
  setExercises: (update: (rows: ExerciseRow[]) => ExerciseRow[]) => void;
  workouts: Workout[];
  editingId?: string;
}) {
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(exercises.length === 0);
  const lastGym = newestFirst(workouts).find((w) => w.kind === 'gym' && w.id !== editingId);

  const inPass = (name: string) => exercises.some((e) => sameExercise(e.name, name));
  const names = exerciseNames(workouts.filter((w) => w.id !== editingId)).filter((n) => !inPass(n));
  const q = query.trim();
  const matches = q ? names.filter((n) => n.toLocaleLowerCase('sv').includes(q.toLocaleLowerCase('sv'))) : names;
  const exact = q && (names.some((n) => sameExercise(n, q)) || inPass(q));

  function addExercise(name: string) {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean || inPass(clean)) return;
    const previous = lastSets(workouts, clean, editingId);
    setExercises((rows) => [...rows, { key: newId(), name: clean, sets: previous ? toRows(previous) : [emptySet()] }]);
    setQuery('');
    setPicking(false);
  }

  function repeatLast() {
    if (!lastGym?.exercises) return;
    setExercises(() => lastGym.exercises!.map((e) => ({ key: newId(), name: e.name, sets: toRows(e.sets) })));
    setPicking(false);
  }

  const update = (key: string, change: (row: ExerciseRow) => ExerciseRow) =>
    setExercises((rows) => rows.map((r) => (r.key === key ? change(r) : r)));

  return (
    <div className="gym-form">
      {exercises.length === 0 && lastGym?.exercises?.length ? (
        <button type="button" className="repeat-btn" onClick={repeatLast}>
          <b>Upprepa förra passet</b>
          <small>{lastGym.exercises.map((e) => e.name).join(', ')}</small>
        </button>
      ) : null}

      {exercises.map((row) => {
        const previous = lastSets(workouts, row.name, editingId);
        return (
          <section key={row.key} className="ex-card" aria-label={row.name}>
            <div className="ex-head">
              <h3>{row.name}</h3>
              <button
                type="button"
                className="icon-x"
                aria-label={`Ta bort ${row.name}`}
                onClick={() => setExercises((rows) => rows.filter((r) => r.key !== row.key))}
              >
                ×
              </button>
            </div>
            {previous && (
              <p className="ex-prev">
                Förra gången: {previous.map((s) => `${formatNumber(s.kg)} × ${s.reps}`).join(', ')}
              </p>
            )}
            <div className="set-grid" role="group" aria-label={`Set för ${row.name}`}>
              <span className="set-label">Set</span>
              <span className="set-label">kg</span>
              <span />
              <span className="set-label">reps</span>
              <span />
              {row.sets.map((set, i) => (
                <SetInputs
                  key={i}
                  index={i}
                  set={set}
                  exercise={row.name}
                  canRemove={row.sets.length > 1}
                  onChange={(next) =>
                    update(row.key, (r) => ({ ...r, sets: r.sets.map((s, j) => (j === i ? next : s)) }))
                  }
                  onRemove={() => update(row.key, (r) => ({ ...r, sets: r.sets.filter((_, j) => j !== i) }))}
                />
              ))}
            </div>
            <button
              type="button"
              className="text-btn small"
              onClick={() => update(row.key, (r) => ({ ...r, sets: [...r.sets, { ...(r.sets.at(-1) ?? emptySet()) }] }))}
            >
              + Set
            </button>
          </section>
        );
      })}

      {picking ? (
        <section className="ex-picker" aria-label="Välj övning">
          <label className="field">
            {exercises.length ? 'Nästa övning' : 'Första övningen'}
            <input
              value={query}
              placeholder="Sök eller skriv en ny"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && q && addExercise(names.find((n) => sameExercise(n, q)) ?? q)}
              autoFocus={exercises.length > 0}
            />
          </label>
          <div className="chips">
            {q && !exact && (
              <button type="button" className="chip new" onClick={() => addExercise(q)}>
                + Lägg till ”{q}”
              </button>
            )}
            {matches.slice(0, 14).map((name) => (
              <button key={name} type="button" className="chip" onClick={() => addExercise(name)}>
                {name}
              </button>
            ))}
          </div>
          {exercises.length > 0 && (
            <button type="button" className="text-btn small" onClick={() => setPicking(false)}>
              Klar
            </button>
          )}
        </section>
      ) : (
        <button type="button" className="add-ex" onClick={() => setPicking(true)}>
          + Lägg till övning
        </button>
      )}
    </div>
  );
}

function SetInputs({
  index,
  set,
  exercise,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  set: SetRow;
  exercise: string;
  canRemove: boolean;
  onChange: (set: SetRow) => void;
  onRemove: () => void;
}) {
  const badKg = set.kg !== '' && parseNumber(set.kg) === null;
  const badReps = set.reps !== '' && parseNumber(set.reps) === null;
  return (
    <>
      <span className="set-no">{index + 1}</span>
      <input
        className="set-input"
        value={set.kg}
        inputMode="decimal"
        placeholder="0"
        aria-label={`${exercise}, set ${index + 1}, kg`}
        aria-invalid={badKg}
        onChange={(e) => onChange({ ...set, kg: e.target.value })}
        onFocus={(e) => e.target.select()}
      />
      <span className="set-x" aria-hidden="true">
        ×
      </span>
      <input
        className="set-input"
        value={set.reps}
        inputMode="numeric"
        placeholder="0"
        aria-label={`${exercise}, set ${index + 1}, reps`}
        aria-invalid={badReps}
        onChange={(e) => onChange({ ...set, reps: e.target.value })}
        onFocus={(e) => e.target.select()}
      />
      {canRemove ? (
        <button type="button" className="icon-x small" aria-label={`Ta bort set ${index + 1}`} onClick={onRemove}>
          ×
        </button>
      ) : (
        <span />
      )}
    </>
  );
}
