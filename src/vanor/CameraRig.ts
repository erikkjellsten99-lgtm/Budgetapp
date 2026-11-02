// Kamerastyrningen i galaxen (CosmosView): dra för att snurra runt det du tittar på, nyp eller scrolla
// för att zooma mot det du pekar på, två fingrar (eller högerklick) för att flytta bilden.
// Mjuk tröghet när du släpper, och flygningar mellan platser i universum.

import * as THREE from 'three'

export interface PickHit {
  point: THREE.Vector3
  /** Så nära får kameran komma punkten. */
  near: number
}

export interface Pose {
  target: THREE.Vector3
  position: THREE.Vector3
  /** Hur mycket bilden tittar upp (+) eller ner (−) från målpunkten, i radianer. */
  pitch?: number
}

interface Flight {
  fromT: THREE.Vector3
  toT: THREE.Vector3
  fromDir: THREE.Vector3
  turn: THREE.Quaternion
  fromLen: number
  toLen: number
  fromPitch: number
  toPitch: number
  t0: number
  dur: number
  done?: () => void
}

const UP = new THREE.Vector3(0, 1, 0)
const smoother = (k: number) => k * k * k * (k * (k * 6 - 15) + 10)

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  /** Punkten kameran kretsar kring och tittar mot. */
  readonly target = new THREE.Vector3()
  readonly position = new THREE.Vector3()
  pitch = 0
  pitchGoal = 0
  /** Det man tittar på här: när man zoomar ut glider bilden tillbaka mot den punkten. */
  anchor: THREE.Vector3 | null = null
  minRadius = 0.002
  maxRadius = 1400
  enabled = true
  /** Punkten under fingret, så att man zoomar mot det man pekar på. */
  pick: (ndc: THREE.Vector2) => PickHit | null = () => null
  /** Håller kameran borta från Jordens yta m.m. */
  constrain: (position: THREE.Vector3) => void = () => {}
  onTap: (ndc: THREE.Vector2) => void = () => {}
  /** Användaren tog tag i bilden (avbryter flygningar). */
  onUser: () => void = () => {}

  private readonly dom: HTMLElement
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private gesture: { x: number; y: number; t: number; moved: number; multi: boolean; pan: boolean } | null = null
  private pinch: { dist: number; x: number; y: number } | null = null
  private readonly rotVel = new THREE.Vector2()
  private readonly panVel = new THREE.Vector2()
  private lastMove = 0
  private readonly wheel = { amount: 0, ndc: new THREE.Vector2() }
  private flight: Flight | null = null
  /** Senaste träffen under fingret: punkten står still under fingret medan man zoomar, så den räcker en stund. */
  private pickCache: { x: number; y: number; t: number; hit: PickHit | null } | null = null
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()
  private readonly sph = new THREE.Spherical()
  private readonly ndc = new THREE.Vector2()
  private readonly ray = new THREE.Raycaster()

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera
    this.dom = dom
    this.position.copy(camera.position)
    dom.addEventListener('pointerdown', this.onDown)
    dom.addEventListener('pointermove', this.onMove)
    dom.addEventListener('pointerup', this.onUp)
    dom.addEventListener('pointercancel', this.onUp)
    dom.addEventListener('wheel', this.onWheel, { passive: false })
    dom.addEventListener('contextmenu', this.onContext)
  }

  dispose() {
    const dom = this.dom
    dom.removeEventListener('pointerdown', this.onDown)
    dom.removeEventListener('pointermove', this.onMove)
    dom.removeEventListener('pointerup', this.onUp)
    dom.removeEventListener('pointercancel', this.onUp)
    dom.removeEventListener('wheel', this.onWheel)
    dom.removeEventListener('contextmenu', this.onContext)
  }

  get flying() {
    return this.flight !== null
  }

  /** Ställ kameran direkt. */
  setPose(p: Pose) {
    this.flight = null
    this.target.copy(p.target)
    this.position.copy(p.position)
    if (p.pitch !== undefined) this.pitch = this.pitchGoal = p.pitch
    this.rotVel.set(0, 0)
    this.panVel.set(0, 0)
    this.apply()
  }

  /** Flyg mjukt dit: avståndet till målet ändras logaritmiskt, så att långa och korta resor känns lika. */
  flyTo(p: Pose, opts: { duration?: number; done?: () => void } = {}) {
    const fromOff = this.position.clone().sub(this.target)
    const toOff = p.position.clone().sub(p.target)
    const fromLen = Math.max(1e-6, fromOff.length())
    const toLen = Math.max(1e-6, toOff.length())
    const fromDir = fromOff.divideScalar(fromLen)
    const toDir = toOff.divideScalar(toLen)
    const travel = this.position.distanceTo(p.position) + Math.abs(Math.log(toLen / fromLen))
    this.flight = {
      fromT: this.target.clone(),
      toT: p.target.clone(),
      fromDir,
      turn: new THREE.Quaternion().setFromUnitVectors(fromDir, toDir.dot(fromDir) < -0.9999 ? toDir.clone().add(new THREE.Vector3(1e-3, 0, 0)).normalize() : toDir),
      fromLen,
      toLen,
      fromPitch: this.pitch,
      toPitch: p.pitch ?? this.pitchGoal,
      t0: performance.now(),
      dur: opts.duration ?? THREE.MathUtils.clamp(0.9 + 0.5 * Math.log2(1 + travel / 1.5), 1, 3.2) * 1000,
      done: opts.done,
    }
    this.pitchGoal = p.pitch ?? this.pitchGoal
    this.rotVel.set(0, 0)
    this.panVel.set(0, 0)
    this.wheel.amount = 0
  }

  stop() {
    this.flight = null
    this.rotVel.set(0, 0)
    this.panVel.set(0, 0)
    this.wheel.amount = 0
  }

  update(dt: number) {
    const now = performance.now()
    if (this.flight) {
      const f = this.flight
      const k = smoother(Math.min(1, (now - f.t0) / f.dur))
      this.target.lerpVectors(f.fromT, f.toT, k)
      const dir = this.tmp.copy(f.fromDir).applyQuaternion(new THREE.Quaternion().slerp(f.turn, k))
      const len = Math.exp(Math.log(f.fromLen) + (Math.log(f.toLen) - Math.log(f.fromLen)) * k)
      this.position.copy(this.target).addScaledVector(dir, len)
      this.pitch = f.fromPitch + (f.toPitch - f.fromPitch) * k
      if (k >= 1) {
        this.flight = null
        f.done?.()
      }
    } else {
      // Tröghet efter att du släppt
      if (!this.pointers.size) {
        const decay = Math.exp(-dt / 0.24)
        if (this.rotVel.lengthSq() > 1e-6) this.rotate(this.rotVel.x * dt, this.rotVel.y * dt)
        if (this.panVel.lengthSq() > 1e-4) this.panBy(this.panVel.x * dt, this.panVel.y * dt)
        this.rotVel.multiplyScalar(decay)
        this.panVel.multiplyScalar(decay)
      }
      // Scrollhjulet zoomar mjukt
      if (Math.abs(this.wheel.amount) > 1e-4) {
        const step = this.wheel.amount * (1 - Math.exp(-dt / 0.07))
        this.wheel.amount -= step
        this.zoomAt(this.wheel.ndc, Math.exp(step))
      }
      this.pitch += (this.pitchGoal - this.pitch) * (1 - Math.exp(-dt / 0.35))
    }
    this.apply()
  }

  /** Lägg kameran i three.js-kameran (och håll den utanför Jorden). */
  private apply() {
    this.constrain(this.position)
    const off = this.tmp2.copy(this.position).sub(this.target)
    if (off.lengthSq() < 1e-12) this.position.add(this.tmp2.set(0, 0, 1e-4))
    else if (Math.abs(off.y) / off.length() > 0.9995) this.position.z += off.length() * 0.03
    const cam = this.camera
    cam.position.copy(this.position)
    cam.up.copy(UP)
    cam.lookAt(this.target)
    cam.rotateX(this.pitch)
    cam.updateMatrixWorld()
  }

  private rotate(dTheta: number, dPhi: number) {
    const off = this.tmp2.copy(this.position).sub(this.target)
    this.sph.setFromVector3(off)
    this.sph.theta += dTheta
    this.sph.phi = THREE.MathUtils.clamp(this.sph.phi + dPhi, 0.03, Math.PI - 0.03)
    this.position.copy(this.target).add(off.setFromSpherical(this.sph))
  }

  /** Flytta bilden (pixlar). */
  private panBy(dx: number, dy: number) {
    const dist = this.position.distanceTo(this.target)
    const h = (2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / Math.max(1, this.dom.clientHeight)
    const right = this.tmp.setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(-dx * h)
    this.position.add(right)
    this.target.add(right)
    const up = this.tmp.setFromMatrixColumn(this.camera.matrixWorld, 1).multiplyScalar(dy * h)
    this.position.add(up)
    this.target.add(up)
  }

  /** Zooma: in mot det som är under fingret, ut från det du tittar på (och tillbaka mot ankaret). */
  zoomAt(ndc: THREE.Vector2, factor: number) {
    if (factor < 1) {
      const hit = this.pickAt(ndc)
      let point: THREE.Vector3
      let near = this.minRadius
      if (hit) {
        point = hit.point
        near = Math.max(near, hit.near)
      } else {
        // Inget under fingret: en punkt på samma djup som målpunkten
        this.ray.setFromCamera(ndc, this.camera)
        const forward = this.tmp.set(0, 0, -1).transformDirection(this.camera.matrixWorld)
        const depth = this.target.clone().sub(this.position).dot(forward)
        const t = depth / Math.max(0.05, this.ray.ray.direction.dot(forward))
        point = this.ray.ray.at(Math.max(this.minRadius * 4, t), new THREE.Vector3())
      }
      const dist = this.position.distanceTo(point)
      const f = Math.max(factor, near / Math.max(dist, 1e-9))
      if (f >= 1) return
      this.position.sub(point).multiplyScalar(f).add(point)
      this.target.sub(point).multiplyScalar(f).add(point)
    } else {
      const off = this.tmp2.copy(this.position).sub(this.target)
      const len = off.length()
      const next = Math.min(this.maxRadius, len * factor)
      this.position.copy(this.target).addScaledVector(off.divideScalar(len), next)
      // Glid tillbaka mot det man tittar på i den här delen av universum
      if (this.anchor) {
        const pull = this.tmp.copy(this.anchor).sub(this.target).multiplyScalar(Math.min(1, (factor - 1) * 1.6))
        this.target.add(pull)
        this.position.add(pull)
      }
    }
  }

  private pickAt(ndc: THREE.Vector2) {
    const now = performance.now()
    const c = this.pickCache
    if (c && now - c.t < 160 && Math.abs(c.x - ndc.x) < 0.03 && Math.abs(c.y - ndc.y) < 0.03) {
      c.t = now
      return c.hit
    }
    const hit = this.pick(ndc)
    this.pickCache = { x: ndc.x, y: ndc.y, t: now, hit }
    return hit
  }

  private toNdc(x: number, y: number, out = this.ndc) {
    const r = this.dom.getBoundingClientRect()
    return out.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return
    this.dom.setPointerCapture?.(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.flight) this.flight = null
    this.onUser()
    this.rotVel.set(0, 0)
    this.panVel.set(0, 0)
    this.wheel.amount = 0
    if (this.pointers.size === 1) {
      this.gesture = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, multi: false, pan: e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey }
    } else {
      if (this.gesture) this.gesture.multi = true
      this.pinch = this.pinchState()
    }
  }

  private pinchState() {
    const [a, b] = [...this.pointers.values()]
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    if (!p || !this.enabled) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    const now = performance.now()
    const dt = Math.max(0.008, (now - this.lastMove) / 1000)
    this.lastMove = now
    if (this.gesture) this.gesture.moved += Math.hypot(dx, dy)
    if (this.pointers.size >= 2) {
      if (!this.pinch) this.pinch = this.pinchState()
      const next = this.pinchState()
      this.zoomAt(this.toNdc(next.x, next.y), this.pinch.dist / next.dist)
      this.panBy(next.x - this.pinch.x, next.y - this.pinch.y)
      this.pinch = next
      return
    }
    if (this.gesture?.pan) {
      this.panBy(dx, dy)
      this.panVel.set(dx / dt, dy / dt).multiplyScalar(0.5)
      return
    }
    const h = Math.max(1, this.dom.clientHeight)
    const dTheta = (-2 * Math.PI * dx) / h
    const dPhi = (-2 * Math.PI * dy) / h
    this.rotate(dTheta, dPhi)
    // Mjukad fart, så att bilden glider vidare när du släpper
    this.rotVel.lerp(new THREE.Vector2(dTheta / dt, dPhi / dt), 0.5)
  }

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.delete(e.pointerId)
    const g = this.gesture
    if (this.pointers.size === 0) {
      // Släppte efter en stund still: ingen tröghet
      if (performance.now() - this.lastMove > 90) {
        this.rotVel.set(0, 0)
        this.panVel.set(0, 0)
      }
      if (g && !g.multi && g.moved < 8 && performance.now() - g.t < 500) this.onTap(this.toNdc(e.clientX, e.clientY).clone())
      this.gesture = null
      this.pinch = null
    } else {
      this.pinch = this.pointers.size >= 2 ? this.pinchState() : null
      // Ett finger kvar efter nypning: fortsätt snurra från där det är nu, utan ryck
      this.rotVel.set(0, 0)
    }
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return
    e.preventDefault()
    if (this.flight) this.flight = null
    this.onUser()
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    this.wheel.amount = THREE.MathUtils.clamp(this.wheel.amount + e.deltaY * scale * 0.0016, -2.5, 2.5)
    this.toNdc(e.clientX, e.clientY, this.wheel.ndc)
  }

  private onContext = (e: Event) => e.preventDefault()
}
