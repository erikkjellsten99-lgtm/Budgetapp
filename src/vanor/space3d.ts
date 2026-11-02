// Byggstenar i 3D för galaxen (CosmosView): texturer, satelliterna, det svarta hålet, sparplaneten och
// budgetens månsystem. Rena three.js-funktioner utan React. Rymdbasen finns i station3d.ts.

import * as THREE from 'three'
import type { PlanetKind } from './planets'
import type { BudgetMoon } from './economy'

export const TYPE_COLORS = { fixed: '#c9d1e0', variable: '#f0aa6c', savings: '#7be3b2' } as const
export const TYPE_NAMES = { fixed: 'Fast', variable: 'Rörlig', savings: 'Sparande' } as const
export const LIST_COLORS = { erik: '#8fc2ff', cassandra: '#ff9ec8' } as const

/** Slumptal med frö, så att galaxen ser likadan ut varje gång den öppnas. */
export function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** Mjuk rund ljuspunkt som textur för stjärnor och solsystem. */
export function glowTexture(): THREE.Texture {
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

/** Enkelt brus (värdebrus med frö) för planetytor och solens yta. */
export function noise2(seed: number) {
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
export function planetTexture(kind: PlanetKind, seed: number): THREE.Texture {
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

export const metal = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6, transparent: true, ...extra })

/** Ytor för stationen och satelliterna, ritade en gång och återanvända. */
let hardware: { cells: THREE.Texture; foil: THREE.Texture; hull: THREE.Texture } | null = null
export function hardwareTextures() {
  if (hardware) return hardware
  const canvas = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  const n = noise2(42)
  // Solceller: mörkblå rutor med ljusa ledare emellan, som på riktiga solpaneler.
  const cells = canvas(128, 256, (ctx) => {
    ctx.fillStyle = '#b9c2d0'
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 8; x++) {
        const g = ctx.createLinearGradient(0, y * 16, 0, y * 16 + 16)
        const tint = 0.85 + n(x, y) * 0.3
        g.addColorStop(0, `rgb(${22 * tint},${44 * tint},${108 * tint})`)
        g.addColorStop(1, `rgb(${12 * tint},${24 * tint},${66 * tint})`)
        ctx.fillStyle = g
        ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14)
      }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    for (let x = 0; x < 128; x += 4) ctx.fillRect(x, 0, 1, 256)
  })
  // Guldfolie (isolering): skrynklig, med ljusa och mörka veck.
  const foil = canvas(128, 128, (ctx) => {
    const img = ctx.createImageData(128, 128)
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const v = n(x / 6, y / 6) * 0.7 + n(x / 2, y / 2) * 0.3
        const i = (y * 128 + x) * 4
        img.data[i] = 150 + v * 105
        img.data[i + 1] = 105 + v * 85
        img.data[i + 2] = 30 + v * 40
        img.data[i + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  })
  // Skrovet: benvitt med fogar, nitrader och små luckor.
  const hull = canvas(256, 128, (ctx) => {
    ctx.fillStyle = '#e9e7e1'
    ctx.fillRect(0, 0, 256, 128)
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = 'rgba(80,85,95,0.35)'
      ctx.fillRect(x, 0, 1.5, 128)
    }
    for (let y = 0; y < 128; y += 42) {
      ctx.fillStyle = 'rgba(80,85,95,0.25)'
      ctx.fillRect(0, y, 256, 1)
    }
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = `rgba(60,64,72,${0.15 + n(k, 3) * 0.25})`
      ctx.fillRect(n(k, 1) * 250, n(k, 2) * 120, 4 + n(k, 4) * 8, 3 + n(k, 5) * 5)
    }
  })
  hardware = { cells, foil, hull }
  return hardware
}

export const cellMat = () => metal('#ffffff', { map: hardwareTextures().cells, metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide })
export const foilMat = () => metal('#ffffff', { map: hardwareTextures().foil, metalness: 0.95, roughness: 0.32 })
export const hullMat = () => metal('#ffffff', { map: hardwareTextures().hull, metalness: 0.15, roughness: 0.55 })
export const frameMat = () => metal('#aeb6c4', { metalness: 0.8, roughness: 0.35 })

/** Ett solpanelsfält: ram och celler, på en bom. */
export function solarArray(length: number, width: number) {
  const g = new THREE.Group()
  const panel = new THREE.Mesh(new THREE.BoxGeometry(length, 0.0012, width), cellMat())
  g.add(panel)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(length + 0.002, 0.002, 0.0016), frameMat())
  frame.position.z = width / 2
  g.add(frame)
  const frame2 = frame.clone()
  frame2.position.z = -width / 2
  g.add(frame2)
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, length, 8), frameMat())
  spine.rotation.z = Math.PI / 2
  g.add(spine)
  return g
}

