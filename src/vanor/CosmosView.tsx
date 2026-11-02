// Din galax i 3D: ett enda universum att röra sig fritt i.
// - Jorden i mitten, med riktiga satellitbilder. Solen går upp över Jorden med dagens poäng:
//   0 = natt (du ser stadsljusen), 100 = hela klotet i sol.
// - Rymdbasen svävar över horisonten, byggd som ISS. En astronaut per vana: bockad idag = ute och bygger.
// - Långt bort på himlen: Hälsogalaxen (ett solsystem per område, en stjärna per vana) och
//   Ekonomigalaxen (skulderna ett svart hål, sparmålet en planet som föds, budgeten ett månsystem).
// Dra för att snurra, nyp för att zooma mot det du pekar på, två fingrar för att flytta. Tryck på något
// för att flyga dit. Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { onDataChange } from '../db'
import { holeShare, loadEconomy, type Economy } from './economy'
import { baseCrew, baseMilestones, monthSatellites, nextMilestone, type Crew, type ModuleKind } from './space'
import type { Task } from './tasks'
import { galaxyMonths, monthName, monthOfWeek } from './progress'
import { weekStart } from './dates'
import { areaSystems, dayScore, habitStars, STAR_KINDS, type Period } from './cosmos'
import { buildGalaxy, buildHabitStar, buildSky, cosmosTime, farGalaxies, pixelRatio, pointScale, screenRing, type Galaxy } from './cosmos3d'
import { billboard, buildEarth, buildSun } from './earth3d'
import { buildStation, crewArrivals, spaceEnvironment, type Station } from './station3d'
import { LIST_COLORS, buildBlackHole, buildMoonSystem, buildNewPlanet, glowTexture, hash, makeSatellite, planetTexture, seeded } from './space3d'
import { CameraRig, type PickHit, type Pose } from './CameraRig'
import {
  EARTH_R,
  EARTH_YAW,
  ECONOMY,
  HEALTH,
  HOME_CAM,
  STATION_POS,
  STATION_QUAT,
  fitDistance,
  hiddenBySphere,
  homePitch,
  homeSky,
  inGalaxy,
  sunDirection,
  zoneAt,
  type GalaxySpot,
} from './universe'
import { BasePanel, EconomyPanel, TimeSlider, capital, kr, type EcoId } from './CosmosPanels'

interface Props {
  habits: Habit[]
  log: Log
  paused: Paused
  today: DateKey
  /** Att göra-saker: de avklarade den här månaden blir satelliter runt Jorden. */
  tasks: Task[]
  onClose: () => void
}

/** Var kameran är: vid Jorden, vid basen, i en galax, i ett solsystem (ett område) eller ute i universum. */
type LevelKey = 'earth' | 'base' | 'health' | 'economy' | 'universe' | `system:${string}`
const systemKey = (area: string): LevelKey => `system:${area}`
const areaOfKey = (key: LevelKey) => (key.startsWith('system:') ? key.slice(7) : null)

/** Något i universum som har en etikett och går att trycka på. */
interface Anchor {
  pos: (out: THREE.Vector3) => THREE.Vector3
  /** Etiketten syns när kameran är mellan så här nära och långt bort. */
  near: number
  far: number
  /** Etiketten hamnar under föremålet: dess radie i världen (eller pixlar under punkten). */
  radius?: number
  dy?: number
  /** Hur nära fingret måste vara (pixlar). */
  hit?: number
  /** Etiketten döljs när den är bakom Jorden (inte för Jorden själv). */
  occlude?: boolean
}

/** Det som byggs om när datan ändras (stationen, solsystemen, ekonomin, satelliterna). */
interface Content {
  anchors: Map<string, Anchor>
  poses: Map<string, () => Pose | null>
  /** Vem kameran följer efter flygningen (en astronaut). */
  follows: Map<string, THREE.Object3D>
  systems: { key: LevelKey; center: THREE.Vector3 }[]
  station: Station | null
  pick: (ray: THREE.Ray) => PickHit | null
  update: (now: number) => void
  dispose: () => void
}

const FOV = 50
const deg = THREE.MathUtils.degToRad
const HOME_PITCH = homePitch(FOV)
/** Panelen täcker nedre delen: bilden tittar ner lite så att det man tittar på hamnar ovanför. */
const PANEL_PITCH = -Math.atan(0.42 * Math.tan(deg(FOV / 2)))
const ORIGIN = new THREE.Vector3()

const GUIDE_KEY = 'vanor-kosmos-guide'
const guideSeen = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

const WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
/** "måndag 2 nov" */
const dayText = (d: DateKey) => {
  const date = new Date(d + 'T12:00:00Z')
  return `${WEEKDAYS[(date.getUTCDay() + 6) % 7]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** Färg på områdets nebulosa runt solsystemet. */
const AREA_TINT: Record<string, string> = {
  Träning: '#ff9f6b',
  Sinne: '#8fb8ff',
  Sömn: '#a99bff',
  Kost: '#8fe8b0',
  'Kropp och vård': '#ffd38f',
  Projekt: '#6fe0ff',
}

/** Var ekonomins delar ligger i Ekonomigalaxen (lokalt, före skalningen). */
const ECO_SCALE = 1.0
const SAVE_POS = new THREE.Vector3(-3.4, 0.7, 2.2)
const MOONS_POS = new THREE.Vector3(3.4, 0.6, -1.8)

/** "Så funkar din galax": visas första gången och sedan via ?-knappen. */
function CosmosGuide({ onClose }: { onClose: () => void }) {
  return (
    <section className="gv-guide" role="dialog" aria-labelledby="cv-guide-title">
      <h3 id="cv-guide-title">Så funkar din galax</h3>
      <dl>
        <div>
          <dt>
            <i className="gv-ico star" aria-hidden="true" />
            Jorden
          </dt>
          <dd>Solen går upp över Jorden med dagens poäng: hur mycket av det som ska göras idag som är gjort. 0 = natt, 100 = hela klotet i sol.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico base" aria-hidden="true" />
            Rymdbas
          </dt>
          <dd>Byggs ut med en modul för varje milstolpe. En astronaut per vana: bockad idag är den ute och bygger, annars inne i basen.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico ring" aria-hidden="true" />
            Galaxer
          </dt>
          <dd>Hälsa är dina vanor med ett solsystem per område (du väljer område under Inställningar). Ekonomi är Groundworks siffror.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico star" aria-hidden="true" />
            Stjärnor
          </dt>
          <dd>
            Varje stjärna är en vana. Ju oftare målet nås, desto hetare: protostjärna, röd dvärg, orange dvärg, gul stjärna och blå jätte.
          </dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico planet" aria-hidden="true" />
            Ekonomi
          </dt>
          <dd>Skulderna är ett svart hål som krymper, sparmålet en planet som föds, budgeten ett månsystem och önskningarna kometer.</dd>
        </div>
      </dl>
      <p className="gv-guide-how">
        Dra för att snurra runt. Nyp (eller scrolla) för att zooma mot det du pekar på, och flytta bilden med två fingrar. Tryck på något för att
        flyga dit – huset tar dig hem till Jorden.
      </p>
      <p className="cv-credit">Jordens bilder: Solar System Scope (CC BY 4.0), byggda på data från NASA.</p>
      <button type="button" className="gv-guide-ok" onClick={onClose}>
        Förstått
      </button>
    </section>
  )
}

export default function CosmosView({ habits, log, paused, today, tasks, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelEls = useRef(new Map<string, HTMLElement>())
  const coreRef = useRef<Core | null>(null)
  const pickRef = useRef<(id: string) => void>(() => {})

  const [level, setLevel] = useState<LevelKey>('earth')
  const levelRef = useRef<LevelKey>('earth')
  levelRef.current = level
  const [failed, setFailed] = useState(false)
  const [away, setAway] = useState(false)
  const [earthReady, setEarthReady] = useState(false)
  const [period, setPeriod] = useState<Period>('now')
  const [starSel, setStarSel] = useState<string | null>(null)
  const [eco, setEco] = useState<EcoId | null>(null)
  const [crewSel, setCrewSel] = useState<number | null>(null)
  const [baseOpen, setBaseOpen] = useState(true)
  const [future, setFuture] = useState(0)
  const futureRef = useRef(0)
  futureRef.current = future
  const applyFutureRef = useRef<((k: number) => void) | null>(null)
  useEffect(() => applyFutureRef.current?.(future), [future])
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen())
  const closeGuide = () => {
    setGuideOpen(false)
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      // Utan lagring visas guiden igen nästa gång – inget mer händer.
    }
  }

  // Data
  const score = useMemo(() => dayScore(habits, log, paused, today), [habits, log, paused, today])
  const stars = useMemo(() => habitStars(habits, log, paused, today, period), [habits, log, paused, today, period])
  const systems = useMemo(() => areaSystems(stars), [stars])
  const months = useMemo(() => galaxyMonths(habits, log, paused, today).map((m) => m.month), [habits, log, paused, today])
  const milestones = useMemo(() => baseMilestones(habits, log, paused, today), [habits, log, paused, today])
  const built = useMemo(() => new Set(milestones.filter((m) => m.done).map((m) => m.id)), [milestones])
  const nextModule = useMemo(() => nextMilestone(milestones)?.id ?? null, [milestones])
  const crew = useMemo(() => baseCrew(habits, log, paused, today, milestones), [habits, log, paused, today, milestones])
  const satCount = useMemo(() => monthSatellites(tasks, monthOfWeek(weekStart(today))).length, [tasks, today])
  const tasksToday = useMemo(() => {
    const list = tasks.filter((t) => t.date === today || t.doneOn === today)
    return { done: list.filter((t) => t.doneOn).length, total: list.length }
  }, [tasks, today])

  // Hushållets ekonomi. undefined = laddas, null = gick inte att läsa.
  const [economy, setEconomy] = useState<Economy | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () =>
      loadEconomy()
        .then((e) => alive && setEconomy((current) => (current && JSON.stringify(current) === JSON.stringify(e) ? current : e)))
        .catch(() => alive && setEconomy((current) => current ?? null))
    load()
    const stop = onDataChange(load)
    return () => {
      alive = false
      stop()
    }
  }, [])

  // Panelen täcker nedre delen: bilden tittar ner när något är valt.
  const area = areaOfKey(level)
  const panelShown = useRef(false)
  panelShown.current = (level === 'economy' && eco !== null) || (level === 'base' && (baseOpen || crewSel !== null)) || (area !== null && starSel !== null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Lämnar man en plats stängs det som var valt där (men inte under en flygning dit).
  useEffect(() => {
    if (coreRef.current?.rig.flying) return
    if (!level.startsWith('system:')) setStarSel(null)
    if (level !== 'economy') setEco(null)
    if (level !== 'base') {
      setCrewSel(null)
      setBaseOpen(true)
    }
  }, [level])

  /* ---------- Scenen: byggs en gång ---------- */
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let core: Core
    try {
      core = createCore(mount, {
        onLevel: (k) => setLevel(k),
        onAway: (a) => setAway(a),
        onTapId: (id) => pickRef.current(id),
        labelEls: labelEls.current,
        panelShown,
        levelRef,
      })
    } catch {
      setFailed(true)
      return
    }
    coreRef.current = core
    core.earthReady.then(() => setEarthReady(true))
    const onLost = (e: Event) => {
      e.preventDefault()
      setFailed(true)
    }
    core.renderer.domElement.addEventListener('webglcontextlost', onLost)
    return () => {
      core.renderer.domElement.removeEventListener('webglcontextlost', onLost)
      coreRef.current = null
      core.dispose()
    }
  }, [])

  /* ---------- Innehållet: byggs om när datan ändras ---------- */
  useEffect(() => {
    const core = coreRef.current
    if (!core || economy === undefined) return
    core.setSun(score.score)
    const content = buildContent(core, {
      systems,
      economy,
      built,
      nextModule,
      crew,
      arrivals: crewArrivals(crew, today),
      satCount,
      futureRef,
      applyFutureRef,
    })
    core.setContent(content)
    return () => {
      core.setContent(null)
      content.dispose()
      applyFutureRef.current = null
    }
  }, [score, systems, economy, built, nextModule, crew, satCount, today])

  /* ---------- Tryck på något (i bilden eller på en etikett) ---------- */
  const fly = (id: string) => coreRef.current?.fly(id)
  const pick = (id: string) => {
    if (id === 'earth' || id === 'base' || id === 'health' || id === 'economy') {
      setEco(null)
      setStarSel(null)
      setCrewSel(null)
      fly(id)
    } else if (id.startsWith('system:')) {
      setStarSel(null)
      fly(id)
    } else if (id.startsWith('star:')) {
      const habitId = id.slice(5)
      const again = starSel === habitId
      setStarSel(again ? null : habitId)
      if (again) {
        const a = stars.find((s) => s.id === habitId)?.area
        if (a) fly(systemKey(a))
      } else fly(id)
    } else if (id.startsWith('crew:')) {
      setCrewSel(Number(id.slice(5)))
      fly(id)
    } else if (id === 'site') {
      setCrewSel(null)
      setBaseOpen(false)
      fly(id)
    } else if (id === 'hole' || id === 'save' || id === 'moons' || id === 'wish' || id === 'worth') openEco(id)
  }
  pickRef.current = pick

  const openEco = (id: EcoId) => {
    setEco(id)
    fly(id === 'wish' || id === 'worth' ? 'economy' : id)
  }
  const closeEco = () => {
    setEco(null)
    fly('economy')
  }
  const back = () => {
    setStarSel(null)
    setEco(null)
    setCrewSel(null)
    fly(area ? 'health' : 'earth')
  }
  const home = () => {
    setStarSel(null)
    setEco(null)
    setCrewSel(null)
    fly('earth')
  }
  /** "Nästa: Gym" på startbilden: flyg till vanans stjärna och visa den. */
  const showHabit = (habit: Habit) => {
    setStarSel(habit.id)
    fly(`star:${habit.id}`)
  }

  const system = area ? systems.find((s) => s.area === area) : undefined
  const chosen = starSel ? stars.find((s) => s.id === starSel) : undefined
  const totalHabits = stars.length
  const working = crew.members.filter((m) => m.working).length
  const periodText = period === 'now' ? 'Nu' : capital(monthName(period, today))
  const crewMember = crewSel !== null ? crew.members[crewSel] : undefined
  const nextInfo = nextMilestone(milestones)

  // Etiketterna: text som följer med det den sitter på. Alla finns hela tiden; de syns när man är nära nog.
  const labels: { id: string; title: string; sub?: string; tone?: string }[] = [
    { id: 'earth', title: 'Jorden', sub: `${score.score} av 100 idag`, tone: 'earth' },
    { id: 'base', title: 'Rymdbas', sub: `${built.size}/${milestones.length} moduler · ${working} ute`, tone: 'base' },
    { id: 'health', title: 'Hälsa', sub: score.total ? `${score.done} av ${score.total} vanor idag` : `${totalHabits} vanor` },
    {
      id: 'economy',
      title: 'Ekonomi',
      sub: economy?.savings
        ? `Sparmål ${Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))} %`
        : economy
          ? `Netto ${kr(economy.worth.net)}`
          : economy === null
            ? 'Kunde inte läsas'
            : '',
    },
    ...systems.map((s) => ({
      id: systemKey(s.area),
      title: s.area,
      sub: `${s.stars.length} ${s.stars.length === 1 ? 'vana' : 'vanor'}${s.pct !== null ? ` · ${s.pct} %` : ''}`,
    })),
    ...stars.filter((s) => s.id !== starSel).map((s) => ({ id: `star:${s.id}`, title: s.name, sub: `${s.pct !== null ? `${s.pct} %` : 'ny'}${s.streak > 1 ? ` · ${s.streak} i rad` : ''}`, tone: 'star' })),
    ...crew.members.map((m, i) => ({ id: `crew:${i}`, title: m.name, tone: 'crew' })),
    ...(nextInfo
      ? [
          {
            id: 'site',
            title: `Bygget · ${nextInfo.module}`,
            sub: crew.paused ? 'Pausad dag – alla vilar' : working ? `${working} ${working === 1 ? 'astronaut' : 'astronauter'} ute` : 'Ingen ute än – bocka av',
            tone: 'site',
          },
        ]
      : []),
    ...(economy
      ? [
          ...(economy.debtLeft > 0 || economy.debtMax > 0 ? [{ id: 'hole', title: 'Skulder', sub: economy.debtLeft > 0 ? kr(economy.debtLeft) : 'Skuldfria' }] : []),
          ...(economy.savings
            ? [{ id: 'save', title: economy.savings.name, sub: `${Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))} %` }]
            : []),
          ...(economy.budget.moons.length ? [{ id: 'moons', title: 'Budget', sub: `${kr(economy.budget.paid)} av ${kr(economy.budget.total)}` }] : []),
        ]
      : []),
  ]

  const header =
    level === 'earth' ? (
      <div className="cv-hero">
        <span className="cv-eyebrow">
          {score.phase.name} · {dayText(today)}
        </span>
        <p className="cv-score">
          <b>{score.score}</b>
          <span>av 100</span>
        </p>
        <p className="cv-phase">
          <b>{score.phase.name}.</b> {score.phase.text}
        </p>
      </div>
    ) : (
      <div className="cv-hero">
        <button type="button" className="cv-backlink" onClick={back}>
          ‹ {area ? 'Hälsogalaxen' : 'Jorden'}
        </button>
        <span className="cv-eyebrow">
          {area
            ? 'Solsystem · Hälsa'
            : level === 'base'
              ? 'I bana runt Jorden'
              : level === 'universe'
                ? 'Universum'
                : `Galax · ${level === 'health' ? 'Hälsa' : 'Ekonomi'}`}
        </span>
        <h2>{area ? area : level === 'health' ? 'Hälsogalaxen' : level === 'economy' ? 'Ekonomigalaxen' : level === 'base' ? 'Rymdbasen' : 'Universum'}</h2>
        <p className="cv-sub">
          {area
            ? system?.summary || 'Inga vanor här än'
            : level === 'health'
              ? `${systems.length} solsystem · ${totalHabits} ${totalHabits === 1 ? 'vana' : 'vanor'}`
              : level === 'economy'
                ? economy
                  ? `Netto ${kr(economy.worth.net)}`
                  : 'Ekonomin kunde inte läsas'
                : level === 'base'
                  ? `${built.size} av ${milestones.length} moduler · ${working} ${working === 1 ? 'astronaut' : 'astronauter'} ute`
                  : 'Jorden, rymdbasen och dina två galaxer'}
        </p>
      </div>
    )

  const periodChips = (level === 'health' || area) && months.length > 0 && (
    <div className="cv-periods" role="group" aria-label="Tid">
      {(['now', ...[...months].reverse()] as Period[]).map((p) => (
        <button key={p} type="button" className="cv-period" aria-pressed={period === p} onClick={() => setPeriod(p)}>
          {p === 'now' ? 'Nu' : capital(monthName(p, today))}
        </button>
      ))}
    </div>
  )

  let bottom: ReactNode
  if (guideOpen) bottom = <CosmosGuide onClose={closeGuide} />
  else if (level === 'economy' && economy && eco) bottom = <EconomyPanel id={eco} economy={economy} future={future} today={today} onBack={closeEco} />
  else if (level === 'economy')
    bottom = (
      <div className="gv-bottom">
        {economy && <TimeSlider economy={economy} future={future} setFuture={setFuture} today={today} />}
        {economy ? (
          <div className="gv-months" role="list">
            {(economy.debtLeft > 0 || economy.debtMax > 0) && (
              <button type="button" role="listitem" className="gv-month gv-hole-chip" onClick={() => openEco('hole')}>
                <span>Skulder</span>
                <b>{economy.debtLeft > 0 ? kr(economy.debtLeft) : '0 kr'}</b>
              </button>
            )}
            {economy.savings && (
              <button type="button" role="listitem" className="gv-month gv-save-chip" onClick={() => openEco('save')}>
                <span>Sparmål</span>
                <b>{Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))}&nbsp;%</b>
              </button>
            )}
            {economy.budget.moons.length > 0 && (
              <button type="button" role="listitem" className="gv-month gv-moon-chip" onClick={() => openEco('moons')}>
                <span>Budget</span>
                <b>{economy.budget.total > 0 ? Math.round((economy.budget.paid / economy.budget.total) * 100) : 0}&nbsp;%</b>
              </button>
            )}
            {economy.wishes.length > 0 && (
              <button type="button" role="listitem" className="gv-month gv-wish-chip" onClick={() => openEco('wish')}>
                <span>Önskningar</span>
                <b>{economy.wishes.length}</b>
              </button>
            )}
            <button type="button" role="listitem" className="gv-month gv-worth-chip" onClick={() => openEco('worth')}>
              <span>Tillgångar</span>
              <b>{kr(economy.worth.net)}</b>
            </button>
          </div>
        ) : (
          <p className="gv-hint">Ekonomin kunde inte läsas just nu. Vanorna fungerar som vanligt.</p>
        )}
      </div>
    )
  else if (level === 'base' && crewMember)
    bottom = (
      <section className="gv-panel cv-card" aria-live="polite">
        <span className="gv-label">{crew.paused ? 'Vilar inne idag' : crewMember.working ? 'Ute och bygger' : 'Inne i basen'}</span>
        <b className="cv-card-title">{crewMember.name}</b>
        <p>
          {crew.paused
            ? 'Pausad dag – hela laget vilar inne i stationen.'
            : crewMember.working
              ? 'Bockad idag, så astronauten är ute på rymdpromenad och bygger på nästa modul.'
              : 'Inte bockad än. Bocka av vanan så kommer astronauten ut genom luftslussen.'}
          {crewMember.streak > 1 && ` ${crewMember.streak} dagar i rad.`}
        </p>
        <div className="cv-card-actions">
          <button
            type="button"
            className="gv-back"
            onClick={() => {
              setCrewSel(null)
              fly('base')
            }}
          >
            Visa hela basen
          </button>
        </div>
      </section>
    )
  else if (level === 'base')
    bottom = baseOpen ? (
      <div className="cv-base-wrap">
        <button type="button" className="cv-hide" onClick={() => setBaseOpen(false)} aria-label="Dölj panelen">
          Dölj
        </button>
        <BasePanel milestones={milestones} crew={crew} crewSel={crewSel} today={today} />
      </div>
    ) : (
      <div className="gv-bottom">
        <button type="button" className="cv-show" onClick={() => setBaseOpen(true)}>
          Rymdbasen · {built.size} av {milestones.length} moduler <span aria-hidden="true">▴</span>
        </button>
      </div>
    )
  else if (area && chosen)
    bottom = (
      <section className="gv-panel cv-card" aria-live="polite">
        <span className="gv-label" style={{ color: STAR_KINDS[chosen.kind].color }}>
          {STAR_KINDS[chosen.kind].name}
        </span>
        <b className="cv-card-title">{chosen.name}</b>
        <p>
          {chosen.pct !== null ? (
            <>
              <b>{chosen.pct}&nbsp;%</b> av målet {chosen.span}.
            </>
          ) : (
            'Ny vana – stjärnan har precis börjat bildas.'
          )}
          {chosen.streak > 1 && ` ${chosen.streak} dagar i rad.`}
        </p>
        <p>{STAR_KINDS[chosen.kind].advice}</p>
        <div className="cv-card-actions">
          <button
            type="button"
            className="gv-back"
            onClick={() => {
              setStarSel(null)
              fly(systemKey(chosen.area))
            }}
          >
            Stäng
          </button>
        </div>
      </section>
    )
  else if (level === 'health' || area)
    bottom = (
      <div className="gv-bottom">
        <p className="gv-hint">
          {period === 'now' ? 'Stjärnorna visar de senaste veckorna.' : `Stjärnorna visar ${monthName(period, today)}.`}{' '}
          {area ? 'Tryck på en stjärna för detaljer.' : 'Tryck på ett solsystem för att flyga dit.'}
        </p>
        {periodChips}
        {period !== 'now' && <span className="cv-period-now">Visar: {periodText}</span>}
      </div>
    )
  else if (level === 'universe')
    bottom = (
      <div className="gv-bottom">
        <p className="gv-hint">Tryck på en galax eller på Jorden för att flyga dit.</p>
      </div>
    )
  else
    bottom = (
      <div className="gv-bottom cv-home-bottom">
        <p className="cv-sub">
          {score.week ? 'Inget måste idag · veckans mål' : `Vanor ${score.done}/${score.total} idag`}
          {tasksToday.total > 0 && ` · Att göra ${tasksToday.done}/${tasksToday.total}`}
        </p>
        {score.next && (
          <button type="button" className="cv-next" onClick={() => showHabit(score.next!)}>
            <span>Nästa</span> {score.next.name} ›
          </button>
        )}
        <p className="gv-hint">{earthReady ? 'Dra för att snurra · nyp för att zooma · tryck på en galax' : 'Laddar Jorden …'}</p>
      </div>
    )

  if (failed)
    return createPortal(
      <div className="galaxy-view cosmos-view loading" role="dialog" aria-modal="true" aria-label="Din galax">
        <div className="cv-failed">
          <p>Galaxen kunde inte visas på den här enheten just nu.</p>
          <button type="button" className="gv-guide-ok" onClick={onClose}>
            Stäng
          </button>
        </div>
      </div>,
      document.body,
    )

  return createPortal(
    <div className="galaxy-view cosmos-view" role="dialog" aria-modal="true" aria-label="Din galax">
      <div className="gv-canvas" ref={mountRef} />
      <div className="cv-labels" aria-hidden={guideOpen}>
        {labels.map((l) => (
          <button
            key={l.id}
            type="button"
            className={l.tone ? `cv-label ${l.tone}` : 'cv-label'}
            ref={(el) => {
              if (el) labelEls.current.set(l.id, el)
              else labelEls.current.delete(l.id)
            }}
            onClick={() => pick(l.id)}
          >
            <b>{l.title}</b>
            {l.sub && <small>{l.sub}</small>}
          </button>
        ))}
      </div>
      <header className="gv-top cv-top">
        {header}
        <div className="gv-actions">
          {(level !== 'earth' || away) && (
            <button type="button" className="gv-close cv-home" aria-label="Tillbaka till startbilden" onClick={home}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="gv-close gv-help"
            aria-label="Så funkar din galax"
            aria-expanded={guideOpen}
            onClick={() => (guideOpen ? closeGuide() : setGuideOpen(true))}
          >
            ?
          </button>
          <button type="button" className="gv-close" aria-label="Stäng galaxen" onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      {bottom}
    </div>,
    document.body,
  )
}

/* ====================================================================================== */
/* Scenen                                                                                 */
/* ====================================================================================== */

interface Core {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  rig: CameraRig
  health: Galaxy
  healthGroup: THREE.Group
  economyGroup: THREE.Group
  econGalaxy: Galaxy
  glow: THREE.Texture
  surfaces: THREE.Texture[]
  sunDir: THREE.Vector3
  earthReady: Promise<void>
  setSun(score: number): void
  setContent(c: Content | null): void
  fly(id: string): void
  dispose(): void
}

interface CoreHooks {
  onLevel: (k: LevelKey) => void
  /** Kameran har lämnat startbilden (då visas hemknappen även vid Jorden). */
  onAway: (away: boolean) => void
  onTapId: (id: string) => void
  labelEls: Map<string, HTMLElement>
  panelShown: { current: boolean }
  levelRef: { current: LevelKey }
}

/**
 * Åt vilket håll kameran ska stå från det den tittar på: `elevation` grader över planet runt `up`,
 * på solens sida (solen bakom kameran, så att man inte tittar rakt in i den), och helst åt `prefer`.
 */
function sunSide(up: THREE.Vector3, sun: THREE.Vector3, prefer: THREE.Vector3, elevation: number, bothSides = false): THREE.Vector3 {
  const n = up.clone().normalize()
  const base = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  base.addScaledVector(n, -base.dot(n)).normalize()
  let best = n.clone()
  let bestScore = -Infinity
  for (const side of bothSides ? [1, -1] : [1]) {
    for (let i = 0; i < 24; i++) {
      const u = base
        .clone()
        .applyAxisAngle(n, (i / 24) * Math.PI * 2)
        .multiplyScalar(Math.cos(deg(elevation)))
        .addScaledVector(n, side * Math.sin(deg(elevation)))
        .normalize()
      const score = u.dot(sun) + 0.45 * u.dot(prefer)
      if (score > bestScore) {
        bestScore = score
        best = u
      }
    }
  }
  return best
}

/** Galaxen sedd snett från solens sida, så att hela skivan ryms (eller bara mitten, `fit`). */
function galaxyPose(g: GalaxySpot, aspect: number, sun: THREE.Vector3, fit = g.radius): Pose {
  const d = fitDistance(fit, FOV, aspect, 1.02)
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quat)
  const toHome = HOME_CAM.clone().sub(g.pos).normalize()
  const dir = sunSide(normal, sun, toHome, 55, true)
  return { target: g.pos.clone(), position: g.pos.clone().addScaledVector(dir, d), pitch: 0 }
}

/** Hur mycket längre bort saker måste vara för att rymmas på en smal skärm (1 på en bred). */
const rangeK = (aspect: number) => fitDistance(1, FOV, aspect) / fitDistance(1, FOV, 1.6)

function createCore(mount: HTMLDivElement, hooks: CoreHooks): Core {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  let dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(mount.clientWidth, mount.clientHeight)
  renderer.setClearColor(0x000000)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  mount.appendChild(renderer.domElement)
  const aspect = () => mount.clientWidth / Math.max(1, mount.clientHeight)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, aspect(), 0.01, 4000)
  scene.add(camera)
  const setScale = () => {
    pixelRatio.value = renderer.getPixelRatio()
    pointScale.value = (mount.clientHeight * renderer.getPixelRatio()) / (2 * Math.tan(deg(FOV / 2)))
  }
  setScale()

  // Efterbehandling: ljusa saker (solen, stjärnorna, stadsljusen) glöder lite (bloom)
  // HDR (halvflyttal) om grafikkortet kan rita till det, annars vanliga 8 bitar (då glöder bara det allra ljusaste)
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
  const target = new THREE.WebGLRenderTarget(1, 1, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(dpr)
  composer.setSize(mount.clientWidth, mount.clientHeight)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.5, 0.5, 0.95)
  bloom.enabled = hdr
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // Himlen: Vintergatans band snett över himlen ovanför Jorden i startbilden
  const mwA = homeSky(34, -40)
  const mwB = homeSky(8, 38)
  const sky = buildSky(renderer, new THREE.Vector3().crossVectors(mwA, mwB), homeSky(-30, -110))
  scene.add(sky.group)
  const far = farGalaxies([HEALTH.pos, ECONOMY.pos])
  scene.add(far.group)

  // Jorden och solen
  const earth = buildEarth(renderer, EARTH_R, EARTH_YAW)
  scene.add(earth.group)
  const sun = buildSun()
  scene.add(sun.group)
  const sunDir = new THREE.Vector3()
  const sunLight = new THREE.DirectionalLight('#fff3e2', 3.2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  const sc = sunLight.shadow.camera
  sc.left = sc.bottom = -0.3
  sc.right = sc.top = 0.3
  sc.near = 0.5
  sc.far = 6
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.0006
  scene.add(sunLight, sunLight.target)
  const earthLight = new THREE.DirectionalLight('#7f9fd6', 0.4)
  earthLight.position.set(0, 0, 0)
  earthLight.target.position.copy(STATION_POS)
  scene.add(earthLight, earthLight.target)
  scene.add(new THREE.AmbientLight('#2a3450', 0.55))
  const pmrem = new THREE.PMREMGenerator(renderer)
  let envMap: THREE.Texture | null = null

  // Galaxerna
  const glow = glowTexture()
  const surfaces = [planetTexture('ocean', 100), planetTexture('rock', 101), planetTexture('gas', 102)]
  const healthGroup = new THREE.Group()
  healthGroup.position.copy(HEALTH.pos)
  healthGroup.quaternion.copy(HEALTH.quat)
  const health = buildGalaxy({ seed: 2026, radius: HEALTH.radius, arms: 3, twist: 4.4, count: 60000, core: '#ffd9a6', young: '#a9c4ff', nebulae: 1, dust: 1 })
  healthGroup.add(health.group)
  scene.add(healthGroup)
  const economyGroup = new THREE.Group()
  economyGroup.position.copy(ECONOMY.pos)
  economyGroup.quaternion.copy(ECONOMY.quat)
  const econGalaxy = buildGalaxy({ seed: 77, radius: ECONOMY.radius, arms: 2, twist: 3.4, count: 45000, core: '#ffdca0', young: '#ffc27a', nebulae: 0.4, dust: 0.7 })
  economyGroup.add(econGalaxy.group)
  scene.add(economyGroup)

  const rig = new CameraRig(camera, renderer.domElement)
  rig.setPose({ target: ORIGIN.clone(), position: HOME_CAM.clone(), pitch: HOME_PITCH })
  rig.anchor = ORIGIN.clone()
  rig.constrain = (p) => {
    const min = EARTH_R + 0.12
    const l = p.length()
    if (l < min) p.multiplyScalar(min / l)
  }

  let content: Content | null = null
  const raycaster = new THREE.Raycaster()
  const sphere = new THREE.Sphere(ORIGIN.clone(), EARTH_R)
  const hitPoint = new THREE.Vector3()
  rig.pick = (ndc) => {
    raycaster.setFromCamera(ndc, camera)
    const ray = raycaster.ray
    let best: PickHit | null = null
    const consider = (h: PickHit | null) => {
      if (h && (!best || h.point.distanceToSquared(camera.position) < best.point.distanceToSquared(camera.position))) best = h
    }
    if (ray.intersectSphere(sphere, hitPoint)) consider({ point: hitPoint.clone(), near: 0.3 })
    // Galaxernas skivor
    for (const g of [HEALTH, ECONOMY]) {
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quat)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, g.pos)
      const p = ray.intersectPlane(plane, new THREE.Vector3())
      if (p && p.distanceTo(g.pos) < g.radius * 1.1) consider({ point: p, near: 0.6 })
    }
    consider(content?.pick(ray) ?? null)
    return best
  }

  // Tryck på något i bilden: närmaste synliga etikett (eller föremål) under fingret
  const screen = new Map<string, { x: number; y: number }>()
  const widths = new WeakMap<HTMLElement, number>()
  let widthStamp = 0
  rig.onTap = (ndc) => {
    const x = ((ndc.x + 1) / 2) * mount.clientWidth
    const y = ((1 - ndc.y) / 2) * mount.clientHeight
    let best: { id: string; d: number } | null = null
    for (const [id, p] of screen) {
      const a = content?.anchors.get(id) ?? fixed.get(id)
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < (a?.hit ?? 34) && (!best || d < best.d)) best = { id, d }
    }
    if (best) hooks.onTapId(best.id)
  }
  let follow: THREE.Object3D | null = null
  const followLast = new THREE.Vector3()

  // Platser som alltid finns
  const fixed = new Map<string, Anchor>([
    ['earth', { pos: (o) => o.set(0, 0, 0), near: 24, far: 3000, radius: EARTH_R, hit: 60, occlude: false }],
    ['base', { pos: (o) => o.copy(STATION_POS), near: 1.7, far: 70, radius: 0.22, hit: 44 }],
    ['health', { pos: (o) => o.copy(HEALTH.pos), near: HEALTH.radius * 2.6, far: 3000, radius: HEALTH.radius * 0.5, hit: 56 }],
    ['economy', { pos: (o) => o.copy(ECONOMY.pos), near: ECONOMY.radius * 2.6, far: 3000, radius: ECONOMY.radius * 0.5, hit: 56 }],
  ])
  const fixedPoses = new Map<string, () => Pose>([
    ['earth', () => ({ target: ORIGIN.clone(), position: HOME_CAM.clone(), pitch: HOME_PITCH })],
    [
      'base',
      () => {
        // Snett ovanifrån på solsidan: stationen i solljus med Jorden under
        const d = fitDistance(0.27, FOV, aspect(), 1.0)
        const up = STATION_POS.clone().normalize()
        const dir = sunSide(up, sunDir, HOME_CAM.clone().sub(STATION_POS).normalize(), 40)
        return { target: STATION_POS.clone(), position: STATION_POS.clone().addScaledVector(dir, d), pitch: PANEL_PITCH }
      },
    ],
    [
      'universe',
      () => {
        // Allt på en gång: Jorden och båda galaxerna, sedda rakt mot planet de ligger i
        const target = HEALTH.pos.clone().add(ECONOMY.pos).divideScalar(3)
        const radius = Math.max(target.length(), target.distanceTo(HEALTH.pos), target.distanceTo(ECONOMY.pos)) + HEALTH.radius
        const n = new THREE.Vector3().crossVectors(HEALTH.pos, ECONOMY.pos).normalize()
        if (n.dot(HOME_CAM) < 0) n.negate()
        const dir = n.multiplyScalar(0.85).addScaledVector(HOME_CAM.clone().normalize(), 0.4).normalize()
        return { target, position: target.clone().addScaledVector(dir, fitDistance(radius, FOV, aspect(), 1.12)), pitch: 0 }
      },
    ],
    ['health', () => galaxyPose(HEALTH, aspect(), sunDir)],
    ['economy', () => galaxyPose(ECONOMY, aspect(), sunDir, 6)],
  ])

  const fly = (id: string) => {
    const pose = content?.poses.get(id)?.() ?? fixedPoses.get(id)?.()
    if (!pose) return
    follow = null
    const f = content?.follows.get(id)
    rig.flyTo(pose, {
      done: () => {
        if (f) {
          follow = f
          f.getWorldPosition(followLast)
        }
      },
    })
  }

  // Var kameran är: närmaste plats, med lite marginal så att det inte fladdrar
  let K = rangeK(aspect())
  const zones = () => [
    { key: 'base', center: STATION_POS, radius: 1.8 * K },
    { key: 'earth', center: ORIGIN, radius: 40 },
    { key: 'health', center: HEALTH.pos, radius: HEALTH.radius * 3.2 * K },
    { key: 'economy', center: ECONOMY.pos, radius: ECONOMY.radius * 3.2 * K },
  ]
  let level: LevelKey = 'earth'
  let away = false
  const findLevel = (): LevelKey => {
    const cam = camera.position
    if (content && cam.distanceTo(HEALTH.pos) < HEALTH.radius * 3.5 * K) {
      let best: { key: LevelKey; d: number } | null = null
      for (const s of content.systems) {
        const d = cam.distanceTo(s.center) / (s.key === level ? 1.25 : 1)
        if (d < 3.2 * K && (!best || d < best.d)) best = { key: s.key, d }
      }
      if (best) return best.key
    }
    return zoneAt(cam, zones(), level, 'universe') as LevelKey
  }
  const anchorFor = (k: LevelKey) =>
    k === 'earth'
      ? ORIGIN
      : k === 'base'
        ? STATION_POS
        : k === 'health'
          ? HEALTH.pos
          : k === 'economy'
            ? ECONOMY.pos
            : k.startsWith('system:')
              ? (content?.systems.find((s) => s.key === k)?.center ?? HEALTH.pos)
              : null

  const onResize = () => {
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    composer.setSize(mount.clientWidth, mount.clientHeight)
    camera.aspect = aspect()
    camera.updateProjectionMatrix()
    setScale()
    K = rangeK(aspect())
  }
  window.addEventListener('resize', onResize)

  // Färre pixlar (och till slut utan bloom) om telefonen inte hinner med
  let slow = 0
  let frames = 0
  const quality = () => {
    if (dpr > 1.25) {
      dpr = Math.max(1, dpr - 0.4)
      renderer.setPixelRatio(dpr)
      composer.setPixelRatio(dpr)
      onResize()
    } else if (bloom.enabled) bloom.enabled = false
  }

  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const sunLocal = new THREE.Vector3()
  const invStation = STATION_QUAT.clone().invert()
  let last = performance.now()
  let lastLevelCheck = 0
  let frame = 0
  const tick = () => {
    frame = requestAnimationFrame(tick)
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    cosmosTime.value = now / 1000

    // Hur bilden lutar: Jorden lågt i startbilden, uppåt när en panel täcker nedre delen
    const lv = hooks.levelRef.current
    rig.pitchGoal = hooks.panelShown.current ? PANEL_PITCH : lv === 'earth' ? HOME_PITCH : 0
    rig.anchor = anchorFor(lv)
    rig.update(dt)
    if (follow && !rig.flying) {
      follow.getWorldPosition(tmp)
      tmp2.copy(tmp).sub(followLast)
      followLast.copy(tmp)
      if (camera.position.distanceTo(tmp) > 0.4) follow = null
      else {
        rig.target.add(tmp2)
        rig.position.add(tmp2)
      }
    }

    // Klippplanen följer med: nära saker skärs inte bort, långt bort räcker precisionen
    const cam = camera.position
    let dNear = cam.length() - EARTH_R
    dNear = Math.min(dNear, Math.max(0.002, cam.distanceTo(STATION_POS) - 0.3))
    if (lv.startsWith('system:') || lv === 'health') dNear = Math.min(dNear, Math.max(0.01, rig.position.distanceTo(rig.target) * 0.5))
    const near = THREE.MathUtils.clamp(dNear * 0.3, 0.0004, 0.5)
    if (Math.abs(camera.near - near) / camera.near > 0.05) {
      camera.near = near
      camera.updateProjectionMatrix()
    }

    if (now - lastLevelCheck > 150) {
      lastLevelCheck = now
      const k = findLevel()
      if (k !== level) {
        level = k
        hooks.onLevel(k)
      }
      const isAway = rig.flying || cam.distanceTo(HOME_CAM) > 0.8 || rig.target.length() > 0.4
      if (isAway !== away) {
        away = isAway
        hooks.onAway(away)
      }
    }

    // Solen: synlig utom bakom Jorden; stationen kan ligga i Jordens skugga
    sky.update(camera)
    earth.update(now)
    const toEarth = tmp.copy(cam).negate().normalize()
    const earthAng = Math.asin(Math.min(1, EARTH_R / cam.length()))
    const ang = Math.acos(THREE.MathUtils.clamp(toEarth.dot(sunDir), -1, 1))
    sun.update(camera, sunDir, THREE.MathUtils.smoothstep(ang, earthAng - 0.004, earthAng + 0.03), now)
    const along = STATION_POS.dot(sunDir)
    const off = tmp2.copy(STATION_POS).addScaledVector(sunDir, -along).length()
    const lit = along > 0 ? 1 : THREE.MathUtils.smoothstep(off, EARTH_R * 0.985, EARTH_R * 1.03)
    sunLight.intensity = 3.2 * lit
    sunLight.position.copy(STATION_POS).addScaledVector(sunDir, 3)
    sunLight.target.position.copy(STATION_POS)
    const nearStation = cam.distanceTo(STATION_POS) < 3
    renderer.shadowMap.autoUpdate = nearStation
    if (content?.station) {
      content.station.group.visible = cam.distanceTo(STATION_POS) < 90
      sunLocal.copy(sunDir).applyQuaternion(invStation)
      content.station.update(now, sunLocal, nearStation, lit < 0.5)
    }
    content?.update(now)

    // Etiketterna följer med det de sitter på, syns bara på lagom avstånd och inte bakom Jorden
    screen.clear()
    const w = mount.clientWidth
    const h = mount.clientHeight
    const all = (id: string) => content?.anchors.get(id) ?? fixed.get(id)
    // Läs etiketternas bredd ibland och i ett svep (läsning mellan skrivningar tvingar fram omlayout)
    if (now - widthStamp > 600) {
      widthStamp = now
      for (const el of hooks.labelEls.values()) widths.set(el, el.offsetWidth)
    }
    for (const [id, el] of hooks.labelEls) {
      const a = all(id)
      let opacity = 0
      if (a) {
        const p = a.pos(tmp)
        const d = cam.distanceTo(p)
        const an = a.near * K
        const af = a.far * K
        if (d > an && d < af && (a.occlude === false || !hiddenBySphere(cam, p, ORIGIN, EARTH_R * 0.999))) {
          const s = tmp2.copy(p).project(camera)
          if (s.z < 1 && Math.abs(s.x) < 1.05 && Math.abs(s.y) < 1.05) {
            const x = ((s.x + 1) / 2) * w
            const y = ((1 - s.y) / 2) * h
            screen.set(id, { x, y })
            opacity = Math.min(1, (d - an) / (an * 0.4 + 1e-6)) * (1 - THREE.MathUtils.smoothstep(d, af * 0.7, af))
            const dy = a.radius ? Math.min(h * 0.3, (a.radius / d) * (h / 2 / Math.tan(deg(FOV / 2)))) + 6 : (a.dy ?? 14)
            const half = (widths.get(el) ?? 80) / 2
            const cx = THREE.MathUtils.clamp(x, half + 6, Math.max(half + 6, w - half - 6))
            el.style.transform = `translate(${cx - half}px, ${y + dy}px)`
          }
        }
      }
      const o = opacity.toFixed(2)
      if (el.style.opacity !== o) el.style.opacity = o
      const pe = opacity > 0.4 ? 'auto' : 'none'
      if (el.style.pointerEvents !== pe) el.style.pointerEvents = pe
    }

    composer.render()

    // Mät hur fort det går de första sekunderna
    frames++
    if (frames > 30 && frames < 400) {
      slow = slow * 0.95 + (dt > 0.034 ? 1 : 0) * 0.05
      if (slow > 0.6 && !(window as { __cosmosFixedQuality?: boolean }).__cosmosFixedQuality) {
        quality()
        slow = 0
        frames = 31
      }
    }
  }
  frame = requestAnimationFrame(tick)
  // För skärmdumpar och felsökning under utveckling
  if (import.meta.env.DEV) (window as unknown as { __cosmos?: unknown }).__cosmos = { fly, rig, camera, renderer }

  return {
    renderer,
    scene,
    camera,
    rig,
    health,
    healthGroup,
    economyGroup,
    econGalaxy,
    glow,
    surfaces,
    sunDir,
    earthReady: earth.ready,
    setSun(score) {
      sunDirection(score, sunDir)
      earth.setSun(sunDir)
      envMap?.dispose()
      envMap = spaceEnvironment(pmrem, sunDir, STATION_POS.clone().negate(), Math.asin(EARTH_R / STATION_POS.length()))
      scene.environment = envMap
      // Jordskenet på stationen: starkt när Jorden under är upplyst
      earthLight.intensity = 0.15 + 0.7 * Math.max(0, STATION_POS.clone().normalize().dot(sunDir))
    },
    setContent(c) {
      content = c
      follow = null
    },
    fly,
    dispose() {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      rig.dispose()
      sky.dispose()
      far.dispose()
      earth.dispose()
      health.dispose()
      econGalaxy.dispose()
      envMap?.dispose()
      pmrem.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      glow.dispose()
      surfaces.forEach((t) => t.dispose())
      composer.dispose()
      target.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

/* ====================================================================================== */
/* Innehållet: stationen, solsystemen, ekonomin och satelliterna                          */
/* ====================================================================================== */

interface ContentData {
  systems: ReturnType<typeof areaSystems>
  economy: Economy | null
  built: Set<ModuleKind>
  nextModule: ModuleKind | null
  crew: Crew
  arrivals: Set<string>
  satCount: number
  futureRef: { current: number }
  applyFutureRef: { current: ((k: number) => void) | null }
}

function buildContent(core: Core, d: ContentData): Content {
  const { scene, camera } = core
  const anchors = new Map<string, Anchor>()
  const poses = new Map<string, () => Pose | null>()
  const follows = new Map<string, THREE.Object3D>()
  const groups: THREE.Object3D[] = []
  const disposers: (() => void)[] = []
  const updates: ((now: number) => void)[] = []
  const pickers: ((ray: THREE.Ray) => PickHit | null)[] = []
  const aspect = () => camera.aspect
  const tmp = new THREE.Vector3()

  /* ----- Rymdbasen ----- */
  const station = buildStation(d.built, d.nextModule, d.crew, d.arrivals)
  station.group.position.copy(STATION_POS)
  station.group.quaternion.copy(STATION_QUAT)
  scene.add(station.group)
  groups.push(station.group)
  disposers.push(() => station.dispose())
  for (const p of station.pickables) {
    const id = `crew:${p.idx}`
    anchors.set(id, { pos: (o) => p.obj.getWorldPosition(o), near: 0.004, far: 0.32, dy: 10, hit: 30 })
    follows.set(id, p.obj)
    poses.set(id, () => {
      // Nära, snett ovanifrån från solsidan så att dräkten är i solljus
      const at = p.obj.getWorldPosition(new THREE.Vector3())
      const dir = sunSide(STATION_POS.clone().normalize(), core.sunDir, camera.position.clone().sub(at).normalize(), 22)
      return { target: at, position: at.clone().addScaledVector(dir, 0.03), pitch: PANEL_PITCH }
    })
  }
  // Bygget: där nästa modul byggs och arbetslaget är ute
  const site = station.siteWorld()
  anchors.set('site', { pos: (o) => o.copy(site), near: 0.16, far: 3.2, dy: 16, hit: 40 })
  poses.set('site', () => {
    const dir = sunSide(STATION_POS.clone().normalize(), core.sunDir, camera.position.clone().sub(site).normalize(), 30)
    return { target: site.clone(), position: site.clone().addScaledVector(dir, 0.075 * rangeK(aspect())), pitch: 0 }
  })
  const stationSphere = new THREE.Sphere(STATION_POS.clone(), 0.3)
  const raycaster = new THREE.Raycaster()
  pickers.push((ray) => {
    if (!ray.intersectsSphere(stationSphere)) return null
    raycaster.ray.copy(ray)
    const hit = raycaster.intersectObject(station.group, true)[0]
    return hit ? { point: hit.point.clone(), near: 0.003 } : null
  })

  /* ----- Hälsogalaxen: ett solsystem per område, en stjärna per vana ----- */
  const systems: Content['systems'] = []
  const starBodies: { center: THREE.Vector3; r: number }[] = []
  const n = d.systems.length
  d.systems.forEach((s, i) => {
    const t = n <= 1 ? 0.45 : 0.25 + 0.65 * (i / (n - 1))
    const local = core.health.armPoint(t, i % 3).setY(0.18)
    const group = new THREE.Group()
    group.position.copy(local)
    core.healthGroup.add(group)
    groups.push(group)
    const center = inGalaxy(HEALTH, local)
    const key = systemKey(s.area)
    systems.push({ key, center })
    // Ett svagt sken av gas i områdets färg runt solsystemet
    const tint = new THREE.Color(AREA_TINT[s.area] ?? '#c7cce0')
    const haze = billboard(
      /* glsl */ `
        uniform vec3 uColor;
        varying vec2 vP;
        void main() {
          float r = length(vP);
          float g = exp(-r * r * 4.5) * 0.18 * (1.0 - smoothstep(0.8, 1.0, r));
          gl_FragColor = vec4(uColor * g, 1.0);
        }`,
      { uColor: { value: tint } },
    )
    haze.material.uniforms.uSize.value = 1.3
    group.add(haze)
    const ring = screenRing(new THREE.Color(STAR_KINDS[s.kind].color))
    group.add(ring)
    updates.push(() => {
      const dist = camera.position.distanceTo(center)
      ;(ring.material as THREE.ShaderMaterial).uniforms.uFade.value = THREE.MathUtils.smoothstep(dist, 4, 9) * (1 - THREE.MathUtils.smoothstep(dist, 50, 90))
    })
    anchors.set(key, { pos: (o) => o.copy(center), near: 2.2, far: HEALTH.radius * 3.4, radius: 0.55, hit: 48 })
    poses.set(key, () => {
      const dist = fitDistance(0.72, FOV, aspect(), 1.0)
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(HEALTH.quat)
      const dir = sunSide(normal, core.sunDir, camera.position.clone().sub(center).normalize(), 32, true)
      return { target: center.clone(), position: center.clone().addScaledVector(dir, dist), pitch: 0 }
    })
    const m = s.stars.length
    s.stars.forEach((star, j) => {
      const seed = hash(star.id) >>> 0
      const angle = (j / Math.max(1, m)) * Math.PI * 2 + 0.6
      const r = m === 1 ? 0 : 0.34 + 0.12 * ((seed % 10) / 10) + 0.03 * m
      const p = new THREE.Vector3(Math.cos(angle) * r, ((j % 3) - 1) * 0.07, Math.sin(angle) * r)
      const body = buildHabitStar(star.kind, seed)
      body.group.position.copy(p)
      group.add(body.group)
      disposers.push(() => body.dispose())
      const world = inGalaxy(HEALTH, local.clone().add(p))
      starBodies.push({ center: world, r: Math.max(0.03, body.size * 0.25) })
      const id = `star:${star.id}`
      anchors.set(id, { pos: (o) => o.copy(world), near: 0.12, far: 2.6, radius: Math.min(0.12, body.size * 0.4), hit: 40 })
      poses.set(id, () => {
        const dist = Math.max(0.16, body.size * 2.4)
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(HEALTH.quat)
        const dir = sunSide(normal, core.sunDir, camera.position.clone().sub(world).normalize(), 22, true)
        return { target: world.clone(), position: world.clone().addScaledVector(dir, dist), pitch: PANEL_PITCH }
      })
    })
  })
  pickers.push((ray) => {
    let best: PickHit | null = null
    for (const s of starBodies) {
      const p = ray.intersectSphere(new THREE.Sphere(s.center, s.r), new THREE.Vector3())
      if (p && (!best || p.distanceToSquared(ray.origin) < best.point.distanceToSquared(ray.origin))) best = { point: p, near: s.r * 1.6 }
    }
    return best
  })

  /* ----- Ekonomigalaxen ----- */
  const economy = d.economy
  const eco = new THREE.Group()
  eco.scale.setScalar(ECO_SCALE)
  core.economyGroup.add(eco)
  groups.push(eco)
  const ecoWorld = (local: THREE.Vector3) => {
    core.economyGroup.updateMatrixWorld(true)
    return eco.localToWorld(local.clone())
  }
  const sparkle = (pos: THREE.Vector3, color: string, scale: number, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: core.glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
    s.position.copy(pos)
    s.scale.setScalar(scale)
    return s
  }
  const settle = (group: THREE.Object3D) =>
    group.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined
      if (mat && !mat.userData.own && mat.userData.opacity !== undefined) mat.opacity = mat.userData.opacity as number
    })
  let hole: ReturnType<typeof buildBlackHole> | null = null
  core.econGalaxy.core.visible = true
  if (economy && (economy.debtLeft > 0 || economy.debtMax > 0)) {
    hole = buildBlackHole(holeShare(economy.debtLeft, economy.debtMax), core.glow)
    hole.group.scale.setScalar(0.85)
    eco.add(hole.group)
    core.econGalaxy.core.visible = false
    disposers.push(() => hole?.dispose())
    anchors.set('hole', { pos: (o) => o.copy(ECONOMY.pos), near: 1.5, far: ECONOMY.radius * 3.4, radius: 1.1, hit: 50 })
    pickers.push((ray) => {
      const p = ray.intersectSphere(new THREE.Sphere(ECONOMY.pos.clone(), 0.9), new THREE.Vector3())
      return p ? { point: p, near: 0.8 } : null
    })
  }
  /** Ekonomins delar sedda från solsidan, på samma avstånd som förut. */
  const ecoPose = (target: THREE.Vector3, pos: THREE.Vector3): Pose => {
    const t = ecoWorld(target)
    const dist = ecoWorld(pos).distanceTo(t) * Math.max(1, rangeK(aspect()) * 0.8)
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(ECONOMY.quat)
    const dir = sunSide(normal, core.sunDir, camera.position.clone().sub(t).normalize(), 20, true)
    return { target: t, position: t.clone().addScaledVector(dir, dist), pitch: PANEL_PITCH }
  }
  poses.set('hole', () => ecoPose(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 1.8, 7.5)))
  // Sparplaneten ligger i en hållare, så att tidsreglaget kan byta ut den mot en mer färdig planet.
  const saveHolder = new THREE.Group()
  saveHolder.position.copy(SAVE_POS)
  saveHolder.scale.setScalar(5.5)
  let born: ReturnType<typeof buildNewPlanet> | null = null
  let bornProgress = -1
  const setBorn = (progress: number) => {
    const p = Math.round(Math.min(1, Math.max(0, progress)) * 100) / 100
    if (p === bornProgress) return
    bornProgress = p
    if (born) {
      saveHolder.remove(born.group)
      born.group.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(m.material as THREE.Material | undefined)?.dispose()
      })
    }
    born = buildNewPlanet(p, core.surfaces[0], core.glow)
    settle(born.group)
    saveHolder.add(born.group)
  }
  if (economy?.savings) {
    setBorn(economy.savings.current / economy.savings.target)
    eco.add(saveHolder)
    anchors.set('save', { pos: (o) => o.copy(ecoWorld(SAVE_POS)), near: 1, far: ECONOMY.radius * 3.4, radius: 0.7, hit: 46 })
    poses.set('save', () => ecoPose(SAVE_POS.clone().add(new THREE.Vector3(0, -0.15, 0)), SAVE_POS.clone().add(new THREE.Vector3(0.6, 1.1, 2.6))))
  }
  let moons: ReturnType<typeof buildMoonSystem> | null = null
  if (economy && economy.budget.moons.length) {
    moons = buildMoonSystem(economy.budget.moons, core.surfaces[2], core.glow)
    moons.group.position.copy(MOONS_POS)
    moons.group.scale.setScalar(5.5)
    settle(moons.group)
    eco.add(moons.group)
    anchors.set('moons', { pos: (o) => o.copy(ecoWorld(MOONS_POS)), near: 1, far: ECONOMY.radius * 3.4, radius: 1.2, hit: 46 })
    poses.set('moons', () => ecoPose(MOONS_POS.clone().add(new THREE.Vector3(0, -0.35, 0)), MOONS_POS.clone().add(new THREE.Vector3(-0.6, 1.5, 3.3))))
  }
  // Önskelistan: en komet per önskan. Det som ryms i månadens överskott ligger nära kärnan.
  const comets = (economy?.wishes ?? []).slice(0, 14).map((wish, i, list) => {
    const reach = wish.months === null ? 1 : wish.months <= 1 ? 0 : Math.min(1, Math.log2(wish.months) / 5)
    const head = sparkle(new THREE.Vector3(), LIST_COLORS[wish.list], 0.45)
    eco.add(head)
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))
    const tail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    eco.add(tail)
    return { head, tail, r: 4 + reach * 5, a: (i / Math.max(1, list.length)) * Math.PI * 2 + 0.4, y: 0.6 + (i % 3) * 0.35 }
  })
  // Tillgångarna: hela galaxen lyser starkare ju större nettot är.
  const halo = sparkle(new THREE.Vector3(), '#ffd9a8', 6 * 3.2, 0)
  eco.add(halo)
  const coreScale = core.econGalaxy.core.scale.x
  const setWorth = (net: number) => {
    const g = THREE.MathUtils.clamp((Math.log10(Math.max(1000, net)) - 3) / 3, 0, 1)
    core.econGalaxy.core.scale.setScalar(coreScale * (0.85 + 0.4 * g))
    halo.material.opacity = 0.03 + 0.1 * g
  }
  setWorth(economy?.worth.net ?? 0)
  d.applyFutureRef.current = (k: number) => {
    if (!economy) return
    const point = economy.timeline[Math.min(k, economy.timeline.length - 1)]
    hole?.setShare(holeShare(point.loanLeft, economy.debtMax))
    if (economy.savings && point.goalSaved !== null) setBorn(point.goalSaved / economy.savings.target)
    setWorth(point.net)
  }
  d.applyFutureRef.current(d.futureRef.current)
  pickers.push((ray) => {
    let best: PickHit | null = null
    for (const local of [SAVE_POS, MOONS_POS]) {
      const p = ray.intersectSphere(new THREE.Sphere(ecoWorld(local), 0.9), new THREE.Vector3())
      if (p && (!best || p.distanceToSquared(ray.origin) < best.point.distanceToSquared(ray.origin))) best = { point: p, near: 0.5 }
    }
    return best
  })

  /* ----- Satelliter: avklarade Att göra-saker den här månaden, i bana runt Jorden ----- */
  const rand = seeded(4040)
  const sats = Array.from({ length: Math.min(10, d.satCount) }, (_, i) => {
    const sat = makeSatellite()
    sat.scale.setScalar(1.3)
    settle(sat)
    scene.add(sat)
    groups.push(sat)
    const axis = new THREE.Vector3(rand() - 0.5, 1, rand() - 0.5).normalize()
    const start = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2)
    start.addScaledVector(axis, -start.dot(axis)).normalize()
    return { sat, r: EARTH_R + 0.24 + (i % 4) * 0.09, axis, start, speed: 0.012 + (i % 3) * 0.004, phase: i * 1.9 }
  })

  // Månarnas banor och kometernas svansar syns bara på nära håll (på långt håll ser de ritade ut)
  const lines: THREE.Material[] = []
  eco.traverse((o) => {
    if ((o as THREE.Line).isLine) lines.push((o as THREE.Line).material as THREE.Material)
  })
  lines.forEach((m) => (m.userData.base = m.userData.opacity ?? m.opacity))
  updates.push((now) => {
    const t = now / 1000
    const near = 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(ECONOMY.pos), 22, 45)
    for (const m of lines) {
      m.opacity = (m.userData.base as number) * near
      m.visible = near > 0.01
    }
    hole?.update(now)
    born?.update(now)
    moons?.update(now)
    for (const c of comets) {
      const a = c.a + now / 60000
      c.head.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r)
      tmp.copy(c.head.position).setY(0).normalize().multiplyScalar(1.4).add(c.head.position)
      const pos = c.tail.geometry.getAttribute('position') as THREE.BufferAttribute
      pos.setXYZ(0, c.head.position.x, c.head.position.y, c.head.position.z)
      pos.setXYZ(1, tmp.x, tmp.y, tmp.z)
      pos.needsUpdate = true
    }
    for (const s of sats) {
      const a = s.phase + t * s.speed
      s.sat.position.copy(s.start).applyAxisAngle(s.axis, a).multiplyScalar(s.r)
      s.sat.rotation.set(a, a * 0.6, 0)
    }
  })

  return {
    anchors,
    poses,
    follows,
    systems,
    station,
    pick(ray) {
      let best: PickHit | null = null
      for (const p of pickers) {
        const h = p(ray)
        if (h && (!best || h.point.distanceToSquared(ray.origin) < best.point.distanceToSquared(ray.origin))) best = h
      }
      return best
    },
    update: (now) => updates.forEach((u) => u(now)),
    dispose() {
      disposers.forEach((f) => f())
      for (const g of groups) {
        g.removeFromParent()
        g.traverse((o) => {
          const m = o as THREE.Mesh
          m.geometry?.dispose()
          const mat = m.material as THREE.Material | THREE.Material[] | undefined
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
          else mat?.dispose()
        })
      }
    },
  }
}

