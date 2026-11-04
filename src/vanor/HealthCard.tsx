import { addDays, type DateKey } from './dates'
import type { Habit } from './habits'
import {
  estimateSleepScore,
  formatHealth,
  METRIC_KEYS,
  METRICS,
  SLEEP_METRICS,
  sleepRating,
  type HealthDay,
  type HealthMetric,
} from '../../supabase/functions/inbox/health'

/** Klockslag "21:30" för när siffrorna kom. */
const clock = (ms: number) => new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

/**
 * Dagens siffror från Apple Hälsa, med de senaste 7 dagarna som små staplar.
 * Visas bara när genvägen har skickat något de senaste två dagarna. Har en vana en regel för måttet
 * visas hur långt det är kvar till gränsen.
 */
export default function HealthCard({
  health,
  habits,
  today,
  goalOf,
}: {
  health: HealthDay[]
  habits: Habit[]
  today: DateKey
  /** Dagens gräns för en vana med regel (kan följa vanans ökning). */
  goalOf: (h: Habit) => number
}) {
  const byDate = new Map(health.map((d) => [d.date, d]))
  const latest = byDate.get(today) ?? byDate.get(addDays(today, -1))
  if (!latest || !Object.keys(latest.values).length) return null

  const isToday = latest.date === today
  const week = Array.from({ length: 7 }, (_, i) => addDays(latest.date, i - 6))
  const goals = new Map<HealthMetric, { min: number; name: string }>()
  for (const h of habits) if (h.auto && !h.archived) goals.set(h.auto.metric, { min: goalOf(h), name: h.name })
  const shown = METRIC_KEYS.filter((m) => latest.values[m] !== undefined && !SLEEP_METRICS.includes(m))
  const pastBedtimes = health
    .filter((d) => d.date < latest.date && d.date >= addDays(latest.date, -13) && d.values.bedtime !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => d.values.bedtime!)

  return (
    <section className="health-card" aria-labelledby="health-title">
      <div className="health-head">
        <h3 id="health-title">Hälsa {isToday ? 'idag' : 'i går'}</h3>
        <span className="health-time">Från Apple Hälsa · {clock(latest.updated)}</span>
      </div>
      <SleepTile values={latest.values} pastBedtimes={pastBedtimes} goal={goals.get('sleepH')} />
      <ul className="health-tiles">
        {latest.values.respRate !== undefined && (
          <li className="health-tile">
            <span className="ht-label">Andning i sömnen</span>
            <b className="ht-value">{latest.values.respRate.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} /min</b>
            <span className="ht-goal muted">Medel under natten</span>
          </li>
        )}
        {shown.map((metric) => {
          const value = latest.values[metric]!
          const goal = goals.get(metric)
          const series = week.map((date) => byDate.get(date)?.values[metric])
          const max = Math.max(goal?.min ?? 0, ...series.map((v) => v ?? 0)) || 1
          const reached = goal ? value >= goal.min : false
          return (
            <li key={metric} className={reached ? 'health-tile reached' : 'health-tile'}>
              <span className="ht-label">{METRICS[metric].label}</span>
              <b className="ht-value">{formatHealth(metric, value)}</b>
              {goal ? (
                <span className="ht-goal">
                  {reached ? `✓ ${goal.name}` : `${formatHealth(metric, Math.max(0, goal.min - value))} kvar till ${goal.name}`}
                </span>
              ) : (
                <span className="ht-goal muted">7 dagar</span>
              )}
              <span className="ht-bars" aria-hidden="true">
                {series.map((v, i) => (
                  <i
                    key={week[i]}
                    className={[v === undefined && 'empty', goal && v !== undefined && v >= goal.min && 'met', i === 6 && 'last']
                      .filter(Boolean)
                      .join(' ') || undefined}
                    style={{ height: `${v === undefined ? 8 : Math.max(8, (v / max) * 100)}%` }}
                  />
                ))}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const STAGES: { metric: HealthMetric; label: string; cls: string }[] = [
  { metric: 'sleepAwakeMin', label: 'Vaken', cls: 'awake' },
  { metric: 'sleepRemH', label: 'REM', cls: 'rem' },
  { metric: 'sleepCoreH', label: 'Kärna', cls: 'core' },
  { metric: 'sleepDeepH', label: 'Djup', cls: 'deep' },
]

/** Natten som i Hälsa: total sömn, sömnpoäng, tider, faser som en stapel och tid i säng. */
function SleepTile({
  values,
  pastBedtimes,
  goal,
}: {
  values: HealthDay['values']
  pastBedtimes: number[]
  goal?: { min: number; name: string }
}) {
  const hours = values.sleepH
  if (hours === undefined) return null
  const estimate = estimateSleepScore(values, pastBedtimes)
  const score = values.sleepScore ?? estimate?.score
  const stageMin = (m: HealthMetric) => {
    const v = values[m]
    return v === undefined ? 0 : m === 'sleepAwakeMin' ? v : v * 60
  }
  const stages = STAGES.filter((s) => values[s.metric] !== undefined)
  const total = stages.reduce((a, s) => a + stageMin(s.metric), 0)
  const reached = goal ? hours >= goal.min : false

  return (
    <div className={reached ? 'sleep-tile reached' : 'sleep-tile'}>
      <div className="sleep-top">
        <div>
          <span className="ht-label">Sömn</span>
          <b className="sleep-total">{formatHealth('sleepH', hours)}</b>
          {values.bedtime !== undefined && values.wakeTime !== undefined && (
            <span className="sleep-times">
              {formatHealth('bedtime', values.bedtime)} – {formatHealth('wakeTime', values.wakeTime)}
              {values.inBedH !== undefined && ` · ${formatHealth('inBedH', values.inBedH)} i säng`}
            </span>
          )}
          {goal && (
            <span className="ht-goal">
              {reached ? `✓ ${goal.name}` : `${formatHealth('sleepH', Math.max(0, goal.min - hours))} kvar till ${goal.name}`}
            </span>
          )}
        </div>
        {score !== undefined && (
          <div
            className="sleep-score"
            style={{ ['--p' as string]: `${score}` }}
            title={
              values.sleepScore !== undefined
                ? 'Sömnpoäng från klockan'
                : estimate
                  ? `Uppskattad: längd ${estimate.duration}/50, läggtid ${estimate.bedtime ?? '–'}/30, avbrott ${estimate.interruptions}/20`
                  : undefined
            }
          >
            <b>{score}</b>
            <span>{sleepRating(score)}</span>
            <small>{values.sleepScore !== undefined ? 'Klockan' : 'Uppskattad'}</small>
          </div>
        )}
      </div>
      {total > 0 && (
        <>
          <div className="sleep-bar" role="img" aria-label="Sömnfaser">
            {stages.map((s) =>
              stageMin(s.metric) > 0 ? <i key={s.metric} className={s.cls} style={{ flexGrow: stageMin(s.metric) }} /> : null,
            )}
          </div>
          <ul className="sleep-stages">
            {stages.map((s) => (
              <li key={s.metric}>
                <i className={s.cls} aria-hidden="true" />
                <span>{s.label}</span>
                <b>{formatHealth(s.metric, values[s.metric]!)}</b>
              </li>
            ))}
          </ul>
          {values.sleepWakes !== undefined && (
            <span className="ht-goal muted">
              {values.sleepWakes === 0 ? 'Inga uppvaknanden' : `${values.sleepWakes} uppvaknande${values.sleepWakes === 1 ? '' : 'n'}`}
            </span>
          )}
        </>
      )}
    </div>
  )
}
