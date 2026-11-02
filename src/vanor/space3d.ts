// Byggstenar i 3D för galaxen (CosmosView): texturer, rymdbasen med arbetslaget, det svarta hålet,
// sparplaneten och budgetens månsystem. Rena three.js-funktioner utan React.

import * as THREE from 'three'
import type { PlanetKind } from './planets'
import type { BudgetMoon } from './economy'
import type { Crew, ModuleKind } from './space'

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

/** Tunn ljusring som markerar var ett solsystem (en månad) ligger. */
export function ringTexture(): THREE.Texture {
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

/** Solens yta: granulering i gult och orange. */
export function sunTexture(): THREE.Texture {
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
export function raysTexture(): THREE.Texture {
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

/**
 * Rymdbasen: en station som byggs av de moduler du har låst upp. Varje milstolpe lägger till en del,
 * så att stationen syns växa över tid. Utan bockar visas bara en tunn byggplats.
 * Byggd som en riktig rymdstation: ett fackverk i mitten, vita moduler med fogar, guldfolie och solcellsfält.
 */
/** Var varje modul sitter på stationen – där byggarbetsplatsen hamnar för nästa modul. */
export const MODULE_SPOT: Record<ModuleKind, [number, number, number]> = {
  core: [0, 0.028, 0],
  panel: [0.14, 0, 0.06],
  panel2: [-0.14, 0, 0.06],
  antenna: [0.02, 0.085, -0.02],
  dock: [0, 0.028, 0.09],
  habitat: [0, 0.028, -0.085],
  greenhouse: [0, 0.052, 0],
  telescope: [-0.055, 0.065, 0],
  ring: [0, 0.028, 0.115],
  sail: [-0.21, 0.028, 0],
  beacon: [0.15, 0.012, 0],
}

/** En astronaut i vit dräkt med guldvisir och ryggsäck, ca 1 cm hög (lite större än skala för att synas). */
export function buildAstronaut() {
  const suit = metal('#f2f2ee', { metalness: 0.05, roughness: 0.75 })
  const dark = metal('#8b9099', { metalness: 0.3, roughness: 0.6 })
  const body = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.0019, 0.0028, 4, 10), suit)
  body.add(torso)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.0021, 16, 12), suit)
  helmet.position.y = 0.0042
  body.add(helmet)
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.00175, 16, 12, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 4, Math.PI / 2.4),
    metal('#e8b04a', { metalness: 1, roughness: 0.15 }),
  )
  visor.position.set(0, 0.0042, 0.0006)
  body.add(visor)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0038, 0.0016), dark)
  pack.position.set(0, 0.0008, -0.0022)
  body.add(pack)
  const limb = (len: number) => new THREE.Mesh(new THREE.CapsuleGeometry(0.0008, len, 3, 8), suit)
  // Armarna sitter i en led vid axeln, så att de kan röra sig när astronauten arbetar
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.0026, 0.0018, 0)
    const arm = limb(0.0026)
    arm.position.y = -0.0015
    shoulder.add(arm)
    shoulder.rotation.z = side * 0.35
    body.add(shoulder)
    return shoulder
  })
  for (const side of [-1, 1]) {
    const leg = limb(0.003)
    leg.position.set(side * 0.0011, -0.0043, 0)
    leg.rotation.z = side * 0.12
    body.add(leg)
  }
  return { body, arms }
}

