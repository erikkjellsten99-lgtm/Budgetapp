// Din galax i 3D: varje månad är ett solsystem i en spiralgalax som växer utåt för varje månad,
// och varje bock är en stjärna i armen. Börjar aldrig om. Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { isoWeek, weekStart, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { planetColor, planetKind, type PlanetKind } from './planets'
import { baseMilestones, monthSatellites, nextMilestone, type ModuleKind } from './space'
import type { Task } from './tasks'
import { galaxyMonths, monthName, monthOfWeek, monthPlanets, type MonthPlanet } from './progress'

interface Props {
  habits: Habit[]
  log: Log
  paused: Paused
  today: DateKey
  /** Att göra-saker: de avklarade blir satelliter. */
  tasks: Task[]
  onClose: () => void
}

/** Rymdbasen har index -1 där månaderna har 0, 1, 2 … */
const BASE = -1
const BASE_POS = new THREE.Vector3(0, 2.4, 0)

/** Slumptal med frö, så att galaxen ser likadan ut varje gång den öppnas. */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** Plats längs spiralarmen för månad nummer t (0 = första månaden, nära kärnan). */
function armPoint(t: number) {
  const arm = Math.round(t) % 2
  const angle = 0.9 + t * 0.62 + arm * Math.PI
  const r = 2.2 + t * 0.9
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, r, angle }
}

/** Mjuk rund ljuspunkt som textur för stjärnor och solsystem. */
function glowTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,244,220,0.85)')
  g.addColorStop(0.45, 'rgba(255,214,150,0.22)')
  g.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Tunn ljusring som markerar var ett solsystem (en månad) ligger. */
function ringTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Enkelt brus (värdebrus med frö) för planetytor och solens yta. */
function noise2(seed: number) {
  const rand = seeded(seed)
  const size = 64
  const grid = Array.from({ length: size * size }, () => rand())
  const at = (x: number, y: number) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const one = (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
    return a + (b - a) * fy
  }
  // Flera lager (fbm) ger naturligare mönster
  return (x: number, y: number) => {
    let v = 0
    let amp = 0.5
    let f = 1
    for (let o = 0; o < 4; o++) {
      v += one(x * f, y * f) * amp
      amp /= 2
      f *= 2
    }
    return v
  }
}


/**
 * Ytan för en planet som gråskala (färgen kommer från vanans färg, så att den matchar listan i panelen):
 * band på gasjättar, kontinenter och moln på den jordlika, kratrar på den steniga.
 */
function planetTexture(kind: PlanetKind, seed: number): THREE.Texture {
  const W = 256
  const H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const n = noise2(seed)
  const n2 = noise2(seed + 99)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * 8
      const v = (y / H) * 4
      let g = 0.8
      if (kind === 'gas' || kind === 'ring') {
        // Band som slingrar sig lite, ljusare och mörkare
        const warp = n(u * 0.6, v * 2) * 1.6
        g = 0.62 + 0.3 * Math.sin(v * 7 + warp * 2) + 0.12 * (n2(u * 2, v * 6) - 0.5)
      } else if (kind === 'ocean') {
        const land = n(u * 0.7, v * 0.9)
        const cloud = n2(u * 1.4 + v, v * 2.2)
        g = land > 0.55 ? 0.55 + (land - 0.55) * 1.2 : 0.38 + land * 0.2
        if (cloud > 0.58) g = Math.min(1, g + (cloud - 0.58) * 3.2)
      } else if (kind === 'rock') {
        g = 0.55 + (n(u * 1.2, v * 1.2) - 0.5) * 0.7 + (n2(u * 5, v * 5) - 0.5) * 0.25
      } else {
        g = 0.82 + 0.1 * Math.sin(v * 5 + n(u, v) * 2) + (n2(u * 3, v * 3) - 0.5) * 0.12
      }
      // Polerna lite ljusare på de flesta
      const pole = Math.abs(y / H - 0.5) * 2
      if (kind !== 'gas' && kind !== 'ring' && pole > 0.86) g = Math.min(1, g + (pole - 0.86) * 3)
      const c = Math.max(0, Math.min(255, g * 255))
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

/** Solens yta: granulering i gult och orange. */
function sunTexture(): THREE.Texture {
  const W = 256
  const H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const n = noise2(7)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = n((x / W) * 24, (y / H) * 12)
      const i = (y * W + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 190 + g * 60
      img.data[i + 2] = 90 + g * 90
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Solens strålar, som från en kameralins: tunna avsmalnande streck. */
function raysTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.translate(size / 2, size / 2)
  for (const [angle, len, width, alpha] of [
    [0, 1, 2, 0.9],
    [Math.PI / 2, 0.55, 1.6, 0.55],
    [0.55, 0.4, 1, 0.4],
    [Math.PI - 0.55, 0.4, 1, 0.4],
  ]) {
    ctx.save()
    ctx.rotate(angle)
    const g = ctx.createLinearGradient((-size / 2) * len, 0, (size / 2) * len, 0)
    g.addColorStop(0, 'rgba(255,240,210,0)')
    g.addColorStop(0.5, `rgba(255,248,230,${alpha})`)
    g.addColorStop(1, 'rgba(255,240,210,0)')
    ctx.fillStyle = g
    ctx.fillRect((-size / 2) * len, -width / 2, size * len, width)
    ctx.restore()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Saturnusringar: ljusa och mörka band, genomskinliga. */
function ringBandTexture(): THREE.Texture {
  const W = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  const n = noise2(3)
  for (let x = 0; x < W; x++) {
    const t = x / W
    const a = (0.25 + 0.6 * n(t * 30, 0.5)) * Math.sin(t * Math.PI) * (t > 0.62 && t < 0.67 ? 0.1 : 1)
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.fillRect(x, 0, 1, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}


/** Antal punkter i en komets svans. */
const TRAIL = 28

/** Plats på en komets lutande ellipsbana vid vinkeln `a` (solen i ena brännpunkten). */
function cometPoint(c: { a: number; b: number; tilt: number }, angle: number, out: THREE.Vector3) {
  const focus = Math.sqrt(c.a * c.a - c.b * c.b)
  const x = Math.cos(angle) * c.a - focus
  const z = Math.sin(angle) * c.b
  return out.set(x * Math.cos(c.tilt) - z * Math.sin(c.tilt), Math.sin(angle) * 0.05, x * Math.sin(c.tilt) + z * Math.cos(c.tilt))
}

/** Avstånd där ett solsystems planeter börjar synas, och där man räknas som "inne i" det. */
const DETAIL_FROM = 5
const INSIDE = 2.2

const GUIDE_KEY = 'vanor-galax-guide'
const guideSeen = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** "Så funkar din galax": visas första gången galaxen öppnas och sedan via ?-knappen. */
function GalaxyGuide({ onClose }: { onClose: () => void }) {
  return (
    <section className="gv-guide" role="dialog" aria-labelledby="gv-guide-title">
      <h3 id="gv-guide-title">Så funkar din galax</h3>
      <dl>
        <div>
          <dt>
            <i className="gv-ico star" aria-hidden="true" />
            Stjärna
          </dt>
          <dd>Varje bock du gör blir en stjärna i armen, vid månaden den hör till.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico ring" aria-hidden="true" />
            Solsystem
          </dt>
          <dd>Varje månad blir ett solsystem längs spiralarmen. Den första ligger närmast kärnan. Ju bättre månad, desto starkare lyser den. Galaxen börjar aldrig om.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico planet" aria-hidden="true" />
            Planet
          </dt>
          <dd>Inne i ett solsystem är varje planet en vana. Den är större ju mer av målet du klarade den månaden, och lyser om du klarade målet varje vecka.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico sat" aria-hidden="true" />
            Satellit
          </dt>
          <dd>Varje Att göra-sak du bockar av skjuts upp som en satellit runt månadens solsystem.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico base" aria-hidden="true" />
            Rymdbas
          </dt>
          <dd>Stationen ovanför kärnan är du, över hela tiden. Den byggs ut med en ny modul för varje milstolpe och kan bara växa.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico comet" aria-hidden="true" />
            Komet
          </dt>
          <dd>7 dagar i rad på en vana ger en komet som flyger runt solen.</dd>
        </div>
      </dl>
      <p className="gv-guide-how">Dra för att snurra. Nyp eller zooma mot en ring för att flyga in. Tryck på en planet för att se vanan.</p>
      <button type="button" className="gv-guide-ok" onClick={onClose}>
        Uppfattat
      </button>
    </section>
  )
}

/** "2026-10-05" → "5 okt". */
const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const shortDate = (d: string, today: string) =>
  `${Number(d.slice(8))} ${SHORT_MONTHS[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== today.slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}`

const metal = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6, transparent: true, ...extra })

/** En liten satellit: kropp med två solpaneler. */
function makeSatellite(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.011), metal('#e8ecf4')))
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0008, 0.007), metal('#3d66c4', { metalness: 0.3, roughness: 0.3 }))
    panel.position.x = side * 0.014
    g.add(panel)
  }
  return g
}

