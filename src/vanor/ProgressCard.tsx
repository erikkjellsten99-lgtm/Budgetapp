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

/** "+12" / "−5" / "±0". */
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

/**
 * Veckans sol: överst i Vanor. Solen stiger från horisonten (0 %) till högst upp (100 % av veckomålen).
 * Den lilla ringen på bågen visar var du borde vara nu för att hinna – är solen förbi den är du i fas.
 * Tryck för att se staplarna vecka för vecka och procent per vana.
 */
export default function ProgressCard({ habits, log, paused, today }: Props) {
  const [open, setOpen] = useState(false)
  const weeks = weeklyScores(habits, log, paused, today)
  const current = weeks[weeks.length - 1]
  const full = weeks.filter((w) => !w.current && w.pct !== null)
  const last = full[full.length - 1]
  const before = full[full.length - 2]
  const trends = habitTrends(habits, log, paused, today)
  const elapsedShare = weekElapsed(today)
  const pct = current.pct ?? 0
  const shouldHave = Math.ceil(current.goal * elapsedShare)
  const behind = Math.max(0, shouldHave - current.done)
  const left = Math.max(0, current.goal - current.done)
  const paused_ = current.pct === null

  const message = paused_
    ? 'Pausad vecka. Solen väntar tills du är tillbaka.'
    : left === 0
      ? 'Veckan är i hamn. Allt du gör nu är bonus.'
      : behind === 0
        ? `Du är i fas. ${left} ${left === 1 ? 'gång' : 'gånger'} kvar till fullt.`
        : `Du ligger ${behind} ${behind === 1 ? 'gång' : 'gånger'} efter. Varje bock flyttar solen.`

  return (
    <section className="week-sun" aria-labelledby="sun-title">
      <SunScene share={pct / 100} pace={elapsedShare} done={left === 0 && !paused_} />

      <div className="ws-stats">
        <div className="ws-now">
          <span className="ws-label" id="sun-title">
            Vecka {isoWeek(today)}
          </span>
          <b className="ws-big">{paused_ ? '–' : `${pct} %`}</b>
          <span className="ws-sub">av veckomålen</span>
        </div>
        {last && (
          <div className="ws-last">
            <span className="ws-label">Förra veckan</span>
            <b>{last.pct}&nbsp;%</b>
            {before && <Change value={change(last.pct, before.pct)} unit="" />}
          </div>
        )}
      </div>

      <p className={behind === 0 || paused_ ? 'ws-msg ok' : 'ws-msg'}>{message}</p>

      <button type="button" className="text-btn ws-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Dölj utveckling' : 'Visa utveckling'}
      </button>

      {open && (
        <div className="ws-more">
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
          {before && last && (
            <p className="ws-note">
              Förra veckan <Change value={change(last.pct, before.pct)} /> mot v. {isoWeek(before.monday)}
            </p>
          )}

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
        </div>
      )}
    </section>
  )
}

/** Himmel, horisont och sol. share = 0–1 av veckomålen, pace = 0–1 av veckan som gått. */
function SunScene({ share, pace, done }: { share: number; pace: number; done: boolean }) {
  const W = 320
  const H = 118
  const cx = W / 2
  const horizon = 100
  const r = 82
  // Från vänster horisont (0 %) upp till högst upp (100 %), en kvarts båge.
  const point = (p: number) => {
    const angle = Math.PI - (Math.PI / 2) * Math.min(1, Math.max(0, p))
    return { x: cx + r * Math.cos(angle), y: horizon - r * Math.sin(angle) }
  }
  const s = Math.min(1, share)
  const sun = point(s)
  const mark = point(pace)
  const start = point(0)
  const top = point(1)
  const warm = 0.25 + 0.75 * s
  const rays = Array.from({ length: 10 }, (_, i) => (i * Math.PI * 2) / 10)

  return (
    <svg className="ws-scene" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <radialGradient id="ws-glow" gradientUnits="userSpaceOnUse" cx={sun.x} cy={sun.y} r="150">
          <stop offset="0" className="ws-glow-in" stopOpacity={warm} />
          <stop offset="1" className="ws-glow-out" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="ws-sky" x="0" y="0" width={W} height={horizon} />
      <rect x="0" y="0" width={W} height={horizon} fill="url(#ws-glow)" />
      {/* Hela bågen streckad, och vägen solen redan gått */}
      <path className="ws-arc" d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${cx + r} ${horizon}`} />
      {s > 0.01 && <path className="ws-path" d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${sun.x} ${sun.y}`} />}
      <circle className="ws-top" cx={top.x} cy={top.y} r="2.5" />
      {/* Var du borde vara nu */}
      <circle className="ws-mark" cx={mark.x} cy={mark.y} r="4.5" />
      <g className={done ? 'ws-sun full' : 'ws-sun'} transform={`translate(${sun.x} ${sun.y})`}>
        {rays.map((a) => (
          <line
            key={a}
            x1={Math.cos(a) * 17}
            y1={Math.sin(a) * 17}
            x2={Math.cos(a) * (20 + 6 * s)}
            y2={Math.sin(a) * (20 + 6 * s)}
            opacity={0.35 + 0.65 * s}
          />
        ))}
        <circle r="13" />
      </g>
      <rect className="ws-ground" x="0" y={horizon} width={W} height={H - horizon} />
      <line className="ws-horizon" x1="0" x2={W} y1={horizon} y2={horizon} />
    </svg>
  )
}
