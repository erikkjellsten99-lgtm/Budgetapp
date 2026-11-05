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

/** Apples nivåer för sömnpoäng: början, längd och namn. */
const ZONES = [
  { from: 0, to: 41, label: 'Mycket låg' },
  { from: 41, to: 61, label: 'Låg' },
  { from: 61, to: 81, label: 'OK' },
  { from: 81, to: 96, label: 'Hög' },
  { from: 96, to: 100, label: 'Mycket hög' },
]

/** 6,88 h → { h: 6, m: 53 } */
function splitHours(hours: number) {
  const total = Math.round(hours * 60)
  return { h: Math.floor(total / 60), m: total % 60 }
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

/** Natten som ett mätinstrument: total tid, poängskala, fasstapel med tidsaxel och en tabell med nyckeltal. */
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
  const fromWatch = values.sleepScore !== undefined
  const minutes = (m: HealthMetric) => {
    const v = values[m]
    return v === undefined ? 0 : m === 'sleepAwakeMin' ? v : v * 60
  }
  const stages = STAGES.filter((st) => values[st.metric] !== undefined)
  const total = stages.reduce((a, st) => a + minutes(st.metric), 0)
  const asleepMin = minutes('sleepRemH') + minutes('sleepCoreH') + minutes('sleepDeepH')
  const reached = goal ? hours >= goal.min : false
  const { h, m } = splitHours(hours)

  const hasTimes = values.bedtime !== undefined && values.wakeTime !== undefined
  const span = hasTimes ? (((values.wakeTime! - values.bedtime!) % 24) + 24) % 24 : 0
  const efficiency = span > 0 ? Math.min(100, Math.round((hours / span) * 100)) : undefined
  const mid = hasTimes ? values.bedtime! + span / 2 : undefined

  return (
    <div className={reached ? 'sleep-tile reached' : 'sleep-tile'}>
      <div className="sleep-head">
        <span className="sleep-kicker">Sömn</span>
        {hasTimes && (
          <span className="sleep-range">
            {formatHealth('bedtime', values.bedtime!)} → {formatHealth('wakeTime', values.wakeTime!)}
          </span>
        )}
      </div>

      <div className="sleep-main">
        <div className="sleep-big">
          <b>{h}</b>
          <u>h</u>
          <b>{String(m).padStart(2, '0')}</b>
          <u>min</u>
          {goal && (
            <span className="sleep-goal">
              {reached ? `✓ ${goal.name}` : `${formatHealth('sleepH', Math.max(0, goal.min - hours))} kvar till ${goal.name}`}
            </span>
          )}
        </div>
        {score !== undefined && (
          <div
            className="sleep-score"
            title={
              fromWatch
                ? 'Sömnpoäng från klockan'
                : estimate
                  ? `Uppskattad: längd ${estimate.duration}/50, läggtid ${estimate.bedtime ?? '–'}/30, avbrott ${estimate.interruptions}/20`
                  : undefined
            }
          >
            <span className="sleep-score-num">
              <b>{score}</b>
              <small>/100</small>
            </span>
            <span className="sleep-score-rating">{sleepRating(score)}</span>
            <span className={fromWatch ? 'sleep-chip watch' : 'sleep-chip'}>{fromWatch ? 'Klockan' : 'Uppskattad'}</span>
          </div>
        )}
      </div>

      {score !== undefined && (
        <div className="sleep-gauge" role="img" aria-label={`Sömnpoäng ${score} av 100, ${sleepRating(score)}`}>
          <div className="sleep-zones">
            {ZONES.map((z) => {
              const fill = Math.min(1, Math.max(0, (score - z.from) / (z.to - z.from)))
              return <i key={z.label} style={{ flexGrow: z.to - z.from, ['--f' as string]: fill }} />
            })}
          </div>
          <span className="sleep-marker" style={{ left: `${Math.min(100, score)}%` }} />
          <div className="sleep-scale" aria-hidden="true">
            {[0, 40, 60, 80, 95].map((t) => (
              <span key={t} style={{ left: `${t}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="sleep-stagebox">
          <div className="sleep-bar" role="img" aria-label="Sömnfaser">
            {stages.map((st) =>
              minutes(st.metric) > 0 ? <i key={st.metric} className={st.cls} style={{ flexGrow: minutes(st.metric) }} /> : null,
            )}
          </div>
          {hasTimes && mid !== undefined && (
            <div className="sleep-axis" aria-hidden="true">
              <span>{formatHealth('bedtime', values.bedtime!)}</span>
              <span>{formatHealth('bedtime', mid)}</span>
              <span>{formatHealth('wakeTime', values.wakeTime!)}</span>
            </div>
          )}
        </div>
      )}

      {stages.length > 0 && (
        <dl className="sleep-stages">
          {stages.map((st) => {
            const isAwake = st.metric === 'sleepAwakeMin'
            const v = formatHealth(st.metric, values[st.metric]!)
            return (
              <div key={st.metric} className={st.cls}>
                <dt>
                  <i aria-hidden="true" />
                  {st.label}
                </dt>
                <dd>{v}</dd>
                <dd className="sub">{isAwake ? (values.sleepWakes ? `${values.sleepWakes}×` : '–') : `${pct(minutes(st.metric), asleepMin)} %`}</dd>
              </div>
            )
          })}
        </dl>
      )}

      {(efficiency !== undefined || values.sleepWakes !== undefined || values.inBedH !== undefined || values.respRate !== undefined) && (
        <dl className="sleep-facts">
          {efficiency !== undefined && (
            <div>
              <dt>Effektivitet</dt>
              <dd>{efficiency} %</dd>
            </div>
          )}
          {values.sleepWakes !== undefined && (
            <div>
              <dt>Uppvaknanden</dt>
              <dd>{values.sleepWakes}</dd>
            </div>
          )}
          {values.inBedH !== undefined && (
            <div>
              <dt>I säng</dt>
              <dd>{formatHealth('inBedH', values.inBedH)}</dd>
            </div>
          )}
          {values.respRate !== undefined && (
            <div>
              <dt>Andning</dt>
              <dd>{values.respRate.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} /min</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
