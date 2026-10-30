import { useState, type CSSProperties } from 'react'
import { addDays, isoWeek, weekStart, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { MonthView } from './Galaxy'
import type { Task } from './tasks'
import { change, habitTrends, weeklyScores } from './progress'

interface Props {
  habits: Habit[]
  log: Log
  paused: Paused
  today: DateKey
  /** Att göra-saker: de avklarade blir satelliter i galaxen. */
  tasks: Task[]
  /** Det som måste göras idag och inte är gjort än (namn), för beskedet under solen. */
  mustToday: string[]
}

type View = 'week' | 'month'
const VIEW_KEY = 'vanor-sol-vy'

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week'
  } catch {
    return 'week'
  }
}

/** "+12" / "−5" / "±0". */
const nameList = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`

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
 * Under står vad som är viktigt idag, i samma anda som listan (Prioritera idag / Kan vänta).
 * Tryck för att se staplarna vecka för vecka och procent per vana.
 */
export default function ProgressCard({ habits, log, paused, today, tasks, mustToday }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>(savedView)
  const chooseView = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Valet sparas bara inte till nästa gång.
    }
  }
  const weeks = weeklyScores(habits, log, paused, today)
  const current = weeks[weeks.length - 1]
  const full = weeks.filter((w) => !w.current && w.pct !== null)
  const last = full[full.length - 1]
  const before = full[full.length - 2]
  const trends = habitTrends(habits, log, paused, today)
  const pct = current.pct ?? 0
  const left = Math.max(0, current.goal - current.done)
  const paused_ = current.pct === null
  // Förra veckan visas bara om vanorna fanns större delen av den – annars blir jämförelsen missvisande (t.ex. 0 %).
  const fullGoal = habits.reduce((sum, h) => sum + Math.min(7, h.goal), 0)
  const showLast = !!last && last.goal >= fullGoal * 0.6

  // Staplarna: alltid 8 veckor, så att rytmen är densamma. Veckor innan vanorna fanns (eller där de
  // bara fanns en del av veckan) visas som tomma platser i stället för ett missvisande 0 %.
  const BARS = 8
  const thisMonday = weekStart(today)
  const slots = Array.from({ length: BARS }, (_, i) => {
    const monday = addDays(thisMonday, -7 * (BARS - 1 - i))
    const w = weeks.find((x) => x.monday === monday)
    const real = !!w && w.pct !== null && (w.current || w.goal >= fullGoal * 0.6)
    return { monday, week: real ? w : null, current: i === BARS - 1 }
  })
  const counted = slots.filter((x) => x.week && !x.current).map((x) => x.week!.pct!)
  const average = counted.length >= 2 ? Math.round(counted.reduce((a, b) => a + b, 0) / counted.length) : null

  const message = paused_
    ? 'Pausad vecka. Solen väntar tills du är tillbaka.'
    : left === 0
      ? 'Veckan är i hamn. Allt du gör nu är bonus.'
      : mustToday.length
        ? `Idag: ${nameList(mustToday)}. Resten kan vänta.`
        : `Inget måste idag. ${left} ${left === 1 ? 'gång' : 'gånger'} kvar på veckan, och du har tid.`

  return (
    <section className="week-sun" aria-labelledby="sun-title" style={{ '--warm': Math.min(1, pct / 100) } as CSSProperties}>
      <div className="ws-switch" role="tablist" aria-label="Vecka eller månad">
        {(
          [
            ['week', 'Vecka'],
            ['month', 'Månad'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? 'on' : undefined}
            onClick={() => chooseView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'month' ? (
        <MonthView habits={habits} log={log} paused={paused} today={today} tasks={tasks} />
      ) : (
      <>
      <div className="ws-hero space sunrise">
        <div className="ws-text">
          <span className="ws-label" id="sun-title">
            Vecka {isoWeek(today)}
          </span>
          <b className="ws-big">{paused_ ? '–' : `${pct}\u00a0%`}</b>
          <span className="ws-sub">av veckomålen</span>
        </div>
        <SunScene share={pct / 100} done={left === 0 && !paused_} />
      </div>

      <div className="ws-foot">
        <p className="ws-msg">{message}</p>
        {showLast && last && (
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
          <div className="pc-chart">
            <div className="pc-chart-head">
              <span>Senaste 8 veckorna</span>
              {average !== null && <span className="pc-avg">Snitt {average}&nbsp;%</span>}
            </div>
            <ol className="pc-bars" aria-label="Procent av veckomålen per vecka">
              {slots.map(({ monday, week, current }) => (
                <li
                  key={monday}
                  className={[current && 'current', !week && 'empty'].filter(Boolean).join(' ') || undefined}
                  aria-label={`Vecka ${isoWeek(monday)}: ${week ? `${week.pct} %${current ? ' hittills' : ''}` : 'ingen data'}`}
                >
                  <span className="pc-val" aria-hidden="true">
                    {week ? week.pct : ''}
                  </span>
                  <span className="pc-track" aria-hidden="true">
                    {!!week?.pct && <span className="pc-fill" style={{ height: `${Math.max(week.pct, 4)}%` }} />}
                  </span>
                  <span className="pc-week" aria-hidden="true">
                    {current ? 'nu' : isoWeek(monday)}
                  </span>
                </li>
              ))}
            </ol>
            {counted.length === 0 && (
              <p className="pc-chart-note">Staplarna fylls på vecka för vecka. Den första hela veckan syns på måndag.</p>
            )}
          </div>
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
      </>
      )}
    </section>
  )
}

/** Slumptal med frö, så att stjärnorna ligger på samma ställe varje gång. */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const STARS = (() => {
  const rand = seeded(44)
  return Array.from({ length: 130 }, () => ({ x: rand() * 360, y: rand() * 112, r: 0.2 + rand() * 0.55, o: 0.25 + rand() * 0.65 }))
})()

/** Städernas ljus på planetens nattsida – svaga punkter som bleknar när solen går upp. */
const CITIES = (() => {
  const rand = seeded(1029)
  return Array.from({ length: 70 }, () => {
    const x = rand() * 360
    // Fler ljus i kluster, som kuster och storstäder.
    const cluster = rand() < 0.6
    return { x: cluster ? 40 + (rand() - 0.5) * 60 + (rand() < 0.5 ? 0 : 230) : x, y: 117 + rand() * 30, r: 0.25 + rand() * 0.45, o: 0.3 + rand() * 0.6 }
  })
})()

/** Solens strålar: tunna, avsmalnande streck som från en kameralins. */
const RAYS = [
  { angle: 0, len: 62, w: 1.1, o: 0.55 },
  { angle: 90, len: 30, w: 0.9, o: 0.35 },
  { angle: 32, len: 24, w: 0.6, o: 0.28 },
  { angle: 148, len: 24, w: 0.6, o: 0.28 },
]

/**
 * Veckans soluppgång, sedd från rymden: solen stiger över en planets horisont mot den streckade mållinjen (100 %).
 * Rymden är svart med stjärnor. Atmosfären lyser som ett tunt band längs horisonten – orange närmast, blått ovanför –
 * och blir starkare ju närmare målet du kommer, medan stjärnorna och städernas ljus bleknar.
 * Samma bildspråk som månadens solsystem och 3D-galaxen.
 */
function SunScene({ share, done }: { share: number; done: boolean }) {
  const W = 360
  const H = 150
  const horizon = 112 // planetens horisont där solen står
  const topY = 38 // mållinjen, 100 %
  const height = (p: number) => horizon + 5 - Math.min(1, Math.max(0, p)) * (horizon + 5 - topY)
  const s = Math.min(1, Math.max(0, share))
  const y = height(s)
  const cx = 236
  const rail = W - 16
  const R = 900 // planetens radie – stor så att horisonten bara böjer sig lite
  const planetY = horizon + R
  const near = (x: number) => Math.max(0, 1 - Math.abs(x - cx) / 120) // 1 nära solen, 0 långt bort

  return (
    <svg className="ws-scene sunrise" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sr-space" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020309" />
          <stop offset="0.75" stopColor="#050916" />
          <stop offset="1" stopColor="#0a1124" />
        </linearGradient>
        {/* Ljuset som sprids i rymden nära horisonten när solen går upp */}
        <radialGradient id="sr-scatter" cx={cx} cy={horizon} r="210" gradientTransform={`translate(${cx} ${horizon}) scale(1 0.45) translate(${-cx} ${-horizon})`} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffcf8f" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#e9875f" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#3a4fa8" stopOpacity="0.14" />
          <stop offset="1" stopColor="#1a2560" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sr-bloom">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="1" />
          <stop offset="0.12" stopColor="#fff1cc" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#ffc979" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sr-ray" x1="0" x2="1">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff3d6" stopOpacity="1" />
          <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="sr-ground" cx={cx} cy={horizon} r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1c1a2e" />
          <stop offset="0.35" stopColor="#0a0e1d" />
          <stop offset="1" stopColor="#03050b" />
        </radialGradient>
        {/* Atmosfärens band: varmt nära solen, blått längre bort */}
        <linearGradient id="sr-limb-warm" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff8a4a" stopOpacity="0" />
          <stop offset={cx / W - 0.22} stopColor="#ff9a55" stopOpacity="0.35" />
          <stop offset={cx / W} stopColor="#ffe2a8" stopOpacity="1" />
          <stop offset={cx / W + 0.2} stopColor="#ff9a55" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff8a4a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sr-limb-blue" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3f6fe0" stopOpacity="0.25" />
          <stop offset={cx / W} stopColor="#8fb8ff" stopOpacity="1" />
          <stop offset="1" stopColor="#3f6fe0" stopOpacity="0.25" />
        </linearGradient>
        <filter id="sr-soft" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="sr-softer" x="-10%" y="-100%" width="120%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="sr-clouds" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.1" numOctaves="4" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.84  0 0 0 0 0.7  0 0 0 2.4 -1.15" />
        </filter>
        <clipPath id="sr-planet">
          <circle cx={cx} cy={planetY} r={R} />
        </clipPath>
        <radialGradient id="sr-lit" cx={cx} cy={horizon} r="150" gradientTransform={`translate(${cx} ${horizon}) scale(1 0.35) translate(${-cx} ${-horizon})`} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="sr-lit-mask">
          <rect width={W} height={H} fill="url(#sr-lit)" />
        </mask>
      </defs>

      {/* Rymden med stjärnor – stjärnorna bleknar när ljuset ökar */}
      <rect width={W} height={H} fill="url(#sr-space)" />
      <g className="sr-fade" opacity={1 - 0.7 * s}>
        {STARS.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#dfe6ff" opacity={st.o * (1 - 0.8 * near(st.x) * s)} />
        ))}
      </g>
      <rect className="sr-fade" width={W} height={H} fill="url(#sr-scatter)" opacity={0.3 + 0.7 * s} />

      {/* Solen: bländande kärna, mjukt sken och tunna strålar */}
      <g className={done ? 'ws-sun full' : 'ws-sun'} style={{ transform: `translate(${cx}px, ${y}px)` }}>
        <circle className="ws-halo" r={30 + 16 * s} fill="url(#sr-bloom)" />
        {RAYS.map((ray) => (
          <rect
            key={ray.angle}
            x={-ray.len}
            y={-ray.w / 2}
            width={ray.len * 2}
            height={ray.w}
            fill="url(#sr-ray)"
            opacity={ray.o * (0.5 + 0.5 * s)}
            transform={`rotate(${ray.angle})`}
          />
        ))}
        <circle r="6.5" fill="#fffdf6" />
      </g>

      {/* Planeten: nattsida med städernas ljus, moln som lyses upp närmast solen och en solreflex */}
      <circle cx={cx} cy={planetY} r={R} fill="url(#sr-ground)" />
      <g clipPath="url(#sr-planet)">
        <g className="sr-fade" opacity={0.9 - 0.5 * s}>
          {CITIES.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="#ffd08a" opacity={c.o * (1 - near(c.x))} />
          ))}
        </g>
        <g mask="url(#sr-lit-mask)">
          <rect className="sr-fade" y={horizon - 4} width={W} height={H - horizon + 4} filter="url(#sr-clouds)" opacity={0.2 + 0.5 * s} />
        </g>
        <ellipse className="sr-fade" cx={cx} cy={horizon + 5} rx={26 + 20 * s} ry="2.6" fill="#ffd9a0" filter="url(#sr-soft)" opacity={0.15 + 0.45 * s} />
      </g>

      {/* Atmosfären längs horisonten: blått dis ytterst, orange band närmast, en skarp ljus kant */}
      <circle className="sr-fade" cx={cx} cy={planetY} r={R + 8} fill="none" stroke="url(#sr-limb-blue)" strokeWidth="14" filter="url(#sr-softer)" opacity={0.4 + 0.45 * s} />
      <circle className="sr-fade" cx={cx} cy={planetY} r={R + 2.5} fill="none" stroke="url(#sr-limb-warm)" strokeWidth="5" filter="url(#sr-soft)" opacity={0.5 + 0.5 * s} />
      <circle cx={cx} cy={planetY} r={R + 0.5} fill="none" stroke="url(#sr-limb-warm)" strokeWidth="1.3" opacity={0.6 + 0.4 * s} />
      <circle cx={cx} cy={planetY} r={R + 1.6} fill="none" stroke="url(#sr-limb-blue)" strokeWidth="0.6" opacity={0.35 + 0.3 * s} />

      {/* Mållinjen: när solen når hit är veckans mål klart. */}
      <line className="ws-goal" x1="160" x2={rail} y1={topY} y2={topY} />
      <text className="ws-goal-label" x={rail - 7} y={topY - 6} textAnchor="end">
        100 %
      </text>
      <line className="ws-mid" x1={rail - 5} x2={rail} y1={height(0.5)} y2={height(0.5)} />
      <text className="ws-mid-label" x={rail - 8} y={height(0.5) + 3} textAnchor="end">
        50
      </text>

      {/* Skenan och hur långt solen har kommit */}
      <line className="ws-rail" x1={rail} x2={rail} y1={topY} y2={horizon + 5} />
      {s > 0 && <line className="ws-rail-fill" x1={rail} x2={rail} y1={y} y2={horizon + 5} />}
      {s > 0 && <circle className="ws-rail-dot" cx={rail} cy={y} r="3" />}
    </svg>
  )
}
