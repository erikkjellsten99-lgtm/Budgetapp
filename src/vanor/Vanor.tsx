import { useEffect, useState } from 'react'
import DaysSheet from './DaysSheet'
import ProgressCard from './ProgressCard'
import TaskSheet from './TaskSheet'
import { doneToday, dueTasks, upcomingTasks, whenText, type Task } from './tasks'
import HabitSheet from './HabitSheet'
import { addDays, isoWeek, longDate, todayKey, weekStart, type DateKey } from './dates'
import { daySummary, habitPlan, isDaily, isDone, todayInfo, type Habit, type TodayInfo } from './habits'
import { loadHabitData, minimumKeys, onHabitChange, saveTaskRecord, toggleCheck, togglePause, toLog, type HabitData } from './store'
import { dayQuote } from './quotes'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import '@fontsource/jetbrains-mono/500.css'
import './vanor.css'

/** Dagens datum som byter vid midnatt, även om appen står öppen. */
function useToday(): DateKey {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const check = () => setToday(todayKey())
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000)
    // Telefonen kan sova över midnatt – kolla igen när appen visas.
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [today])
  return today
}

/** Vanorna från databasen, uppdateras vid varje ändring (här eller via synken). */
export function useHabitData(): HabitData | null {
  const [data, setData] = useState<HabitData | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => loadHabitData().then((d) => alive && setData(d))
    load()
    const stop = onHabitChange(load)
    return () => {
      alive = false
      stop()
    }
  }, [])
  return data
}

