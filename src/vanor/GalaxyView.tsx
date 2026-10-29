// Din galax i 3D: varje månad är ett solsystem i en spiralgalax som växer utåt för varje månad,
// och varje bock är en stjärna i armen. Börjar aldrig om. Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { isoWeek, weekStart, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { galaxyMonths, monthName, monthOfWeek, monthPlanets, type MonthPlanet } from './progress'

interface Props {
  habits: Habit[]
  log: Log
  paused: Paused
  today: DateKey
  onClose: () => void
}

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

/** Planetfärger, en per vana i den ordning vanorna ligger. */
const PLANET_COLORS = ['#7fb2ff', '#ff9a6b', '#8ee0b0', '#e7a8ff', '#ffd36b', '#6be0e6', '#ff7f9e', '#c9d1e8']
const planetColor = (i: number) => PLANET_COLORS[i % PLANET_COLORS.length]

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

export default function GalaxyView({ habits, log, paused, today, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const months = useMemo(() => galaxyMonths(habits, log, paused, today), [habits, log, paused, today])
  const [selected, setSelected] = useState<number | null>(null)
  const panelShown = useRef(false)
  panelShown.current = selected !== null
  // Vald planet (vana) i det solsystem man är i.
  const [planetSel, setPlanetSel] = useState<number | null>(null)
  const planetSelRef = useRef<number | null>(null)
  planetSelRef.current = planetSel
  useEffect(() => setPlanetSel(null), [selected])
  const planets = useMemo(() => months.map((m) => monthPlanets(habits, log, paused, today, m.month)), [months, habits, log, paused, today])
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
    scene.add(
      new THREE.Points(
        bulgeGeo,
        new THREE.PointsMaterial({ size: 0.12, color: '#ffdcae', map: glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    )

    // Rosa stjärnbildningsområden längs armarna, som i riktiga spiralgalaxer
    for (let i = 0; i < Math.min(40, 6 + n * 2); i++) {
      const p = armPoint(rand() * (armLength - 0.5))
      const neb = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: rand() < 0.7 ? '#ff8fb8' : '#8fb8ff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      neb.position.set(p.x + gauss() * 0.5, 0, p.z + gauss() * 0.5)
      neb.scale.setScalar(1.2 + rand() * 1.6)
      scene.add(neb)
    }

    // Kärnan
    const coreSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#ffe2b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }),
    )
    coreSprite.scale.setScalar(5 + Math.min(4, n * 0.15))
    scene.add(coreSprite)

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
    const planetGeo = new THREE.SphereGeometry(1, 24, 16)
    const details = systems.map((sun, i) => {
      const group = new THREE.Group()
      group.position.copy(sun.position)
      group.visible = false
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffe9b8', transparent: true }))
      group.add(core)
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
        const mesh = new THREE.Mesh(
          planetGeo,
          new THREE.MeshStandardMaterial({ color: planetColor(k), roughness: 0.75, metalness: 0, emissive: planetColor(k), emissiveIntensity: 0.08, transparent: true }),
        )
        const size = 0.009 + 0.016 * planet.share
        mesh.scale.setScalar(size)
        group.add(mesh)
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
      scene.add(group)
      return { group, bodies, core, comets }
    })
    scene.add(new THREE.AmbientLight('#8090c0', 0.35))
    const sunLight = new THREE.PointLight('#ffe7c2', 3, 0, 0)
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
    flyToRef.current = (index) => {
      const target = index === null ? new THREE.Vector3() : systems[index].position.clone()
      const dest = index === null ? home.clone() : target.clone().add(new THREE.Vector3(0, 0.95, 1.4))
      flight = { from: camera.position.clone(), to: dest, fromT: controls.target.clone(), toT: target, start: performance.now() }
      controls.autoRotate = index === null
    }

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
      if (insideIndex !== null) {
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
      for (const s of systems) {
        const projected = s.position.clone().project(camera)
        const d = Math.hypot(projected.x - pointer.x, projected.y - pointer.y)
        if (projected.z < 1 && d < 0.18 && (!best || d < best.d)) best = { i: s.userData.index, d }
      }
      if (best && best.i !== insideIndex) {
        setSelected(best.i)
        flyToRef.current?.(best.i)
      }
    }

    // Zooma in = dras mot det solsystem du zoomar mot (där fingrarna/musen är, annars mitten av skärmen).
    const zoomPoint = new THREE.Vector2(0, 0)
    const touches = new Map<number, { x: number; y: number }>()
    const toNdc = (x: number, y: number) => {
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
      for (const sun of systems) {
        const projected = sun.position.clone().project(camera)
        if (projected.z >= 1) continue
        const d = Math.hypot(projected.x - zoomPoint.x, projected.y - zoomPoint.y)
        if (!best || d < best.d) best = { i: sun.userData.index, d }
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
      if (!flight && distance < lastDistance - 1e-4) {
        const i = nearestToZoom()
        if (i !== null) {
          const pull = Math.min(1, ((lastDistance - distance) / distance) * 1.6)
          offset.subVectors(systems[i].position, controls.target).multiplyScalar(pull)
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
          detail.bodies.forEach((b, k) => {
            const a = b.phase + (now / 1000) * b.speed
            b.mesh.position.set(Math.cos(a) * b.radius, 0, Math.sin(a) * b.radius)
            const picked = i === insideIndex && planetSelRef.current === k
            const material = b.mesh.material as THREE.MeshStandardMaterial
            material.opacity = fade
            material.emissiveIntensity = picked ? 0.55 : 0.08
            b.mesh.scale.setScalar(b.size * (picked ? 1.45 : 1))
            if (b.halo) {
              b.halo.position.copy(b.mesh.position)
              b.halo.material.opacity = 0.75 * fade * (0.8 + 0.2 * Math.sin(now / 500 + k))
            }
            ;(b.orbit.material as THREE.LineBasicMaterial).opacity = (picked ? 0.55 : 0.2) * fade
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
            ;(c.tail.material as THREE.LineBasicMaterial).opacity = fade
          }
        }
        sun.scale.setScalar(sun.userData.scale * (1 - 0.75 * fade))
        rings[i].material.opacity = 0.85 * (1 - fade)
      })
      const maxFade = THREE.MathUtils.clamp((DETAIL_FROM - (near as { d: number } | null ?? { d: 99 }).d) / (DETAIL_FROM - INSIDE), 0, 1)
      const closest = near as { i: number; d: number } | null
      if (closest) sunLight.position.copy(systems[closest.i].position)
      const inside = closest && closest.d < INSIDE && controls.target.distanceTo(systems[closest.i].position) < 0.3 ? closest.i : null
      if (inside !== insideIndex) {
        insideIndex = inside
        if (!flight) setSelected(inside)
      }

      const beat = 0.5 + 0.5 * Math.sin(now / 600)
      if (current) current.material.opacity = 0.55 + 0.25 * beat
      if (currentRing && currentRing.material.opacity > 0.01) currentRing.scale.setScalar(0.85 + 0.3 * beat)
      dust.rotation.y += 0.00015
      const closeness = camera.position.distanceTo(controls.target) / home.length()
      // Inne i ett solsystem tonas galaxens stjärnor ner så att solen och planeterna syns.
      for (const m of fadeWhenClose) m.opacity = Math.min(1, 0.22 + closeness * 1.1) * (1 - 0.92 * maxFade)
      earnedMaterial.opacity = 1 - 0.85 * maxFade
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
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [months, log, planets])

  const selectedMonth = selected === null ? null : months[selected]
  const selectedPlanets: MonthPlanet[] = selected === null ? [] : planets[selected]
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
        <button type="button" className="gv-close" aria-label="Stäng galaxen" onClick={onClose}>
          ×
        </button>
      </header>

      {selectedMonth ? (
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
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : (
        <div className="gv-bottom">
          <p className="gv-hint">
            {months.length <= 1
              ? 'Ringen är ditt solsystem för den här månaden. Nästa månad läggs till längre ut i armen.'
              : 'Ringarna är dina månader. Tryck på en, eller välj nedan.'}
          </p>
          <div className="gv-months" role="list" ref={(el) => {
              if (el) el.scrollLeft = el.scrollWidth
            }}>
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
