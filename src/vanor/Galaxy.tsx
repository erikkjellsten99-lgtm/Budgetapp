import type { DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { monthName, monthScore, previousMonth, type MonthScore } from './progress'

/**
 * Planettyper, en per vecka i månaden: färg i ljuset, färg i skuggan och om den har ringar eller band.
 * Inspirerade av riktiga planeter, så att bilden känns som rymden och inte som en tecknad bild.
 */
const PLANETS = [
  { light: '#d9a27a', dark: '#4a2414', kind: 'rock' }, // Mars-lik
  { light: '#8fc3ff', dark: '#0d2a5c', kind: 'ocean' }, // jordlik
  { light: '#e8d3a8', dark: '#5a4426', kind: 'gas' }, // Jupiter-lik
  { light: '#f1dfb0', dark: '#5b4a24', kind: 'ring' }, // Saturnus-lik
  { light: '#a9e6ea', dark: '#123f4d', kind: 'ice' }, // isjätte
] as const

const ORBIT_ANGLES = [215, 320, 150, 35, 255]

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
 * Månadens solsystem, ritat för att likna ett rymdfoto: stjärnfält, en nebulosa som växer fram
 * under månaden, en sol med korona och klotformade planeter som är belysta från solen.
 * En bana per vecka – planeten växer med veckans procent. Varje bockning blir en ljus stjärna.
 */
export function GalaxyScene({ score, small = false }: { score: MonthScore; small?: boolean }) {
  const W = small ? 120 : 360
  const H = small ? 72 : 168
  const cx = W * (small ? 0.5 : 0.6)
  const cy = H * 0.52
  const k = small ? 0.36 : 1
  const id = `${score.month}${small ? 's' : ''}`.replace('-', '')
  const progress = Math.min(1, score.pct / 100)
  const rand = seeded(Number(score.month.replace('-', '')) * 7 + (small ? 1 : 0))

  // Bakgrundens stjärnfält finns alltid (som på ett riktigt foto). De ljusa stjärnorna är dina bockar.
  const field = Array.from({ length: small ? 50 : 170 }, () => ({
    x: rand() * W,
    y: rand() * H,
    r: (0.25 + rand() * 0.45) * (small ? 0.8 : 1),
    o: 0.15 + rand() * 0.45,
  }))
  const earned = Array.from({ length: Math.min(small ? 30 : 140, score.checks) }, () => {
    // Fler stjärnor nära nebulosans band, som i Vintergatan.
    const x = rand() * W
    const band = cy + (x - cx) * -0.18 + (rand() - 0.5) * H * 0.7
    return { x, y: Math.max(2, Math.min(H - 2, band)), r: (0.6 + rand() * 0.9) * (small ? 0.75 : 1), o: 0.55 + rand() * 0.45, hot: rand() < 0.18 }
  })

  const planets = score.weeks.map((w, i) => {
    const rx = (36 + i * 25) * k
    const ry = rx * 0.3
    // Fasta vinklar som sprider planeterna och håller dem innanför bilden.
    const angle = ORBIT_ANGLES[i % ORBIT_ANGLES.length] * (Math.PI / 180)
    const x = cx + rx * Math.cos(angle)
    const y = cy + ry * Math.sin(angle)
    const behind = Math.sin(angle) < 0
    const size = w.pct ? (2.2 + 6.8 * Math.min(1, w.pct / 100)) * (small ? 0.55 : 1) * (behind ? 0.88 : 1) : 0
    return { w, i, rx, ry, x, y, behind, size, type: PLANETS[i % PLANETS.length] }
  })

  const planet = (p: (typeof planets)[number]) => {
    if (p.w.state === 'future' || !p.size) {
      return <circle key={p.w.monday} className="gx-slot" cx={p.x} cy={p.y} r={1.4 * (small ? 0.7 : 1)} />
    }
    // Ljuset kommer från solen: gradientens ljuspunkt förskjuts mot solen.
    const dx = cx - p.x
    const dy = cy - p.y
    const len = Math.hypot(dx, dy) || 1
    const fx = 0.5 + (dx / len) * 0.32
    const fy = 0.5 + (dy / len) * 0.32
    const gid = `gx-p${p.i}-${id}`
    return (
      <g key={p.w.monday} opacity={p.behind ? 0.85 : 1}>
        <defs>
          <radialGradient id={gid} cx={fx} cy={fy} fx={fx} fy={fy} r="0.85">
            <stop offset="0" stopColor={p.type.light} />
            <stop offset="0.55" stopColor={p.type.light} stopOpacity="0.85" />
            <stop offset="1" stopColor={p.type.dark} />
          </radialGradient>
        </defs>
        {p.type.kind === 'ocean' && <circle cx={p.x} cy={p.y} r={p.size * 1.18} fill="#7fb6ff" opacity="0.18" />}
        {p.type.kind === 'ring' && (
          <ellipse cx={p.x} cy={p.y} rx={p.size * 2.1} ry={p.size * 0.55} className="gx-ring-back" transform={`rotate(-12 ${p.x} ${p.y})`} />
        )}
        <circle cx={p.x} cy={p.y} r={p.size} fill={`url(#${gid})`} />
        {p.type.kind === 'gas' && p.size > 3 && (
          <g clipPath={`url(#${gid}-clip)`} opacity="0.35">
            <clipPath id={`${gid}-clip`}>
              <circle cx={p.x} cy={p.y} r={p.size} />
            </clipPath>
            <rect x={p.x - p.size} y={p.y - p.size * 0.35} width={p.size * 2} height={p.size * 0.18} fill="#8a6236" />
            <rect x={p.x - p.size} y={p.y + p.size * 0.2} width={p.size * 2} height={p.size * 0.14} fill="#8a6236" />
          </g>
        )}
        {p.type.kind === 'ring' && (
          <path
            className="gx-ring-front"
            d={`M ${p.x - p.size * 2.1} ${p.y} A ${p.size * 2.1} ${p.size * 0.55} 0 0 0 ${p.x + p.size * 2.1} ${p.y}`}
            transform={`rotate(-12 ${p.x} ${p.y})`}
          />
        )}
        {p.w.state === 'current' && !small && <circle className="gx-current" cx={p.x} cy={p.y} r={p.size + 4} />}
      </g>
    )
  }

  return (
    <svg className={small ? 'galaxy small' : 'galaxy'} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`gx-bg-${id}`} cx="0.62" cy="0.5" r="0.85">
          <stop offset="0" stopColor="#0d1326" />
          <stop offset="0.6" stopColor="#060914" />
          <stop offset="1" stopColor="#020308" />
        </radialGradient>
        {/* Nebulosan: brus som färgas lila och blått och tonas in längs ett band. */}
        <filter id={`gx-neb-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={small ? 0.035 : 0.013} numOctaves="4" seed={Number(score.month.slice(5))} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.78  0 0 0 1.6 -0.55"
          />
          <feGaussianBlur stdDeviation={small ? 0.6 : 1.2} />
        </filter>
        <linearGradient id={`gx-bandmask-${id}`} x1="0" y1="0" x2="0" y2="1" gradientTransform="rotate(-10 0.5 0.5)">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`gx-mask-${id}`}>
          <rect width={W} height={H} fill={`url(#gx-bandmask-${id})`} />
        </mask>
        <radialGradient id={`gx-sun-${id}`} cx="0.45" cy="0.42" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#fff3cf" />
          <stop offset="0.8" stopColor="#ffc35c" />
          <stop offset="1" stopColor="#f08a24" />
        </radialGradient>
        <radialGradient id={`gx-corona-${id}`}>
          <stop offset="0" stopColor="#ffd88a" stopOpacity="0.55" />
          <stop offset="0.3" stopColor="#ffb85c" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gx-flare-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffe2a8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffe2a8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe2a8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`gx-vignette-${id}`} cx="0.6" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#gx-bg-${id})`} />
      {/* Nebulosan växer fram med månadens procent. */}
      <rect width={W} height={H} filter={`url(#gx-neb-${id})`} mask={`url(#gx-mask-${id})`} opacity={0.25 + 0.6 * progress} />

      {field.map((s, i) => (
        <circle key={`f${i}`} cx={s.x} cy={s.y} r={s.r} fill="#cfd8ff" opacity={s.o} />
      ))}
      {earned.map((s, i) => (
        <g key={`e${i}`} opacity={s.o}>
          <circle cx={s.x} cy={s.y} r={s.r * 2.4} fill={s.hot ? '#bcd2ff' : '#fff1d6'} opacity="0.12" />
          <circle cx={s.x} cy={s.y} r={s.r} fill={s.hot ? '#dfe9ff' : '#fffaf0'} />
        </g>
      ))}

      {planets.map((p) => (
        <ellipse key={`o${p.i}`} className={p.w.state === 'future' ? 'gx-orbit future' : 'gx-orbit'} cx={cx} cy={cy} rx={p.rx} ry={p.ry} />
      ))}
      {planets.filter((p) => p.behind).map(planet)}

      <circle cx={cx} cy={cy} r={(small ? 20 : 58) * (0.7 + 0.3 * progress)} fill={`url(#gx-corona-${id})`} />
      {!small && <rect x={cx - 70} y={cy - 0.6} width="140" height="1.2" fill={`url(#gx-flare-${id})`} />}
      <circle cx={cx} cy={cy} r={small ? 4 : 9} fill={`url(#gx-sun-${id})`} />

      {planets.filter((p) => !p.behind).map(planet)}
      <rect width={W} height={H} fill={`url(#gx-vignette-${id})`} />
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