/** Fliken Vanor: dagens vanor att bocka av. */
export default function Vanor() {
  const today = useToday()
  const data = useHabitData()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [popped, setPopped] = useState<string | null>(null)
  const [daysFor, setDaysFor] = useState<string | null>(null)
  // Att göra-arket: null = stängt, 'new' = ny sak, annars saken som ändras.
  const [taskSheet, setTaskSheet] = useState<Task | 'new' | null>(null)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  if (!data) return null
  const { checks, pauses } = data
  const habits = data.habits.filter((h) => !h.archived)

  const log = toLog(checks)
  const minimums = minimumKeys(checks)
  const paused = new Set(pauses.map((p) => p.date))
  const pausedToday = paused.has(today)
  // Kopplingar till borttagna vanor räknas inte (annars skulle t.ex. Stretching aldrig komma upp).
  const names = new Map(habits.map((h) => [h.id, h.name]))
  const rows = habits.map((h) => {
    const habit = { ...h, after: h.after.filter((id) => names.has(id)) }
    const info = todayInfo(habit, log, today, paused)
    // En efter-vana som väntar på passet: säg det, så att den inte ser klar ut.
    if (habit.after.length && !info.done && !info.due && !pausedToday && info.count < info.goal) {
      const after = habit.after.map((id) => names.get(id)).join(' eller ')
      info.pills.unshift({ kind: 'plain', text: `Kommer upp när du bockat ${after}` })
    }
    return { habit, info, plan: habitPlan(habit, (id) => names.get(id)) }
  })
  const monday = weekStart(today)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const weekOf = (id: string): DayCell[] =>
    weekDates.map((date) => ({
      date,
      state: isDone(log, id, date)
        ? minimums.has(`${date}|${id}`)
          ? 'min'
          : 'done'
        : paused.has(date)
          ? 'paused'
          : date > today
            ? 'future'
            : date === today
              ? 'today'
              : 'missed',
    }))
  // Prioritera: det som måste göras idag först, sedan det som kan vänta (mest bråttom först).
  const open = rows.filter((r) => r.info.due && !r.info.done)
  const must = open.filter((r) => r.info.must)
  const flexible = open.filter((r) => !r.info.must).sort((a, b) => b.info.urgency - a.info.urgency)
  const closed = rows.filter((r) => !(r.info.due && !r.info.done))
  const habitSummary = daySummary(rows.map((r) => r.info))
  // Att göra-saker räknas som måsten idag (och försenade), precis som dagliga vanor.
  const tasksDue = dueTasks(data.tasks, today)
  const tasksDone = doneToday(data.tasks, today)
  const upcoming = upcomingTasks(data.tasks, today)
  const summary = {
    total: habitSummary.total + tasksDue.length + tasksDone.length,
    done: habitSummary.done + tasksDone.length,
    flexible: habitSummary.flexible,
  }

  const headline = !habits.length && !summary.total
    ? 'Vanor'
    : pausedToday && !open.length && !tasksDue.length
      ? 'Vilodag'
      : summary.done < summary.total
        ? `${summary.total - summary.done} kvar idag`
        : summary.flexible
          ? 'Inget måste idag'
          : 'Dagen är klar'

  function check(habit: Habit, min = false) {
    setPopped(habit.id)
    toggleCheck(habit.id, today, min)
  }

  const row = ({ habit, info, plan }: { habit: Habit; info: TodayInfo; plan: string }) => (
    <HabitRow
      key={habit.id}
      habit={habit}
      info={info}
      plan={plan}
      week={weekOf(habit.id)}
      waiting={!!habit.after.length && !info.done && !info.due}
      min={minimums.has(`${today}|${habit.id}`)}
      pop={popped === habit.id}
      onCheck={check}
      onDays={() => setDaysFor(habit.id)}
      onPopEnd={() => setPopped(null)}
    />
  )

  return (
    <div className="vanor">
      <header className="top">
        <div className="head">
          <p className="date-line">
            {longDate(today)}, <span className="nowrap">vecka {isoWeek(today)}</span>
          </p>
          <h2 className="headline">{headline}</h2>
          {summary.total > 0 && <TodayBar done={summary.done} total={summary.total} />}
        </div>
        <button type="button" className="icon-btn" aria-label="Hantera vanor" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2.2" />
            <circle cx="8" cy="17" r="2.2" />
          </svg>
        </button>
      </header>

      {habits.length > 0 && <ProgressCard
          habits={habits}
          log={log}
          paused={paused}
          today={today}
          mustToday={[...tasksDue.map((t) => t.title), ...must.map((r) => r.habit.name)]}
        />}

      {pausedToday && (
        <div className="pause-banner" role="status">
          <p>
            <b>Pausad dag</b>
            Streaks står still och veckomålen sänks.
          </p>
          <button type="button" className="text-btn" onClick={() => togglePause(today)}>
            Ångra
          </button>
        </div>
      )}

      {!habits.length ? (
        <div className="all-done">
          <p>Inga vanor än. Lägg till egna, välj bland förslagen eller flytta över dina vanor från den gamla vanetrackern.</p>
          <button type="button" className="primary" onClick={() => setSettingsOpen(true)}>
            Kom igång
          </button>
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="todo-title">
            <div className="section-head">
              <h2 className="section-title" id="todo-title">
                Prioritera idag <span className="count">{must.length + tasksDue.length}</span>
              </h2>
              <button type="button" className="text-btn add-task" onClick={() => setTaskSheet('new')}>
                + Att göra
              </button>
            </div>
            {must.length || tasksDue.length ? (
              <ul className="habits">
                {tasksDue.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onOpen={() => setTaskSheet(t)} />
                ))}
                {must.map(row)}
              </ul>
            ) : (
              <p className="all-done">
                {pausedToday
                  ? 'Inga krav idag. Krya på dig.'
                  : flexible.length
                    ? 'Inget måste göras idag för att hinna veckans mål. Ta något nedan om du har tid.'
                    : 'Allt för idag är gjort.'}
              </p>
            )}
          </section>

          {flexible.length > 0 && (
            <section className="section" aria-labelledby="flex-title">
              <h2 className="section-title" id="flex-title">
                Kan vänta <span className="count">{flexible.length}</span>
              </h2>
              <p className="section-hint">Det finns fler dagar kvar än gånger. Gör gärna idag, men det är inget måste.</p>
              <ul className="habits">{flexible.map(row)}</ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="section" aria-labelledby="upcoming-title">
              <h2 className="section-title" id="upcoming-title">
                Kommande <span className="count">{upcoming.length}</span>
              </h2>
              <ul className="habits">
                {(showAllUpcoming ? upcoming : upcoming.slice(0, 4)).map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onOpen={() => setTaskSheet(t)} />
                ))}
              </ul>
              {upcoming.length > 4 && (
                <button type="button" className="text-btn" onClick={() => setShowAllUpcoming(!showAllUpcoming)}>
                  {showAllUpcoming ? 'Visa färre' : `Visa alla ${upcoming.length}`}
                </button>
              )}
            </section>
          )}

          {closed.length + tasksDone.length > 0 && (
            <section className="section" aria-labelledby="rest-title">
              <h2 className="section-title" id="rest-title">
                Klart eller inte idag <span className="count">{closed.length + tasksDone.length}</span>
              </h2>
              <ul className="habits">
                {tasksDone.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onOpen={() => setTaskSheet(t)} />
                ))}
                {closed.map(row)}
              </ul>
            </section>
          )}

          <DayQuote today={today} />

          <div className="footer-actions">
            <button type="button" className="text-btn" onClick={() => setSettingsOpen(true)}>
              + Lägg till eller ta bort vanor
            </button>
            {!pausedToday && (
              <button type="button" className="text-btn quiet" onClick={() => togglePause(today)}>
                Sjuk eller skadad? Pausa dagen
              </button>
            )}
            <p className="quiet backfill-tip">Glömt att bocka igår? Tryck på prickarna under vanan.</p>
          </div>
        </>
      )}

      {daysFor && habits.some((h) => h.id === daysFor) && (
        <DaysSheet
          habit={habits.find((h) => h.id === daysFor)!}
          today={today}
          paused={paused}
          stateOf={(date) => (isDone(log, daysFor, date) ? (minimums.has(`${date}|${daysFor}`) ? 'min' : 'done') : 'none')}
          onClose={() => setDaysFor(null)}
        />
      )}
      {taskSheet && <TaskSheet task={taskSheet === 'new' ? undefined : taskSheet} onClose={() => setTaskSheet(null)} />}
      {settingsOpen && <HabitSheet habits={data.habits} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

/** Dagens bockar som segment: ett per sak som ska göras idag. */
function TodayBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="today-bar" role="img" aria-label={`${done} av ${total} klara idag`}>
      <span className="today-segs" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < done ? 'on' : undefined} />
        ))}
      </span>
      <span className="today-count" aria-hidden="true">
        {done} av {total} klart
      </span>
    </div>
  )
}

