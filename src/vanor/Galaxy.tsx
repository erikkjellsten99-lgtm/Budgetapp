import { lazy, Suspense, useState, type ComponentType, type KeyboardEvent } from 'react'
import { isoWeek, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { planetColor, planetKind } from './planets'
import { monthSatellites } from './space'
import type { Task } from './tasks'
import { monthForecast, monthName, monthPlanets, monthScore, previousMonth, weekHabits, type MonthPlanet, type MonthScore } from './progress'

/**
 * Planettyper, en per vecka i månaden: färg i ljuset, färg i skuggan och om den har ringar eller band.
 * Inspirerade av riktiga planeter, så att bilden känns som rymden och inte som en tecknad bild.
 */
// 3D-galaxen laddas först när den öppnas, så att resten av appen förblir snabb.
type GalaxyProps = { habits: Habit[]; log: Log; paused: Paused; today: DateKey; tasks: Task[]; onClose: () => void }

const RELOAD_KEY = 'vanor-galax-omladdad'
/** Sätts innan sidan laddas om, så att galaxen öppnas direkt igen efteråt. */
const REOPEN_KEY = 'vanor-galax-oppna'

const session = {
  get: (key: string) => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, value)
    } catch {
      // Utan lagring: inget att komma ihåg.
    }
  },
}

const GalaxyView = lazy<ComponentType<GalaxyProps>>(() =>
  import('./GalaxyView')
    .then((module) => {
      session.set(RELOAD_KEY, null)
      return module
    })
    .catch(() => {
      // Vanligaste orsaken: en ny version har publicerats sedan appen öppnades, och galaxens gamla fil
      // finns inte längre på servern. Då laddas appen om en gång (med den nya versionen) och galaxen öppnas igen.
      if (navigator.onLine && !session.get(RELOAD_KEY)) {
        session.set(RELOAD_KEY, '1')
        session.set(REOPEN_KEY, '1')
        location.reload()
        return new Promise<never>(() => {})
      }
      return {
        default: ({ onClose }: { onClose: () => void }) => (
          <div className="galaxy-view loading" role="dialog" aria-modal="true" onClick={onClose}>
            {navigator.onLine
              ? 'Galaxen kunde inte laddas. Stäng appen helt och öppna den igen. Tryck för att stänga.'
              : 'Galaxen behöver internet första gången den öppnas. Tryck för att stänga.'}
          </div>
        ),
      }
    }),
)

/** Blandar en färg mot rymdens mörker – planetens skuggsida. */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number, to: number) => Math.round(c + (to - c) * amount)
  const r = mix((n >> 16) & 255, 6)
  const g = mix((n >> 8) & 255, 8)
  const b = mix(n & 255, 18)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const ORBIT_ANGLES = [215, 320, 150, 35, 255, 105, 0, 185]

