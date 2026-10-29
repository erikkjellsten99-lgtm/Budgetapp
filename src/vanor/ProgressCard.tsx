import { useState } from 'react'
import { isoWeek, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { change, habitTrends, weekElapsed, weeklyScores } from './progress'

interface Props {
  habits: Habit[]
  log: Log
  paused: Paused
  today: DateKey
}

/** "+12" / "−5" / "±0" procentenheter. */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0')

function Change({ value, unit = '%-enheter' }: { value: number | null; unit?: string }) {
  if (value === null) return null
  const kind = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return (
    <span className={`trend ${kind}`}>
      <span aria-hidden="true">{kind === 'up' ? '▲' : kind === 'down' ? '▼' : '•'}</span> {signed(value)}
      {unit && <span className="trend-unit"> {unit}</span>}
    </span>
  )
}

/** Utveckling i procent: veckomålen vecka för vecka och per vana. */
export default function ProgressCard({ habits, log, paused, today }: Props) {
  const [open, setOpen] = useState(false)
  const weeks = weeklyScores(habits, log, paused, today)
  const current = weeks[weeks.length - 1]
  const full = weeks.filter((w) => !w.current && w.pct !== null)
  const last = full[full.length - 1]
  const before = full[full.length - 2]
  const trends = habitTrends(habits, log, paused, today)
  const elapsed = Math.round(weekElapsed(today) * 100)
  const onPace = current.pct !== null && current.pct >= elapsed - 5

  return (
    <section className="section progress-card" aria-labelledby="progress-title">
      <h2 className="section-title" id="progress-title">
        Utveckling
      </h2>
      <div className="pc-card">
        <div className="pc-head">
          {last ? (
            <div>
              <span className="pc-label">Förra veckan, v. {isoWeek(last.monday)}</span>
              <b className="pc-big">{last.pct} %</b>
              <span className="pc-sub">av veckomålen</span>
              {before && (
                <span className="pc-sub">
                  <Change value={change(last.pct, before.pct)} /> mot v. {isoWeek(before.monday)}
                </span>
              )}
            </div>
          ) : (
            <div>
              <span className="pc-label">Den här veckan hittills</span>
              <b className="pc-big">{current.pct ?? 0} %</b>
              <span className="pc-sub">av veckomålen. Jämförelsen kommer efter första hela veckan.</span>
            </div>
          )}
          {last && current.pct !== null && (
            <div className={onPace ? 'pc-now ok' : 'pc-now'}>
              <span>Den här veckan</span>
              <b>{current.pct} %</b>
              <span>{onPace ? 'i fas' : `${elapsed} % av veckan har gått`}</span>
            </div>
          )}
        </div>

        <ol className="pc-bars" aria-label="Procent av veckomålen per vecka">
          {weeks.map((w) => (
            <li
              key={w.monday}
              className={w.current ? 'current' : undefined}
              aria-label={`Vecka ${isoWeek(w.monday)}: ${w.pct === null ? 'pausad' : `${w.pct} %`}${w.current ? ' hittills' : ''}`}
            >
              <span className="pc-val" aria-hidden="true">
                {w.pct === null ? '–' : w.pct}
              </span>
              <span className="pc-track" aria-hidden="true">
                {!!w.pct && <span className="pc-fill" style={{ height: `${w.pct}%` }} />}
              </span>
              <span className="pc-week" aria-hidden="true">
                {w.current ? 'nu' : `v${isoWeek(w.monday)}`}
              </span>
            </li>
          ))}
        </ol>

        <button type="button" className="text-btn pc-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Dölj per vana' : 'Visa per vana'}
        </button>

        {open && (
          <ul className="pc-habits">
            {trends.map((t) => (
              <li key={t.habit.id}>
                <span className="pc-name">
                  <b>{t.habit.name}</b>
                  <small>
                    {t.weeks === 0
                      ? 'Ingen hel vecka än'
                      : `Senaste ${t.weeks === 1 ? 'veckan' : `${t.weeks} veckorna`}${
                          t.prevPct !== null ? `, mot ${t.weeks === 1 ? 'veckan' : `${t.weeks} veckorna`} innan` : ''
                        }`}
                  </small>
                </span>
                <span className="pc-right">
                  <b>{t.pct === null ? '–' : `${t.pct} %`}</b>
                  <Change value={change(t.pct, t.prevPct)} unit="" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