type DayState = 'done' | 'min' | 'missed' | 'today' | 'future' | 'paused'
interface DayCell {
  date: DateKey
  state: DayState
}

const DAY_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
const DAY_NAMES = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
const STATE_TEXT: Record<DayState, string> = {
  done: 'klar',
  min: 'minimum',
  missed: 'inte gjord',
  today: 'idag, inte gjord än',
  future: 'kommer',
  paused: 'pausad',
}

/** Veckan som sju rutor, måndag–söndag. Tryck för att bocka dagar i efterhand. */
function WeekStrip({ week, name, onClick }: { week: DayCell[]; name: string; onClick: () => void }) {
  return (
    <button type="button" className="week-btn" aria-label={`${name} den här veckan: ${week.map((d, i) => `${DAY_NAMES[i]} ${STATE_TEXT[d.state]}`).join(', ')}. Tryck för att bocka i efterhand.`} onClick={onClick}>
    <span className="week">
      {week.map((d, i) => (
        <span key={d.date} className={`day ${d.state}`} title={`${DAY_NAMES[i]}: ${STATE_TEXT[d.state]}`}>
          <span aria-hidden="true">{DAY_LETTERS[i]}</span>
        </span>
      ))}
    </span>
      <svg className="week-edit" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.5 3.5l2 2L6 12H4v-2z" />
      </svg>
    </button>
  )
}

interface RowProps {
  habit: Habit
  info: TodayInfo
  /** T.ex. "4 gånger i veckan" eller "Efter Gym". */
  plan: string
  week: DayCell[]
  /** Efter-vana som väntar på att passet bockas. */
  waiting: boolean
  /** Bara minimiversionen gjord idag. */
  min: boolean
  pop: boolean
  onCheck: (habit: Habit, min?: boolean) => void
  /** Öppna dagarna för att bocka i efterhand. */
  onDays: () => void
  onPopEnd: () => void
}

