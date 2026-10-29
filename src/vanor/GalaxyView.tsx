// Din galax i 3D: varje månad är ett solsystem i en spiralgalax som växer utåt för varje månad,
// och varje bock är en stjärna i armen. Börjar aldrig om. Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { isoWeek, weekStart, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { galaxyMonths, monthName, monthOfWeek, type GalaxyMonth } from './progress'

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

export default function GalaxyView({ habits, log, paused, today, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const months = useMemo(() => galaxyMonths(habits, log, paused, today), [habits, log, paused, today])
  const [selected, setSelected] = useState<GalaxyMonth | null>(null)
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
    controls.minDistance = 1.2
    controls.maxDistance = home.length() * 1.6
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enablePan = false

    const glow = glowTexture()
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
    scene.add(
      new THREE.Points(
        earnedGeo,
        new THREE.PointsMaterial({ size: 0.14, color: '#fff6e6', map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    )

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
      scene.add(sprite)
      return sprite
    })
    const current = systems[systems.length - 1]

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
      const dest = index === null ? home.clone() : target.clone().add(new THREE.Vector3(0, 4.5, 7))
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
      // Sprites är små i 3D – välj den månad som ligger närmast trycket på skärmen.
      let best: { i: number; d: number } | null = null
      for (const s of systems) {
        const projected = s.position.clone().project(camera)
        const d = Math.hypot(projected.x - pointer.x, projected.y - pointer.y)
        if (projected.z < 1 && d < 0.12 && (!best || d < best.d)) best = { i: s.userData.index, d }
      }
      if (best) {
        setSelected(months[best.i])
        flyToRef.current?.(best.i)
      }
    }
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
      if (current) current.material.opacity = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(now / 600))
      dust.rotation.y += 0.00015
      const closeness = camera.position.distanceTo(controls.target) / home.length()
      for (const m of fadeWhenClose) m.opacity = Math.min(1, 0.22 + closeness * 1.1)
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse((o) => {
        const obj = o as THREE.Mesh
        obj.geometry?.dispose()
        const mat = obj.material as THREE.Material | undefined
        mat?.dispose()
      })
      glow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [months, log])

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

      {selected ? (
        <section className="gv-panel" aria-live="polite">
          <span className="gv-label">{monthName(selected.month, today)}</span>
          <b className="gv-big">{selected.pct}&nbsp;%</b>
          <p>
            {selected.current ? 'Byggs fortfarande. ' : ''}
            {selected.weeks.length} veckor · {selected.checks} {selected.checks === 1 ? 'stjärna' : 'stjärnor'}
            {selected.bestWeek?.pct != null && ` · bästa veckan v.\u00a0${isoWeek(selected.bestWeek.monday)} (${selected.bestWeek.pct}\u00a0%)`}
          </p>
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : (
        <p className="gv-hint">
          {months.length <= 1
            ? 'Din första månad lyser nära kärnan. Varje ny månad läggs till längre ut i armen.'
            : 'Dra för att snurra, nyp för att zooma, tryck på en ljuspunkt för att se månaden.'}
        </p>
      )}
    </div>,
    document.body,
  )
}