/**
 * Rymdbasen: en station som byggs av de moduler du har låst upp. Varje milstolpe lägger till en del,
 * så att stationen syns växa över tid. Utan bockar visas bara en tunn byggplats.
 */
function buildStation(built: Set<ModuleKind>) {
  const group = new THREE.Group()
  const spin: THREE.Object3D[] = []
  let beacon: THREE.Mesh | null = null
  const add = (mesh: THREE.Object3D, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }
  const tube = (r: number, len: number, color: string) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), metal(color))
    m.rotation.z = Math.PI / 2
    return m
  }
  if (!built.has('core')) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#7fe0ff', wireframe: true, transparent: true })))
    return { group, spin, beacon }
  }
  // Kärnmodulen: en lång tub med noder i ändarna
  add(tube(0.018, 0.14, '#dfe4ee'))
  add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 16), metal('#c9d0dc')), 0.075)
  add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 16), metal('#c9d0dc')), -0.075)
  const panels = (x: number) => {
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 8), metal('#aab3c2'))
      arm.rotation.x = Math.PI / 2
      add(arm, x, 0, side * 0.035)
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.0015, 0.09), metal('#2f5fc7', { metalness: 0.35, roughness: 0.25 }))
      add(panel, x, 0, side * 0.1)
    }
  }
  if (built.has('panel')) panels(0.03)
  if (built.has('panel2')) panels(-0.03)
  if (built.has('antenna')) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.06, 8), metal('#c9d0dc')), 0.075, 0.05)
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3), metal('#f2f4f8', { side: THREE.DoubleSide }))
    dish.rotation.x = Math.PI
    add(dish, 0.075, 0.09)
  }
  if (built.has('dock')) {
    add(tube(0.012, 0.04, '#b9c1cf'), -0.115)
    const port = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 10, 24), metal('#ffcf7a'))
    port.rotation.y = Math.PI / 2
    add(port, -0.137)
  }
  if (built.has('habitat')) {
    const hab = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 24), metal('#f4f1ea', { metalness: 0.2, roughness: 0.6 }))
    add(hab, 0.075, -0.055)
  }
  if (built.has('greenhouse')) {
    add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 24, 16),
        new THREE.MeshStandardMaterial({ color: '#7fe0a0', roughness: 0.1, metalness: 0, transparent: true, emissive: '#1f6b3a', emissiveIntensity: 0.4 }),
      ),
      -0.075,
      -0.05,
    )
  }
  if (built.has('telescope')) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.06, 20), metal('#2b2f3a', { metalness: 0.8 }))
    scope.rotation.z = -0.6
    add(scope, -0.04, 0.04)
  }
  if (built.has('ring')) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.005, 12, 64), metal('#dfe4ee'))
    ring.rotation.y = Math.PI / 2
    const holder = new THREE.Group()
    holder.add(ring)
    for (let k = 0; k < 4; k++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.22, 6), metal('#aab3c2'))
      spoke.rotation.x = (k * Math.PI) / 4
      holder.add(spoke)
    }
    spin.push(add(holder))
  }
  if (built.has('sail')) {
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), metal('#ffcf7a', { side: THREE.DoubleSide, metalness: 0.9, roughness: 0.2 }))
    sail.rotation.y = Math.PI / 2
    add(sail, -0.2)
  }
  if (built.has('beacon')) {
    beacon = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true }))
    add(beacon, 0, 0.03)
  }
  return { group, spin, beacon }
}

