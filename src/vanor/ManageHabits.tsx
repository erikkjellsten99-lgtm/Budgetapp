import { useState } from 'react'
import { SUGGESTIONS } from './defaults'
import { NAME_MAX, goalText, habitPlan, nameError, sameName, type Habit } from './habits'
import { addHabit, removeHabit, restoreHabit, updateHabit } from './store'

/** Lägg till, ändra, ta bort och lägg tillbaka vanor. Visas i Inställningar. */
export default function ManageHabits({ all }: { all: Habit[] }) {
  const [editing, setEditing] = useState<string | null>(null)

  const active = all.filter((h) => !h.archived)
  const removed = all.filter((h) => h.archived)
  // Förslag som redan finns (eller ligger bland borttagna) visas inte.
  const suggestions = SUGGESTIONS.filter((s) => !all.some((h) => sameName(h.name, s.name)))

  return (
    <>
      <section>
        <h3>Mina vanor</h3>
        {active.length ? (
          <ul className="manage-list">
            {active.map((h) =>
              editing === h.id ? (
                <EditHabit key={h.id} habit={h} active={active} onDone={() => setEditing(null)} />
              ) : (
                <li key={h.id} className="manage-row">
                  <div className="manage-info">
                    <b>{h.name}</b>
                    <span>
                      {habitPlan(h, (id) => active.find((a) => a.id === id)?.name)}
                      {h.after.some((id) => active.some((a) => a.id === id)) ? ` · ${goalText(h.goal)}` : ''}
                      {h.minimum ? ` · minimum ${h.minimum}` : ''}
                      {h.remind ? ` · påminnelse ${h.remind}` : ''}
                    </span>
                  </div>
                  <button type="button" className="text-btn" onClick={() => setEditing(h.id)}>
                    Ändra
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="hint">Inga vanor än. Lägg till en nedan.</p>
        )}
      </section>

      <section>
        <h3>Lägg till vana</h3>
        <NewHabit active={active} />
        {suggestions.length > 0 && (
          <>
            <p className="hint chips-hint">Eller välj ett förslag:</p>
            <div className="chips">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="chip"
                  onClick={() => addHabit(s.name, s.goal, s.minimum)}
                >
                  + {s.name} <span>{s.goal >= 7 ? 'dagl.' : `${s.goal}/v`}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {removed.length > 0 && (
        <section>
          <h3>Borttagna</h3>
          <p className="hint">Det du bockat finns kvar. Lägg tillbaka så fortsätter historiken.</p>
          <ul className="manage-list">
            {removed.map((h) => (
              <li key={h.id} className="manage-row is-removed">
                <div className="manage-info">
                  <b>{h.name}</b>
                  <span>{goalText(h.goal)}</span>
                </div>
                <button type="button" className="text-btn" onClick={() => restoreHabit(h.id)}>
                  Lägg tillbaka
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Mål 1–7 dagar i veckan. */
function GoalPicker({ value, onChange, id }: { value: number; onChange: (goal: number) => void; id: string }) {
  return (
    <div className="goal-picker" role="radiogroup" aria-labelledby={id}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={goalText(n)}
          onClick={() => onChange(n)}
        >
          {n === 7 ? 'Alla' : n}
        </button>
      ))}
    </div>
  )
}

interface FieldsProps {
  idPrefix: string
  /** Vanor som den här kan göras efter (alla andra aktiva). */
  others: Habit[]
  after: string[]
  setAfter: (v: string[]) => void
  name: string
  goal: number
  minimum: string
  remind: string
  error: string | null
  setName: (v: string) => void
  setGoal: (v: number) => void
  setMinimum: (v: string) => void
  setRemind: (v: string) => void
}

function HabitFields({
  idPrefix,
  others,
  after,
  setAfter,
  name,
  goal,
  minimum,
  remind,
  error,
  setName,
  setGoal,
  setMinimum,
  setRemind,
}: FieldsProps) {
  return (
    <>
      <label className="field">
        <span>Namn</span>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder="T.ex. Läsa 20 min"
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={!!error}
          aria-describedby={error ? `${idPrefix}-err` : undefined}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && (
        <p className="field-error" id={`${idPrefix}-err`} role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <span id={`${idPrefix}-goal`}>
          Mål: <b>{goalText(goal)}</b>
        </span>
        <GoalPicker id={`${idPrefix}-goal`} value={goal} onChange={setGoal} />
      </div>
      <label className="field">
        <span>Minimum en dålig dag (valfritt)</span>
        <input
          id={`${idPrefix}-min`}
          type="text"
          value={minimum}
          maxLength={40}
          placeholder="T.ex. 5 min"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setMinimum(e.target.value)}
        />
      </label>
      <div className="field">
        <label htmlFor={`${idPrefix}-remind`}>Påminnelse (valfri)</label>
        <div className="remind-row">
          <input
            id={`${idPrefix}-remind`}
            type="time"
            value={remind}
            step={300}
            onChange={(e) => setRemind(e.target.value)}
          />
          {remind && (
            <button type="button" className="text-btn" onClick={() => setRemind('')}>
              Ingen
            </button>
          )}
        </div>
        <small className="field-help">
          En notis vid den tiden om vanan inte är bockad. Slå på notiser under Påminnelser överst.
        </small>
      </div>
      {others.length > 0 && (
        <div className="field">
          <span id={`${idPrefix}-after`}>Görs efter (valfritt)</span>
          <div className="chips" role="group" aria-labelledby={`${idPrefix}-after`}>
            {others.map((o) => {
              const on = after.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setAfter(on ? after.filter((x) => x !== o.id) : [...after, o.id])}
                >
                  {on ? '✓ ' : ''}
                  {o.name}
                </button>
              )
            })}
          </div>
          <small className="field-help">Vanan kommer upp de dagar du gjort någon av dessa, t.ex. Stretching efter Gym.</small>
        </div>
      )}
    </>
  )
}

function NewHabit({ active }: { active: Habit[] }) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState(3)
  const [minimum, setMinimum] = useState('')
  const [remind, setRemind] = useState('')
  const [after, setAfter] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState('')
  const error = tried ? nameError(name, active) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (busy || nameError(name, active)) return
    setBusy(true)
    await addHabit(name, goal, minimum, after, remind)
    setAdded(name.trim())
    setName('')
    setMinimum('')
    setRemind('')
    setAfter([])
    setGoal(3)
    setTried(false)
    setBusy(false)
  }

  return (
    <form className="habit-form" onSubmit={submit} noValidate>
      <HabitFields
        idPrefix="new"
        others={active}
        after={after}
        setAfter={setAfter}
        name={name}
        goal={goal}
        minimum={minimum}
        remind={remind}
        error={error}
        setName={(v) => {
          setName(v)
          setAdded('')
        }}
        setGoal={setGoal}
        setMinimum={setMinimum}
        setRemind={setRemind}
      />
      <button type="submit" className="primary" disabled={busy}>
        Lägg till
      </button>
      {added && (
        <p className="field-ok" role="status">
          {added} är tillagd.
        </p>
      )}
    </form>
  )
}

function EditHabit({ habit, active, onDone }: { habit: Habit; active: Habit[]; onDone: () => void }) {
  const [name, setName] = useState(habit.name)
  const [goal, setGoal] = useState(habit.goal)
  const [minimum, setMinimum] = useState(habit.minimum ?? '')
  const [remind, setRemind] = useState(habit.remind ?? '')
  const [after, setAfter] = useState(habit.after.filter((id) => active.some((a) => a.id === id)))
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const error = nameError(name, active, habit.id)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy || error) return
    setBusy(true)
    await updateHabit(habit.id, { name, goal, minimum, after, remind })
    onDone()
  }

  async function remove() {
    setBusy(true)
    await removeHabit(habit.id)
    onDone()
  }

  return (
    <li className="manage-row is-editing">
      <form className="habit-form" onSubmit={save} noValidate>
        <HabitFields
          idPrefix={`edit-${habit.id}`}
          others={active.filter((a) => a.id !== habit.id)}
          after={after}
          setAfter={setAfter}
          name={name}
          goal={goal}
          minimum={minimum}
          remind={remind}
          error={error}
          setName={setName}
          setGoal={setGoal}
          setMinimum={setMinimum}
          setRemind={setRemind}
        />
        {confirm ? (
          <div className="confirm" role="alert">
            <p>
              Ta bort <b>{habit.name}</b>? Den försvinner från listan, men det du bockat sparas.
            </p>
            <div className="form-actions">
              <button type="button" className="danger" disabled={busy} onClick={remove}>
                Ja, ta bort
              </button>
              <button type="button" className="text-btn" onClick={() => setConfirm(false)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy || !!error}>
              Spara
            </button>
            <button type="button" className="text-btn" onClick={onDone}>
              Avbryt
            </button>
            <button type="button" className="text-btn danger-text" onClick={() => setConfirm(true)}>
              Ta bort
            </button>
          </div>
        )}
      </form>
    </li>
  )
}