/** Gnistor från svetsen: ett litet sken som fladdrar. */
export function sparkTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,230,160,0.9)')
  g.addColorStop(0.5, 'rgba(255,170,60,0.3)')
  g.addColorStop(1, 'rgba(255,140,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Namnskylt över en astronaut (vanans namn), som en liten skylt som alltid vänds mot kameran. */
export function nameTag(text: string): { sprite: THREE.Sprite; texture: THREE.Texture } {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const label = text.length > 16 ? text.slice(0, 15) + '…' : text
  ctx.font = '600 30px Figtree, system-ui, sans-serif'
  const w = Math.min(248, ctx.measureText(label).width + 28)
  ctx.fillStyle = 'rgba(10,14,30,0.72)'
  ctx.beginPath()
  ctx.roundRect((256 - w) / 2, 10, w, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#eef3ff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 128, 33)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(0.022, 0.0055, 1)
  sprite.position.y = 0.0095
  return { sprite, texture }
}

/**
 * Arbetslaget på rymdbasen, kopplat till vanorna:
 * - en astronaut per vana med namnskylt. Bockad idag = bygger vid nästa modul (med livlina), annars är den inne i basen
 * - modulen växer fram i ställningen i takt med hur nära nästa milstolpe du är; klar idag = laget firar
 * - extra byggare för långa serier, som kommer med en kapsel som dockar
 * - pausad dag: alla vilar inne i stationen, och fönstret lyser
 * - pannlampor på hjälmarna
 * Den som inte har bockat idag är inne i basen (fönstret lyser). Bockar du av kommer astronauten ut genom
 * luckan och flyger till bygget – nästa gång du öppnar galaxen (arrivals = vanor som bockats sedan sist).
 */
export function buildCrew(next: ModuleKind | null, crew: Crew | null, arrivals: ReadonlySet<string> = new Set()) {
  const group = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const site = new THREE.Vector3(...MODULE_SPOT[next ?? 'panel'])
  const hatch = new THREE.Vector3(0, 0.049, 0) // luckan överst på kärnans nod
  const progress = crew ? (crew.celebrate ? 1 : crew.progress) : 0.3
  const paused = !!crew?.paused

  // Ställningen och modulen som växer fram i den
  if (next) {
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.026, 0.02, 0.026, 2, 1, 2)),
      new THREE.LineBasicMaterial({ color: '#9fe6ff', transparent: true, opacity: 0.55 }),
    )
    frame.material.userData.opacity = 0.55
    frame.position.copy(site)
    group.add(frame)
    const h = 0.018 * Math.max(0.05, progress)
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.02), hullMat())
    part.position.copy(site).add(new THREE.Vector3(0, -0.009 + h / 2, 0))
    group.add(part)
  }

  const sparkTex = sparkTexture()
  disposables.push(sparkTex)
  const additive = { map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
  const lampMat = new THREE.SpriteMaterial({ ...additive, color: '#fff2c8' })
  lampMat.userData.opacity = 0.9

  type Worker = {
    body: THREE.Group
    arms: THREE.Group[]
    base: THREE.Vector3
    tether: THREE.Line | null
    weld: boolean
    idx: number | null
    /** Kommer ut ur basen: sekunder efter att galaxen öppnats. */
    arrive: number | null
  }
  const workers: Worker[] = []
  const anchor = new THREE.Vector3(site.x * 0.6, 0, site.z * 0.6) // livlinorna fästs i fackverket
  const addWorker = (pos: THREE.Vector3, face: number, opts: { tether: boolean; weld: boolean; name?: string; idx?: number; arrive?: number }) => {
    const a = buildAstronaut()
    a.body.position.copy(pos)
    a.body.rotation.set(0.2, face, 0.15)
    // pannlampa
    const lamp = new THREE.Sprite(lampMat)
    lamp.scale.setScalar(0.004)
    lamp.position.set(0, 0.0048, 0.0022)
    a.body.add(lamp)
    if (opts.name) {
      const tag = nameTag(opts.name)
      disposables.push(tag.texture)
      a.body.add(tag.sprite)
    }
    group.add(a.body)
    let tether: THREE.Line | null = null
    if (opts.tether) {
      tether = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([anchor, pos.clone()]),
        new THREE.LineBasicMaterial({ color: '#d8dde4', transparent: true, opacity: 0.5 }),
      )
      ;(tether.material as THREE.Material).userData.opacity = 0.5
      group.add(tether)
    }
    workers.push({ ...a, base: pos.clone(), tether, weld: opts.weld, idx: opts.idx ?? null, arrive: opts.arrive ?? null })
  }

  // Platser runt bygget
  const siteSlot = (k: number) => {
    const ang = k * 2.4
    const r = 0.017 + (k % 3) * 0.003
    return site.clone().add(new THREE.Vector3(Math.cos(ang) * r, ((k % 4) - 1.5) * 0.006, Math.sin(ang) * r))
  }

  const members = crew?.members ?? []
  if (!paused) {
    let s = 0
    let order = 0
    members.forEach((m, idx) => {
      if (!m.working) return // inne i basen
      const pos = siteSlot(s)
      const face = Math.atan2(site.x - pos.x, site.z - pos.z)
      // nyss bockad: kommer ut ur luckan, en i taget
      const arrive = arrivals.has(m.id) ? 1.2 + 3.2 * order++ : undefined
      addWorker(pos, face, { tether: true, weld: s % 2 === 0, name: m.name, idx, arrive })
      s++
    })
    // Extra byggare för långa serier
    for (let k = 0; k < (crew?.extra ?? 0); k++) {
      const pos = siteSlot(s++)
      addWorker(pos, Math.atan2(site.x - pos.x, site.z - pos.z), { tether: true, weld: k % 2 === 1 })
    }
    // Utan vanor än: två som bygger på kärnan, så att basen ändå lever
    if (!crew || members.length === 0) {
      for (let k = 0; k < 2; k++) {
        const pos = siteSlot(k)
        addWorker(pos, Math.atan2(site.x - pos.x, site.z - pos.z), { tether: true, weld: k === 0 })
      }
    }
  }

  // Svetsgnistor vid dem som svetsar
  const sparks = workers
    .filter((w) => w.weld)
    .slice(0, 3)
    .map((w) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive }))
      sp.material.userData.own = true
      sp.position.copy(w.base).lerp(site, 0.55)
      group.add(sp)
      return { sp, w }
    })

  // Luckan på kärnan, med en lampa som blinkar när någon kommer ut
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.005, 0.0011, 8, 24), foilMat())
  hatchRing.rotation.x = Math.PI / 2
  hatchRing.position.copy(hatch)
  group.add(hatchRing)
  const hatchLight = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, color: '#8dffb0' }))
  hatchLight.material.userData.own = true
  hatchLight.scale.setScalar(0.008)
  hatchLight.position.copy(hatch).add(new THREE.Vector3(0.007, 0.001, 0))
  group.add(hatchLight)
  const lastArrival = workers.reduce((m, w) => Math.max(m, w.arrive ?? -1), -1)

  // Bäraren flyger med en balk mellan kärnan och bygget (när någon bygger)
  const anyone = workers.some((w) => w.tether)
  const carrier = anyone ? buildAstronaut() : null
  if (carrier) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0012, 0.0012), frameMat())
    beam.position.set(0, 0.0005, 0.0028)
    carrier.body.add(beam)
    carrier.arms.forEach((s) => (s.rotation.x = -1.2))
    group.add(carrier.body)
  }
  const from = new THREE.Vector3(0.01, 0.05, 0.02)
  const to = site.clone().add(new THREE.Vector3(0, 0.022, 0))

  // Kapseln som kommer med nya byggare (när serien gett extra byggare)
  let shuttle: THREE.Group | null = null
  const dockAt = new THREE.Vector3(0, 0.028, 0.13)
  if (!paused && (crew?.extra ?? 0) > 0) {
    shuttle = new THREE.Group()
    const shell = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.014, 20), hullMat())
    shell.rotation.x = -Math.PI / 2
    shuttle.add(shell)
    const engine = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, color: '#9fd8ff' }))
    engine.material.userData.own = true
    engine.scale.setScalar(0.008)
    engine.position.z = 0.01
    shuttle.add(engine)
    group.add(shuttle)
  }

  // Någon är inne (inte bockad än, eller pausad dag): fönstret i stationen lyser
  let window_: THREE.Sprite | null = null
  if (paused || members.some((m) => !m.working)) {
    window_ = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, color: '#ffd38a' }))
    window_.material.userData.own = true
    window_.scale.setScalar(0.02)
    window_.position.set(0, 0.028, 0.02)
    group.add(window_)
  }

  // Modulen klar idag: konfetti i lagets färger
  const confetti: { s: THREE.Sprite; v: THREE.Vector3; t0: number }[] = []
  if (crew?.celebrate) {
    const colors = ['#ffd84d', '#7fe0ff', '#ff7ab6', '#8dff9a', '#ffffff']
    for (let k = 0; k < 36; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, color: colors[k % colors.length] }))
      s.material.userData.own = true
      s.scale.setScalar(0.004)
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize()
      confetti.push({ s, v, t0: Math.random() * 2400 })
      group.add(s)
    }
  }

  const tmp = new THREE.Vector3()
  const out = hatch.clone().add(new THREE.Vector3(0, 0.012, 0))
  let t0: number | null = null
  return {
    group,
    /** Astronauterna som går att trycka på, med vanans index i laget. */
    pickables: workers.filter((w) => w.idx !== null).map((w) => ({ obj: w.body, idx: w.idx as number })),
    update(now: number, fade: number) {
      if (t0 === null) t0 = now
      const since = (now - t0) / 1000
      for (const [i, w] of workers.entries()) {
        // På väg ut ur basen: upp ur luckan, sedan en båge till bygget medan den vinkar
        if (w.arrive !== null && since < w.arrive + 5) {
          const t = since - w.arrive
          w.body.visible = t >= 0
          if (w.tether) w.tether.visible = false
          if (t < 0) continue
          if (t < 1) w.body.position.lerpVectors(hatch, out, t * t * (3 - 2 * t))
          else {
            const k = Math.min(1, (t - 1) / 4)
            const e = k * k * (3 - 2 * k)
            w.body.position.lerpVectors(out, w.base, e).add(tmp.set(0, Math.sin(e * Math.PI) * 0.02, 0))
          }
          w.arms[1].rotation.set(0, 0, 2.4 + Math.sin(now / 180) * 0.35)
          w.arms[0].rotation.x = -0.4
          continue
        }
        w.body.visible = true
        if (w.tether) w.tether.visible = true
        if (w.arrive !== null) w.arms[1].rotation.z = 0.35
        // svävar lätt och arbetar med armarna (eller vinkar)
        w.body.position.copy(w.base).add(tmp.set(0, Math.sin(now / 900 + i * 2) * 0.0012, Math.cos(now / 1300 + i) * 0.0008))
        if (crew?.celebrate && w.tether) w.body.rotation.y = now / 600 + i
        if (w.tether) {
          w.arms[1].rotation.x = -1.1 + Math.sin(now / (w.weld ? 160 : 420) + i) * (w.weld ? 0.12 : 0.45)
          w.arms[0].rotation.x = -0.5 + Math.sin(now / 700 + i) * 0.2
        } else {
          w.arms[0].rotation.x = Math.sin(now / 1600 + i) * 0.3
          w.arms[1].rotation.x = -Math.sin(now / 1700 + i) * 0.3
        }
        if (w.tether) {
          const pts = w.tether.geometry.attributes.position as THREE.BufferAttribute
          pts.setXYZ(1, w.body.position.x, w.body.position.y, w.body.position.z)
          pts.needsUpdate = true
        }
      }
      // svetsen blixtrar i korta stötar
      // luckans lampa blinkar medan någon är på väg ut
      hatchLight.material.opacity = since < lastArrival + 1.2 && Math.sin(now / 150) > 0 ? fade : fade * 0.15
      sparks.forEach(({ sp, w }, k) => {
        const on =
          w.body.visible && (w.arrive === null || since > w.arrive + 5) && Math.sin(now / 90 + k * 3) * Math.sin(now / 37 + k) > 0.15 && Math.sin(now / 2300 + k * 2) > -0.4
        sp.material.opacity = on ? fade * (0.7 + 0.3 * Math.random()) : 0
        sp.scale.setScalar(0.006 + Math.random() * 0.006)
      })
      if (carrier) {
        const u = (now / 7000) % 2
        const k = u < 1 ? u : 2 - u
        carrier.body.position.lerpVectors(from, to, k * k * (3 - 2 * k))
        carrier.body.rotation.set(0.3, u < 1 ? 0.6 : -2.5, Math.sin(now / 1500) * 0.2)
      }
      if (shuttle) {
        // 30 s: flyger in (8 s), ligger dockad (14 s), flyger iväg (8 s)
        const u = (now / 1000) % 30
        const k = u < 8 ? 1 - u / 8 : u < 22 ? 0 : (u - 22) / 8
        const e = k * k
        shuttle.position.copy(dockAt).add(tmp.set(0.05 * e, 0.06 * e, 0.3 * e))
        shuttle.visible = k < 0.999
        ;(shuttle.children[1] as THREE.Sprite).material.opacity = u < 8 || u >= 22 ? fade * 0.9 : 0
      }
      if (window_) window_.material.opacity = fade * (0.75 + 0.15 * Math.sin(now / 1800))
      for (const c of confetti) {
        const t = ((now + c.t0) % 2400) / 2400
        c.s.position.copy(site).addScaledVector(c.v, 0.06 * t).add(tmp.set(0, -0.01 * t * t, 0))
        c.s.material.opacity = fade * (1 - t)
      }
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}

/**
 * Vilka astronauter som ska komma ut ur basen nu: vanor som är bockade idag men inte var det förra gången
 * galaxen visades. Sparas per telefon och dag.
 */
export const OUT_KEY = 'vanor-galax-ute'
export function crewArrivals(crew: Crew, today: string): Set<string> {
  const working = crew.members.filter((m) => m.working).map((m) => m.id)
  let before: string[] = []
  try {
    const saved = JSON.parse(localStorage.getItem(OUT_KEY) ?? 'null') as { day: string; ids: string[] } | null
    if (saved?.day === today && Array.isArray(saved.ids)) before = saved.ids
    localStorage.setItem(OUT_KEY, JSON.stringify({ day: today, ids: working }))
  } catch {
    return new Set() // utan lagring står de redan ute
  }
  return new Set(working.filter((id) => !before.includes(id)))
}

export function buildStation(built: Set<ModuleKind>, next: ModuleKind | null = null, crewInfo: Crew | null = null, arrivals: ReadonlySet<string> = new Set()) {
  const group = new THREE.Group()
  const spin: THREE.Object3D[] = []
  const lights: THREE.Mesh[] = []
  const add = (mesh: THREE.Object3D, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }
  /** En trycksatt modul längs z-axeln: rund med avrundade ändar. */
  const module = (r: number, len: number, mat = hullMat()) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 24), mat)
    m.rotation.x = Math.PI / 2
    return m
  }
  if (!built.has('core')) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#7fe0ff', wireframe: true, transparent: true })))
    // Före första bocken: astronauterna bygger på kärnan
    const crew = buildCrew('core', crewInfo, arrivals)
    group.add(crew.group)
    return { group, spin, beacon: null as THREE.Mesh | null, lights, crew }
  }

  // Fackverket: fyra balkar med stag, stationens ryggrad
  const truss = new THREE.Group()
  const L = 0.3
  const s = 0.009
  for (const [y, z] of [[s, s], [s, -s], [-s, s], [-s, -s]]) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, L, 6), frameMat())
    beam.rotation.z = Math.PI / 2
    beam.position.set(0, y, z)
    truss.add(beam)
  }
  for (let x = -L / 2; x <= L / 2 + 1e-6; x += 0.02) {
    for (const [y, z, rot] of [[s, 0, 'x'], [-s, 0, 'x'], [0, s, 'y'], [0, -s, 'y']] as const) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0012, s * 2), frameMat())
      if (rot === 'y') strut.rotation.x = Math.PI / 2
      strut.position.set(x, y, z)
      truss.add(strut)
    }
  }
  add(truss)

  // Kärnan: två moduler i kors och en nod i mitten
  add(module(0.016, 0.09), 0, 0.028, 0)
  add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 16), hullMat()), 0, 0.028, 0)
  const cross = module(0.013, 0.05)
  cross.rotation.set(0, 0, Math.PI / 2)
  add(cross, 0, 0.028, 0)
  // Radiatorer: vita kylpaneler som sticker ut ur fackverket
  for (const side of [-1, 1]) {
    const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.0012, 0.05), metal('#f4f6f8', { metalness: 0.1, roughness: 0.7 }))
    radiator.position.set(side * 0.05, -0.012, 0)
    radiator.rotation.x = 0.5
    group.add(radiator)
  }

  // Solpanelsfält vid fackverkets ändar: två vingar uppåt och nedåt (panel), sedan två till (panel2)
  const arrays = (x: number) => {
    for (const side of [-1, 1]) {
      const wing = solarArray(0.045, 0.14)
      wing.rotation.x = 0.35
      wing.position.set(x, 0, side * 0.085)
      group.add(wing)
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 12), foilMat())
    mast.rotation.x = Math.PI / 2
    mast.position.set(x, 0, 0)
    group.add(mast)
  }
  if (built.has('panel')) arrays(L / 2 - 0.01)
  if (built.has('panel2')) arrays(-L / 2 + 0.01)

  if (built.has('antenna')) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 8), frameMat())
    add(boom, 0.02, 0.07, -0.02)
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.016, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3.2), metal('#f4f6f8', { side: THREE.DoubleSide, metalness: 0.3, roughness: 0.4 }))
    dish.rotation.x = Math.PI + 0.5
    add(dish, 0.02, 0.098, -0.02)
    const feed = new THREE.Mesh(new THREE.ConeGeometry(0.002, 0.008, 8), foilMat())
    add(feed, 0.02, 0.09, -0.017)
  }
  if (built.has('dock')) {
    // Dockningsport med en dockad kapsel
    add(module(0.009, 0.02), 0, 0.028, 0.075)
    const port = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0018, 10, 32), foilMat())
    add(port, 0, 0.028, 0.092)
    const capsule = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.024, 24, 1, true), hullMat())
    capsule.rotation.x = -Math.PI / 2
    add(capsule, 0, 0.028, 0.108)
    const shield = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), metal('#3a3026', { metalness: 0.2, roughness: 0.9, side: THREE.DoubleSide }))
    add(shield, 0, 0.028, 0.12)
    for (const side of [-1, 1]) {
      const wing = solarArray(0.03, 0.01)
      add(wing, side * 0.028, 0.028, 0.112)
    }
  }
  if (built.has('habitat')) {
    // Uppblåsbar bostadsmodul med tygbanden synliga
    const hab = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.03, 8, 32), metal('#efece4', { metalness: 0.05, roughness: 0.85 }))
    add(hab, 0, 0.028, -0.085).rotation.x = Math.PI / 2
    for (let k = -1; k <= 1; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.0012, 8, 40), metal('#c9c4b6', { metalness: 0.1, roughness: 0.8 }))
      add(band, 0, 0.028, -0.085 + k * 0.014)
    }
  }
  if (built.has('greenhouse')) {
    // Växthus: en glaskupol med grönt ljus inifrån
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: '#cfefff', roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.6 }),
    )
    ;(dome.material as THREE.Material).userData.opacity = 0.6
    add(dome, 0, 0.048, 0)
    const plants = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3fae5c', emissive: '#2c8a45', emissiveIntensity: 0.8, transparent: true }))
    add(plants, 0, 0.048, 0)
  }
  if (built.has('telescope')) {
    // Teleskop i guldfolie med solskydd
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 24), foilMat())
    tube.rotation.z = -0.5
    add(tube, -0.06, 0.055, 0)
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.016, 24, 1, true), metal('#f4f6f8', { side: THREE.DoubleSide, metalness: 0.2 }))
    shade.rotation.z = -0.5
    add(shade, -0.047, 0.077, 0)
  }
  if (built.has('ring')) {
    // Roterande bostadsring med ekrar
    const holder = new THREE.Group()
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.0075, 16, 96), hullMat())
    ring.rotation.y = Math.PI / 2
    holder.add(ring)
    for (let k = 0; k < 6; k++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.23, 8), frameMat())
      spoke.rotation.x = (k * Math.PI) / 6
      holder.add(spoke)
    }
    holder.position.y = 0.028
    spin.push(add(holder, 0, 0.028, 0))
  }
  if (built.has('sail')) {
    // Solsegel: tunn guldfolie spänd på fyra bommar
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), metal('#ffffff', { map: hardwareTextures().foil, metalness: 1, roughness: 0.2, side: THREE.DoubleSide }))
    sail.rotation.set(0, Math.PI / 2, Math.PI / 4)
    add(sail, -0.23, 0.028, 0)
  }
  let beacon: THREE.Mesh | null = null
  if (built.has('beacon')) {
    beacon = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true }))
    add(beacon, L / 2, 0.012, 0)
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 8), new THREE.MeshBasicMaterial({ color: '#4dff8a', transparent: true }))
    lights.push(add(green, -L / 2, 0.012, 0) as THREE.Mesh)
  }
  const crew = buildCrew(next, crewInfo, arrivals)
  group.add(crew.group)
  return { group, spin, beacon, lights, crew }
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
