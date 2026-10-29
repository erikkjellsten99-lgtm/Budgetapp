import { useState, type CSSProperties } from 'react'
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
    <section className="week-sun" aria-labelledby="sun-title" style={{ '--warm': Math.min(1, pct / 100) } as CSSProperties}>
      <div className="ws-hero">
        <div className="ws-text">
          <span className="ws-label" id="sun-title">
            Vecka {isoWeek(today)}
          </span>
          <b className="ws-big">{paused_ ? '–' : `${pct}\u00a0%`}</b>
          <span className="ws-sub">av veckomålen</span>
        </div>
        <SunScene share={pct / 100} pace={elapsedShare} done={left === 0 && !paused_} />
      </div>

      <div className="ws-foot">
        <p className={behind === 0 || paused_ ? 'ws-msg ok' : 'ws-msg'}>{message}</p>
        {last && (
          <div className="ws-last">
            <span>Förra veckan</span>
            <b>{last.pct}&nbsp;%</b>
            {before && <Change value={change(last.pct, before.pct)} unit="" />}
          </div>
        )}
      </div>

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

/**
 * Solen till höger i kortet. Den stiger rakt upp från horisonten: 0 % = precis vid horisonten,
 * 100 % = högst upp. Den streckade linjen är var du borde vara nu för att hinna veckans mål.
 */
function SunScene({ share, pace, done }: { share: number; pace: number; done: boolean }) {
  const W = 140
  const H = 132
  const horizon = H - 22
  const topY = 30
  const height = (p: number) => horizon - Math.min(1, Math.max(0, p)) * (horizon - topY)
  const s = Math.min(1, Math.max(0, share))
  const y = height(s)
  const paceY = height(pace)
  const cx = W / 2

  return (
    <svg className="ws-scene" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <radialGradient id="ws-disc" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" className="ws-disc-a" />
          <stop offset="1" className="ws-disc-b" />
        </radialGradient>
        <radialGradient id="ws-halo">
          <stop offset="0" className="ws-halo-a" />
          <stop offset="1" className="ws-halo-b" />
        </radialGradient>
        <clipPath id="ws-above">
          <rect x="0" y="0" width={W} height={horizon} />
        </clipPath>
      </defs>

      {/* Mål nu */}
      <line className="ws-pace" x1="8" x2={W - 8} y1={paceY} y2={paceY} />
      <text className="ws-pace-label" x={W - 8} y={paceY - 5} textAnchor="end">
        i fas
      </text>

      <g clipPath="url(#ws-above)">
        <g className={done ? 'ws-sun full' : 'ws-sun'} style={{ transform: `translate(${cx}px, ${y}px)` }}>
          <circle className="ws-halo" r={30 + 14 * s} fill="url(#ws-halo)" opacity={0.45 + 0.55 * s} />
          <circle r="15" fill="url(#ws-disc)" />
        </g>
      </g>

      <line className="ws-horizon" x1="0" x2={W} y1={horizon} y2={horizon} />
      <line className="ws-horizon soft" x1="22" x2={W - 22} y1={horizon + 7} y2={horizon + 7} />
      <line className="ws-horizon soft" x1="44" x2={W - 44} y1={horizon + 13} y2={horizon + 13} />
    </svg>
  )
}
