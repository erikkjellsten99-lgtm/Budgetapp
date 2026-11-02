// Din galax i 3D, i tre nivåer:
// 1. Jorden: dagens poäng som en soluppgång över horisonten. På himlen en galax per livsområde
//    (Hälsa och Ekonomi), och rymdbasen med astronauterna som kretsar runt Jorden.
// 2. En galax: i Hälsa är varje solsystem ett område (Träning, Sinne …). Ekonomi har skulderna som ett
//    svart hål i kärnan, sparmålet som en planet som föds, budgeten som ett månsystem och önskningarna som kometer.
// 3. Ett solsystem: varje stjärna är en vana – klassen visar hur väl den sitter.
// Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { onDataChange } from '../db'
import { holeShare, loadEconomy, type Economy } from './economy'
import { baseCrew, baseMilestones, monthSatellites, nextMilestone } from './space'
import type { Task } from './tasks'
import { galaxyMonths, monthName, monthOfWeek } from './progress'
import { weekStart } from './dates'
import { areaOf } from './areas'
import { areaSystems, dayScore, habitStars, STAR_KINDS, type Period } from './cosmos'
import { buildEarth, buildHabitStar, buildSpiral, nebula, starfield } from './cosmos3d'
import {
  LIST_COLORS,
  buildBlackHole,
  buildMoonSystem,
  buildNewPlanet,
  buildStation,
  crewArrivals,
  glowTexture,
  hash,
  makeSatellite,
  planetTexture,
  raysTexture,
  ringTexture,
  sunTexture,
} from './space3d'
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

/** Var man är: Jorden, en galax, ett solsystem (ett område) eller rymdbasen. */
type LevelKey = 'earth' | 'health' | 'economy' | 'base' | `system:${string}`
const systemKey = (area: string): LevelKey => `system:${area}`
const areaOfKey = (key: LevelKey) => (key.startsWith('system:') ? key.slice(7) : null)

/** Något i en vy som går att trycka på (och som har en etikett). */
interface Anchor {
  id: string
  pos: () => THREE.Vector3
  /** Hur nära trycket måste vara på skärmen (−1…1). */
  hit?: number
  /** Etiketten så här många pixlar under punkten (stora saker som galaxer behöver mer). */
  dy?: number
}

interface World {
  key: LevelKey
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  home: { pos: THREE.Vector3; target: THREE.Vector3 }
  anchors: Anchor[]
  update: (now: number) => void
  /** Var kameran ska stå för att titta närmare på något (och om den ska följa med när det rör sig). */
  focus?: (id: string) => { pos: THREE.Vector3; target: THREE.Vector3; follow?: THREE.Object3D } | null
  dispose?: () => void
}

interface Api {
  go: (key: LevelKey, via?: string) => void
  focus: (id: string | null) => void
}

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

/** Färg på områdets nebulosa (bakgrunden i solsystemet). */
const AREA_TINT: Record<string, string> = {
  Träning: '#ff9f6b',
  Sinne: '#8fb8ff',
  Sömn: '#a99bff',
  Kost: '#8fe8b0',
  'Kropp och vård': '#ffd38f',
  Projekt: '#6fe0ff',
}

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
          <dd>Startbilden. Solen stiger med dagens poäng: hur mycket av det som ska göras idag som är gjort. 100 = full sol.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico ring" aria-hidden="true" />
            Galaxer
          </dt>
          <dd>En per livsområde. Hälsa är dina vanor, Ekonomi är Groundworks siffror. Tryck för att flyga in.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico planet" aria-hidden="true" />
            Solsystem
          </dt>
          <dd>I Hälsa är varje solsystem ett område, t.ex. Träning eller Sinne. Du väljer område för varje vana under Inställningar.</dd>
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
            <i className="gv-ico base" aria-hidden="true" />
            Rymdbas
          </dt>
          <dd>Kretsar runt Jorden. En astronaut per vana: bockad idag är den ute och bygger, annars inne i basen.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico ring" aria-hidden="true" />
            Ekonomi
          </dt>
          <dd>Skulderna är ett svart hål som krymper, sparmålet en planet som föds, budgeten ett månsystem och önskningarna kometer.</dd>
        </div>
      </dl>
      <p className="gv-guide-how">Dra för att vrida, nyp för att zooma. Pilen uppe till vänster tar dig tillbaka.</p>
      <button type="button" className="gv-guide-ok" onClick={onClose}>
        Förstått
      </button>
    </section>
  )
}