function HabitRow({ habit, info, plan, week, waiting, min, pop, onCheck, onDays, onPopEnd }: RowProps) {
  // Starka lägen visas som lappar, resten som lugn text under namnet.
  const strong = info.pills.filter((p) => p.kind === 'warn' || p.kind === 'bad' || (p.kind === 'ok' && !info.done))
  const notes = info.pills.filter((p) => p.kind === 'plain').map((p) => p.text)
  const streak = info.pills.find((p) => p.kind === 'fire')?.text
  if (info.done && min) notes.unshift(habit.minimum ? `Minimum ${habit.minimum}` : 'Minimum')
  const count = isDaily(habit) ? null : info.goal > 0 ? `${info.count} av ${info.goal}` : null
  const label = (info.done ? 'Ångra ' : 'Bocka av ') + habit.name
  const cls = ['habit', info.done && 'is-done', waiting && 'is-waiting'].filter(Boolean).join(' ')
  const showMin = !info.done && !waiting && habit.minimum

  return (
    <li className={cls}>
      <div className="info">
        <span className="name">{habit.name}</span>
        <span className="meta">
          {/* Planen ("4 gånger i veckan") syns redan i räknaren – visa läget i stället när det finns. */}
          {notes.length ? notes.join(', ') : plan}
          {streak && <span className="streak">{streak}</span>}
        </span>
        <span className="progress">
          <WeekStrip week={week} name={habit.name} onClick={onDays} />
          {count && <span className="count">{count}</span>}
          {showMin && (
            <button
              type="button"
              className="min-btn"
              aria-label={`Bocka av bara minimum för ${habit.name}: ${habit.minimum}`}
              onClick={() => onCheck(habit, true)}
            >
              Min {habit.minimum}
            </button>
          )}
        </span>
        {strong.length > 0 && (
          <span className="actions">
            {strong.map((p) => (
              <span key={p.text} className={`pill ${p.kind}`}>
                {p.text}
              </span>
            ))}
          </span>
        )}
      </div>
      <button
        type="button"
        className={['check', info.done && 'on', info.done && min && 'min', pop && 'pop'].filter(Boolean).join(' ')}
        aria-label={label}
        aria-pressed={info.done}
        onClick={() => onCheck(habit)}
        onAnimationEnd={onPopEnd}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      </button>
    </li>
  )
}

/** En att göra-sak i listan: tryck på texten för att ändra, på cirkeln för att bocka av. */
function TaskRow({ task, today, onOpen }: { task: Task; today: DateKey; onOpen: () => void }) {
  const done = !!task.doneOn
  const late = !done && task.date < today
  const toggle = () => {
    const { doneOn: _was, ...rest } = task
    saveTaskRecord(done ? rest : { ...rest, doneOn: today })
  }
  return (
    <li className={['habit', 'task-row', done && 'is-done', late && 'is-late'].filter(Boolean).join(' ')}>
      <button type="button" className="info task-open" onClick={onOpen} aria-label={`Ändra ${task.title}`}>
        <span className="name">{task.title}</span>
        <span className="meta">{done ? 'Klart' : whenText(task, today)}</span>
      </button>
      <button
        type="button"
        className={done ? 'check on' : 'check'}
        aria-label={(done ? 'Ångra ' : 'Bocka av ') + task.title}
        aria-pressed={done}
        onClick={toggle}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      </button>
    </li>
  )
}

/** Dagens citat. Tryck för att bläddra till ett annat; nästa dag börjar det om. */
function DayQuote({ today }: { today: DateKey }) {
  const [shift, setShift] = useState({ day: today, offset: 0 })
  const offset = shift.day === today ? shift.offset : 0
  const quote = dayQuote(today, offset)
  return (
    <button
      type="button"
      className="day-quote"
      aria-label={`Dagens citat: ${quote.text}${quote.by ? `, ${quote.by}` : ''}. Tryck för ett annat.`}
      onClick={() => setShift({ day: today, offset: offset + 1 })}
    >
      <span className="quote-text" key={`${today}-${offset}`}>
        ”{quote.text}”
        {quote.by && <small>{quote.by}</small>}
      </span>
    </button>
  )
}
