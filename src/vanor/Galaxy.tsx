import type { DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { monthName, monthScore, previousMonth, type MonthScore } from './progress'

/** Planeternas färger, en per vecka i månaden. */
const PLANET_COLORS = ['#8fb3ff', '#6fd6c8', '#f4a3bf', '#c7a8ff', '#ffc27a']

/** Enkel slumpgenerator med frö, så att stjärnorna ligger på samma ställe varje gång. */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Månadens solsystem. Solen i mitten, en bana per vecka. Planeten växer med veckans procent,
 * kommande veckor är tomma banor. Varje bockning under månaden blir en stjärna.
 */
export function GalaxyScene({ score, small = false }: { score: MonthScore; small?: boolean }) {
  const W = small ? 96 : 200
  const H = small ? 64 : 132
  const cx = W / 2
  const cy = H / 2 + (small ? 0 : 4)
  const scale = small ? 0.48 : 1
  const rand = seeded(Number(score.month.replace('-', '')))
  const starCount = Math.min(small ? 40 : 160, score.checks)
  const stars = Array.from({ length: starCount }, () => ({
    x: rand() * W,
    y: rand() * H,
    r: (0.5 + rand() * 0.9) * (small ? 0.7 : 1),
    o: 0.35 + rand() * 0.6,
  }))
  const complete = score.pct >= 100
  const n = score.weeks.length
  const id = `${score.month}${small ? 's' : ''}`

  return (
    <svg className={small ? 'galaxy small' : 'galaxy'} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <radialGradient id={`gx-sun-${id}`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="1" stopColor="#efa43a" />
        </radialGradient>
        <radialGradient id={`gx-glow-${id}`}>
          <stop offset="0" stopColor="#f8c870" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f8c870" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gx-band-${id}`}>
          <stop offset="0" stopColor="#b9a6ff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#b9a6ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {stars.map((s, i) => (
        <circle key={i} className="gx-star" cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
      ))}

      {complete && <ellipse cx={cx} cy={cy} rx={W * 0.48} ry={H * 0.42} fill={`url(#gx-band-${id})`} />}

      {score.weeks.map((w, i) => {
        const rx = (24 + i * (64 / Math.max(1, n - 1))) * scale * (n > 1 ? 1 : 1)
        const ry = rx * 0.42
        // Planeterna sprids runt banorna så att de inte hamnar på rad.
        const angle = (-35 + i * 71) * (Math.PI / 180)
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        const size = w.pct === null ? 0 : (1.8 + 5.2 * Math.min(1, w.pct / 100)) * scale
        return (
          <g key={w.monday} className={`gx-week ${w.state}`}>
            <ellipse className="gx-orbit" cx={cx} cy={cy} rx={rx} ry={ry} />
            {w.state === 'future' || w.pct === null || w.pct === 0 ? (
              <circle className="gx-slot" cx={px} cy={py} r={2.2 * scale} />
            ) : (
              <>
                {w.state === 'current' && <circle className="gx-ring" cx={px} cy={py} r={size + 3 * scale} />}
                <circle cx={px} cy={py} r={size} fill={PLANET_COLORS[i % PLANET_COLORS.length]} />
              </>
            )}
          </g>
        )
      })}

      <circle cx={cx} cy={cy} r={(small ? 14 : 24) * (0.6 + 0.4 * Math.min(1, score.pct / 100))} fill={`url(#gx-glow-${id})`} />
      <circle cx={cx} cy={cy} r={small ? 4.5 : 8} fill={`url(#gx-sun-${id})`} />
    </svg>
  )
}

/** Månadsvyn i kortet: galaxen, procent och tidigare månader. */
export function MonthView({ habits, log, paused, today }: { habits: Habit[]; log: Log; paused: Paused; today: DateKey }) {
  const score = monthScore(habits, log, paused, today)
  const currentIndex = score.weeks.findIndex((w) => w.state === 'current')
  const built = score.weeks.filter((w) => w.state === 'past' && (w.pct ?? 0) >= 80).length
  // Tidigare månader där vanorna fanns, nyast först (högst 6).
  const firstCreated = habits.reduce((min, h) => (h.created < min ? h.created : min), today)
  const archive: MonthScore[] = []
  for (let m = previousMonth(score.month); archive.length < 6 && m >= firstCreated.slice(0, 7); m = previousMonth(m)) {
    const s = monthScore(habits, log, paused, today, m)
    if (s.weeks.some((w) => w.goal > 0)) archive.push(s)
  }
  const title = monthName(score.month, today)

  return (
    <>
      <div className="ws-hero space">
        <div className="ws-text">
          <span className="ws-label" id="sun-title">
            {title}
          </span>
          <b className="ws-big">{score.pct}&nbsp;%</b>
          <span className="ws-sub">av månadens mål</span>
        </div>
        <GalaxyScene score={score} />
      </div>
      <div className="ws-foot">
        <p className="ws-msg">
          {score.pct >= 100
            ? 'Hela galaxen är byggd. Snyggt jobbat.'
            : score.checks === 0
              ? 'Varje bock blir en stjärna, och varje vecka en planet.'
              : currentIndex >= 0
                ? `Vecka ${currentIndex + 1} av ${score.weeks.length} bygger sin planet. ${score.checks} ${score.checks === 1 ? 'stjärna' : 'stjärnor'} hittills.`
              : `${score.checks} stjärnor den här månaden.`}
          {built > 0 && ` ${built} ${built === 1 ? 'planet' : 'planeter'} med minst 80 %.`}
        </p>
      </div>
      {archive.length > 0 && (
        <div className="gx-archive">
          <span className="gx-archive-title">Tidigare månader</span>
          <ol>
            {archive.map((s) => (
              <li key={s.month} aria-label={`${monthName(s.month, today)}: ${s.pct} %`}>
                <GalaxyScene score={s} small />
                <span>
                  {monthName(s.month, today).slice(0, 3)} · {s.pct}&nbsp;%
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
