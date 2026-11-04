import { addDays, type DateKey } from './dates'
import type { Habit } from './habits'
import { formatHealth, METRIC_KEYS, METRICS, type HealthDay, type HealthMetric } from '../../supabase/functions/inbox/health'

/** Klockslag "21:30" för när siffrorna kom. */
const clock = (ms: number) => new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

/**
 * Dagens siffror från Apple Hälsa, med de senaste 7 dagarna som små staplar.
 * Visas bara när genvägen har skickat något de senaste två dagarna. Har en vana en regel för måttet
 * visas hur långt det är kvar till gränsen.
 */
export default function HealthCard({ health, habits, today }: { health: HealthDay[]; habits: Habit[]; today: DateKey }) {
  const byDate = new Map(health.map((d) => [d.date, d]))
  const latest = byDate.get(today) ?? byDate.get(addDays(today, -1))
  if (!latest || !Object.keys(latest.values).length) return null

  const isToday = latest.date === today
  const week = Array.from({ length: 7 }, (_, i) => addDays(latest.date, i - 6))
  const goals = new Map<HealthMetric, { min: number; name: string }>()
  for (const h of habits) if (h.auto && !h.archived) goals.set(h.auto.metric, { min: h.auto.min, name: h.name })
  const shown = METRIC_KEYS.filter((m) => latest.values[m] !== undefined)

  return (
    <section className="health-card" aria-labelledby="health-title">
      <div className="health-head">
        <h3 id="health-title">Hälsa {isToday ? 'idag' : 'i går'}</h3>
        <span className="health-time">Från Apple Hälsa · {clock(latest.updated)}</span>
      </div>
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
