// Hälsodatan som föremål i Hälsogalaxen: kärnan slår i din vilopuls, nattens sömn blir en nebulosa
// med ett färgband per fas runt kärnan, dagens steg en lysande ring runt hela galaxen och varje
// träningspass en meteor. Allt ligger i galaxens egna koordinater (skivan i xz-planet).

import * as THREE from 'three'
import { heartbeat, type Vitals } from './vitals'
import { seeded } from './space3d'

/** Fasernas färger, samma som sömndiagrammet i Hälsa idag. */
export const STAGE_COLORS: Record<string, string> = {
  awake: '#f08c5a',
  rem: '#5ec8f0',
  core: '#3d7cf0',
  deep: '#6a4fe0',
  asleep: '#3d7cf0',
}
const PULSE = '#ff6f96'
const STEPS = '#ffa063'

export interface VitalsScene {
  group: THREE.Group
  /** Var etiketterna sitter (galaxens koordinater). */
  spots: { pulse: THREE.Vector3; sleep: THREE.Vector3; steps: THREE.Vector3 }
  update(now: number): void
  dispose(): void
}

const glowSprite = (map: THREE.Texture, color: string, scale: number, opacity = 1) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  s.scale.setScalar(scale)
  s.material.userData.own = true
  return s
}

/**
 * Bygger det som `vitals` har data för. `radius` = galaxens radie, `core` = galaxens kärnsken
 * (lyser starkare med konditionen), `glow` = mjuk ljuspunkt som textur.
 */
