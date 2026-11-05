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
  const groups = GROUPS.map((g) => ({ title: g.title, hue: g.hue, metrics: shown.filter((m) => g.metrics.includes(m)) })).filter((g) => g.metrics.length)
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
        <section key={g.title} className={`hm-group ${g.hue}`} aria-label={g.title}>
          <h4 className="hm-head">
            <GroupIcon hue={g.hue} />
            {g.title}
          </h4>
          <ul className="hm-list">
            {g.metrics.map((metric) => (
              <MetricRow
                key={metric}
                metric={metric}
                value={latest.values[metric]!}
                goal={goals.get(metric)}
                series={week.map((date) => byDate.get(date)?.values[metric])}
                trend={vsAverage(metric, latest.values[metric]!, health, latest.date)}
              />
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

/** Måtten i grupper, i den ordning de visas. Varje grupp har en egen färg (hue) och ikon. */
const GROUPS: { title: string; hue: Hue; metrics: HealthMetric[] }[] = [
  { title: 'Aktivitet', hue: 'move', metrics: ['steps', 'distanceKm', 'activeKcal', 'exerciseMin', 'workouts', 'standHours', 'flights'] },
  { title: 'Hjärta och kondition', hue: 'heart', metrics: ['vo2Max', 'restingHr', 'hrvMs', 'hrRecovery', 'walkingHr', 'spo2'] },
  { title: 'Kropp och återhämtning', hue: 'body', metrics: ['weightKg', 'bodyFat', 'wristTemp', 'waterL', 'mindfulMin'] },
]

type Hue = 'move' | 'heart' | 'body' | 'sleep'

/** Enkel ikon per grupp: en blixt för rörelse, ett hjärta, ett löv och en måne för sömnen. */
function GroupIcon({ hue }: { hue: Hue }) {
  const path = {
    move: 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z',
    heart: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z',
    body: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7',
    sleep: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  }[hue]
  return (
    <span className="hm-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d={path} />
      </svg>
    </span>
  )
}

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
  if (Math.abs(diff) < step / 2) return { dir: 'flat', text: 'Som vanligt' }
  return { dir: diff > 0 ? 'up' : 'down', text: `${splitValue(metric, Math.abs(diff))[0]} ${diff > 0 ? 'högre' : 'lägre'} än vanligt` }
}

/**
 * Ett mått som en rad: namn och en kort mening till vänster, siffran till höger. Mått med mål får en ring
 * (som i Aktivitet), andra en mjuk kurva över de senaste 7 dagarna.
 */
function MetricRow({
  metric,
  value,
  goal,
  series,
  trend,
}: {
  metric: HealthMetric
  value: number
  goal?: { min: number; name: string }
  series: (number | undefined)[]
  trend: Trend | null
}) {
  const [num, unit] = splitValue(metric, value)
  const reached = goal ? value >= goal.min : false
  const note = goal
    ? reached
      ? `${goal.name} klart`
      : `${splitValue(metric, Math.max(0, goal.min - value))[0]} kvar till ${goal.name}`
    : trend?.text
  return (
    <li className={reached ? 'hm-row reached' : 'hm-row'}>
      <span className="hm-text">
        <span className="hm-name">{METRICS[metric].label}</span>
        {note && <span className="hm-note">{note}</span>}
      </span>
      {goal ? <Ring part={value / goal.min} /> : <Spark series={series} />}
      <span className="hm-value">
        <b>{num}</b>
        {unit && <small>{unit}</small>}
      </span>
    </li>
  )
}

/** Hur långt mot målet, som en ring. Full ring när målet är nått. */
function Ring({ part }: { part: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, part))
  return (
    <svg className="hm-ring" viewBox="0 0 36 36" width="36" height="36" role="img" aria-label={`${Math.round(p * 100)} % av målet`}>
      <circle className="track" cx="18" cy="18" r={r} />
      <circle className="fill" cx="18" cy="18" r={r} strokeDasharray={`${p * c} ${c}`} transform="rotate(-90 18 18)" />
    </svg>
  )
}

/** De senaste 7 dagarna som en mjuk kurva, idag som en prick. */
function Spark({ series }: { series: (number | undefined)[] }) {
  const W = 72
  const H = 28
  const known = series.filter((v): v is number => v !== undefined)
  if (known.length < 2) return <span className="hm-spark empty" aria-hidden="true" />
  const lo = Math.min(...known)
  const hi = Math.max(...known)
  const x = (i: number) => (i / (series.length - 1)) * (W - 6) + 3
  const y = (v: number) => (hi === lo ? H / 2 : H - 4 - ((v - lo) / (hi - lo)) * (H - 8))
  // Dagar utan värde hoppas över, så att kurvan går obruten mellan dagarna som finns
  const points = series.flatMap((v, i) => (v === undefined ? [] : [[x(i), y(v)] as const]))
  // Mjuk linje genom punkterna (kardinal-spline)
  let d = ''
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const prev = points[i - 1]
    if (!prev) {
      d += `M${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`
      continue
    }
    const before = points[i - 2] ?? prev
    const after = points[i + 1] ?? pt
    const c1 = [prev[0] + (pt[0] - before[0]) / 6, prev[1] + (pt[1] - before[1]) / 6]
    const c2 = [pt[0] - (after[0] - prev[0]) / 6, pt[1] - (after[1] - prev[1]) / 6]
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`
  }
  // Pricken bara när idag har ett värde
  const last = series[series.length - 1] !== undefined ? points[points.length - 1] : null
  return (
    <svg className="hm-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} />
      {last && <circle cx={last[0]} cy={last[1]} r="3" />}
    </svg>
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
        <span className="sleep-kicker">
          <GroupIcon hue="sleep" />
          Sömn
        </span>
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
