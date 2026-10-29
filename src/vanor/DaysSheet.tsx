import { useEffect, useRef } from 'react'
import { addDays, longDate, type DateKey } from './dates'
import type { Habit } from './habits'
import { setCheck } from './store'

/** Hur långt bakåt man kan bocka i efterhand. */
export const BACKFILL_DAYS = 14

type State = 'none' | 'done' | 'min'

interface Props {
  habit: Habit
  today: DateKey
  /** Dagens läge per datum för vanan. */
  stateOf: (date: DateKey) => State
  paused: ReadonlySet<DateKey>
  onClose: () => void
}

/** Ark för att bocka av eller ångra dagar i efterhand, för en vana. */
export default function DaysSheet({ habit, today, stateOf, paused, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Från idag och bakåt, men inte före dagen vanan lades till.
  const days: DateKey[] = []
  for (let i = 0; i < BACKFILL_DAYS; i++) {
    const date = addDays(today, -i)
    if (date < habit.created) break
    days.push(date)
  }

  // "Tisdag 27 okt" så att raden får plats på en rad i mobilen.
  const dayName = (date: DateKey, i: number) =>
    i === 0 ? 'Idag' : i === 1 ? 'Igår' : longDate(date).replace(/(\d+) ([a-z]{3})[a-z]*$/, '$1 $2')

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="days-title">
        <div className="sheet-head">
          <h2 id="days-title">{habit.name}</h2>
          <button ref={closeRef} type="button" className="primary" onClick={onClose}>
            Klar
          </button>
        </div>
        <p className="hint">Glömt att bocka? Tryck på dagen. Tryck igen för att ångra.</p>
        <ul className="manage-list days-list">
          {days.map((date, i) => {
            const state = stateOf(date)
            const set = (next: State) => setCheck(habit.id, date, state === next ? 'none' : next)
            return (
              <li key={date} className="manage-row day-row">
                <span className="manage-info">
                  <b>{dayName(date, i)}</b>
                  {i > 1 ? null : <span>{longDate(date)}</span>}
                  {paused.has(date) && <span>Pausad dag</span>}
                </span>
                <span className="day-choice" role="group" aria-label={`${habit.name}, ${dayName(date, i)}`}>
                  {habit.minimum && (
                    <button
                      type="button"
                      className={state === 'min' ? 'choice on min' : 'choice'}
                      aria-pressed={state === 'min'}
                      onClick={() => set('min')}
                    >
                      Minimum
                    </button>
                  )}
                  <button
                    type="button"
                    className={state === 'done' ? 'choice on' : 'choice'}
                    aria-pressed={state === 'done'}
                    onClick={() => set('done')}
                  >
                    Klar
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        {days.length < BACKFILL_DAYS && (
          <p className="hint">Vanan lades till {longDate(habit.created).toLowerCase()}, så dagarna före det finns inte här.</p>
        )}
      </div>
    </div>
  )
}