export function buildVitals(vitals: Vitals, radius: number, core: THREE.Object3D, glow: THREE.Texture): VitalsScene {
  const R = radius
  const group = new THREE.Group()
  const owned: { dispose(): void }[] = []
  const updates: ((t: number) => void)[] = []
  const rand = seeded(5150)

  /* ----- Kärnan: slår i vilopulsen och lyser efter konditionen ----- */
  const coreScale = core.scale.x
  core.scale.setScalar(coreScale * (0.85 + 0.35 * vitals.glow))
  // Varje hjärtslag skickar ut en rosa ljusvåg i skivan från kärnan (kärnan själv är för ljus för att färgas)
  if (vitals.pulse) {
    const bpm = vitals.pulse.bpm
    const period = 60 / Math.max(30, Math.min(120, bpm))
    const waveMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(PULSE) }, uAge: { value: 0 } },
      vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAge;
        varying vec2 vP;
        void main() {
          // En tunn ring som växer från kärnan och bleknar, och ett svagare efterslag strax innanför
          float r = length(vP);
          float front = uAge;
          float ring = exp(-pow((r - front) / 0.035, 2.0)) + 0.5 * exp(-pow((r - front * 0.72) / 0.03, 2.0));
          float fade = (1.0 - uAge) * smoothstep(0.02, 0.12, r);
          gl_FragColor = vec4(uColor * ring * fade * 1.6, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    waveMat.userData.own = true
    const wave = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), waveMat)
    wave.rotation.x = -Math.PI / 2
    wave.scale.setScalar(R * 0.42)
    wave.renderOrder = 2
    group.add(wave)
    owned.push(wave.geometry, waveMat)
    const heart = glowSprite(glow, PULSE, R * 0.16, 0)
    group.add(heart)
    owned.push(heart.material)
    updates.push((t) => {
      waveMat.uniforms.uAge.value = (((t % period) + period) % period) / period
      heart.material.opacity = 0.35 * heartbeat(t, bpm)
    })
  }

  /* ----- Sömnen: en nebulosa runt kärnan, ett färgband per fas i nattens ordning ----- */
  const sleepR = R * 0.34
  let nebula: THREE.Points | null = null
  if (vitals.sleep) {
    const bands = vitals.sleep.bands.length ? vitals.sleep.bands : [{ k: 'core' as const, share: 1 }]
    // Starkare sken ju bättre natt: poängen om den finns, annars längden mot 8 h
    const quality = vitals.sleep.score !== null ? vitals.sleep.score / 100 : Math.min(1, vitals.sleep.hours / 8)
    const count = 1800
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const c = new THREE.Color()
    let start = 0
    let i = 0
    for (const band of bands) {
      const n = Math.max(1, Math.round(band.share * count))
      for (let j = 0; j < n && i < count; j++, i++) {
        const a = (start + band.share * (j / n)) * Math.PI * 2
        // Djup sömn ligger närmast kärnan, vaken längst ut – som stegen i sömndiagrammet
        const lift = band.k === 'deep' ? -0.1 : band.k === 'rem' ? 0.06 : band.k === 'awake' ? 0.14 : 0
        const r = sleepR * (1 + lift + (rand() - 0.5) * 0.12)
        pos[i * 3] = Math.cos(a) * r
        pos[i * 3 + 1] = (rand() - 0.5) * R * 0.025
        pos[i * 3 + 2] = Math.sin(a) * r
        // I galaxen dras cyan mot grönt av kärnans gula sken, så REM görs lite blåare här
        c.set(band.k === 'rem' ? '#6aa8ff' : (STAGE_COLORS[band.k] ?? STAGE_COLORS.core)).multiplyScalar(0.8 + 0.5 * rand())
        col[i * 3] = c.r
        col[i * 3 + 1] = c.g
        col[i * 3 + 2] = c.b
      }
      start += band.share
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, i * 3), 3))
    const mat = new THREE.PointsMaterial({
      size: R * 0.03,
      map: glow,
      vertexColors: true,
      transparent: true,
      opacity: 0.35 + 0.55 * quality,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    mat.userData.own = true
    nebula = new THREE.Points(geo, mat)
    nebula.frustumCulled = false
    group.add(nebula)
    owned.push(geo, mat)
    updates.push((t) => {
      // Ett varv på tio minuter, och en lugn andning i skenet
      nebula!.rotation.y = -t * ((Math.PI * 2) / 600)
      mat.opacity = (0.35 + 0.55 * quality) * (0.88 + 0.12 * Math.sin(t * 0.4))
    })
  }

  /* ----- Stegen: en ring runt galaxen som fylls mot målet ----- */
  const stepR = R * 1.03
  const ringMat = (opacity: number) => {
    const m = new THREE.MeshBasicMaterial({ color: STEPS, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    m.userData.own = true
    return m
  }
  const stepHead = new THREE.Vector3(stepR, 0, 0)
  if (vitals.steps) {
    const part = Math.max(0.004, vitals.steps.part)
    const track = new THREE.Mesh(new THREE.TorusGeometry(stepR, R * 0.004, 6, 256), ringMat(0.1))
    const fill = new THREE.Mesh(new THREE.TorusGeometry(stepR, R * 0.008, 8, 256, part * Math.PI * 2), ringMat(vitals.steps.part >= 1 ? 0.95 : 0.7))
    // Ringen ligger i skivan och börjar "klockan tolv" sett från startbilden (lokal −x), medsols
    for (const m of [track, fill]) {
      m.rotation.x = Math.PI / 2
      group.add(m)
      owned.push(m.geometry, m.material as THREE.Material)
    }
    const end = part * Math.PI * 2
    stepHead.set(Math.cos(end) * stepR, 0, Math.sin(end) * stepR)
    const tip = glowSprite(glow, STEPS, R * 0.09, 0.9)
    tip.position.copy(stepHead)
    group.add(tip)
    owned.push(tip.material)
    updates.push((t) => {
      tip.material.opacity = 0.65 + 0.3 * Math.sin(t * 2.2)
    })
  }

  /* ----- Träningspassen: en meteor per pass som skär genom galaxen ----- */
  const meteors = Array.from({ length: Math.min(6, vitals.workouts) }, (_, k) => {
    const head = glowSprite(glow, '#fff1dc', R * 0.05, 0)
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 0.85, 0.7, 0, 0, 0], 3))
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    mat.userData.own = true
    const tail = new THREE.Line(geo, mat)
    group.add(head, tail)
    owned.push(head.material, geo, mat)
    const a = rand() * Math.PI * 2
    const from = new THREE.Vector3(Math.cos(a), 0.25 + rand() * 0.2, Math.sin(a)).multiplyScalar(R * 1.25)
    const to = new THREE.Vector3(Math.cos(a + 2.4), -0.1, Math.sin(a + 2.4)).multiplyScalar(R * 0.55)
    return { head, tail, from, to, period: 7 + k * 1.3, offset: k * 2.1 }
  })
  const p = new THREE.Vector3()
  const back = new THREE.Vector3()
  updates.push((t) => {
    for (const m of meteors) {
      const phase = ((t + m.offset) % m.period) / m.period
      // Syns under första tredjedelen av perioden, sedan vila
      const s = phase / 0.33
      const on = s < 1 ? Math.sin(s * Math.PI) : 0
      p.lerpVectors(m.from, m.to, Math.min(1, s))
      back.lerpVectors(m.from, m.to, Math.max(0, Math.min(1, s) - 0.18))
      m.head.position.copy(p)
      m.head.material.opacity = 0.9 * on
      const pos = m.tail.geometry.getAttribute('position') as THREE.BufferAttribute
      pos.setXYZ(0, p.x, p.y, p.z)
      pos.setXYZ(1, back.x, back.y, back.z)
      pos.needsUpdate = true
      ;(m.tail.material as THREE.LineBasicMaterial).opacity = 0.7 * on
    }
  })

  return {
    group,
    spots: {
      pulse: new THREE.Vector3(0, R * 0.05, 0),
      sleep: new THREE.Vector3(-sleepR * 0.8, 0, sleepR * 0.6),
      steps: stepHead.clone(),
    },
    update(now) {
      const t = now / 1000
      for (const u of updates) u(t)
    },
    dispose() {
      core.scale.setScalar(coreScale)
      group.removeFromParent()
      owned.forEach((o) => o.dispose())
    },
  }
}
