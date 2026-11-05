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
  type SleepStage,
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
  const groups = GROUPS.map((g) => ({ title: g.title, metrics: shown.filter((m) => g.metrics.includes(m)) })).filter((g) => g.metrics.length)
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
      <SleepTile values={latest.values} stages={latest.stages} pastBedtimes={pastBedtimes} goal={goals.get('sleepH')} />
      {groups.map((g) => (
        <section key={g.title} className="hm-group" aria-label={g.title}>
          <header className="hm-head">
            <span className="hm-kicker">{g.title}</span>
            <span className="hm-days" aria-hidden="true">
              7 dagar
            </span>
          </header>
          <div className="hm-grid">
            {g.metrics.map((metric) => (
              <Instrument
                key={metric}
                metric={metric}
                value={latest.values[metric]!}
                goal={goals.get(metric)}
                week={week}
                series={week.map((date) => byDate.get(date)?.values[metric])}
                trend={vsAverage(metric, latest.values[metric]!, health, latest.date)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}

/** Måtten i grupper, i den ordning de visas. */
const GROUPS: { title: string; metrics: HealthMetric[] }[] = [
  { title: 'Aktivitet', metrics: ['steps', 'distanceKm', 'activeKcal', 'exerciseMin', 'workouts', 'standHours', 'flights'] },
  { title: 'Hjärta och kondition', metrics: ['vo2Max', 'restingHr', 'hrvMs', 'hrRecovery', 'walkingHr', 'spo2'] },
  { title: 'Kropp och återhämtning', metrics: ['weightKg', 'bodyFat', 'wristTemp', 'waterL', 'mindfulMin'] },
]

const DAY_LETTERS = ['S', 'M', 'T', 'O', 'T', 'F', 'L']
const dayLetter = (date: DateKey) => DAY_LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()]

/** "37,6 ml/kg/min" → ["37,6", "ml/kg/min"], så att siffran kan vara stor och enheten liten. */
function splitValue(metric: HealthMetric, value: number): [string, string] {
  const text = formatHealth(metric, value)
  const at = text.lastIndexOf('\u00a0')
  if (at < 0) return [text, '']
  const unit = text.slice(at + 1)
  // "679 steg" under rubriken Steg: enheten säger inget nytt
  return [text.slice(0, at), unit === METRICS[metric].label.toLowerCase() ? '' : unit]
}

interface Trend {
  dir: 'up' | 'down' | 'flat'
  text: string
}

/**
 * Jämförelse mot ditt eget snitt de 14 dagarna före, t.ex. "+0,3 °C". Hälsa visar själv
 * handledstemperatur som avvikelse, och för puls, HRV och VO₂ max är trenden mer intressant än siffran.
 * Null när det finns färre än 3 tidigare dagar, och för summor som steg (de växer under dagen).
 */
function vsAverage(metric: HealthMetric, value: number, health: HealthDay[], date: DateKey): Trend | null {
  if (METRICS[metric].kind === 'sum') return null
  const from = addDays(date, -14)
  const past = health
    .filter((d) => d.date < date && d.date >= from && d.values[metric] !== undefined)
    .map((d) => d.values[metric]!)
  if (past.length < 3) return null
  const diff = value - past.reduce((a, b) => a + b, 0) / past.length
  const step = 10 ** -METRICS[metric].decimals
  if (Math.abs(diff) < step / 2) return { dir: 'flat', text: 'som ditt snitt' }
  return { dir: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : '\u2212'}${splitValue(metric, Math.abs(diff))[0]} mot snitt` }
}

/** Ett mått: etikett, stor siffra, mål eller trend och de senaste 7 dagarna som staplar med veckodag. */
function Instrument({
  metric,
  value,
  goal,
  week,
  series,
  trend,
}: {
  metric: HealthMetric
  value: number
  goal?: { min: number; name: string }
  week: DateKey[]
  series: (number | undefined)[]
  trend: Trend | null
}) {
  const [num, unit] = splitValue(metric, value)
  const reached = goal ? value >= goal.min : false
  const known = series.filter((v): v is number => v !== undefined)
  const hi = Math.max(goal?.min ?? 0, ...known) || 1
  const lo = Math.min(...known)
  // Summor (steg, pass) från noll. Puls, VO₂ max m.m. ändras lite från dag till dag, så de visas mellan
  // veckans lägsta och högsta värde – annars blir alla staplar lika höga.
  const barHeight = (v: number) =>
    METRICS[metric].kind === 'sum' ? Math.max(10, (v / hi) * 100) : hi === lo ? 60 : 25 + ((v - lo) / (hi - lo)) * 75
  const progress = goal ? Math.min(100, Math.round((value / goal.min) * 100)) : 0
  return (
    <div className={reached ? 'hm-item reached' : 'hm-item'}>
      <span className="hm-label">{METRICS[metric].label}</span>
      <span className="hm-value">
        <b>{num}</b>
        {unit && <u>{unit}</u>}
      </span>
      {goal ? (
        <span className="hm-goal">
          <span className="hm-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.name}: ${progress} %`}>
            <i style={{ width: `${progress}%` }} />
          </span>
          <span className="hm-goal-text">
            {reached ? `\u2713 ${goal.name}` : `${splitValue(metric, Math.max(0, goal.min - value))[0]} kvar till ${goal.name}`}
          </span>
        </span>
      ) : (
        trend && (
          <span className={`hm-trend ${trend.dir}`}>
            <i aria-hidden="true">{trend.dir === 'up' ? '\u25b2' : trend.dir === 'down' ? '\u25bc' : '\u25cf'}</i>
            {trend.text}
          </span>
        )
      )}
      <span className="hm-week" aria-hidden="true">
        {series.map((v, i) => (
          <span key={week[i]} className="hm-day">
            <i
              className={[v === undefined && 'empty', goal && v !== undefined && v >= goal.min && 'met', i === 6 && 'today']
                .filter(Boolean)
                .join(' ') || undefined}
              style={{ height: `${v === undefined ? 0 : barHeight(v)}%` }}
            />
            <small>{dayLetter(week[i])}</small>
          </span>
        ))}
      </span>
    </div>
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
  stages: night,
  pastBedtimes,
  goal,
}: {
  values: HealthDay['values']
  stages?: SleepStage[]
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

      {night && night.length > 1 ? (
        <Hypnogram stages={night} />
      ) : (
        total > 0 && (
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
        )
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

const HYPNO_ROWS: { k: SleepStage['k'][]; label: string; cls: string }[] = [
  { k: ['awake'], label: 'Vaken', cls: 'awake' },
  { k: ['rem'], label: 'REM', cls: 'rem' },
  { k: ['core', 'asleep'], label: 'Kärna', cls: 'core' },
  { k: ['deep'], label: 'Djup', cls: 'deep' },
]

const HOUR = 3_600_000
const clockOf = (ms: number) => new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

/** Sömndiagram: fas på höjden, tid på bredden, som trappsteg över natten. */
function Hypnogram({ stages }: { stages: SleepStage[] }) {
  const t0 = stages[0].s
  const t1 = stages[stages.length - 1].e
  const span = Math.max(1, t1 - t0)
  const W = 1000
  const ROW = 24
  const x = (ms: number) => ((ms - t0) / span) * W
  const rowOf = (k: SleepStage['k']) => Math.max(0, HYPNO_ROWS.findIndex((r) => r.k.includes(k)))
  const ticks: number[] = []
  for (let t = Math.ceil(t0 / HOUR) * HOUR; t < t1; t += HOUR) ticks.push(t)
  // Bara var annan timme om natten är lång, så att etiketterna inte krockar
  const step = ticks.length > 9 ? 2 : 1
  const shown = ticks.filter((_, i) => i % step === 0)

  return (
    <div className="sleep-hypno">
      <div className="hy-labels" aria-hidden="true">
        {HYPNO_ROWS.map((r) => (
          <span key={r.label} className={r.cls}>
            {r.label}
          </span>
        ))}
      </div>
      <div className="hy-plot">
        <svg viewBox={`0 0 ${W} ${ROW * HYPNO_ROWS.length}`} preserveAspectRatio="none" role="img" aria-label="Sömndiagram över natten">
          {HYPNO_ROWS.map((r, i) => (
            <line key={r.label} className="hy-grid" x1="0" x2={W} y1={i * ROW + ROW / 2} y2={i * ROW + ROW / 2} vectorEffect="non-scaling-stroke" />
          ))}
          {shown.map((t) => (
            <line key={t} className="hy-tick" x1={x(t)} x2={x(t)} y1="0" y2={ROW * HYPNO_ROWS.length} vectorEffect="non-scaling-stroke" />
          ))}
          {stages.slice(1).map((st, i) => {
            const prev = stages[i]
            const a = rowOf(prev.k)
            const b = rowOf(st.k)
            return a === b ? null : (
              <line
                key={`c${st.s}`}
                className="hy-link"
                x1={x(st.s)}
                x2={x(st.s)}
                y1={a * ROW + ROW / 2}
                y2={b * ROW + ROW / 2}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {stages.map((st) => {
            const row = rowOf(st.k)
            const w = Math.max(2, x(st.e) - x(st.s))
            return (
              <rect key={`${st.s}-${st.k}`} className={HYPNO_ROWS[row].cls} x={x(st.s)} y={row * ROW + 5} width={w} height={ROW - 10} rx="3">
                <title>{`${HYPNO_ROWS[row].label} ${clockOf(st.s)}–${clockOf(st.e)} (${Math.round((st.e - st.s) / 60000)} min)`}</title>
              </rect>
            )
          })}
        </svg>
        <div className="hy-axis" aria-hidden="true">
          {shown.map((t) => (
            <span key={t} style={{ left: `${((t - t0) / span) * 100}%` }}>
              {new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