export default function CosmosView({ habits, log, paused, today, tasks, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)
  const labelEls = useRef(new Map<string, HTMLElement>())
  const apiRef = useRef<Api | null>(null)
  const pickRef = useRef<(id: string) => void>(() => {})

  const [level, setLevel] = useState<LevelKey>('earth')
  const levelRef = useRef<LevelKey>('earth')
  levelRef.current = level
  const [period, setPeriod] = useState<Period>('now')
  const [starSel, setStarSel] = useState<string | null>(null)
  const [eco, setEco] = useState<EcoId | null>(null)
  const [crewSel, setCrewSel] = useState<number | null>(null)
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

  // Panelen täcker nedre delen: bilden flyttas upp när något är valt.
  const panelShown = useRef(false)
  panelShown.current = (level === 'economy' && eco !== null) || level === 'base' || (level.startsWith('system:') && starSel !== null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Var kameran stod i varje vy, så att allt kan byggas om (nya bockar) utan att du hamnar på start.
  const viewsRef = useRef(new Map<LevelKey, { pos: THREE.Vector3; target: THREE.Vector3 }>())

  useEffect(() => {
    const mount = mountRef.current
    // Vänta tills ekonomin är läst, så att scenen inte byggs om direkt efter att den öppnats.
    if (!mount || economy === undefined) return
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x020309)
    mount.appendChild(renderer.domElement)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const glow = glowTexture()
    const ringTex = ringTexture()
    const sunTex = sunTexture()
    const raysTex = raysTexture()
    const surfaces = [planetTexture('ocean', 100), planetTexture('rock', 101), planetTexture('gas', 102)]
    const textures = [glow, ringTex, sunTex, raysTex, envMap, ...surfaces]
    const aspect = () => mount.clientWidth / Math.max(1, mount.clientHeight)

    /** En vy: egen scen, kamera och styrning (bara den aktiva vyns styrning är på). */
    const makeWorld = (key: LevelKey, fov: number, pos: THREE.Vector3, target: THREE.Vector3) => {
      const scene = new THREE.Scene()
      scene.environment = envMap
      scene.environmentIntensity = 0.45
      const camera = new THREE.PerspectiveCamera(fov, aspect(), 0.05, 600)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = false
      controls.enabled = false
      const saved = viewsRef.current.get(key)
      camera.position.copy(saved?.pos ?? pos)
      controls.target.copy(saved?.target ?? target)
      controls.update()
      scene.add(camera)
      return { key, scene, camera, controls, home: { pos: pos.clone(), target: target.clone() } }
    }
    const sparkle = (pos: THREE.Vector3, color: string, scale: number, opacity = 1) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
      s.position.copy(pos)
      s.scale.setScalar(scale)
      return s
    }
    /** Materialens sparade genomskinlighet (t.ex. växthusets glas) – samma som när galaxen tonade in dem. */
    const settle = (group: THREE.Object3D) =>
      group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m && !m.userData.own && m.userData.opacity !== undefined) m.opacity = m.userData.opacity as number
      })

    // ---------- Jorden ----------
    const buildEarthWorld = (): World => {
      const w = makeWorld('earth', 50, new THREE.Vector3(0, 0.15, 6.2), new THREE.Vector3(0, 1.0, -2))
      const { scene, controls } = w
      controls.enableZoom = false
      controls.rotateSpeed = 0.35
      controls.minAzimuthAngle = -0.4
      controls.maxAzimuthAngle = 0.4
      controls.minPolarAngle = 1.3
      controls.maxPolarAngle = 1.75
      const R = 3.2
      const earthC = new THREE.Vector3(0, -R - 0.35, -1.5)
      const earth = buildEarth(R)
      earth.group.position.copy(earthC)
      // Vänd så att en kontinent med städer syns vid horisonten
      earth.group.rotation.set(-0.2, 1.76, 0.1)
      scene.add(earth.group)
      // Solen stiger med dagens poäng: 0 = natt (under horisonten), 100 = högt upp.
      const s = score.score
      const sunPos = new THREE.Vector3(1.3, s === 0 ? -4.5 : -1.95 + (s / 100) * 9, -26)
      earth.setSun(sunPos.clone().sub(earthC))
      const sunGroup = new THREE.Group()
      sunGroup.position.copy(sunPos)
      sunGroup.add(sparkle(new THREE.Vector3(), '#ffd9a0', 22, 0.55))
      sunGroup.add(sparkle(new THREE.Vector3(), '#fff6e8', 5))
      const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex, color: '#fff1dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
      rays.scale.setScalar(8)
      rays.material.opacity = 0.65
      sunGroup.add(rays)
      const flare = sparkle(new THREE.Vector3(), '#ffcf9a', 1, 0.5)
      flare.scale.set(30, 0.7, 1)
      sunGroup.add(flare)
      scene.add(sunGroup)
      const light = new THREE.DirectionalLight('#fff1dc', 2.6)
      light.position.copy(sunPos)
      light.target.position.copy(earthC)
      scene.add(light, light.target)
      scene.add(new THREE.AmbientLight('#8090c0', 0.06))
      // Rymden bakom: stjärnor och moln av gas
      scene.add(starfield(2600, 90, 11, glow))
      const clouds = [
        nebula(new THREE.Vector3(-14, 10, -48), 34, '#9a8f86', 0.22),
        nebula(new THREE.Vector3(10, 16, -55), 40, '#8c8a9e', 0.18),
        nebula(new THREE.Vector3(18, 3, -45), 28, '#a08a78', 0.16),
        nebula(new THREE.Vector3(-4, 22, -60), 36, '#7f8aa0', 0.14),
      ]
      clouds.forEach((c) => scene.add(c))
      // Galaxerna på himlen
      const health = buildSpiral({ seed: 5, radius: 0.55, count: 1800, inner: '#fff1d6', outer: '#a9c1ff', size: 0.028, glow })
      health.group.position.set(-1.25, 1.15, -4.5)
      health.group.rotation.set(1.05, 0.2, 0.4)
      scene.add(health.group)
      const money = buildSpiral({ seed: 9, radius: 0.6, count: 1800, inner: '#ffe6b8', outer: '#ffb86a', size: 0.032, glow })
      money.group.position.set(1.0, 2.45, -6.5)
      money.group.rotation.set(0.9, -0.3, -0.5)
      scene.add(money.group)
      // Rymdbasen i låg bana runt Jorden (utan ankomster – de visas när du åker dit)
      const station = buildStation(built, nextModule, crew)
      settle(station.group)
      station.group.scale.setScalar(1.15)
      scene.add(station.group)
      const stationPos = () => station.group.position
      // Satelliter: avklarade Att göra-saker den här månaden
      const sats = Array.from({ length: Math.min(10, satCount) }, (_, i) => {
        const sat = makeSatellite()
        sat.scale.setScalar(2.2)
        settle(sat)
        scene.add(sat)
        return { sat, r: R + 0.32 + (i % 3) * 0.08, tilt: 0.4 + i * 0.7, speed: 0.05 + (i % 4) * 0.012, phase: i * 1.9 }
      })
      const tmp = new THREE.Vector3()
      const X = new THREE.Vector3(1, 0, 0)
      const Z = new THREE.Vector3(0, 0, 1)
      return {
        ...w,
        anchors: [
          { id: 'health', pos: () => health.group.position, hit: 0.16, dy: 44 },
          { id: 'economy', pos: () => money.group.position, hit: 0.16, dy: 40 },
          { id: 'base', pos: stationPos, hit: 0.12 },
        ],
        update(now) {
          earth.update(now)
          health.group.rotation.y = 0.2 + now / 30000
          money.group.rotation.y = -0.3 + now / 34000
          rays.material.rotation = now / 60000
          clouds.forEach((c, i) => (c.material.rotation += 0.00003 * (i % 2 ? 1 : -1)))
          // Banan: över horisonten, långsamt från vänster till höger
          const a = now / 26000
          station.group.position.set(Math.sin(a) * 0.85, 0.34 + Math.cos(a * 2) * 0.04, 1.05 - Math.cos(a) * 0.55)
          station.group.rotation.y = now / 14000
          for (const r of station.spin) r.rotation.x = now / 5000
          station.crew.update(now, 1)
          for (const s of sats) {
            const t = s.phase + (now / 1000) * s.speed
            tmp.set(Math.cos(t) * s.r, 0, Math.sin(t) * s.r).applyAxisAngle(X, 0.9 + s.tilt * 0.2).applyAxisAngle(Z, s.tilt)
            s.sat.position.copy(earthC).add(tmp)
            s.sat.rotation.set(t, t * 0.6, 0)
          }
          // Lite liv när ingen rör skärmen: bilden glider sakta
          if (!dragging) controls.target.x = w.home.target.x + Math.sin(now / 9000) * 0.12
        },
        dispose: () => station.crew.dispose(),
      }
    }

    // ---------- Hälsa: ett solsystem per område ----------
    const SPIRAL_R = 6
    const TWIST = 4.6
    /** Snett ovanifrån, så långt bort att hela galaxen ryms på bredden även på en smal telefon. */
    const galaxyHome = (fov: number, radius: number) => {
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect())
      const d = Math.max(11, (radius / Math.tan(half)) * 0.82)
      const tilt = THREE.MathUtils.degToRad(40)
      return new THREE.Vector3(0, d * Math.sin(tilt), d * Math.cos(tilt))
    }
    const armPos = (i: number, n: number) => {
      const t = n <= 1 ? 0.45 : 0.25 + 0.65 * (i / (n - 1))
      const angle = (i % 2) * Math.PI + t * TWIST
      const r = SPIRAL_R * (0.06 + 0.94 * t)
      return new THREE.Vector3(Math.cos(angle) * r, 0.08, Math.sin(angle) * r)
    }
    const buildHealthWorld = (): World => {
      const w = makeWorld('health', 52, galaxyHome(52, SPIRAL_R + 0.6), new THREE.Vector3(0, 0, 0))
      const { scene, controls } = w
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
      controls.minDistance = 2.5
      controls.maxDistance = 40
      const galaxy = buildSpiral({ seed: 2026, radius: SPIRAL_R, count: 16000, inner: '#ffe4bf', outer: '#a9c1ff', size: 0.085, twist: TWIST, glow })
      scene.add(galaxy.group)
      scene.add(starfield(1800, 120, 3, glow))
      for (let k = 0; k < 18; k++) {
        const p = armPos(k % 9, 9).multiplyScalar(0.9 + (k % 3) * 0.08)
        scene.add(sparkle(p.add(new THREE.Vector3(((k * 37) % 10) / 10 - 0.5, 0, ((k * 53) % 10) / 10 - 0.5)), k % 3 ? '#ff8fb8' : '#8fb8ff', 1.4 + (k % 4) * 0.4, 0.14))
      }
      const anchors: Anchor[] = []
      const suns = systems.map((s, i) => {
        const p = armPos(i, systems.length)
        const color = STAR_KINDS[s.kind].color
        const share = (s.pct ?? 10) / 100
        // Solsystemen sitter i galaxen och följer med när den snurrar.
        const sun = sparkle(p, color, 0.9 + 1.5 * share)
        galaxy.group.add(sun)
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, opacity: 0.8, depthWrite: false }))
        ring.position.copy(p)
        ring.scale.setScalar(1.2)
        galaxy.group.add(ring)
        anchors.push({ id: systemKey(s.area), pos: () => sun.getWorldPosition(new THREE.Vector3()), hit: 0.14 })
        return { ring, phase: i }
      })
      return {
        ...w,
        anchors,
        update(now) {
          galaxy.group.rotation.y = now / 90000
          suns.forEach((s) => s.ring.scale.setScalar(1.15 + 0.12 * Math.sin(now / 700 + s.phase)))
        },
        focus(id) {
          const a = anchors.find((x) => x.id === id)
          if (!a) return null
          const p = a.pos().clone()
          return { target: p, pos: p.clone().add(new THREE.Vector3(0, 1.4, 2.2)) }
        },
      }
    }

    // ---------- Ett solsystem: en stjärna per vana ----------
    const buildSystemWorld = (area: string): World => {
      const fit = Math.max(3.6, 1.35 / Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * aspect())))
      const w = makeWorld(systemKey(area), 50, new THREE.Vector3(0, fit * 0.3, fit), new THREE.Vector3(0, 0, 0))
      const { scene, controls } = w
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
      controls.minDistance = 0.6
      controls.maxDistance = 14
      scene.add(starfield(1600, 70, hash(area) >>> 0, glow))
      const tint = AREA_TINT[area] ?? '#c7cce0'
      scene.add(nebula(new THREE.Vector3(-6, 2, -14), 18, tint, 0.12))
      scene.add(nebula(new THREE.Vector3(7, -3, -18), 20, tint, 0.08))
      const list = systems.find((s) => s.area === area)?.stars ?? []
      const anchors: Anchor[] = []
      const bodies = list.map((star, i) => {
        const n = list.length
        const angle = (i / Math.max(1, n)) * Math.PI * 2 + 0.5
        const r = n === 1 ? 0 : 0.78 + 0.32 * (((hash(star.id) >>> 0) % 10) / 10)
        const p = new THREE.Vector3(Math.cos(angle) * r, ((i % 3) - 1) * 0.24, Math.sin(angle) * r)
        const body = buildHabitStar(star.kind, hash(star.id) >>> 0, { glow, sun: sunTex, rays: raysTex })
        body.group.position.copy(p)
        scene.add(body.group)
        anchors.push({ id: `star:${star.id}`, pos: () => body.group.position, hit: 0.12, dy: 26 })
        return body
      })
      return {
        ...w,
        anchors,
        update(now) {
          bodies.forEach((b) => b.update(now))
        },
        focus(id) {
          const i = list.findIndex((s) => `star:${s.id}` === id)
          if (i < 0) return null
          const p = bodies[i].group.position.clone()
          const dir = w.camera.position.clone().sub(p).setY(0.25).normalize()
          return { target: p, pos: p.clone().addScaledVector(dir, Math.max(1.2, bodies[i].size * 7)) }
        },
      }
    }

    // ---------- Ekonomi ----------
    const SAVE_POS = new THREE.Vector3(-3.4, 0.7, 2.2)
    const MOONS_POS = new THREE.Vector3(3.4, 0.6, -1.8)
    const buildEconomyWorld = (): World => {
      const w = makeWorld('economy', 52, galaxyHome(52, SPIRAL_R + 0.6), new THREE.Vector3(0, 0, 0))
      const { scene, controls } = w
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.25
      controls.minDistance = 1.2
      controls.maxDistance = 40
      const galaxy = buildSpiral({ seed: 77, radius: SPIRAL_R, count: 15000, inner: '#ffe3b0', outer: '#ffad6a', size: 0.085, twist: TWIST, glow })
      scene.add(galaxy.group)
      scene.add(starfield(1600, 120, 8, glow))
      scene.add(new THREE.AmbientLight('#8090c0', 0.12))
      const sun = new THREE.PointLight('#fff0d8', 40, 0, 2)
      sun.position.set(0, 2.5, 0)
      scene.add(sun)
      scene.add(new THREE.DirectionalLight('#ffe8cc', 1.2))
      const anchors: Anchor[] = []
      let hole: ReturnType<typeof buildBlackHole> | null = null
      if (economy && (economy.debtLeft > 0 || economy.debtMax > 0)) {
        hole = buildBlackHole(holeShare(economy.debtLeft, economy.debtMax), glow)
        hole.group.scale.setScalar(1.15)
        scene.add(hole.group)
        galaxy.core.visible = false
        anchors.push({ id: 'hole', pos: () => new THREE.Vector3(0, 0, 0), hit: 0.14, dy: 46 })
      }
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
            const mesh = o as THREE.Mesh
            mesh.geometry?.dispose()
            ;(mesh.material as THREE.Material | undefined)?.dispose()
          })
        }
        born = buildNewPlanet(p, surfaces[0], glow)
        settle(born.group)
        saveHolder.add(born.group)
      }
      if (economy?.savings) {
        setBorn(economy.savings.current / economy.savings.target)
        scene.add(saveHolder)
        anchors.push({ id: 'save', pos: () => SAVE_POS, hit: 0.14, dy: 34 })
      }
      let moons: ReturnType<typeof buildMoonSystem> | null = null
      if (economy && economy.budget.moons.length) {
        moons = buildMoonSystem(economy.budget.moons, surfaces[2], glow)
        moons.group.position.copy(MOONS_POS)
        moons.group.scale.setScalar(5.5)
        settle(moons.group)
        scene.add(moons.group)
        anchors.push({ id: 'moons', pos: () => MOONS_POS, hit: 0.14, dy: 40 })
      }
      // Önskelistan: en komet per önskan. Det som ryms i månadens överskott ligger nära kärnan.
      const comets = (economy?.wishes ?? []).slice(0, 14).map((wish, i, list) => {
        const reach = wish.months === null ? 1 : wish.months <= 1 ? 0 : Math.min(1, Math.log2(wish.months) / 5)
        const head = sparkle(new THREE.Vector3(), LIST_COLORS[wish.list], 0.45)
        scene.add(head)
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
        geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))
        const tail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
        scene.add(tail)
        return { head, tail, r: 4 + reach * 5, a: (i / Math.max(1, list.length)) * Math.PI * 2 + 0.4, y: 0.6 + (i % 3) * 0.35 }
      })
      if (comets.length) anchors.push({ id: 'wish', pos: () => comets[0].head.position, hit: 0.12 })
      // Tillgångarna: hela galaxen lyser starkare ju större nettot är.
      const halo = sparkle(new THREE.Vector3(), '#ffd9a8', SPIRAL_R * 3.2, 0)
      scene.add(halo)
      const coreScale = galaxy.core.scale.x
      const setWorth = (net: number) => {
        const g = THREE.MathUtils.clamp((Math.log10(Math.max(1000, net)) - 3) / 3, 0, 1)
        galaxy.core.scale.setScalar(coreScale * (0.85 + 0.4 * g))
        halo.material.opacity = 0.04 + 0.14 * g
      }
      setWorth(economy?.worth.net ?? 0)
      applyFutureRef.current = (k: number) => {
        if (!economy) return
        const point = economy.timeline[Math.min(k, economy.timeline.length - 1)]
        hole?.setShare(holeShare(point.loanLeft, economy.debtMax))
        if (economy.savings && point.goalSaved !== null) setBorn(point.goalSaved / economy.savings.target)
        setWorth(point.net)
      }
      applyFutureRef.current(futureRef.current)
      const tmp = new THREE.Vector3()
      return {
        ...w,
        anchors,
        update(now) {
          galaxy.group.rotation.y = now / 90000
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
        },
        focus(id) {
          if (id === 'hole' && hole) return { target: new THREE.Vector3(0, -0.5, 0), pos: new THREE.Vector3(0, 1.8, 7.5) }
          if (id === 'save') return { target: SAVE_POS.clone().add(new THREE.Vector3(0, -0.15, 0)), pos: SAVE_POS.clone().add(new THREE.Vector3(0.6, 1.1, 2.6)) }
          if (id === 'moons') return { target: MOONS_POS.clone().add(new THREE.Vector3(0, -0.35, 0)), pos: MOONS_POS.clone().add(new THREE.Vector3(-0.6, 1.5, 3.3)) }
          return null
        },
        dispose: () => hole?.dispose(),
      }
    }

    // ---------- Rymdbasen ----------
    const buildBaseWorld = (): World => {
      const w = makeWorld('base', 55, new THREE.Vector3(0.32, 0.26, 0.92), new THREE.Vector3(0, -0.02, 0))
      const { scene, camera, controls } = w
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.25
      controls.minDistance = 0.02
      controls.maxDistance = 3.5
      controls.zoomToCursor = true
      // Astronauterna som bockat sedan sist kommer ut ur luckan nu.
      const station = buildStation(built, nextModule, crew, crewArrivals(crew, today))
      settle(station.group)
      scene.add(station.group)
      const sunDir = new THREE.Vector3(1.2, 0.8, 0.6).normalize()
      const light = new THREE.DirectionalLight('#fff0d8', 2.8)
      light.position.copy(sunDir).multiplyScalar(10)
      scene.add(light)
      scene.add(new THREE.AmbientLight('#8090c0', 0.12))
      const fill = new THREE.DirectionalLight('#9fb4ff', 0.35)
      camera.add(fill)
      // Jorden långt under stationen
      const earth = buildEarth(6)
      earth.group.position.set(0, -7.4, -1.5)
      earth.setSun(sunDir)
      scene.add(earth.group)
      scene.add(starfield(2000, 90, 21, glow))
      const anchors: Anchor[] = station.crew.pickables.map((p) => ({ id: `crew:${p.idx}`, pos: () => p.obj.getWorldPosition(new THREE.Vector3()), hit: 0.07 }))
      return {
        ...w,
        anchors,
        update(now) {
          station.group.rotation.y = now / 14000
          for (const r of station.spin) r.rotation.x = now / 5000
          if (station.beacon) (station.beacon.material as THREE.MeshBasicMaterial).opacity = Math.sin(now / 400) > 0.6 ? 1 : 0.2
          station.crew.update(now, 1)
          earth.update(now)
          // Närmaste klippplanet följer med in, så att inget skärs bort på nära håll.
          const near = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.04, 0.0006, 0.05)
          if (Math.abs(camera.near - near) > 1e-5) {
            camera.near = near
            camera.updateProjectionMatrix()
          }
        },
        focus(id) {
          const pick = station.crew.pickables.find((p) => `crew:${p.idx}` === id)
          if (!pick) return null
          const at = pick.obj.getWorldPosition(new THREE.Vector3())
          const dir = camera.position.clone().sub(at).normalize()
          return { target: at, pos: at.clone().addScaledVector(dir, 0.09), follow: pick.obj }
        },
        dispose: () => station.crew.dispose(),
      }
    }

    // Vyerna byggs först när man åker dit.
    const worlds = new Map<LevelKey, World>()
    const getWorld = (key: LevelKey): World => {
      let w = worlds.get(key)
      if (w) return w
      const area = areaOfKey(key)
      w =
        key === 'earth'
          ? buildEarthWorld()
          : key === 'health'
            ? buildHealthWorld()
            : key === 'economy'
              ? buildEconomyWorld()
              : key === 'base'
                ? buildBaseWorld()
                : buildSystemWorld(area ?? '')
      worlds.set(key, w)
      return w
    }

    // Finns inte området längre (vanan bytte område) går vi till Hälsa.
    let startKey = levelRef.current
    const startArea = areaOfKey(startKey)
    if (startArea && !systems.some((s) => s.area === startArea)) {
      startKey = 'health'
      setLevel('health')
    }
    let active = getWorld(startKey)
    active.controls.enabled = true

    // Övergång mellan vyer: kameran flyger mot det du tryckte på, bilden tonas till svart,
    // och nästa vy glider in från lite längre bort.
    let trans: { from: World; to: World; t0: number; via: THREE.Vector3 | null; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 } | null = null
    const OUT = 520
    const IN = 900
    let flight: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number; follow?: THREE.Object3D } | null = null
    let follow: THREE.Object3D | null = null
    const go = (key: LevelKey, viaId?: string) => {
      if (trans) return
      const to = getWorld(key)
      if (to === active) return
      const via = viaId ? (active.anchors.find((a) => a.id === viaId)?.pos().clone() ?? null) : null
      flight = null
      follow = null
      active.controls.enabled = false
      // Nästa vy börjar en bit bakom sitt startläge (inåt när man åker in, utåt när man åker tillbaka).
      const target = to.home.target.clone()
      const homePos = to.home.pos.clone()
      const startPos = target.clone().add(homePos.clone().sub(target).multiplyScalar(via ? 1.9 : 0.55))
      to.camera.position.copy(startPos)
      to.controls.target.copy(target)
      trans = { from: active, to, t0: performance.now(), via, fromPos: active.camera.position.clone(), fromTarget: active.controls.target.clone(), toPos: homePos, toTarget: target }
    }
    const focus = (id: string | null) => {
      if (trans) return
      const f = id ? active.focus?.(id) : null
      const dest = f ?? { pos: active.home.pos.clone(), target: active.home.target.clone() }
      flight = { from: active.camera.position.clone(), to: dest.pos, fromT: active.controls.target.clone(), toT: dest.target, start: performance.now(), follow: f?.follow }
      active.controls.autoRotate = !id
    }
    apiRef.current = { go, focus }

    // Tryck (inte drag) på något i vyn.
    let down = { x: 0, y: 0 }
    let dragging = false
    const pointer = new THREE.Vector2()
    const tmp = new THREE.Vector3()
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      dragging = true
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      if (trans || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      let best: { id: string; d: number } | null = null
      for (const a of active.anchors) {
        const p = tmp.copy(a.pos()).project(active.camera)
        const d = Math.hypot(p.x - pointer.x, p.y - pointer.y)
        if (p.z < 1 && d < (a.hit ?? 0.12) && (!best || d < best.d)) best = { id: a.id, d }
      }
      if (best) pickRef.current(best.id)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      for (const w of worlds.values()) {
        w.camera.aspect = aspect()
        w.camera.updateProjectionMatrix()
      }
    }
    window.addEventListener('resize', onResize)

    const ease = (k: number) => k * k * (3 - 2 * k)
    let viewShift = 0
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const now = performance.now()
      let world = active
      let fade = 0
      if (trans) {
        const t = now - trans.t0
        if (t < OUT) {
          // Ut: flyg mot det du tryckte på (eller backa) medan bilden tonas ner
          const k = ease(t / OUT)
          world = trans.from
          const dest = trans.via
            ? trans.via.clone().add(trans.fromPos.clone().sub(trans.via).multiplyScalar(0.18))
            : trans.fromPos.clone().add(trans.fromPos.clone().sub(trans.fromTarget).multiplyScalar(0.8))
          world.camera.position.lerpVectors(trans.fromPos, dest, k)
          world.controls.target.lerpVectors(trans.fromTarget, trans.via ?? trans.fromTarget, k)
          fade = k
        } else {
          // In: nästa vy glider fram till sitt startläge medan bilden tonas upp
          const k = ease(Math.min(1, (t - OUT) / IN))
          world = trans.to
          if (active !== trans.to) {
            // Den gamla vyn lämnas där den började, så att man kommer tillbaka till samma bild.
            trans.from.camera.position.copy(trans.fromPos)
            trans.from.controls.target.copy(trans.fromTarget)
            active = trans.to
            setLevel(trans.to.key)
          }
          const start = trans.toTarget.clone().add(trans.toPos.clone().sub(trans.toTarget).multiplyScalar(trans.via ? 1.9 : 0.55))
          world.camera.position.lerpVectors(start, trans.toPos, k)
          world.controls.target.copy(trans.toTarget)
          fade = 1 - k
          if (k >= 1) {
            trans = null
            world.controls.enabled = true
          }
        }
        world.camera.lookAt(world.controls.target)
      } else if (flight) {
        const k = ease(Math.min(1, (now - flight.start) / 1100))
        active.camera.position.lerpVectors(flight.from, flight.to, k)
        active.controls.target.lerpVectors(flight.fromT, flight.toT, k)
        if (k >= 1) {
          follow = flight.follow ?? null
          flight = null
        }
      } else if (follow) {
        // Följ astronauten du tryckt på medan stationen snurrar.
        const d = follow.getWorldPosition(tmp).sub(active.controls.target)
        active.controls.target.add(d)
        active.camera.position.add(d)
      }
      world.update(now)
      if (!trans) world.controls.update()
      // Panelen täcker nedre delen – flytta bilden uppåt när något är valt.
      viewShift += ((panelShown.current ? 0.2 : 0) - viewShift) * 0.08
      world.camera.setViewOffset(mount.clientWidth, mount.clientHeight, 0, mount.clientHeight * viewShift, mount.clientWidth, mount.clientHeight)
      if (fadeRef.current) fadeRef.current.style.opacity = String(fade)
      // Etiketterna följer med det de sitter på.
      for (const [id, el] of labelEls.current) {
        const a = world.anchors.find((x) => x.id === id)
        if (!a) {
          el.style.opacity = '0'
          continue
        }
        const p = tmp.copy(a.pos()).project(world.camera)
        const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1
        el.style.opacity = visible ? String(1 - fade) : '0'
        el.style.pointerEvents = visible && fade < 0.2 ? 'auto' : 'none'
        // Under punkten, men aldrig utanför skärmens kanter
        const half = el.offsetWidth / 2
        const x = THREE.MathUtils.clamp(((p.x + 1) / 2) * mount.clientWidth, half + 6, Math.max(half + 6, mount.clientWidth - half - 6))
        el.style.transform = `translate(${x - half}px, ${((1 - p.y) / 2) * mount.clientHeight + (a.dy ?? 12)}px)`
      }
      renderer.render(world.scene, world.camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      apiRef.current = null
      applyFutureRef.current = null
      for (const w of worlds.values()) {
        viewsRef.current.set(w.key, { pos: w.camera.position.clone(), target: w.controls.target.clone() })
        w.controls.dispose()
        w.dispose?.()
        w.scene.traverse((o) => {
          const obj = o as THREE.Mesh
          obj.geometry?.dispose()
          ;(obj.material as THREE.Material | undefined)?.dispose()
        })
      }
      textures.forEach((t) => t.dispose())
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, systems, economy, built, nextModule, crew, satCount, today])

  // Tryck på något i vyn (eller på en etikett)
  const pick = (id: string) => {
    const api = apiRef.current
    if (!api) return
    if (level === 'earth') {
      if (id === 'health' || id === 'economy' || id === 'base') {
        setEco(null)
        setStarSel(null)
        setCrewSel(null)
        api.go(id, id)
      }
    } else if (level === 'health') {
      if (id.startsWith('system:')) {
        setStarSel(null)
        api.go(id as LevelKey, id)
      }
    } else if (level.startsWith('system:')) {
      if (id.startsWith('star:')) {
        const habitId = id.slice(5)
        const again = starSel === habitId
        setStarSel(again ? null : habitId)
        api.focus(again ? null : id)
      }
    } else if (level === 'economy') {
      if (id === 'hole' || id === 'save' || id === 'moons' || id === 'wish' || id === 'worth') openEco(id)
    } else if (level === 'base') {
      if (id.startsWith('crew:')) {
        setCrewSel(Number(id.slice(5)))
        api.focus(id)
      }
    }
  }
  pickRef.current = pick

  const openEco = (id: EcoId) => {
    setEco(id)
    apiRef.current?.focus(id === 'wish' || id === 'worth' ? null : id)
  }
  const closeEco = () => {
    setEco(null)
    apiRef.current?.focus(null)
  }
  const back = () => {
    const api = apiRef.current
    if (!api) return
    setStarSel(null)
    setEco(null)
    setCrewSel(null)
    api.go(level.startsWith('system:') ? 'health' : 'earth')
  }
  /** "Nästa: Gym" på startbilden: flyg till vanans solsystem och visa stjärnan. */
  const showHabit = (habit: Habit) => {
    const api = apiRef.current
    if (!api) return
    setStarSel(habit.id)
    api.go(systemKey(areaOf(habit)))
  }

  const area = areaOfKey(level)
  const system = area ? systems.find((s) => s.area === area) : undefined
  const chosen = starSel ? stars.find((s) => s.id === starSel) : undefined
  const totalHabits = stars.length
  const working = crew.members.filter((m) => m.working).length
  const periodText = period === 'now' ? 'Nu' : capital(monthName(period, today))

  // Etiketter i vyn: text som följer med det den sitter på.
  const labels: { id: string; title: string; sub: string; tone?: string }[] =
    level === 'earth'
      ? [
          { id: 'health', title: 'Hälsa', sub: score.total ? `${score.done} av ${score.total} vanor idag` : `${totalHabits} vanor` },
          {
            id: 'economy',
            title: 'Ekonomi',
            sub: economy?.savings
              ? `Sparmål ${Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))} %`
              : economy
                ? `Netto ${kr(economy.worth.net)}`
                : 'Kunde inte läsas',
          },
          { id: 'base', title: 'Rymdbas', sub: `${built.size}/${milestones.length} moduler · ${working} ute`, tone: 'base' },
        ]
      : level === 'health'
        ? systems.map((s) => ({
            id: systemKey(s.area),
            title: s.area,
            sub: `${s.stars.length} ${s.stars.length === 1 ? 'vana' : 'vanor'}${s.pct !== null ? ` · ${s.pct} %` : ''}`,
          }))
        : system
          ? system.stars.map((s) => ({
              id: `star:${s.id}`,
              title: s.name,
              sub: `${s.pct !== null ? `${s.pct} %` : 'ny'}${s.streak > 1 ? ` · ${s.streak} i rad` : ''}`,
            }))
          : level === 'economy' && economy
            ? [
                ...(economy.debtLeft > 0 || economy.debtMax > 0 ? [{ id: 'hole', title: 'Skulder', sub: economy.debtLeft > 0 ? kr(economy.debtLeft) : 'Skuldfria' }] : []),
                ...(economy.savings
                  ? [{ id: 'save', title: economy.savings.name, sub: `${Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))} %` }]
                  : []),
                ...(economy.budget.moons.length ? [{ id: 'moons', title: 'Budget', sub: `${kr(economy.budget.paid)} av ${kr(economy.budget.total)}` }] : []),
                ...(economy.wishes.length ? [{ id: 'wish', title: 'Önskningar', sub: `${economy.wishes.length} st` }] : []),
              ]
            : []

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
        <p className="cv-sub">
          {score.week ? 'Inget måste idag · veckans mål' : `Vanor ${score.done}/${score.total} idag`}
          {tasksToday.total > 0 && ` · Att göra ${tasksToday.done}/${tasksToday.total}`}
        </p>
        {score.next && (
          <button type="button" className="cv-next" onClick={() => showHabit(score.next!)}>
            <span>Nästa</span> {score.next.name} ›
          </button>
        )}
      </div>
    ) : (
      <div className="cv-hero">
        <button type="button" className="cv-backlink" onClick={back}>
          ‹ {area ? 'Hälsogalaxen' : 'Jorden'}
        </button>
        <span className="cv-eyebrow">{area ? 'Solsystem · Hälsa' : level === 'base' ? 'Rymdbas · i bana runt Jorden' : `Galax · ${level === 'health' ? 'Hälsa' : 'Ekonomi'}`}</span>
        <h2>{area ? area : level === 'health' ? 'Hälsogalaxen' : level === 'economy' ? 'Ekonomigalaxen' : 'Rymdbasen'}</h2>
        <p className="cv-sub">
          {area
            ? system?.summary || 'Inga vanor här än'
            : level === 'health'
              ? `${systems.length} solsystem · ${totalHabits} ${totalHabits === 1 ? 'vana' : 'vanor'}`
              : level === 'economy'
                ? economy
                  ? `Netto ${kr(economy.worth.net)}`
                  : 'Ekonomin kunde inte läsas'
                : `${built.size} av ${milestones.length} moduler · ${working} ${working === 1 ? 'astronaut' : 'astronauter'} ute`}
        </p>
        <p className="cv-tip">
          {area
            ? 'Varje stjärna är en vana. Tryck på en för detaljer.'
            : level === 'health'
              ? 'Tryck på ett solsystem för att flyga dit. Dra för att snurra, nyp för att zooma.'
              : level === 'economy'
                ? 'Tryck på något för att se siffrorna.'
                : 'Nyp för att zooma ända fram. Tryck på en astronaut.'}
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
            <small>{l.sub}</small>
          </button>
        ))}
      </div>
      <div className="cv-fade" ref={fadeRef} aria-hidden="true" />
      <header className="gv-top cv-top">
        {header}
        <div className="gv-actions">
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

      {guideOpen ? (
        <CosmosGuide onClose={closeGuide} />
      ) : level === 'economy' && economy && eco ? (
        <EconomyPanel id={eco} economy={economy} future={future} today={today} onBack={closeEco} />
      ) : level === 'economy' ? (
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
      ) : level === 'base' ? (
        <BasePanel milestones={milestones} crew={crew} crewSel={crewSel} today={today} />
      ) : area && chosen ? (
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
                apiRef.current?.focus(null)
              }}
            >
              Stäng
            </button>
          </div>
        </section>
      ) : level === 'health' || area ? (
        <div className="gv-bottom">
          <p className="gv-hint">
            {period === 'now' ? 'Stjärnorna visar de senaste veckorna.' : `Stjärnorna visar ${monthName(period, today)}.`} Välj en månad för att se hur det
            såg ut då.
          </p>
          {periodChips}
          {period !== 'now' && <span className="cv-period-now">Visar: {periodText}</span>}
        </div>
      ) : (
        <div className="gv-bottom">
          <p className="gv-hint">Tryck på en galax för att flyga dit, eller på rymdbasen.</p>
        </div>
      )}
    </div>,
    document.body,
  )
}