/** Solens strålar, som från en kameralins (samma som i veckans soluppgång). */
const SUN_RAYS = [
  { angle: 0, len: 74, w: 1.1, o: 0.5 },
  { angle: 90, len: 30, w: 0.9, o: 0.32 },
  { angle: 32, len: 24, w: 0.6, o: 0.25 },
  { angle: 148, len: 24, w: 0.6, o: 0.25 },
]

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
export function GalaxyScene({
  score,
  bodies,
  small = false,
  comets = 0,
  satellites = 0,
  picked = null,
  onPick,
}: {
  score: MonthScore
  /** En planet per vana, samma som i 3D-galaxen. */
  bodies: MonthPlanet[]
  small?: boolean
  /** Antal kometer (7 dagar i rad på en vana) under månaden. */
  comets?: number
  /** Antal satelliter (avklarade Att göra-saker) under månaden. */
  satellites?: number
  picked?: string | null
  onPick?: (planet: MonthPlanet) => void
}) {
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

  // Kometer flyger in uppifrån mot solen, med svansen bort från den. Högst tre syns.
  // Satelliter på en egen yttre bana: en per avklarad Att göra-sak (högst 16 syns).
  const outerRx = (36 + Math.max(1, bodies.length) * Math.min(25, 150 / Math.max(1, bodies.length)) + 10) * k
  const satList = Array.from({ length: Math.min(16, satellites) }, (_, i) => {
    const a = ((i * 360) / Math.min(16, satellites) + 18) * (Math.PI / 180)
    const x = cx + outerRx * Math.cos(a)
    const y = cy + outerRx * 0.3 * Math.sin(a)
    // Lutning längs banan
    const tangent = (Math.atan2(outerRx * 0.3 * Math.cos(a), -outerRx * Math.sin(a)) * 180) / Math.PI
    return { x, y, rot: tangent, behind: Math.sin(a) < 0 }
  })
  const satellite = (sat: (typeof satList)[number], i: number) => (
    <g key={`s${i}`} transform={`translate(${sat.x} ${sat.y}) rotate(${sat.rot}) scale(${small ? 0.5 : 1})`} opacity={sat.behind ? 0.75 : 1}>
      <rect x="-4.6" y="-0.75" width="3.3" height="1.5" fill="#5f86d6" />
      <rect x="1.3" y="-0.75" width="3.3" height="1.5" fill="#5f86d6" />
      <rect x="-1.3" y="-1.1" width="2.6" height="2.2" rx="0.4" fill="#e9edf5" />
      <circle cx="0" cy="0" r="3" fill={`url(#gx-star-hot-${id})`} opacity="0.6" />
    </g>
  )

  const cometList = Array.from({ length: Math.min(3, comets) }, (_, i) => {
    const x = W * (0.5 + 0.17 * i) + rand() * 20
    const y = H * (0.14 + rand() * 0.22)
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    const tail = (small ? 14 : 34) + rand() * 12
    return { x, y, tx: x + (dx / len) * tail, ty: y + (dy / len) * tail }
  })

  // Banorna får plats i bilden även med många vanor.
  const step = Math.min(25, 150 / Math.max(1, bodies.length))
  const planets = bodies.map((body, i) => {
    const rx = (36 + i * step) * k
    const ry = rx * 0.3
    // Fasta vinklar som sprider planeterna och håller dem innanför bilden.
    const angle = ORBIT_ANGLES[i % ORBIT_ANGLES.length] * (Math.PI / 180)
    const x = cx + rx * Math.cos(angle)
    const y = cy + ry * Math.sin(angle)
    const behind = Math.sin(angle) < 0
    const size = body.checks > 0 ? (2.8 + 8 * body.share) * (small ? 0.55 : 1) * (behind ? 0.88 : 1) : 0
    const color = planetColor(i)
    return { body, i, rx, ry, x, y, behind, size, type: { light: color, dark: shade(color, 0.8), kind: planetKind(i) } }
  })

  // Tryck på en planet (eller en tom bana) för att se vanan. Träffytan är större än planeten.
  const pickable = (p: (typeof planets)[number]) =>
    onPick && !small
      ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${p.body.name}, ${p.body.checks} ${p.body.checks === 1 ? 'bock' : 'bockar'}`,
          'aria-pressed': picked === p.body.id,
          className: picked === p.body.id ? 'gx-pick is-picked' : 'gx-pick',
          onClick: () => onPick(p.body),
          onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(p.body)),
        }
      : {}
  const hit = (p: (typeof planets)[number]) => onPick && !small && <circle className="gx-hit" cx={p.x} cy={p.y} r={14} />
  const pickRing = (p: (typeof planets)[number], r: number) =>
    picked === p.body.id && <circle className="gx-picked" cx={p.x} cy={p.y} r={r + 4.5} />

  const planet = (p: (typeof planets)[number]) => {
    if (!p.size) {
      return (
        <g key={p.body.id} {...pickable(p)}>
          {hit(p)}
          <circle className="gx-slot" cx={p.x} cy={p.y} r={1.4 * (small ? 0.7 : 1)} />
          {pickRing(p, 1.4)}
        </g>
      )
    }
    // Vanan klarade målet varje vecka i månaden: planeten lyser.
    const perfect = p.body.weeksTotal > 0 && p.body.weeksMet === p.body.weeksTotal
    // Ljuset kommer från solen: belyst sida mot solen, skuggsida bort från den (som en riktig planet).
    const dx = cx - p.x
    const dy = cy - p.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const fx = 0.5 + ux * 0.3
    const fy = 0.5 + uy * 0.3
    const gid = `gx-p${p.i}-${id}`
    const r = p.size
    const tilt = -12
    const textured = !small && r > 3
    return (
      <g key={p.body.id} opacity={p.behind && !perfect ? 0.88 : 1} {...pickable(p)}>
        {hit(p)}
        {/* Perfekt vecka: planeten lyser upp med ett eget sken. */}
        {perfect && <circle cx={p.x} cy={p.y} r={r * 3.2 + 4} fill={`url(#gx-perfect-${id})`} />}
        <defs>
          <radialGradient id={gid} cx={fx} cy={fy} fx={fx} fy={fy} r="0.9">
            <stop offset="0" stopColor={p.type.light} />
            <stop offset="0.6" stopColor={p.type.light} stopOpacity="0.9" />
            <stop offset="1" stopColor={p.type.dark} />
          </radialGradient>
          <linearGradient id={`${gid}-sh`} x1={0.5 + ux * 0.5} y1={0.5 + uy * 0.5} x2={0.5 - ux * 0.5} y2={0.5 - uy * 0.5}>
            <stop offset="0" stopColor="#02030a" stopOpacity="0" />
            <stop offset="0.48" stopColor="#02030a" stopOpacity="0" />
            <stop offset="0.66" stopColor="#02030a" stopOpacity="0.72" />
            <stop offset="1" stopColor="#02030a" stopOpacity="0.94" />
          </linearGradient>
          <linearGradient id={`${gid}-rim`} x1={0.5 + ux * 0.5} y1={0.5 + uy * 0.5} x2={0.5 - ux * 0.5} y2={0.5 - uy * 0.5}>
            <stop offset="0" stopColor="#fffaf0" stopOpacity="0.85" />
            <stop offset="0.45" stopColor="#fffaf0" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${gid}-clip`}>
            <circle cx={p.x} cy={p.y} r={r} />
          </clipPath>
        </defs>
        {p.type.kind === 'ocean' && <circle cx={p.x} cy={p.y} r={r * 1.22} fill={`url(#gx-atmo-${id})`} />}
        {p.type.kind === 'ring' && (
          <ellipse cx={p.x} cy={p.y} rx={r * 2.15} ry={r * 0.5} className="gx-ring-back" transform={`rotate(${tilt} ${p.x} ${p.y})`} />
        )}
        <circle cx={p.x} cy={p.y} r={r} fill={`url(#${gid})`} />
        {/* Yta: band på gasjättar, fläckar på steniga planeter, moln på den jordlika */}
        {textured && (
          <g clipPath={`url(#${gid}-clip)`}>
            <rect
              x={p.x - r}
              y={p.y - r}
              width={r * 2}
              height={r * 2}
              filter={`url(#gx-surf-${p.type.kind === 'gas' || p.type.kind === 'ring' ? 'band' : p.type.kind === 'ocean' ? 'cloud' : 'rock'}-${id})`}
              opacity={p.type.kind === 'ocean' ? 0.55 : 0.4}
              transform={p.type.kind === 'gas' || p.type.kind === 'ring' ? `rotate(${tilt} ${p.x} ${p.y})` : undefined}
            />
          </g>
        )}
        <circle cx={p.x} cy={p.y} r={r} fill={`url(#${gid}-sh)`} />
        <circle cx={p.x} cy={p.y} r={r - 0.2} fill="none" stroke={`url(#${gid}-rim)`} strokeWidth={small ? 0.3 : 0.5} />
        {p.type.kind === 'ring' && (
          <path
            className="gx-ring-front"
            d={`M ${p.x - r * 2.15} ${p.y} A ${r * 2.15} ${r * 0.5} 0 0 0 ${p.x + r * 2.15} ${p.y}`}
            transform={`rotate(${tilt} ${p.x} ${p.y})`}
          />
        )}
        {pickRing(p, p.size)}
      </g>
    )
  }

  return (
    <svg
      className={small ? 'galaxy small' : 'galaxy'}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden={onPick && !small ? undefined : true}
      aria-label={onPick && !small ? 'Månadens solsystem: en planet per vana' : undefined}
    >
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
            values="0 0 0 0 0.5  0 0 0 0 0.48  0 0 0 0 0.72  0 0 0 1.5 -0.6"
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
        {/* Planetytor: brus som blir band, moln eller fläckar */}
        <filter id={`gx-surf-band-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.55" numOctaves="3" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 2.6 -1.1" />
        </filter>
        <filter id={`gx-surf-cloud-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="9" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 3 -1.6" />
        </filter>
        <filter id={`gx-surf-rock-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 2.4 -1" />
        </filter>
        <radialGradient id={`gx-atmo-${id}`}>
          <stop offset="0.78" stopColor="#8fc2ff" stopOpacity="0" />
          <stop offset="0.86" stopColor="#8fc2ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8fc2ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gx-star-warm-${id}`}>
          <stop offset="0" stopColor="#fff4dc" stopOpacity="0.7" />
          <stop offset="0.3" stopColor="#ffe2b0" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gx-star-hot-${id}`}>
          <stop offset="0" stopColor="#e6eeff" stopOpacity="0.7" />
          <stop offset="0.3" stopColor="#b9ccff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#9ab4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gx-bloom-${id}`}>
          <stop offset="0" stopColor="#fffaf0" stopOpacity="1" />
          <stop offset="0.12" stopColor="#fff1cc" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#ffc979" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gx-ray-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff3d6" stopOpacity="1" />
          <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`gx-perfect-${id}`}>
          <stop offset="0" stopColor="#fff4d0" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ffd27a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb84a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`gx-vignette-${id}`} cx="0.6" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#gx-bg-${id})`} />
      {/* Nebulosan växer fram med månadens procent. */}
      <rect width={W} height={H} filter={`url(#gx-neb-${id})`} mask={`url(#gx-mask-${id})`} opacity={0.18 + 0.45 * progress} />

      {field.map((s, i) => (
        <circle key={`f${i}`} cx={s.x} cy={s.y} r={s.r} fill={i % 7 === 0 ? '#ffe3c4' : i % 5 === 0 ? '#c4d6ff' : '#e6ebff'} opacity={s.o} />
      ))}
      {earned.map((s, i) => (
        <g key={`e${i}`} opacity={s.o}>
          <circle cx={s.x} cy={s.y} r={s.r * 3.2} fill={`url(#gx-star-${s.hot ? 'hot' : 'warm'}-${id})`} />
          <circle cx={s.x} cy={s.y} r={s.r * 0.7} fill={s.hot ? '#eef3ff' : '#fffdf6'} />
        </g>
      ))}

      {cometList.map((c, i) => (
        <g key={`c${i}`} className="gx-comet">
          <defs>
            <linearGradient id={`gx-comet-${id}-${i}`} gradientUnits="userSpaceOnUse" x1={c.x} y1={c.y} x2={c.tx} y2={c.ty}>
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.3" stopColor="#bfe3ff" stopOpacity="0.5" />
              <stop offset="1" stopColor="#8fb8ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M ${c.x} ${c.y} L ${c.tx} ${c.ty}`} stroke={`url(#gx-comet-${id}-${i})`} strokeWidth={small ? 1.2 : 2.4} strokeLinecap="round" />
          <circle cx={c.x} cy={c.y} r={small ? 3 : 6} fill={`url(#gx-star-hot-${id})`} />
          <circle cx={c.x} cy={c.y} r={small ? 0.9 : 1.7} fill="#ffffff" />
        </g>
      ))}

      {planets.map((p) => (
        <ellipse key={`o${p.i}`} className={picked === p.body.id ? 'gx-orbit picked' : 'gx-orbit'} cx={cx} cy={cy} rx={p.rx} ry={p.ry} />
      ))}
      {planets.filter((p) => p.behind).map(planet)}

      {/* Solen, samma som veckans soluppgång: mjukt sken, varm korona, tunna strålar och en bländande kärna */}
      <circle cx={cx} cy={cy} r={(small ? 20 : 58) * (0.7 + 0.3 * progress)} fill={`url(#gx-corona-${id})`} />
      <circle cx={cx} cy={cy} r={small ? 12 : 30} fill={`url(#gx-bloom-${id})`} />
      {SUN_RAYS.map((ray) => (
        <rect
          key={ray.angle}
          x={cx - ray.len * (small ? 0.4 : 1)}
          y={cy - (ray.w * (small ? 0.6 : 1)) / 2}
          width={ray.len * 2 * (small ? 0.4 : 1)}
          height={ray.w * (small ? 0.6 : 1)}
          fill={`url(#gx-ray-${id})`}
          opacity={ray.o}
          transform={`rotate(${ray.angle} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={small ? 2.6 : 6} fill="#fffdf6" />

      {satList.length > 0 && <ellipse className="gx-orbit sat" cx={cx} cy={cy} rx={outerRx} ry={outerRx * 0.3} />}
      {satList.filter((sat) => sat.behind).map(satellite)}
      {planets.filter((p) => !p.behind).map(planet)}
      {satList.filter((sat) => !sat.behind).map(satellite)}
      <rect width={W} height={H} fill={`url(#gx-vignette-${id})`} pointerEvents="none" />
    </svg>
  )
}

const cometsIn = (habits: Habit[], log: Log, paused: Paused, today: DateKey, month: string) =>
  monthPlanets(habits, log, paused, today, month).reduce((n, p) => n + p.comets, 0)

/** Detaljer för en vana (planet) i månaden: vecka för vecka, hur mycket av målet som klarades. */
function HabitDetails({
  planet,
  index,
  score,
  habits,
  log,
  paused,
  onClose,
}: {
  planet: MonthPlanet
  index: number
  score: MonthScore
  habits: Habit[]
  log: Log
  paused: Paused
  onClose: () => void
}) {
  const habit = habits.find((h) => h.id === planet.id)
  const weeks = score.weeks.map((w) => {
    const row = habit && w.state !== 'future' ? weekHabits([habit], log, paused, w.monday)[0] : undefined
    return { w, row }
  })
  const perfect = planet.weeksTotal > 0 && planet.weeksMet === planet.weeksTotal
  return (
    <section className="gx-week" aria-live="polite">
      <header>
        <div>
          <span className="gx-week-label">
            <i className="gx-dot" style={{ background: planetColor(index) }} aria-hidden="true" />
            {planet.name}
          </span>
          <b>
            {planet.checks} {planet.checks === 1 ? 'bock' : 'bockar'}
            {perfect && <em className="gx-perfect-tag">Lyser</em>}
          </b>
        </div>
        <button type="button" className="gx-week-close" aria-label="Stäng vanan" onClick={onClose}>
          ×
        </button>
      </header>
      <ul>
        {weeks.map(({ w, row }) => (
          <li key={w.monday} className={row && row.goal > 0 && row.done >= row.goal ? 'met' : undefined}>
            <span className="gx-week-name">
              Vecka {isoWeek(w.monday)}
              {w.state === 'current' ? ' (nu)' : ''}
            </span>
            <span className="gx-week-bar" aria-hidden="true">
              <i style={{ width: row && row.goal > 0 ? `${Math.round((row.done / row.goal) * 100)}%` : '0%' }} />
            </span>
            <span className="gx-week-num">
              {!row ? '–' : row.goal === 0 ? 'paus' : `${row.done}/${row.goal}`}
              {row && row.goal > 0 && row.done >= row.goal && <span aria-label=" klart"> ✓</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="gx-sub">
        {planet.weeksTotal > 0
          ? `Målet klarat ${planet.weeksMet} av ${planet.weeksTotal} ${planet.weeksTotal === 1 ? 'vecka' : 'veckor'}${perfect ? ' – planeten lyser.' : '.'}`
          : 'Veckans mål avgörs på söndag.'}
        {planet.comets > 0 && ` ☄ ${planet.comets} ${planet.comets === 1 ? 'komet' : 'kometer'} (7 dagar i rad).`}
      </p>
    </section>
  )
}

/** Månadsvyn i kortet: galaxen, procent och tidigare månader. */
export function MonthView({ habits, log, paused, today, tasks }: { habits: Habit[]; log: Log; paused: Paused; today: DateKey; tasks: Task[] }) {
  const score = monthScore(habits, log, paused, today)
  const bodies = monthPlanets(habits, log, paused, today, score.month)
  const built = bodies.filter((p) => p.share >= 0.8).length
  // Tidigare månader där vanorna fanns, nyast först (högst 6).
  const firstCreated = habits.reduce((min, h) => (h.created < min ? h.created : min), today)
  const archive: MonthScore[] = []
  for (let m = previousMonth(score.month); archive.length < 6 && m >= firstCreated.slice(0, 7); m = previousMonth(m)) {
    const s = monthScore(habits, log, paused, today, m)
    if (s.weeks.some((w) => w.goal > 0)) archive.push(s)
  }
  const title = monthName(score.month, today)
  // Öppen direkt om appen just laddades om för att hämta galaxens nya version.
  const [galaxyOpen, setGalaxyOpen] = useState(() => {
    const reopen = session.get(REOPEN_KEY) === '1'
    session.set(REOPEN_KEY, null)
    return reopen
  })
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [howOpen, setHowOpen] = useState(false)
  const pickedIndex = bodies.findIndex((p) => p.id === pickedId)
  const picked = pickedIndex >= 0 ? bodies[pickedIndex] : null
  const comets = bodies.reduce((n, p) => n + p.comets, 0)
  const satellites = monthSatellites(tasks, score.month)
  const forecast = monthForecast(score, today)
  // Förra månaden jämförs bara om vanorna fanns större delen av den (annars blir jämförelsen missvisande).
  const last = archive[0]
  const lastComparable =
    !!last && last.month === previousMonth(score.month) && last.weeks.filter((w) => w.goal > 0).length >= last.weeks.length - 1
  const best = archive.length >= 2 ? archive.reduce((a, b) => (b.pct > a.pct ? b : a)) : null
  const headingForBest = best !== null && forecast.projected !== null && forecast.projected > best.pct
  const diff = lastComparable && forecast.projected !== null ? forecast.projected - last.pct : null

  return (
    <>
      <div className="ws-hero space">
        <div className="ws-text">
          <span className="ws-label" id="sun-title">
            {title}
          </span>
          <b className="ws-big">{score.pct}&nbsp;%</b>
          <span className="ws-sub">av månadens mål</span>
          <button type="button" className="gx-open" onClick={() => setGalaxyOpen(true)}>
            Öppna din galax <span aria-hidden="true">›</span>
          </button>
        </div>
        <GalaxyScene
          score={score}
          bodies={bodies}
          comets={comets}
          satellites={satellites.length}
          picked={picked?.id ?? null}
          onPick={(planet) => setPickedId((cur) => (cur === planet.id ? null : planet.id))}
        />
        {!picked && <span className="gx-tap-hint">Tryck på en planet för vanan</span>}
      </div>
      {picked && (
        <HabitDetails planet={picked} index={pickedIndex} score={score} habits={habits} log={log} paused={paused} onClose={() => setPickedId(null)} />
      )}
      {!picked && (comets > 0 || satellites.length > 0) && (
        <p className="gx-events">
          {comets > 0 && (
            <span className="gx-event">
              <span aria-hidden="true">☄</span> {comets} {comets === 1 ? 'komet' : 'kometer'}: 7 dagar i rad på en vana.
            </span>
          )}
          {satellites.length > 0 && (
            <span className="gx-event">
              <span aria-hidden="true">🛰</span> {satellites.length} {satellites.length === 1 ? 'satellit' : 'satelliter'}: avklarade Att göra-saker.
            </span>
          )}
        </p>
      )}
      {!picked && (
        <div className="gx-how">
          <button type="button" className="text-btn" aria-expanded={howOpen} onClick={() => setHowOpen(!howOpen)}>
            {howOpen ? 'Dölj förklaringen' : 'Så funkar bilden'}
          </button>
          {howOpen && (
            <ul>
              <li>
                <b>Solen</b> är månaden. Procenten visar hur mycket av månadens mål du har klarat.
              </li>
              <li>
                <b>Varje planet</b> är en av dina vanor, i samma färg som i galaxen. Den är större ju mer av målet du har klarat i månaden. Tryck på en planet för att se vanan vecka för vecka.
              </li>
              <li>
                <b>Varje bock</b> blir en stjärna, och <b>varje avklarad Att göra-sak</b> en satellit på den yttersta banan.
              </li>
              <li>
                <b>En vana som klarar målet varje vecka</b> får planeten att lysa, och <b>7 dagar i rad</b> på en vana ger en komet.
              </li>
              <li>
                <b>Varje månad</b> blir ett solsystem i din galax, som aldrig börjar om.
              </li>
            </ul>
          )}
        </div>
      )}
      {galaxyOpen && (
        <Suspense fallback={<div className="galaxy-view loading">Laddar galaxen …</div>}>
          <GalaxyView habits={habits} log={log} paused={paused} today={today} tasks={tasks} onClose={() => setGalaxyOpen(false)} />
        </Suspense>
      )}
      <div className="ws-foot gx-foot">
        <div className="gx-forecast">
          {score.pct >= 100 ? (
            <p className="ws-msg">Hela galaxen är byggd. Snyggt jobbat.</p>
          ) : forecast.projected === null ? (
            <>
              <p className="ws-msg">För tidigt för en prognos. Den kommer efter första veckan.</p>
              <p className="gx-sub">
                {score.checks === 0
                  ? 'Varje bock blir en stjärna, och varje vana en planet.'
                  : `${score.checks} ${score.checks === 1 ? 'stjärna' : 'stjärnor'} hittills.`}
              </p>
            </>
          ) : (
            <>
              <p className="ws-msg">
                Prognos: ungefär <b>{forecast.projected}&nbsp;%</b> i slutet av {title}.
              </p>
              <p className="gx-sub">
                {forecast.perWeekNeeded !== null
                  ? `För ${forecast.target} % behövs ungefär ${forecast.perWeekNeeded} bockar i veckan resten av månaden, mot ${forecast.perWeekNow} i veckan hittills.`
                  : forecast.projected >= 100
                    ? 'Du är på väg mot en hel galax.'
                    : `${score.checks} stjärnor hittills.${built > 0 ? ` ${built} ${built === 1 ? 'vana' : 'vanor'} på minst 80 %.` : ''}`}
              </p>
              {headingForBest && <p className="gx-best">På väg mot din bästa månad hittills.</p>}
            </>
          )}
        </div>
        {lastComparable && last && (
          <div className="ws-last">
            <span>{monthName(last.month, today).replace(/^./, (c) => c.toUpperCase())}</span>
            <b>{last.pct}&nbsp;%</b>
            {diff !== null && (
              <span className={diff > 0 ? 'trend up' : diff < 0 ? 'trend down' : 'trend flat'}>
                <span aria-hidden="true">{diff > 0 ? '▲' : diff < 0 ? '▼' : '•'}</span>{' '}
                {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : '±0'}
              </span>
            )}
          </div>
        )}
      </div>
      {archive.length > 0 && (
        <div className="gx-archive">
          <span className="gx-archive-title">Tidigare månader</span>
          <ol>
            {archive.map((s) => (
              <li
                key={s.month}
                className={best?.month === s.month ? 'best' : undefined}
                aria-label={`${monthName(s.month, today)}: ${s.pct} %${best?.month === s.month ? ', bästa månaden' : ''}`}
              >
                <GalaxyScene score={s} small
                  bodies={monthPlanets(habits, log, paused, today, s.month)}
                  comets={cometsIn(habits, log, paused, today, s.month)}
                  satellites={monthSatellites(tasks, s.month).length}
                />
                <span>
                  {monthName(s.month, today).slice(0, 3)} · {s.pct}&nbsp;%
                </span>
                {best?.month === s.month && <em className="gx-best-tag">Bäst</em>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