/** En liten satellit: guldfolieklädd kropp, två solpanelsvingar, parabolantenn och en spröt. */
export function makeSatellite(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.009, 0.008), foilMat()))
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.0084, 0.0015, 0.0084), hullMat())
  top.position.y = 0.0052
  g.add(top)
  for (const side of [-1, 1]) {
    const wing = solarArray(0.016, 0.0065)
    wing.position.x = side * 0.0135
    g.add(wing)
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), metal('#f2f4f8', { side: THREE.DoubleSide }))
  dish.position.set(0, -0.0065, 0)
  g.add(dish)
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.008, 6), frameMat())
  rod.position.set(0.002, 0.009, 0.002)
  g.add(rod)
  return g
}

/** Ackretionsskivans ljus: varmt nära hålet, med virvlande stråk, och genomskinligt längst ut. */
export function diskTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const n = noise2(17)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5
      const dy = y / size - 0.5
      const r = Math.hypot(dx, dy) * 2 // 0 i mitten, 1 vid kanten
      const a = Math.atan2(dy, dx)
      // Mjuk innerkant (ingen trappstegskant), ljusast nära hålet, och tonar ut mot ytterkanten.
      const band = r < 0.27 ? 0 : r < 0.36 ? (r - 0.27) / 0.09 : Math.max(0, 1 - (r - 0.36) / 0.64)
      const swirl = 0.6 + 0.4 * n(a * 3 + r * 9, r * 14)
      const heat = Math.pow(band, 1.6) * swirl
      const i = (y * size + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 150 + 105 * Math.pow(band, 2)
      img.data[i + 2] = 60 + 190 * Math.pow(band, 4)
      img.data[i + 3] = Math.min(255, heat * 330)
    }
  ctx.putImageData(img, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Ljuset som böjs runt ett svart hål: en tunn, ljus ring med mjuk kant. */
export function haloTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,235,200,0)')
  g.addColorStop(0.06, 'rgba(255,240,215,0.95)')
  g.addColorStop(0.2, 'rgba(255,190,110,0.35)')
  g.addColorStop(1, 'rgba(255,150,60,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Det svarta hålet: skulderna. Storleken är det som är kvar av det högsta beloppet, så hålet krymper
 * när ni betalar av. Utan skulder finns bara en ljus ring kvar där hålet var.
 */
export function buildBlackHole(share: number, glow: THREE.Texture) {
  const group = new THREE.Group()
  const disk = diskTexture()
  const halo = haloTexture()
  const textures = [disk, halo]
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
  const radiusFor = (s: number) => (s > 0 ? 0.16 + 0.4 * s : 0.3)

  // Hålet byggs i storlek 1 och skalas, så att tidsreglaget kan krympa det utan att bygga om något.
  const hole = new THREE.Group()
  hole.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: '#000000' })))
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 4.6, 160, 1), new THREE.MeshBasicMaterial({ map: disk, side: THREE.DoubleSide, ...additive }))
  ring.rotation.x = -Math.PI / 2 + 0.16
  hole.add(ring)
  // Ljuset från skivans baksida böjs över och under hålet, och en tunn fotonring precis utanför horisonten
  const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#ffc98a', ...additive, opacity: 0.75 }))
  lens.scale.setScalar(3.1)
  hole.add(lens)
  const photon = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#fff3dc', ...additive }))
  photon.scale.setScalar(2.35)
  hole.add(photon)
  group.add(hole)

  // Skuldfri: en lugn, ljus ring där hålet var
  const free = new THREE.Group()
  const freeRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#bff5d6', ...additive }))
  freeRing.scale.setScalar(4)
  free.add(freeRing)
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e8fff2', ...additive, opacity: 0.6 }))
  core.scale.setScalar(2)
  free.add(core)
  group.add(free)

  const setShare = (s: number) => {
    hole.visible = s > 0
    free.visible = s <= 0
    ;(s > 0 ? hole : free).scale.setScalar(radiusFor(s))
  }
  setShare(share)
  return {
    group,
    radius: radiusFor(share),
    setShare,
    update(now: number) {
      ring.rotation.z = -now / 3000
    },
    dispose: () => textures.forEach((t) => t.dispose()),
  }
}