export default function GalaxyView({ habits, log, paused, today, tasks, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const months = useMemo(() => galaxyMonths(habits, log, paused, today), [habits, log, paused, today])
  const [selected, setSelected] = useState<number | null>(null)
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen())
  const closeGuide = () => {
    setGuideOpen(false)
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      // Utan lagring visas guiden igen nästa gång – inget mer händer.
    }
  }
  const panelShown = useRef(false)
  panelShown.current = selected !== null
  // Vald planet (vana) i det solsystem man är i.
  const [planetSel, setPlanetSel] = useState<number | null>(null)
  const planetSelRef = useRef<number | null>(null)
  planetSelRef.current = planetSel
  useEffect(() => setPlanetSel(null), [selected])
  const planets = useMemo(() => months.map((m) => monthPlanets(habits, log, paused, today, m.month)), [months, habits, log, paused, today])
  const sats = useMemo(() => months.map((m) => monthSatellites(tasks, m.month)), [months, tasks])
  const milestones = useMemo(() => baseMilestones(habits, log, paused, today), [habits, log, paused, today])
  const built = useMemo(() => new Set(milestones.filter((m) => m.done).map((m) => m.id)), [milestones])
  const flyToRef = useRef<((index: number | null) => void) | null>(null)
  const totalStars = months.reduce((s, m) => s + m.checks, 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const n = Math.max(1, months.length)
    const rMax = armPoint(n - 1).r + 2.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x03050c)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.05, 600)
    // Avstånd så att hela galaxen får plats på bredden, även på en smal telefon. Sedd snett ovanifrån.
    const homeFor = (aspect: number) => {
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(55 / 2)) * aspect)
      const d = (rMax / Math.tan(half)) * 0.9
      const tilt = THREE.MathUtils.degToRad(38)
      return new THREE.Vector3(0, d * Math.sin(tilt), d * Math.cos(tilt))
    }
    const home = homeFor(mount.clientWidth / mount.clientHeight)
    camera.position.copy(home)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.6
    controls.maxDistance = home.length() * 1.6
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enablePan = false

    const glow = glowTexture()
    const ringTex = ringTexture()
    const sunTex = sunTexture()
    const raysTex = raysTexture()
    const bandTex = ringBandTexture()
    // En yta per vana (samma vana ser likadan ut i alla månader)
    const surfaces = new Map<number, THREE.Texture>()
    const surfaceFor = (k: number) => {
      if (!surfaces.has(k)) surfaces.set(k, planetTexture(planetKind(k), 100 + k))
      return surfaces.get(k)!
    }
    const rand = seeded(20261029)

    // Galaxens stjärnor: två spiralarmar som når så långt som dina månader – galaxen växer utåt med tiden.
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5
    const warm = new THREE.Color('#ffd9a0')
    const blue = new THREE.Color('#a9c1ff')
    const violet = new THREE.Color('#cdb0ff')
    const c = new THREE.Color()
    const armLength = n - 1 + 3
    const makeLayer = (count: number, size: number, brightness: number, scatter: number) => {
      const pos = new Float32Array(count * 3)
      const col = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const t = Math.pow(rand(), 0.75) * armLength
        const arm = rand() < 0.5 ? 0 : 1
        const angle = 0.9 + t * 0.62 + arm * Math.PI + gauss() * 0.22 * scatter
        const r = Math.max(0.4, 2.2 + t * 0.9 + gauss() * (0.35 + t * 0.04) * scatter)
        const x = Math.cos(angle) * r
        const z = Math.sin(angle) * r
        const y = gauss() * (0.12 + 0.25 * Math.max(0, 1 - r / rMax))
        pos.set([x, y, z], i * 3)
        const k = Math.min(1, r / rMax)
        c.copy(warm).lerp(k < 0.45 ? blue : violet, k < 0.45 ? k / 0.45 : (k - 0.45) / 0.55)
        const dim = brightness * (0.45 + rand() * 0.55)
        col.set([c.r * dim, c.g * dim, c.b * dim], i * 3)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size, vertexColors: true, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      scene.add(points)
      return points
    }
    const dust = makeLayer(Math.min(30000, 9000 + n * 1800), 0.13, 0.5, 2.2)
    const brightArm = makeLayer(Math.min(5000, 1200 + n * 300), 0.24, 0.9, 0.8)
    // Nära blir tusentals ljuspunkter för starka – de tonas ned när du zoomar in.
    const fadeWhenClose = [dust.material, brightArm.material] as THREE.PointsMaterial[]

    // Kärnans bula: tät och varm
    const bulgeCount = 5000
    const bulgePos = new Float32Array(bulgeCount * 3)
    for (let i = 0; i < bulgeCount; i++) {
      const r = Math.abs(gauss()) * 2.1
      const a = rand() * Math.PI * 2
      bulgePos.set([Math.cos(a) * r, gauss() * 0.45 * Math.max(0.2, 1 - r / 2.4), Math.sin(a) * r], i * 3)
    }
    const bulgeGeo = new THREE.BufferGeometry()
    bulgeGeo.setAttribute('position', new THREE.BufferAttribute(bulgePos, 3))
    const bulgeMaterial = new THREE.PointsMaterial({ size: 0.12, color: '#ffdcae', map: glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    scene.add(new THREE.Points(bulgeGeo, bulgeMaterial))
    // Inne i ett solsystem tonas galaxens sken ner så att rymden blir svart runt solen.
    const fadeInside: { m: THREE.Material; base: number }[] = [{ m: bulgeMaterial, base: 0.55 }]

    // Rosa stjärnbildningsområden längs armarna, som i riktiga spiralgalaxer
    for (let i = 0; i < Math.min(40, 6 + n * 2); i++) {
      const p = armPoint(rand() * (armLength - 0.5))
      const neb = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: rand() < 0.7 ? '#ff8fb8' : '#8fb8ff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      neb.position.set(p.x + gauss() * 0.5, 0, p.z + gauss() * 0.5)
      neb.scale.setScalar(1.2 + rand() * 1.6)
      scene.add(neb)
      fadeInside.push({ m: neb.material, base: 0.16 })
    }

    // Kärnan
    const coreSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#ffe2b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }),
    )
    coreSprite.scale.setScalar(5 + Math.min(4, n * 0.15))
    scene.add(coreSprite)
    fadeInside.push({ m: coreSprite.material, base: 0.9 })

    // Dina bockar: en ljus stjärna per bock, nära den månad den hör till.
    const monthIndex = new Map(months.map((m, i) => [m.month, i]))
    const earned: number[] = []
    for (const [date, ids] of Object.entries(log)) {
      const index = monthIndex.get(monthOfWeek(weekStart(date)))
      if (index === undefined) continue
      for (const id of ids) {
        const r2 = seeded(hash(date + id))
        const p = armPoint(index + (r2() - 0.5) * 0.9)
        const spread = 0.5 + p.r * 0.08
        earned.push(p.x + (r2() - 0.5) * spread * 2, (r2() - 0.5) * 0.3, p.z + (r2() - 0.5) * spread * 2)
      }
    }
    const earnedGeo = new THREE.BufferGeometry()
    earnedGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(earned), 3))
    const earnedMaterial = new THREE.PointsMaterial({ size: 0.14, color: '#fff6e6', map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    scene.add(new THREE.Points(earnedGeo, earnedMaterial))

    const rings: THREE.Sprite[] = []
    // Ett solsystem per månad, ljusare ju bättre månaden gick.
    const systems: THREE.Sprite[] = months.map((m, i) => {
      const p = armPoint(i)
      const share = Math.min(1, m.pct / 100)
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: new THREE.Color('#ffd28a').lerp(new THREE.Color('#ffffff'), share * 0.6),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.45 + 0.55 * share,
        }),
      )
      sprite.position.set(p.x, 0.05, p.z)
      sprite.scale.setScalar(0.55 + 1.25 * share)
      sprite.userData.index = i
      sprite.userData.scale = 0.55 + 1.25 * share
      sprite.userData.opacity = 0.45 + 0.55 * share
      scene.add(sprite)
      // Ring runt solsystemet så det syns mot stjärnorna i armen.
      const ring = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: ringTex, color: '#ffd28a', transparent: true, depthWrite: false, opacity: 0.85 }),
      )
      ring.position.copy(sprite.position)
      ring.scale.setScalar(0.9)
      scene.add(ring)
      rings.push(ring)
      return sprite
    })
    const current = systems[systems.length - 1]
    const currentRing = rings[rings.length - 1]

    // Närbild: varje solsystem har en planet per vana som kretsar runt solen. Syns först när man zoomar nära.
    const planetGeo = new THREE.SphereGeometry(1, 48, 32)
    const details = systems.map((sun, i) => {
      const group = new THREE.Group()
      group.position.copy(sun.position)
      group.visible = false
      // Solen: yta med granulering, varm korona och tunna strålar
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.028, 32, 20), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true }))
      group.add(core)
      const corona = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: '#ffc773', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      corona.scale.setScalar(0.22)
      group.add(corona)
      const rays = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: raysTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      rays.scale.setScalar(0.42)
      group.add(rays)
      const list = planets[i]
      const bodies = list.map((planet, k) => {
        const radius = 0.11 + (k * 0.22) / Math.max(1, list.length - 1)
        const orbit = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            Array.from({ length: 96 }, (_, a) => new THREE.Vector3(Math.cos((a / 96) * Math.PI * 2) * radius, 0, Math.sin((a / 96) * Math.PI * 2) * radius)),
          ),
          new THREE.LineBasicMaterial({ color: '#aab4d8', transparent: true, opacity: 0.18, depthWrite: false }),
        )
        group.add(orbit)
        const kind = planetKind(k)
        const mesh = new THREE.Mesh(
          planetGeo,
          new THREE.MeshStandardMaterial({
            color: planetColor(k),
            map: surfaceFor(k),
            roughness: kind === 'ocean' ? 0.55 : 0.9,
            metalness: 0,
            emissive: planetColor(k),
            emissiveIntensity: 0.02,
            transparent: true,
          }),
        )
        mesh.rotation.z = 0.25 + (k % 3) * 0.12 // lutande axel
        const size = 0.009 + 0.016 * planet.share
        mesh.scale.setScalar(size)
        group.add(mesh)
        // Ringar på ringplaneten
        if (kind === 'ring') {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1.4, 2.4, 64, 1),
            new THREE.MeshStandardMaterial({ color: planetColor(k), map: bandTex, alphaMap: bandTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }),
          )
          // Ringens textur går från inner- till ytterkant
          const uv = ring.geometry.getAttribute('uv') as THREE.BufferAttribute
          const pos = ring.geometry.getAttribute('position') as THREE.BufferAttribute
          for (let v = 0; v < uv.count; v++) {
            const r = Math.hypot(pos.getX(v), pos.getY(v))
            uv.setXY(v, (r - 1.4) / 1.0, 0.5)
          }
          ring.rotation.x = -Math.PI / 2
          mesh.add(ring)
        }
        // Atmosfär på den jordlika: ett tunt blått sken runt kanten
        if (kind === 'ocean') {
          const atmo = new THREE.Mesh(
            planetGeo,
            new THREE.MeshBasicMaterial({ color: '#8fc2ff', transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }),
          )
          atmo.scale.setScalar(1.12)
          mesh.add(atmo)
        }
        // Perfekt månad för vanan (målet klarat varje vecka): planeten får ett eget sken.
        let halo: THREE.Sprite | null = null
        if (planet.weeksTotal > 0 && planet.weeksMet === planet.weeksTotal) {
          halo = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: glow, color: planetColor(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }),
          )
          halo.scale.setScalar(size * 9)
          group.add(halo)
        }
        return { mesh, halo, size, orbit, radius, phase: (hash(planet.id + months[i].month) % 628) / 100, speed: 0.22 / Math.sqrt(radius) }
      })
      // Kometer: en för varje 7 dagar i rad på en vana (högst tre), på långsmala banor runt solen.
      const cometCount = Math.min(3, list.reduce((n, pl) => n + pl.comets, 0))
      const comets = Array.from({ length: cometCount }, (_, c) => {
        const head = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glow, color: '#d8ecff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        )
        head.scale.setScalar(0.05)
        group.add(head)
        const trail = new Float32Array(TRAIL * 3)
        const colors = new Float32Array(TRAIL * 3)
        for (let t = 0; t < TRAIL; t++) {
          const k2 = 1 - t / TRAIL
          colors.set([0.75 * k2, 0.88 * k2, 1 * k2], t * 3)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(trail, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const tail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
        group.add(tail)
        return { head, tail, a: 0.42 + 0.07 * c, b: 0.16 + 0.03 * c, tilt: 0.5 + c * 1.9, speed: 0.35 - c * 0.06, phase: c * 2.1 }
      })
      // Satelliter: en per avklarad Att göra-sak den månaden (högst 12 syns), på lutande banor utanför planeterna.
      const satellites = sats[i].slice(0, 12).map((_, j) => {
        const sat = makeSatellite()
        group.add(sat)
        return { sat, r: 0.36 + (j % 4) * 0.012, tilt: 0.3 + j * 0.9, incline: 0.12 + (j % 3) * 0.08, speed: 0.5 + (j % 5) * 0.06, phase: j * 1.7 }
      })
      scene.add(group)
      return { group, bodies, core, corona, rays, comets, satellites }
    })
    // Rymdbasen ovanför kärnan: en markering på avstånd, stationen syns när man flyger dit.
    const baseRing = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: ringTex, color: '#7fe0ff', transparent: true, depthWrite: false, opacity: 0.9 }),
    )
    baseRing.position.copy(BASE_POS)
    baseRing.scale.setScalar(1.1)
    scene.add(baseRing)
    const baseGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#bfefff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }),
    )
    baseGlow.position.copy(BASE_POS)
    baseGlow.scale.setScalar(0.7)
    scene.add(baseGlow)
    const station = buildStation(built)
    station.group.position.copy(BASE_POS)
    station.group.visible = false
    scene.add(station.group)

    // Svagt omgivningsljus: planeternas nattsida blir nästan svart, som i rymden.
    scene.add(new THREE.AmbientLight('#8090c0', 0.1))
    // Svagt fyllnadsljus från kameran, så att planeterna mellan dig och solen inte blir helt svarta.
    const fill = new THREE.DirectionalLight('#9fb4ff', 0.35)
    camera.add(fill)
    scene.add(camera)
    const sunLight = new THREE.PointLight('#fff0d8', 3.6, 0, 0)
    scene.add(sunLight)

    // Bakgrundsstjärnor långt bort
    const farCount = 1500
    const far = new Float32Array(farCount * 3)
    for (let i = 0; i < farCount; i++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(120 + rand() * 80)
      far.set([v.x, v.y, v.z], i * 3)
    }
    const farGeo = new THREE.BufferGeometry()
    farGeo.setAttribute('position', new THREE.BufferAttribute(far, 3))
    scene.add(new THREE.Points(farGeo, new THREE.PointsMaterial({ size: 0.5, color: '#8f9cc8', transparent: true, opacity: 0.6, depthWrite: false })))

    // Flyg till en månad (eller tillbaka till hela galaxen med null).
    let flight: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number } | null = null
    const posOf = (index: number) => (index === BASE ? BASE_POS : systems[index].position)
    flyToRef.current = (index) => {
      // Vid rymdbasen siktar kameran lite under stationen, så att den syns ovanför den höga panelen.
      const target = index === null ? new THREE.Vector3() : posOf(index).clone().add(new THREE.Vector3(0, index === BASE ? -0.16 : 0, 0))
      const dest =
        index === null
          ? home.clone()
          : target.clone().add(index === BASE ? new THREE.Vector3(0.25, 0.3, 0.85) : new THREE.Vector3(0, 0.95, 1.4))
      flight = { from: camera.position.clone(), to: dest, fromT: controls.target.clone(), toT: target, start: performance.now() }
      controls.autoRotate = index === null
    }

    // Allt man kan flyga till: rymdbasen och varje månad.
    const targets = (): [number, THREE.Vector3][] => [[BASE, BASE_POS], ...systems.map((sun, i): [number, THREE.Vector3] => [i, sun.position])]

    // Tryck (inte drag) på ett solsystem väljer det.
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let down = { x: 0, y: 0 }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      // Inne i ett solsystem: tryck på en planet för att se den vanan.
      if (insideIndex !== null && insideIndex !== BASE) {
        const detail = details[insideIndex]
        let hitPlanet: { k: number; d: number } | null = null
        detail.bodies.forEach((b, k) => {
          const projected = b.mesh.getWorldPosition(tmp).project(camera)
          const d = Math.hypot(projected.x - pointer.x, projected.y - pointer.y)
          if (projected.z < 1 && d < 0.12 && (!hitPlanet || d < hitPlanet.d)) hitPlanet = { k, d }
        })
        const found = hitPlanet as { k: number; d: number } | null
        setPlanetSel(found ? (planetSelRef.current === found.k ? null : found.k) : null)
        if (found) return
      }
      // Sprites är små i 3D – välj den månad som ligger närmast trycket på skärmen.
      let best: { i: number; d: number } | null = null
      for (const [i, pos] of targets()) {
        const projected = pos.clone().project(camera)
        const d = Math.hypot(projected.x - pointer.x, projected.y - pointer.y)
        if (projected.z < 1 && d < 0.18 && (!best || d < best.d)) best = { i, d }
      }
      if (best && best.i !== insideIndex) {
        setSelected(best.i)
        flyToRef.current?.(best.i)
      }
    }

    // Zooma in = dras mot det solsystem du zoomar mot (där fingrarna/musen är, annars mitten av skärmen).
    const zoomPoint = new THREE.Vector2(0, 0)
    const touches = new Map<number, { x: number; y: number }>()
    // Dragningen mot ett solsystem gäller bara medan du själv zoomar (inte när kameran glider av sig själv).
    let zoomingUntil = 0
    const toNdc = (x: number, y: number) => {
      zoomingUntil = performance.now() + 400
      const rect = renderer.domElement.getBoundingClientRect()
      zoomPoint.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
    }
    const onWheel = (e: WheelEvent) => toNdc(e.clientX, e.clientY)
    const onTouchDown = (e: PointerEvent) => touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const onTouchMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2) {
        const [a, b] = [...touches.values()]
        toNdc((a.x + b.x) / 2, (a.y + b.y) / 2)
      }
    }
    const onTouchUp = (e: PointerEvent) => touches.delete(e.pointerId)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })
    renderer.domElement.addEventListener('pointerdown', onTouchDown)
    renderer.domElement.addEventListener('pointermove', onTouchMove)
    window.addEventListener('pointerup', onTouchUp)
    window.addEventListener('pointercancel', onTouchUp)

    const nearestToZoom = () => {
      let best: { i: number; d: number } | null = null
      for (const [i, pos] of targets()) {
        const projected = pos.clone().project(camera)
        if (projected.z >= 1) continue
        const d = Math.hypot(projected.x - zoomPoint.x, projected.y - zoomPoint.y)
        if (!best || d < best.d) best = { i, d }
      }
      return best?.i ?? null
    }
    let lastDistance = camera.position.distanceTo(controls.target)
    let insideIndex: number | null = null
    let viewShift = 0
    const tmp = new THREE.Vector3()
    const offset = new THREE.Vector3()
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    const onResize = () => {
      home.copy(homeFor(mount.clientWidth / mount.clientHeight))
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      if (flight) {
        const k = Math.min(1, (now - flight.start) / 900)
        const e = 1 - Math.pow(1 - k, 3)
        camera.position.lerpVectors(flight.from, flight.to, e)
        controls.target.lerpVectors(flight.fromT, flight.toT, e)
        if (k >= 1) flight = null
      }
      // Den pågående månaden pulserar svagt – den byggs fortfarande.
      // Inzoomning drar kameran mot solsystemet – ju närmare, desto mer centrerat.
      const distance = camera.position.distanceTo(controls.target)
      if (!flight && now < zoomingUntil && distance < lastDistance - 1e-4) {
        const i = nearestToZoom()
        if (i !== null) {
          const pull = Math.min(1, ((lastDistance - distance) / distance) * 1.6)
          offset.subVectors(posOf(i), controls.target).multiplyScalar(pull)
          controls.target.add(offset)
          camera.position.add(offset)
        }
      }
      lastDistance = camera.position.distanceTo(controls.target)

      // Närmaste solsystem: planeterna tonas in, solen lyser upp dem, och månaden visas när man är inne i det.
      let near: { i: number; d: number } | null = null
      systems.forEach((sun, i) => {
        const d = camera.position.distanceTo(sun.position)
        if (!near || d < near.d) near = { i, d }
        const fade = THREE.MathUtils.clamp((DETAIL_FROM - d) / (DETAIL_FROM - INSIDE), 0, 1)
        const detail = details[i]
        detail.group.visible = fade > 0
        if (fade > 0) {
          ;(detail.core.material as THREE.MeshBasicMaterial).opacity = fade
          detail.core.rotation.y = now / 9000
          detail.corona.material.opacity = 0.85 * fade
          detail.rays.material.opacity = 0.7 * fade
          detail.rays.material.rotation = Math.sin(now / 4000) * 0.04
          detail.bodies.forEach((b, k) => {
            const a = b.phase + (now / 1000) * b.speed
            b.mesh.position.set(Math.cos(a) * b.radius, 0, Math.sin(a) * b.radius)
            const picked = i === insideIndex && planetSelRef.current === k
            const material = b.mesh.material as THREE.MeshStandardMaterial
            material.opacity = fade
            material.emissiveIntensity = picked ? 0.12 : 0.02
            b.mesh.rotation.y = now / (2600 + k * 500)
            b.mesh.scale.setScalar(b.size * (picked ? 1.45 : 1))
            if (b.halo) {
              b.halo.position.copy(b.mesh.position)
              b.halo.material.opacity = 0.75 * fade * (0.8 + 0.2 * Math.sin(now / 500 + k))
            }
            ;(b.orbit.material as THREE.LineBasicMaterial).opacity = (picked ? 0.45 : 0.12) * fade
          })
          for (const c of detail.comets) {
            const angle = c.phase + (now / 1000) * c.speed
            cometPoint(c, angle, c.head.position)
            c.head.material.opacity = fade
            const positions = c.tail.geometry.getAttribute('position') as THREE.BufferAttribute
            for (let t = 0; t < TRAIL; t++) {
              cometPoint(c, angle - t * 0.035, tmp)
              positions.setXYZ(t, tmp.x, tmp.y, tmp.z)
            }
            positions.needsUpdate = true
            ;(c.tail.material as THREE.LineBasicMaterial).opacity = 0.55 * fade
          }
          for (const s of detail.satellites) {
            const a = s.phase + (now / 1000) * s.speed
            const x = Math.cos(a) * s.r
            const z = Math.sin(a) * s.r
            s.sat.position.set(x * Math.cos(s.tilt) - z * Math.sin(s.tilt), Math.sin(a) * s.r * s.incline, x * Math.sin(s.tilt) + z * Math.cos(s.tilt))
            s.sat.rotation.set(a * 0.5, a, 0)
            s.sat.traverse((o) => {
              const m = (o as THREE.Mesh).material as THREE.Material | undefined
              if (m) m.opacity = fade
            })
          }
        }
        sun.scale.setScalar(sun.userData.scale * (1 - 0.88 * fade))
        rings[i].material.opacity = 0.85 * (1 - fade)
      })
      // Rymdbasen tonas in på samma sätt när man kommer nära.
      const baseD = camera.position.distanceTo(BASE_POS)
      const baseFade = THREE.MathUtils.clamp((DETAIL_FROM - baseD) / (DETAIL_FROM - INSIDE), 0, 1)
      station.group.visible = baseFade > 0
      if (baseFade > 0) {
        station.group.rotation.y = now / 14000
        for (const r of station.spin) r.rotation.x = now / 5000
        if (station.beacon) (station.beacon.material as THREE.MeshBasicMaterial).opacity = baseFade * (0.4 + 0.6 * (Math.sin(now / 400) > 0.6 ? 1 : 0.2))
        station.group.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined
          if (m && o !== station.beacon) m.opacity = baseFade
        })
      }
      baseRing.material.opacity = 0.9 * (1 - baseFade)
      // Vid rymdbasen tonas månadernas ringar och sken bort, så att stationen står för sig själv.
      rings.forEach((r) => (r.material.opacity *= 1 - baseFade))
      systems.forEach((sun) => (sun.material.opacity = sun.userData.opacity * (1 - 0.9 * baseFade)))
      baseGlow.material.opacity = 0.8 * (1 - baseFade)
      if (!near || baseD < (near as { d: number }).d) near = { i: BASE, d: baseD }

      const maxFade = THREE.MathUtils.clamp((DETAIL_FROM - (near as { d: number } | null ?? { d: 99 }).d) / (DETAIL_FROM - INSIDE), 0, 1)
      const closest = near as { i: number; d: number } | null
      // Solen lyser upp planeterna; vid rymdbasen kommer ljuset från sidan så att stationen får skuggor.
      if (closest) sunLight.position.copy(closest.i === BASE ? tmp.copy(BASE_POS).add(new THREE.Vector3(1.2, 0.8, 0.6)) : systems[closest.i].position)
      const inside =
        closest && closest.d < INSIDE && controls.target.distanceTo(posOf(closest.i)) < 0.3 ? closest.i : null
      if (inside !== insideIndex) {
        insideIndex = inside
        if (!flight) setSelected(inside)
      }

      const beat = 0.5 + 0.5 * Math.sin(now / 600)
      if (current) current.material.opacity = (0.55 + 0.25 * beat) * (1 - 0.9 * baseFade)
      if (currentRing && currentRing.material.opacity > 0.01) currentRing.scale.setScalar(0.85 + 0.3 * beat)
      dust.rotation.y += 0.00015
      const closeness = camera.position.distanceTo(controls.target) / home.length()
      // Inne i ett solsystem tonas galaxens stjärnor ner så att solen och planeterna syns.
      for (const m of fadeWhenClose) m.opacity = Math.min(1, 0.22 + closeness * 1.1) * (1 - 0.92 * maxFade)
      earnedMaterial.opacity = 1 - 0.85 * maxFade
      for (const f of fadeInside) (f.m as THREE.SpriteMaterial).opacity = f.base * (1 - 0.92 * maxFade)
      // Panelen täcker nedre delen – flytta bilden uppåt när en månad visas.
      viewShift += ((panelShown.current ? 0.21 : 0) - viewShift) * 0.08
      camera.setViewOffset(mount.clientWidth, mount.clientHeight, 0, mount.clientHeight * viewShift, mount.clientWidth, mount.clientHeight)
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('pointerdown', onTouchDown)
      renderer.domElement.removeEventListener('pointermove', onTouchMove)
      window.removeEventListener('pointerup', onTouchUp)
      window.removeEventListener('pointercancel', onTouchUp)
      controls.dispose()
      scene.traverse((o) => {
        const obj = o as THREE.Mesh
        obj.geometry?.dispose()
        const mat = obj.material as THREE.Material | undefined
        mat?.dispose()
      })
      glow.dispose()
      ringTex.dispose()
      sunTex.dispose()
      raysTex.dispose()
      bandTex.dispose()
      surfaces.forEach((t) => t.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [months, log, planets, sats, built])

  const selectedMonth = selected === null || selected === BASE ? null : months[selected]
  const selectedPlanets: MonthPlanet[] = selectedMonth ? planets[selected!] : []
  const selectedSats = selectedMonth ? sats[selected!] : []
  const next = nextMilestone(milestones)
  const chosenPlanet = planetSel === null ? null : (selectedPlanets[planetSel] ?? null)
  const monthComets = selectedPlanets.reduce((n, p) => n + p.comets, 0)

  const open = (i: number) => {
    setSelected(i)
    flyToRef.current?.(i)
  }

  const back = () => {
    setSelected(null)
    flyToRef.current?.(null)
  }

  return createPortal(
    <div className="galaxy-view" role="dialog" aria-modal="true" aria-label="Din galax">
      <div className="gv-canvas" ref={mountRef} />
      <header className="gv-top">
        <div>
          <h2>Din galax</h2>
          <p>
            {months.length} {months.length === 1 ? 'månad' : 'månader'} · {totalStars} {totalStars === 1 ? 'stjärna' : 'stjärnor'}
          </p>
        </div>
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
        <GalaxyGuide onClose={closeGuide} />
      ) : selected === BASE ? (
        <section className="gv-panel gv-base" aria-live="polite">
          <span className="gv-label">Rymdbasen</span>
          <b className="gv-big">
            {built.size} av {milestones.length} moduler
          </b>
          {next?.progress && (
            <div className="gv-next">
              <span>
                Nästa: <b>{next.module}</b> vid {next.title.toLowerCase()}
              </span>
              <span className="gv-next-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.round((next.progress.now / next.progress.target) * 100))}%` }} />
              </span>
              <span className="gv-next-num">
                {Math.min(next.progress.now, next.progress.target)} av {next.progress.target} {next.progress.unit}
              </span>
            </div>
          )}
          <ol className="gv-modules">
            {milestones.map((m) => (
              <li key={m.id} className={m.done ? 'done' : undefined}>
                <span className="gv-module-check" aria-hidden="true">
                  {m.done ? '✓' : ''}
                </span>
                <span>
                  <b>{m.module}</b> · {m.title}
                </span>
                <span className="gv-module-date">{m.done ? shortDate(m.done, today) : ''}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : selectedMonth ? (
        <section className="gv-panel" aria-live="polite">
          <span className="gv-label">{monthName(selectedMonth.month, today)}</span>
          <b className="gv-big">{selectedMonth.pct}&nbsp;%</b>
          <p>
            {selectedMonth.current ? 'Byggs fortfarande. ' : ''}
            {selectedMonth.weeks.length} veckor · {selectedMonth.checks} {selectedMonth.checks === 1 ? 'stjärna' : 'stjärnor'}
            {selectedMonth.bestWeek?.pct != null &&
              ` · bästa veckan v.\u00a0${isoWeek(selectedMonth.bestWeek.monday)} (${selectedMonth.bestWeek.pct}\u00a0%)`}
          </p>
          {selectedPlanets.length > 0 && (
            <span className="gv-label gv-planets-title">Planeterna är dina vanor · bockar</span>
          )}
          {selectedPlanets.length > 0 && (
            <ul className="gv-planets">
              {selectedPlanets.map((planet, k) => (
                <li key={planet.id}>
                  <button type="button" aria-pressed={planetSel === k} onClick={() => setPlanetSel(planetSel === k ? null : k)}>
                    <i style={{ background: planetColor(k) }} aria-hidden="true" />
                    {planet.name}
                    <span>{planet.checks}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {chosenPlanet ? (
            <p className="gv-planet-detail">
              <b>{chosenPlanet.name}:</b>{' '}
              {chosenPlanet.weeksTotal > 0
                ? `målet klarat ${chosenPlanet.weeksMet} av ${chosenPlanet.weeksTotal} ${chosenPlanet.weeksTotal === 1 ? 'vecka' : 'veckor'}`
                : 'veckans mål avgörs på söndag'}
              {chosenPlanet.weeksTotal > 0 && chosenPlanet.weeksMet === chosenPlanet.weeksTotal && ' · perfekt, planeten lyser'}
              {chosenPlanet.comets > 0 && ` · ☄ ${chosenPlanet.comets} ${chosenPlanet.comets === 1 ? 'komet' : 'kometer'} (7 dagar i rad)`}
            </p>
          ) : (
            monthComets > 0 && (
              <p className="gv-planet-detail">
                ☄ {monthComets} {monthComets === 1 ? 'komet' : 'kometer'}: 7 dagar i rad på en vana. Tryck på en planet för att se vanan.
              </p>
            )
          )}
          {selectedSats.length > 0 && (
            <p className="gv-planet-detail">
              🛰 {selectedSats.length} {selectedSats.length === 1 ? 'satellit' : 'satelliter'}:{' '}
              {selectedSats
                .slice(0, 4)
                .map((t) => t.title)
                .join(', ')}
              {selectedSats.length > 4 && ` och ${selectedSats.length - 4} till`}.
            </p>
          )}
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : (
        <div className="gv-bottom">
          <p className="gv-hint">
            {months.length <= 1
              ? 'Den gula ringen är månadens solsystem, den blå ovanför kärnan är din rymdbas.'
              : 'Gula ringar är dina månader, den blå är din rymdbas. Tryck på en, eller välj nedan.'}
          </p>
          <div className="gv-months" role="list" ref={(el) => {
              if (el) el.scrollLeft = el.scrollWidth
            }}>
            <button type="button" role="listitem" className="gv-month gv-base-chip" onClick={() => open(BASE)}>
              <span>Rymdbas</span>
              <b>
                {built.size}/{milestones.length}
              </b>
            </button>
            {months.map((m, i) => (
              <button key={m.month} type="button" role="listitem" className={m.current ? 'gv-month is-current' : 'gv-month'} onClick={() => open(i)}>
                <span>{monthName(m.month, today)}</span>
                <b>{m.pct}&nbsp;%</b>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