/**
 * Sparmålet som en planet som föds: en roterande skiva av gas och stoft som samlas ihop ju närmare målet
 * ni kommer. Vid 100 % är planeten färdig, med ringar och en måne.
 */
export function buildNewPlanet(progress: number, surface: THREE.Texture, glow: THREE.Texture) {
  const p = Math.min(1, Math.max(0, progress))
  const group = new THREE.Group()
  const rand = seeded(300000)
  const count = Math.round(2600 * (1 - 0.75 * p))
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    // Ju längre ni har kommit, desto tätare samlas stoftet runt planeten
    const r = 0.05 + 0.26 * (1 - 0.5 * p) * Math.pow(rand(), 0.8 + 2.5 * p)
    const a = rand() * Math.PI * 2
    pos.set([Math.cos(a) * r, (rand() - 0.5) * 0.012 * (1 + r * 8), Math.sin(a) * r], i * 3)
    c.set(rand() < 0.65 ? '#ffcf96' : '#9fc6ff').multiplyScalar(0.4 + 0.6 * rand())
    col.set([c.r, c.g, c.b], i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const disk = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.014, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  disk.rotation.x = 0.25
  group.add(disk)
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#69d2b4', map: surface, roughness: 0.6, metalness: 0, transparent: true, envMapIntensity: 0.15 }),
  )
  planet.scale.setScalar(0.018 + 0.07 * p)
  group.add(planet)
  if (p >= 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.3, 96, 1),
      new THREE.MeshStandardMaterial({ color: '#d8f5ec', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2 + 0.3
    ;(ring.material as THREE.Material).userData.opacity = 0.6
    planet.add(ring)
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.012, 24, 16), new THREE.MeshStandardMaterial({ color: '#c9cdd6', roughness: 0.9, transparent: true }))
    moon.position.set(0.16, 0.02, 0)
    group.add(moon)
  }
  return {
    group,
    update(now: number) {
      disk.rotation.y = now / 7000
      planet.rotation.y = now / 4000
    },
  }
}

/**
 * Budgeten som ett månsystem runt en gasjätte: en måne per kategori, större ju större budget. Månen lyser när
 * kategorin är betald den här månaden och är mörk så länge den inte är det.
 */
export function buildMoonSystem(moons: BudgetMoon[], surface: THREE.Texture, glow: THREE.Texture) {
  const group = new THREE.Group()
  const giant = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#e2b77a', map: surface, roughness: 0.8, transparent: true, envMapIntensity: 0.15 }),
  )
  giant.rotation.z = 0.2
  group.add(giant)
  const max = Math.max(1, ...moons.map((m) => m.budget))
  const shown = moons.slice(0, 16)
  const bodies = shown.map((m, i) => {
    const radius = 0.11 + i * (0.36 / Math.max(1, shown.length))
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 96 }, (_, a) => new THREE.Vector3(Math.cos((a / 96) * Math.PI * 2) * radius, 0, Math.sin((a / 96) * Math.PI * 2) * radius)),
      ),
      new THREE.LineBasicMaterial({ color: '#aab4d8', transparent: true, depthWrite: false }),
    )
    orbit.material.userData.opacity = 0.12
    group.add(orbit)
    const share = m.budget > 0 ? m.paid / m.budget : 0
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshStandardMaterial({
        color: TYPE_COLORS[m.type],
        roughness: 0.85,
        transparent: true,
        emissive: TYPE_COLORS[m.type],
        emissiveIntensity: 0.05 + 0.5 * share,
        envMapIntensity: 0.1,
      }),
    )
    mesh.material.userData.opacity = 0.55 + 0.45 * share
    mesh.scale.setScalar(0.006 + 0.016 * Math.sqrt(m.budget / max))
    group.add(mesh)
    let halo: THREE.Sprite | null = null
    if (share >= 1) {
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: TYPE_COLORS[m.type], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
      halo.material.userData.opacity = 0.7
      halo.scale.setScalar(mesh.scale.x * 7)
      group.add(halo)
    }
    return { mesh, halo, radius, phase: i * 2.4, speed: 0.25 / Math.sqrt(radius) }
  })
  group.rotation.x = 0.18
  return {
    group,
    update(now: number) {
      giant.rotation.y = now / 5000
      for (const b of bodies) {
        const a = b.phase + (now / 1000) * b.speed
        b.mesh.position.set(Math.cos(a) * b.radius, 0, Math.sin(a) * b.radius)
        b.halo?.position.copy(b.mesh.position)
      }
    },
  }
}
