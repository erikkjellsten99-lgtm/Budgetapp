// Rymdbasen i galaxen (CosmosView), byggd som den riktiga rymdstationen ISS och i verklig skala:
// ett långt fackverk med solpaneler som vrider sig mot solen, vita radiatorer, trycksatta moduler med
// skyddsfiltar, en kupol med fönster, en luftsluss och robotarmen. Varje milstolpe lägger till en del,
// och nästa del byggs medan du tittar på (solpanelen vecklas ut, kapseln närmar sig porten …).
// Astronauterna har riktiga rymddräkter (EMU): hård överkropp med bröstpanel, ryggsäck, hjälm med
// guldvisir och lampor, leder vid axlar, armbågar, midja och knän.
// Allt byggs i meter och skalas ner (M), så att proportionerna stämmer. Rena three.js-funktioner.

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Crew, ModuleKind } from './space'
import { noise2, seeded } from './space3d'

/** Världens enheter per meter. Fackverket (ca 100 m) blir knappt en halv enhet. */
export const M = 0.0045

/* ---------- Ytor ---------- */

const canvasTex = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** Normalkarta från en höjdfunktion (för tyg och skrynklig folie). */
function normalTex(size: number, height: (x: number, y: number) => number, strength: number) {
  return canvasTex(
    size,
    size,
    (ctx) => {
      const img = ctx.createImageData(size, size)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const dx = (height((x + 1) % size, y) - height((x + size - 1) % size, y)) * strength
          const dy = (height(x, (y + 1) % size) - height(x, (y + size - 1) % size)) * strength
          const len = Math.hypot(dx, dy, 1)
          const i = (y * size + x) * 4
          img.data[i] = (0.5 - (dx / len) * 0.5) * 255
          img.data[i + 1] = (0.5 + (dy / len) * 0.5) * 255
          img.data[i + 2] = (0.5 + (1 / len) * 0.5) * 255
          img.data[i + 3] = 255
        }
      ctx.putImageData(img, 0, 0)
    },
    false,
  )
}

export interface StationMaterials {
  mmod: THREE.MeshStandardMaterial
  fabric: THREE.MeshStandardMaterial
  armWhite: THREE.MeshStandardMaterial
  truss: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  cells: THREE.MeshStandardMaterial
  cellsBack: THREE.MeshStandardMaterial
  radiator: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  rail: THREE.MeshStandardMaterial
  russian: THREE.MeshStandardMaterial
  suit: THREE.MeshStandardMaterial
  joint: THREE.MeshStandardMaterial
  visor: THREE.MeshStandardMaterial
  stripe: THREE.MeshStandardMaterial
  lamp: THREE.MeshBasicMaterial
  windowLit: THREE.MeshBasicMaterial
  grow: THREE.MeshBasicMaterial
  textures: THREE.Texture[]
}

export function stationMaterials(): StationMaterials {
  const n = noise2(42)
  const n2 = noise2(4242)
  const rand = seeded(7)
  // Skyddsfiltarna mot mikrometeoriter: benvita paneler med fogar, bultar och lite smuts
  const mmodMap = canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#e6e4dd'
    ctx.fillRect(0, 0, 512, 512)
    for (let y = 0; y < 512; y += 128)
      for (let x = 0; x < 512; x += 64) {
        const tint = 0.93 + n(x / 40, y / 40) * 0.1
        ctx.fillStyle = `rgb(${226 * tint},${224 * tint},${217 * tint})`
        ctx.fillRect(x + 2, y + 2, 60, 124)
        ctx.fillStyle = 'rgba(70,72,78,0.55)'
        for (const [bx, by] of [[6, 6], [56, 6], [6, 120], [56, 120]]) ctx.fillRect(x + bx, y + by, 2, 2)
      }
    ctx.fillStyle = 'rgba(90,92,98,0.35)'
    for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 2, 512)
    for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y, 512, 2)
    for (let k = 0; k < 26; k++) {
      ctx.fillStyle = `rgba(40,42,48,${0.25 + rand() * 0.35})`
      ctx.fillRect(rand() * 500, rand() * 500, 4 + rand() * 18, 3 + rand() * 6)
    }
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = 'rgba(200,160,70,0.6)'
      ctx.fillRect(rand() * 500, rand() * 500, 10, 3)
    }
  })
  const fabricNormal = normalTex(128, (x, y) => n(x / 9, y / 5) * 0.7 + n2(x / 3, y / 3) * 0.3, 3.2)
  // Guldfolie: skrynklig, med ljusa och mörka veck
  const foilMap = canvasTex(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256)
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const v = n(x / 10, y / 10) * 0.65 + n2(x / 3, y / 3) * 0.35
        const i = (y * 256 + x) * 4
        img.data[i] = 150 + v * 105
        img.data[i + 1] = 104 + v * 80
        img.data[i + 2] = 34 + v * 36
        img.data[i + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  })
  const foilNormal = normalTex(128, (x, y) => n(x / 4, y / 4) * 0.6 + n2(x / 1.6, y / 1.6) * 0.4, 5)
  // Solcellerna: mörka, kopparskimrande celler i ett rutnät, med en tunn ljus kant runt varje cell
  const cellMap = canvasTex(256, 1024, (ctx) => {
    ctx.fillStyle = '#9a8f80'
    ctx.fillRect(0, 0, 256, 1024)
    for (let y = 0; y < 1024; y += 16)
      for (let x = 0; x < 256; x += 16) {
        if (x >= 120 && x < 136) continue // mitten där masten löper
        const t = 0.8 + n(x / 30, y / 60) * 0.35
        const g = ctx.createLinearGradient(0, y, 0, y + 16)
        g.addColorStop(0, `rgb(${92 * t},${58 * t},${34 * t})`)
        g.addColorStop(1, `rgb(${58 * t},${34 * t},${24 * t})`)
        ctx.fillStyle = g
        ctx.fillRect(x + 1, y + 1, 14, 14)
      }
    ctx.fillStyle = 'rgba(210,200,180,0.5)'
    for (let y = 0; y < 1024; y += 128) ctx.fillRect(0, y, 256, 2)
  })
  const radMap = canvasTex(64, 256, (ctx) => {
    ctx.fillStyle = '#eceeef'
    ctx.fillRect(0, 0, 64, 256)
    ctx.fillStyle = 'rgba(120,126,136,0.45)'
    for (let y = 0; y < 256; y += 32) ctx.fillRect(0, y, 64, 2)
    ctx.fillStyle = 'rgba(120,126,136,0.25)'
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 1, 256)
  })
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
  return {
    mmod: std({ map: mmodMap, roughness: 0.72, metalness: 0.04, normalMap: fabricNormal, normalScale: new THREE.Vector2(0.25, 0.25) }),
    fabric: std({ color: '#ebe9e3', roughness: 0.9, metalness: 0, normalMap: fabricNormal, normalScale: new THREE.Vector2(0.22, 0.22) }),
    armWhite: std({ color: '#eeedea', roughness: 0.6, metalness: 0.1 }),
    truss: std({ color: '#c2c6cc', roughness: 0.4, metalness: 0.75 }),
    dark: std({ color: '#3c4048', roughness: 0.55, metalness: 0.55 }),
    gold: std({ map: foilMap, color: '#ffffff', roughness: 0.3, metalness: 1, normalMap: foilNormal, normalScale: new THREE.Vector2(0.8, 0.8) }),
    cells: std({ map: cellMap, color: '#ffffff', roughness: 0.32, metalness: 0.6 }),
    cellsBack: std({ color: '#b8b4ac', roughness: 0.8, metalness: 0.1 }),
    radiator: std({ map: radMap, roughness: 0.55, metalness: 0.05 }),
    glass: std({ color: '#0d1218', roughness: 0.06, metalness: 0.9 }),
    rail: std({ color: '#d7b25a', roughness: 0.45, metalness: 0.8 }),
    russian: std({ color: '#dcdcd2', roughness: 0.8, metalness: 0.05, normalMap: fabricNormal, normalScale: new THREE.Vector2(0.4, 0.4) }),
    suit: std({ color: '#f3f1ec', roughness: 0.86, metalness: 0, normalMap: fabricNormal, normalScale: new THREE.Vector2(0.2, 0.2) }),
    joint: std({ color: '#8a9099', roughness: 0.42, metalness: 0.72 }),
    visor: std({ color: '#e7b450', roughness: 0.14, metalness: 1, emissive: new THREE.Color('#3b2706') }),
    stripe: std({ color: '#c8322a', roughness: 0.8, metalness: 0 }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.6) }),
    windowLit: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.95) }),
    grow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.6, 2.2) }),
    textures: [mmodMap, fabricNormal, foilMap, foilNormal, cellMap, radMap],
  }
}

/* ---------- Byggverktyg ---------- */


/** Lägg en del i gruppen, med läge och vridning. */
function put<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
  obj.position.set(x, y, z)
  obj.rotation.set(rx, ry, rz)
  parent.add(obj)
  return obj
}

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(geo, mat)

/** Cylinder längs en axel ('x', 'y' eller 'z'). */
function cyl(r: number, len: number, axis: 'x' | 'y' | 'z', seg = 20, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg)
  if (axis === 'x') g.rotateZ(-Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  return g
}

/** Gör geometrin redo att slås ihop: utan index, bara läge, normal och uv. */
function plain(geo: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
  g.applyMatrix4(matrix)
  return g
}

/**
 * Slå ihop alla delar i `parts` till en geometri per material och lägg dem i `into`, så att stationen
 * ritas med få anrop. `parts` måste ligga under `into` och tas bort efteråt.
 */
function bake(parts: THREE.Object3D, into: THREE.Object3D) {
  into.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(into.matrixWorld).invert()
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  parts.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const list = byMat.get(m.material) ?? []
    list.push(plain(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)))
    byMat.set(m.material, list)
    m.geometry.dispose()
  })
  parts.removeFromParent()
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list)
    list.forEach((g) => g.dispose())
    if (!merged) continue
    const out = new THREE.Mesh(merged, mat)
    out.castShadow = out.receiveShadow = !(mat instanceof THREE.MeshBasicMaterial)
    into.add(out)
  }
}

/** Bygg delar som slås ihop direkt i `parent`. */
function baked(parent: THREE.Object3D, build: (g: THREE.Group) => void) {
  const g = new THREE.Group()
  parent.add(g)
  build(g)
  bake(g, parent)
}

/** Trycksatt modul: cylinder med skyddsfiltar (texturen skalad till meter), välvda ändar, ringar och ledstänger. */
function pressurized(parent: THREE.Object3D, mats: StationMaterials, r: number, len: number, axis: 'x' | 'y' | 'z', x: number, y: number, z: number, mat = mats.mmod) {
  const g = new THREE.Group()
  const body = new THREE.CylinderGeometry(r, r, len, 32, 1, true)
  const uv = body.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((2 * Math.PI * r) / 4), uv.getY(i) * (len / 4))
  g.add(mesh(body, mat))
  for (const s of [-1, 1]) {
    const cap = new THREE.SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    cap.scale(1, 0.3, 1)
    if (s < 0) cap.rotateX(Math.PI)
    cap.translate(0, (s * len) / 2, 0)
    g.add(mesh(cap, mat))
    const ring = new THREE.TorusGeometry(r * 1.01, 0.07, 6, 40)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, (s * len) / 2 - s * 0.1, 0)
    g.add(mesh(ring, mats.truss))
  }
  // Ledstänger längs sidorna (de gula handtagen astronauterna håller i)
  for (const a of [0.35, Math.PI - 0.35, Math.PI + 0.9]) {
    const rail = new THREE.BoxGeometry(0.05, len * 0.8, 0.05)
    rail.translate(Math.cos(a) * (r + 0.12), 0, Math.sin(a) * (r + 0.12))
    g.add(mesh(rail, mats.rail))
  }
  if (axis === 'x') g.rotation.z = -Math.PI / 2
  if (axis === 'z') g.rotation.x = Math.PI / 2
  g.position.set(x, y, z)
  parent.add(g)
  return g
}

/** Ett fackverk längs x: fyra balkar med ramar och diagonaler, som på ISS, och utrustningslådor inuti. */
function trussSegment(parent: THREE.Object3D, mats: StationMaterials, x0: number, x1: number, y: number, z: number, size = 4.4) {
  const g = new THREE.Group()
  const len = Math.abs(x1 - x0)
  const h = size / 2
  const beam = 0.16
  for (const [cy, cz] of [[h, h], [h, -h], [-h, h], [-h, -h]]) put(g, mesh(new THREE.BoxGeometry(len, beam, beam), mats.truss), 0, cy, cz)
  const bays = Math.max(1, Math.round(len / 4.4))
  const bay = len / bays
  for (let i = 0; i <= bays; i++) {
    const x = -len / 2 + i * bay
    for (const [cy, cz, w, d] of [[h, 0, beam, size], [-h, 0, beam, size], [0, h, size, beam], [0, -h, size, beam]]) put(g, mesh(new THREE.BoxGeometry(beam, w, d), mats.truss), x, cy, cz)
    if (i === bays) break
    const diag = Math.hypot(bay, size)
    const ang = Math.atan2(size, bay) * (i % 2 ? 1 : -1)
    for (const side of [-1, 1]) {
      put(g, mesh(new THREE.BoxGeometry(diag, 0.1, 0.1), mats.truss), x + bay / 2, 0, side * h, 0, 0, ang)
      put(g, mesh(new THREE.BoxGeometry(diag, 0.1, 0.1), mats.truss), x + bay / 2, side * h, 0, 0, -ang, 0)
    }
  }
  const rand = seeded(Math.round(x0 * 13 + 7))
  for (let i = 0; i < bays; i++) {
    if (rand() < 0.45) continue
    const x = -len / 2 + (i + 0.5) * bay
    put(g, mesh(new RoundedBoxGeometry(bay * 0.6, size * 0.45, size * 0.35, 1, 0.1), rand() < 0.5 ? mats.fabric : mats.dark), x, -h * 0.25, (rand() - 0.5) * h)
  }
  g.position.set((x0 + x1) / 2, y, z)
  parent.add(g)
  return g
}

/** En solpanelsvinge längs +z: mast i mitten och filten med celler, `deploy` 0–1 hur utvecklad. */
function solarWing(parent: THREE.Object3D, mats: StationMaterials, length: number, width: number, deploy = 1) {
  const g = new THREE.Group()
  parent.add(g)
  const L = Math.max(0.6, length * deploy)
  // Lådorna filten veckas ihop i, vid roten och längst ut
  put(g, mesh(new THREE.BoxGeometry(width * 1.04, 0.5, 0.7), mats.dark), 0, 0, 0.35)
  put(g, mesh(new THREE.BoxGeometry(width * 1.04, 0.5, 0.7), mats.dark), 0, 0, L + 0.35)
  const blanket = new THREE.PlaneGeometry(width, L)
  blanket.rotateX(-Math.PI / 2)
  const uv = blanket.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * deploy)
  put(g, mesh(blanket, mats.cells), 0, 0.03, L / 2 + 0.35)
  const back = blanket.clone()
  back.rotateX(Math.PI)
  put(g, mesh(back, mats.cellsBack), 0, -0.03, L / 2 + 0.35)
  put(g, mesh(cyl(0.12, L, 'z', 8), mats.truss), 0, 0.12, L / 2 + 0.35)
  return g
}

/** En vit radiator: en rad paneler längs +z. */
function radiator(parent: THREE.Object3D, mats: StationMaterials, panels: number, panelLen: number, width: number) {
  const g = new THREE.Group()
  parent.add(g)
  for (let i = 0; i < panels; i++) put(g, mesh(new THREE.BoxGeometry(width, 0.12, panelLen * 0.96), mats.radiator), 0, 0, (i + 0.5) * panelLen)
  put(g, mesh(cyl(0.1, panels * panelLen, 'z', 6), mats.truss), -width / 2, 0.08, (panels * panelLen) / 2)
  return g
}

/* ---------- Astronauten (rymddräkten EMU) ---------- */

export interface Astronaut {
  root: THREE.Group
  shoulder: [THREE.Bone, THREE.Bone]
  elbow: [THREE.Bone, THREE.Bone]
  hip: [THREE.Bone, THREE.Bone]
  knee: [THREE.Bone, THREE.Bone]
}

/**
 * En astronaut i rymddräkt, ca 2 m hög, med midjan i origo och fronten mot +z.
 * Byggd som ett skelett med stela delar (ett ritanrop per material). `lead` = röda ränder på benen,
 * som på den som leder en rymdpromenad.
 */
export function buildAstronaut(mats: StationMaterials, lead = false, tool = true): Astronaut {
  const root = new THREE.Group()
  const waist = new THREE.Bone()
  const mk = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const b = new THREE.Bone()
    b.position.set(x, y, z)
    parent.add(b)
    return b
  }
  const shoulder = [mk(waist, -0.36, 0.5, 0), mk(waist, 0.36, 0.5, 0)] as [THREE.Bone, THREE.Bone]
  const elbow = [mk(shoulder[0], 0, -0.33, 0), mk(shoulder[1], 0, -0.33, 0)] as [THREE.Bone, THREE.Bone]
  const hip = [mk(waist, -0.13, -0.2, 0), mk(waist, 0.13, -0.2, 0)] as [THREE.Bone, THREE.Bone]
  const knee = [mk(hip[0], 0, -0.4, 0), mk(hip[1], 0, -0.4, 0)] as [THREE.Bone, THREE.Bone]
  const bones = [waist, ...shoulder, ...elbow, ...hip, ...knee]
  root.add(waist)
  root.updateMatrixWorld(true)

  // Delarna: geometri, material och benet de sitter på
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material; bone: THREE.Bone }[] = []
  const add = (bone: THREE.Bone, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)))
    parts.push({ geo, mat, bone })
  }
  // Hård överkropp, bröstpanelen (DCM) med reglage, ryggsäcken (PLSS) och SAFER-enheten under den
  add(waist, new RoundedBoxGeometry(0.58, 0.6, 0.4, 3, 0.16), mats.suit, 0, 0.33, 0)
  add(waist, new RoundedBoxGeometry(0.36, 0.15, 0.17, 2, 0.04), mats.suit, 0, 0.2, 0.27)
  for (const [x, c] of [[-0.1, mats.joint], [0, mats.stripe], [0.1, mats.joint]] as const) add(waist, cyl(0.025, 0.04, 'z', 8), c, x, 0.22, 0.37)
  add(waist, new RoundedBoxGeometry(0.6, 0.76, 0.26, 3, 0.08), mats.suit, 0, 0.38, -0.33)
  add(waist, new RoundedBoxGeometry(0.62, 0.16, 0.26, 2, 0.05), mats.joint, 0, -0.04, -0.33)
  // Midjeleden och byxdelen
  add(waist, new THREE.TorusGeometry(0.2, 0.022, 8, 28), mats.joint, 0, 0.03, 0, Math.PI / 2)
  add(waist, new RoundedBoxGeometry(0.46, 0.28, 0.34, 3, 0.12), mats.suit, 0, -0.1, 0)
  // Hjälmen: vitt skal (EVVA) med guldvisir framtill, en lampa på var sida och en kamera ovanpå
  const hy = 0.78
  const hz = 0.05
  const front = Math.PI / 2
  add(waist, new THREE.SphereGeometry(0.168, 18, 12), mats.glass, 0, hy, hz)
  add(waist, new THREE.SphereGeometry(0.182, 24, 14, front + Math.PI * 0.4, Math.PI * 1.2, 0, Math.PI * 0.78), mats.suit, 0, hy, hz)
  add(waist, new THREE.SphereGeometry(0.182, 24, 5, 0, Math.PI * 2, 0, Math.PI * 0.22), mats.suit, 0, hy, hz)
  add(waist, new THREE.SphereGeometry(0.186, 28, 14, front - Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.21, Math.PI * 0.42), mats.visor, 0, hy, hz)
  add(waist, new THREE.TorusGeometry(0.15, 0.022, 8, 28), mats.joint, 0, hy - 0.13, hz, Math.PI / 2)
  for (const s of [-1, 1]) {
    add(waist, new RoundedBoxGeometry(0.045, 0.05, 0.13, 1, 0.015), mats.suit, s * 0.16, hy + 0.11, hz + 0.03)
    add(waist, new THREE.CircleGeometry(0.017, 12), mats.lamp, s * 0.16, hy + 0.11, hz + 0.096)
  }
  add(waist, new RoundedBoxGeometry(0.045, 0.045, 0.09, 1, 0.012), mats.joint, 0.07, hy + 0.18, hz + 0.04)
  // Armar: axelled, överarm, armbåge, underarm, handled och handske (med verktyget i höger hand)
  const limb = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 12)
  for (const i of [0, 1]) {
    const s = i === 0 ? -1 : 1
    // Axellagret sitter där armen går in i överkroppen
    add(shoulder[i], new THREE.TorusGeometry(0.082, 0.016, 8, 22), mats.joint, 0, -0.05, 0, Math.PI / 2)
    add(shoulder[i], limb(0.074, 0.2), mats.suit, 0, -0.17, 0)
    add(elbow[i], limb(0.064, 0.18), mats.suit, 0, -0.13, 0)
    add(elbow[i], new THREE.TorusGeometry(0.062, 0.016, 6, 18), mats.joint, 0, -0.27, 0, Math.PI / 2)
    add(elbow[i], new RoundedBoxGeometry(0.1, 0.16, 0.065, 2, 0.03), mats.suit, 0, -0.37, 0.01)
    add(elbow[i], limb(0.022, 0.05), mats.suit, s * -0.055, -0.33, 0.03, 0, 0, s * 0.6)
    if (tool && s > 0) {
      add(elbow[i], new RoundedBoxGeometry(0.09, 0.12, 0.22, 1, 0.02), mats.joint, 0, -0.42, 0.1)
      add(elbow[i], cyl(0.02, 0.1, 'z', 8), mats.joint, 0, -0.44, 0.25)
    }
  }
  // Ben: lår, knä, smalben och känga med mörk sula
  for (const i of [0, 1]) {
    add(hip[i], limb(0.09, 0.26), mats.suit, 0, -0.2, 0)
    add(knee[i], limb(0.08, 0.26), mats.suit, 0, -0.2, 0)
    add(knee[i], new RoundedBoxGeometry(0.15, 0.13, 0.31, 2, 0.05), mats.suit, 0, -0.43, 0.05)
    add(knee[i], new THREE.BoxGeometry(0.15, 0.03, 0.31), mats.joint, 0, -0.5, 0.05)
    if (lead) {
      add(hip[i], cyl(0.1, 0.07, 'y', 16), mats.stripe, 0, -0.22, 0)
      add(knee[i], cyl(0.088, 0.07, 'y', 16), mats.stripe, 0, -0.18, 0)
    }
  }

  // Slå ihop per material till ett skelettnät, där varje hörn följer sitt ben
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const p of parts) {
    const g = plain(p.geo, p.bone.matrixWorld)
    p.geo.dispose()
    const count = g.getAttribute('position').count
    const idx = new Uint16Array(count * 4)
    const w = new Float32Array(count * 4)
    const bi = bones.indexOf(p.bone)
    for (let k = 0; k < count; k++) {
      idx[k * 4] = bi
      w[k * 4] = 1
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4))
    const list = byMat.get(p.mat) ?? []
    list.push(g)
    byMat.set(p.mat, list)
  }
  const skeleton = new THREE.Skeleton(bones)
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list)
    list.forEach((g) => g.dispose())
    if (!merged) continue
    const m = new THREE.SkinnedMesh(merged, mat)
    m.frustumCulled = false
    m.castShadow = m.receiveShadow = mat !== mats.lamp
    root.add(m)
    m.bind(skeleton)
  }
  return { root, shoulder, elbow, hip, knee }
}

/** Kroppen avslappnad som i tyngdlöshet: armarna lite framåt, knäna böjda. */
function neutral(a: Astronaut, t: number, phase: number) {
  const b = Math.sin(t * 0.7 + phase) * 0.04
  a.hip[0].rotation.set(-0.35 + b, 0, -0.06)
  a.hip[1].rotation.set(-0.3 - b, 0, 0.06)
  a.knee[0].rotation.x = 0.55 + b
  a.knee[1].rotation.x = 0.5 - b
}

/** Vrid så att huvudet pekar `up` och fronten så nära `front` som går. */
function orient(q: THREE.Quaternion, up: THREE.Vector3, front: THREE.Vector3) {
  const y = up.clone().normalize()
  const z = front.clone().addScaledVector(y, -front.dot(y))
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x)
  z.normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

/* ---------- Stationen ---------- */

/** Var nästa modul byggs (meter, i stationens lokala läge): där arbetslaget samlas. */
export const MODULE_SITE: Record<ModuleKind, [number, number, number]> = {
  core: [0, 2.6, -7.6],
  panel: [34, 3.2, 3],
  panel2: [-34, 3.2, 3],
  antenna: [1.5, 9.5, -6],
  dock: [0, 1.6, 15.5],
  habitat: [0, 6.5, 12.4],
  greenhouse: [-5.2, -4.6, -4.8],
  telescope: [22, 9.2, 3],
  ring: [0, 16.5, -46],
  sail: [0, 9, -30],
  beacon: [1.5, 12, -6],
}

export interface CrewPick {
  obj: THREE.Object3D
  idx: number
}

export interface Station {
  /** Läggs i världen på basens plats (oskalad). */
  group: THREE.Group
  pickables: CrewPick[]
  /** Platsen där nästa modul byggs, i världen (för kameran). */
  siteWorld(out?: THREE.Vector3): THREE.Vector3
  /** `sunLocal` = riktningen mot solen i basens läge, `near` = kameran är nära (rita arbetslaget). */
  update(now: number, sunLocal: THREE.Vector3, near: boolean, shadowed: boolean): void
  dispose(): void
}

/**
 * Bygg stationen av de moduler som är klara, och nästa modul medan den byggs.
 * Arbetslaget kopplat till vanorna:
 * - en astronaut per vana: bockad idag = ute och bygger (med livlina), annars inne i basen (fönstren lyser)
 * - den som leder arbetet står på robotarmens fotplatta vid bygget, när armen når dit
 * - nyss bockad (sedan galaxen visades sist): kommer ut ur luftslussen och tar sig fram till bygget
 * - extra byggare för långa serier, som kommer med en kapsel
 * - pausad dag: alla vilar inne; milstolpe idag: laget vinkar och modulen blixtrar till
 */
export function buildStation(built: Set<ModuleKind>, next: ModuleKind | null, crew: Crew | null, arrivals: ReadonlySet<string> = new Set()): Station {
  const mats = stationMaterials()
  const group = new THREE.Group()
  const root = new THREE.Group()
  root.scale.setScalar(M)
  group.add(root)
  const has = (k: ModuleKind) => built.has(k)
  const building = (k: ModuleKind) => next === k
  const progress = crew ? (crew.celebrate ? 1 : crew.progress) : 0.3
  const MOD_Y = -1.2
  const TRUSS_Y = 3.2
  const coreDone = has('core')
  // Nod 2 behövs både för dockningsporten och bostadsmodulen (som sitter ovanpå den)
  const node2 = has('dock') || building('dock') || has('habitat') || building('habitat')
  const windows: THREE.Mesh[] = []
  const extraMats: THREE.Material[] = []

  baked(root, (st) => {
    /* ----- Kärnan: Zarja och nod 1 finns alltid (så började ISS), resten kommer med första bocken ----- */
    pressurized(st, mats, 2.05, 12.6, 'z', 0, MOD_Y, -16.4, mats.russian)
    pressurized(st, mats, 2.3, 5.4, 'z', 0, MOD_Y, -7.6)
    for (const s of [-1, 1]) {
      // Zarjas små solpaneler
      const w = solarWing(st, mats, 10, 3.2)
      w.position.set(s * 2.2, MOD_Y, -12.5)
      w.rotation.y = (s * Math.PI) / 2
    }
    if (!coreDone) return
    pressurized(st, mats, 2.15, 13, 'z', 0, MOD_Y, -29.6, mats.russian) // Zvezda
    put(st, mesh(new THREE.SphereGeometry(1.4, 20, 14), mats.russian), 0, MOD_Y, -22.6)
    for (const s of [-1, 1]) {
      const w = solarWing(st, mats, 12, 3.4)
      w.position.set(s * 2.3, MOD_Y, -33)
      w.rotation.y = (s * Math.PI) / 2
    }
    pressurized(st, mats, 1.35, 6.2, 'z', 0, MOD_Y, -39.8, mats.russian) // Progress längst bak
    pressurized(st, mats, 2.15, 8.5, 'z', 0, MOD_Y, 0) // Destiny
    // Luftslussen Quest på nod 1:s styrbordssida, med luckan utåt
    pressurized(st, mats, 1.95, 3.4, 'x', 4.3, MOD_Y, -7.6)
    pressurized(st, mats, 1.05, 2.2, 'x', 7.0, MOD_Y, -7.6)
    put(st, mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 28), mats.truss), 8.15, MOD_Y, -7.6, 0, Math.PI / 2)
    // Centrala fackverket ovanpå labbet, med radiatorerna under
    trussSegment(st, mats, -20, 20, TRUSS_Y, 0)
    put(st, mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6), mats.truss), 0, TRUSS_Y - 2.6, 0)
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const r = radiator(st, mats, 8, 2.9, 3.4)
        r.position.set(s * (11 + k * 3.6), TRUSS_Y - 2.4, 0.4 + k * 0.4)
        r.rotation.x = Math.PI / 2 + 0.25
      }
    // Solpanelernas fasta del och leden de vrider sig i (alfaleden)
    for (const side of [1, -1] as const) {
      const key = side > 0 ? 'panel' : 'panel2'
      if (!has(key) && !building(key)) continue
      put(st, mesh(cyl(2.6, 2.2, 'x', 28), mats.truss), side * 21.2, TRUSS_Y, 0)
      trussSegment(st, mats, side * 22.3, side * 28, TRUSS_Y, 0)
    }
    /* ----- Dockningsporten: nod 2, adaptern och laboratorierna på sidorna ----- */
    if (node2) {
      pressurized(st, mats, 2.2, 7.2, 'z', 0, MOD_Y, 8.6)
      put(st, mesh(new THREE.CylinderGeometry(1.0, 1.4, 2.2, 24), mats.mmod), 0, MOD_Y, 13.3, Math.PI / 2)
      put(st, mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 28), mats.truss), 0, MOD_Y, 14.45)
      pressurized(st, mats, 2.2, 11, 'x', -8, MOD_Y, 8.6) // Kibo
      put(st, mesh(new THREE.BoxGeometry(5, 3.6, 4.4), mats.fabric), -16, MOD_Y, 8.6)
      pressurized(st, mats, 2.25, 6.6, 'x', 5.6, MOD_Y, 8.6) // Columbus
    }
    /* ----- Antennen: Z1-fackverket med Ku-bandsparabolen ----- */
    if (has('antenna') || building('antenna')) {
      const k = has('antenna') ? 1 : progress
      trussSegment(st, mats, -1.6, 1.6, TRUSS_Y + 3.6, -6, 2.8)
      const boomLen = 1 + 3.5 * k
      put(st, mesh(cyl(0.12, boomLen, 'y', 8), mats.truss), 1.5, TRUSS_Y + 5 + boomLen / 2, -6)
      put(st, mesh(new THREE.ConeGeometry(0.35, 0.8, 12), mats.radiator), -1.2, TRUSS_Y + 5.6, -6)
    }
    /* ----- Bostadsmodulen: en uppblåsbar modul med tygband ovanpå nod 2 ----- */
    if (has('habitat') || building('habitat')) {
      const k = has('habitat') ? 1 : 0.35 + 0.65 * progress
      const r = 3.4 * (0.6 + 0.4 * k)
      const base = MOD_Y + 2.2
      const body = new THREE.CapsuleGeometry(r, 5 * k, 8, 32)
      put(st, mesh(body, mats.fabric), 0, base + 1.2 + r + 2.5 * k, 8.6)
      for (let i = 0; i < 5; i++) put(st, mesh(new THREE.TorusGeometry(r * 1.01, 0.09, 6, 48), mats.dark), 0, base + 1.2 + r + 2.5 * k + (i - 2) * 1.2 * k, 8.6, Math.PI / 2)
      put(st, mesh(cyl(1.3, 1.6, 'y', 24), mats.mmod), 0, base + 0.6, 8.6)
    }
    /* ----- Växthuset: nod 3 med kupolen, där odlingslamporna lyser rosa genom fönstren ----- */
    if (has('greenhouse') || building('greenhouse')) {
      pressurized(st, mats, 2.2, 6.7, 'x', -5.6, MOD_Y, -7.6)
      const cy = MOD_Y - 2.75
      put(st, mesh(new THREE.CylinderGeometry(1.0, 1.5, 1.3, 7), mats.mmod), -5.2, cy, -7.6)
      put(st, mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24), mats.glass), -5.2, cy - 0.67, -7.6)
      for (let i = 0; i < 7; i++) {
        const a = ((i + 0.5) / 7) * Math.PI * 2
        const pane = mesh(new THREE.PlaneGeometry(0.72, 0.85), mats.glass)
        pane.rotation.order = 'YXZ'
        put(st, pane, -5.2 + Math.sin(a) * 1.27, cy, -7.6 + Math.cos(a) * 1.27)
        pane.rotation.set(0.37, a, 0)
      }
      const growMat = mats.grow.clone()
      growMat.color.multiplyScalar(has('greenhouse') ? 1 : 0.15 + 0.85 * progress)
      extraMats.push(growMat)
      put(st, mesh(new THREE.CylinderGeometry(0.92, 1.38, 1.15, 7), growMat), -5.2, cy, -7.6)
    }
    /* ----- Teleskopet: ett rymdteleskop i silverfolie som servas på fackverket ----- */
    if (has('telescope') || building('telescope')) {
      const lift = building('telescope') ? 26 * (1 - progress) : 0
      const sy = TRUSS_Y + 6.4 + lift
      put(st, mesh(cyl(2.1, 9, 'x', 28), mats.radiator), 22, sy, 0)
      put(st, mesh(cyl(2.15, 2.4, 'x', 28), mats.gold), 16.6, sy, 0)
      put(st, mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.15, 28), mats.dark), 26.6, sy, 0, 0, 0, Math.PI / 2)
      put(st, mesh(new THREE.BoxGeometry(0.2, 2.4, 2.2), mats.truss), 27.2, sy + 1.6, 0, 0, 0, 0.7)
      for (const s of [-1, 1]) {
        const w = solarWing(st, mats, 7, 2.4)
        w.position.set(21, sy, s * 2.3)
        w.rotation.y = s > 0 ? 0 : Math.PI
      }
      if (!lift) put(st, mesh(new THREE.BoxGeometry(3, 2.2, 3), mats.truss), 22, TRUSS_Y + 3.2, 0)
    }
  })
  // Labbets fönster mot Jorden är ett eget nät, eftersom det kan lysa
  if (coreDone) windows.push(put(root, mesh(new THREE.CircleGeometry(0.25, 16), mats.glass), 0, MOD_Y - 2.18, 0.5, Math.PI / 2))

  if (!coreDone) {
    // Byggplats: ställningen till fackverket
    const scaffoldMat = new THREE.LineBasicMaterial({ color: '#8fb4c8', transparent: true, opacity: 0.5 })
    extraMats.push(scaffoldMat)
    put(root, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(18, 4.4, 4.4, 4, 1, 1)), scaffoldMat), 0, TRUSS_Y, -7.6)
  }

  /* ----- Solpanelerna: yttre fackverket med två par vingar per sida, som vrider sig mot solen ----- */
  const alpha: THREE.Group[] = []
  if (coreDone)
    for (const side of [1, -1] as const) {
      const key = side > 0 ? 'panel' : 'panel2'
      if (!has(key) && !building(key)) continue
      const deploy = has(key) ? 1 : 0.06 + 0.94 * progress
      const outer = put(root, new THREE.Group(), 0, TRUSS_Y, 0)
      baked(outer, (g) => {
        trussSegment(g, mats, side * 28, side * 48, 0, 0, 3.6)
        for (const px of [33.5, 44.5]) {
          for (const dir of [-1, 1]) {
            const w = solarWing(g, mats, 34, 11.4, deploy)
            w.position.set(side * px, 0, dir * 1.9)
            w.rotation.y = dir > 0 ? 0 : Math.PI
          }
          const r = radiator(g, mats, 4, 3, 2.6)
          r.position.set(side * (px - 3.5), -1.8, 0)
          r.rotation.x = -Math.PI / 2
        }
      })
      alpha.push(outer)
    }

  /* ----- Antennens parabol (vrider sig) ----- */
  let dish: THREE.Group | null = null
  if (coreDone && (has('antenna') || building('antenna'))) {
    const k = has('antenna') ? 1 : progress
    if (k > 0.5) {
      dish = put(root, new THREE.Group(), 1.5, TRUSS_Y + 6 + 3.5 * k, -6)
      const petals = has('antenna') ? 16 : Math.max(2, Math.round(16 * (k - 0.5) * 2))
      baked(dish, (g) => {
        for (let i = 0; i < petals; i++) put(g, mesh(new THREE.SphereGeometry(1.0, 3, 6, (i / 16) * Math.PI * 2, (Math.PI * 2) / 16, 0, Math.PI / 3.2), mats.radiator), 0, 0, 0, Math.PI)
        put(g, mesh(cyl(0.05, 0.9, 'y', 6), mats.truss), 0, -0.4, 0)
      })
    }
  }

  /* ----- Kapseln vid dockningsporten (som Dragon) ----- */
  let capsule: THREE.Group | null = null
  let capsuleHome: THREE.Vector3 | null = null
  if (coreDone && (has('dock') || building('dock'))) {
    capsule = put(root, new THREE.Group())
    baked(capsule, (g) => {
      put(g, mesh(new THREE.CylinderGeometry(0.9, 1.85, 3.6, 28), mats.fabric), 0, 0, 0, Math.PI / 2)
      put(g, mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.5, 28), mats.dark), 0, 0, -2.05, Math.PI / 2)
      put(g, mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.6, 28, 1, true), mats.cells), 0, 0, 3.1, Math.PI / 2)
      put(g, mesh(new THREE.CircleGeometry(1.85, 28), mats.dark), 0, 0, 4.4)
      for (const a of [0.5, 2.6, 4.7]) put(g, mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), mats.dark), Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0.6)
    })
    capsuleHome = new THREE.Vector3(0, MOD_Y, 16.6)
    capsule.position.copy(capsuleHome)
    if (building('dock')) capsule.position.z += 45 * (1 - progress)
  }

  /* ----- Rotationsringen: en ring av moduler som snurrar för konstgjord tyngdkraft ----- */
  let ring: THREE.Group | null = null
  if (coreDone && (has('ring') || building('ring'))) {
    const holder = put(root, new THREE.Group(), 0, MOD_Y, -48)
    baked(holder, (g) => put(g, mesh(cyl(1.2, 6, 'z', 20), mats.truss), 0, 0, 3))
    ring = put(holder, new THREE.Group())
    const segs = 14
    const count = has('ring') ? segs : Math.max(1, Math.round(segs * progress))
    baked(ring, (g) => {
      for (let i = 0; i < count; i++) {
        const a = (i / segs) * Math.PI * 2
        put(g, mesh(new THREE.CylinderGeometry(1.5, 1.5, (2 * Math.PI * 16) / segs - 0.6, 18), mats.mmod), Math.cos(a) * 16, Math.sin(a) * 16, 0, 0, 0, a)
      }
      for (let i = 0; i < 4; i++) put(g, mesh(cyl(0.2, 32, 'x', 6), mats.truss), 0, 0, 0, 0, 0, (i * Math.PI) / 4)
      put(g, mesh(cyl(1.6, 2.4, 'z', 20), mats.mmod))
    })
  }

  /* ----- Solseglet: en tunn, blank folie på bommar, på en mast ovanför stationen ----- */
  let sail: THREE.Group | null = null
  if (coreDone && (has('sail') || building('sail'))) {
    const k = has('sail') ? 1 : 0.1 + 0.9 * progress
    sail = put(root, new THREE.Group(), 0, TRUSS_Y + 16, -30)
    const film = new THREE.PlaneGeometry(36 * k, 36 * k, 8, 8)
    const pos = film.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.4) * Math.cos(pos.getY(i) * 0.33) * 0.3)
    film.computeVertexNormals()
    const sailMat = new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 1, roughness: 0.18, side: THREE.DoubleSide })
    extraMats.push(sailMat)
    put(sail, mesh(film, sailMat), 0, 0, 0, -Math.PI / 2, 0, Math.PI / 4).receiveShadow = true
    baked(sail, (g) => {
      for (let i = 0; i < 2; i++) put(g, mesh(cyl(0.12, 36 * k * 1.41, 'x', 6), mats.truss), 0, 0.1, 0, 0, Math.PI / 4 + (i * Math.PI) / 2, 0)
    })
    put(root, mesh(cyl(0.25, 12, 'y', 8), mats.truss), 0, TRUSS_Y + 10, -30)
  }

  /* ----- Fyren: blinkande ljus på fackverkets ändar och en stark blixt överst ----- */
  const strobes: { mesh: THREE.Mesh; phase: number }[] = []
  if (coreDone && (has('beacon') || building('beacon'))) {
    const k = has('beacon') ? 1 : progress
    put(root, mesh(cyl(0.15, 4 * k + 0.5, 'y', 8), mats.truss), -1.2, TRUSS_Y + 7 + (4 * k + 0.5) / 2, -6)
    const colors: [number, number, number, THREE.Color, number][] = [
      [-1.2, TRUSS_Y + 7.6 + 4 * k, -6, new THREE.Color(9, 9, 9), 0],
      [48, TRUSS_Y + 2, 0, new THREE.Color(7, 0.4, 0.2), 0.5],
      [-48, TRUSS_Y + 2, 0, new THREE.Color(0.3, 7, 0.7), 0.25],
    ]
    for (const [x, y, z, c, phase] of colors) {
      if (Math.abs(x) > 40 && !(x > 0 ? has('panel') : has('panel2'))) continue
      const m = new THREE.MeshBasicMaterial({ color: c })
      extraMats.push(m)
      strobes.push({ mesh: put(root, mesh(new THREE.SphereGeometry(0.4, 12, 8), m), x, y, z), phase })
    }
  }

  /* ----- Robotarmen (Canadarm2) på sin vagn längs fackverket ----- */
  const site = new THREE.Vector3(...MODULE_SITE[next ?? 'core'])
  const arm = coreDone ? buildArm(mats) : null
  if (arm) {
    arm.base.position.set(THREE.MathUtils.clamp(site.x, -24, 24), TRUSS_Y + 2.4, 2.6)
    root.add(arm.base)
  }

  /* ----- Arbetslaget ----- */
  const members = crew?.members ?? []
  const paused = !!crew?.paused
  type Worker = {
    a: Astronaut
    base: THREE.Vector3
    face: THREE.Quaternion
    idx: number | null
    /** Sekunder efter att galaxen öppnats då astronauten kommer ut ur luftslussen. */
    arrive: number | null
    onArm: boolean
    tether: THREE.Line | null
    anchor: THREE.Vector3
    phase: number
  }
  const workers: Worker[] = []
  const hatch = new THREE.Vector3(9.2, MOD_Y, -7.6)
  const crewGroup = put(root, new THREE.Group())
  const footAt = site.clone().add(new THREE.Vector3(0, 0.2, 3.2))
  const reach = arm ? arm.base.position.distanceTo(footAt) < arm.reach * 0.92 : false
  const tetherMat = new THREE.LineBasicMaterial({ color: '#d9dde3', transparent: true, opacity: 0.75 })
  extraMats.push(tetherMat)
  const addWorker = (pos: THREE.Vector3, opts: { idx?: number; arrive?: number; onArm?: boolean; lead?: boolean }) => {
    const a = buildAstronaut(mats, !!opts.lead)
    a.root.position.copy(pos)
    // Fronten mot bygget, huvudet ungefär uppåt
    const face = orient(new THREE.Quaternion(), new THREE.Vector3(0, 1, 0).add(pos.clone().sub(site).normalize().multiplyScalar(0.4)), site.clone().sub(pos))
    a.root.quaternion.copy(face)
    crewGroup.add(a.root)
    let tether: THREE.Line | null = null
    if (!opts.onArm) {
      tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => new THREE.Vector3())), tetherMat)
      tether.frustumCulled = false
      crewGroup.add(tether)
    }
    const anchor = pos.clone().lerp(site, 0.6).add(new THREE.Vector3(0, -1.4, 0))
    workers.push({ a, base: pos.clone(), face, idx: opts.idx ?? null, arrive: opts.arrive ?? null, onArm: !!opts.onArm, tether, anchor, phase: workers.length * 1.7 })
  }
  // Platser runt bygget, med astronauterna lite utspridda
  const slot = (k: number) => {
    const ang = k * 2.2 + 0.6
    const r = 2.6 + (k % 3) * 0.8
    return site.clone().add(new THREE.Vector3(Math.cos(ang) * r, 1.0 + ((k % 4) - 1.5) * 0.9, Math.sin(ang) * r))
  }
  if (!paused) {
    let s = 0
    let order = 0
    let armTaken = false
    members.forEach((m, idx) => {
      if (!m.working) return
      const arrive = arrivals.has(m.id) ? 1.2 + 3.4 * order++ : undefined
      const onArm = reach && !armTaken && arrive === undefined
      if (onArm) armTaken = true
      addWorker(onArm ? footAt : slot(s++), { idx, arrive, onArm, lead: idx === 0 })
    })
    for (let k = 0; k < (crew?.extra ?? 0); k++) addWorker(slot(s++), {})
    if (!crew || members.length === 0) for (let k = 0; k < 2; k++) addWorker(k === 0 && reach ? footAt : slot(k), { onArm: reach && k === 0 })
  }
  // Någon är inne (inte bockad än, eller pausad dag): fönstren lyser varmt
  const inside = paused || members.some((m) => !m.working)
  if (inside && coreDone) {
    for (const w of windows) w.material = mats.windowLit
    for (const z of [-26.5, -28.5, -30.5]) put(root, mesh(new THREE.CircleGeometry(0.2, 12), mats.windowLit), 2.18, MOD_Y + 0.5, z, 0, Math.PI / 2)
  }

  // Bäraren: en astronaut som tar sig fram med en reservdel mellan luftslussen och bygget
  const carrier = workers.length ? buildAstronaut(mats) : null
  let cargo: THREE.Mesh | null = null
  if (carrier) {
    crewGroup.add(carrier.root)
    cargo = put(crewGroup, mesh(new RoundedBoxGeometry(0.9, 0.6, 0.6, 2, 0.06), mats.fabric))
    cargo.castShadow = true
  }

  // Firar idag: modulen blixtrar till i korta ljusglimtar
  const glints: THREE.Mesh[] = []
  if (crew?.celebrate) {
    const rand = seeded(99)
    const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 3.6) })
    extraMats.push(glintMat)
    for (let k = 0; k < 24; k++) {
      const g = put(root, mesh(new THREE.SphereGeometry(0.12, 6, 4), glintMat), site.x + (rand() - 0.5) * 8, site.y + (rand() - 0.5) * 6, site.z + (rand() - 0.5) * 8)
      g.userData.phase = rand() * 10
      glints.push(g)
    }
  }

  // Kapseln med extra byggare: flyger in, dockar och åker iväg (när dockningsporten är klar)
  const shuttleLoop = !paused && (crew?.extra ?? 0) > 0 && has('dock')

  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const pathMid = new THREE.Vector3(7, TRUSS_Y + 3.5, -2)
  const toward = new THREE.Vector3()
  const bezier = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3) =>
    out.copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t)
  /** På väg längs banan: huvudet framåt, fronten mot stationen (hand över hand längs ledstängerna). */
  const travel = (a: Astronaut, from: THREE.Vector3, to: THREE.Vector3, s: number, ds: number) => {
    bezier(from, pathMid, to, s, a.root.position)
    bezier(from, pathMid, to, THREE.MathUtils.clamp(s + ds, 0, 1), tmp)
    const dir = tmp.sub(a.root.position)
    if (dir.lengthSq() < 1e-8) return
    toward.set(0, MOD_Y, a.root.position.z).sub(a.root.position)
    a.root.quaternion.slerp(orient(quat, dir, toward), 0.12)
  }
  let t0: number | null = null
  const updateTether = (w: Worker) => {
    if (!w.tether) return
    const pos = w.tether.geometry.getAttribute('position') as THREE.BufferAttribute
    const to = w.a.root.position
    for (let i = 0; i < pos.count; i++) {
      const t = i / (pos.count - 1)
      const sag = Math.sin(t * Math.PI) * 0.45
      pos.setXYZ(i, w.anchor.x + (to.x - w.anchor.x) * t, w.anchor.y + (to.y - w.anchor.y) * t - sag, w.anchor.z + (to.z - w.anchor.z) * t + sag * 0.3)
    }
    pos.needsUpdate = true
  }

  return {
    group,
    pickables: workers.filter((w) => w.idx !== null).map((w) => ({ obj: w.a.root, idx: w.idx as number })),
    siteWorld(out = new THREE.Vector3()) {
      return root.localToWorld(out.copy(site))
    },
    update(now, sunLocal, near, shadowed) {
      if (t0 === null) t0 = now
      const t = (now - t0) / 1000
      // Solpanelerna vrider sig mot solen runt fackverket (alfaleden)
      const goal = Math.atan2(sunLocal.z, sunLocal.y)
      for (const a of alpha) {
        let d = goal - a.rotation.x
        d = Math.atan2(Math.sin(d), Math.cos(d))
        a.rotation.x += d * 0.03
      }
      if (dish) dish.rotation.set(0.4 + Math.sin(t / 9) * 0.2, t / 14, 0)
      if (ring) ring.rotation.z = t * 0.12
      if (sail) sail.rotation.y = Math.sin(t / 20) * 0.2
      for (const s of strobes) s.mesh.visible = (t + s.phase) % 1.6 < 0.12
      for (const g of glints) g.visible = Math.sin(t * 6 + (g.userData.phase as number)) > 0.85
      if (shuttleLoop && capsule && capsuleHome) {
        // 40 s: flyger in, ligger dockad, åker iväg
        const u = t % 40
        const k = u < 10 ? 1 - u / 10 : u < 28 ? 0 : (u - 28) / 12
        capsule.position.copy(capsuleHome).add(tmp.set(0, k * k * 8, k * k * 60))
      }
      // Hjälmlamporna syns mest i Jordens skugga
      mats.lamp.color.setScalar(shadowed ? 7 : 2.2)
      crewGroup.visible = near
      if (!near) return
      for (const w of workers) {
        const a = w.a
        neutral(a, t, w.phase)
        if (w.arrive !== null && t < w.arrive + 8) {
          const k = t - w.arrive
          a.root.visible = k >= 0
          if (w.tether) w.tether.visible = false
          if (k < 0) continue
          const e = Math.min(1, k / 8)
          travel(a, hatch, w.base, e * e * (3 - 2 * e), 0.03)
          a.shoulder[0].rotation.set(-2.5 + Math.sin(k * 3) * 0.5, 0, 0)
          a.shoulder[1].rotation.set(-2.5 - Math.sin(k * 3) * 0.5, 0, 0)
          a.elbow[0].rotation.x = a.elbow[1].rotation.x = -0.4
          continue
        }
        a.root.visible = true
        if (w.tether) w.tether.visible = true
        a.root.quaternion.slerp(w.face, 0.06)
        if (!w.onArm) a.root.position.copy(w.base).add(tmp.set(Math.sin(t * 0.5 + w.phase) * 0.12, Math.sin(t * 0.37 + w.phase) * 0.15, Math.cos(t * 0.41 + w.phase) * 0.1))
        if (crew?.celebrate) {
          a.shoulder[1].rotation.set(-2.7, 0, 0.4 + Math.sin(t * 5 + w.phase) * 0.35)
          a.shoulder[0].rotation.set(-0.6, 0, -0.2)
        } else {
          a.shoulder[1].rotation.set(-1.25 + Math.sin(t * 1.6 + w.phase) * 0.18, 0, 0.12)
          a.elbow[1].rotation.x = -0.7 + Math.sin(t * 2.3 + w.phase) * 0.25
          a.shoulder[0].rotation.set(-0.9 + Math.sin(t * 0.8 + w.phase) * 0.1, 0, -0.2)
          a.elbow[0].rotation.x = -0.9
        }
        if (w.onArm) {
          a.knee[0].rotation.x = a.knee[1].rotation.x = 0.15
          a.hip[0].rotation.x = a.hip[1].rotation.x = -0.1
        }
        updateTether(w)
      }
      if (carrier && cargo) {
        const u = (t / 16) % 2
        const k = u < 1 ? u : 2 - u
        const s = 0.12 + 0.76 * (k * k * (3 - 2 * k))
        travel(carrier, hatch, site, s, u < 1 ? 0.02 : -0.02)
        neutral(carrier, t, 3)
        carrier.shoulder[0].rotation.set(-1.4, 0, 0)
        carrier.shoulder[1].rotation.set(-1.4, 0, 0)
        carrier.elbow[0].rotation.x = carrier.elbow[1].rotation.x = -0.6
        cargo.position.copy(tmp2.set(0, 0.1, 0.75).applyQuaternion(carrier.root.quaternion).add(carrier.root.position))
        cargo.quaternion.copy(carrier.root.quaternion)
      }
      // Armen håller fotplattan under astronauten (eller vilar)
      if (arm) {
        const footWorker = workers.find((w) => w.onArm)
        if (footWorker) arm.reachTo(tmp.copy(footWorker.a.root.position).add(new THREE.Vector3(0, -2.35, 0)))
        else arm.reachTo(tmp.copy(arm.base.position).add(new THREE.Vector3(4, 5, 9)))
      }
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
      })
      for (const mat of Object.values(mats)) if (mat instanceof THREE.Material) mat.dispose()
      extraMats.forEach((m) => m.dispose())
      mats.textures.forEach((t) => t.dispose())
    },
  }
}

/** Robotarmen: bas, axel, två bommar och en griparm med fotplatta. Löser vinklarna så att handen når en punkt. */
function buildArm(mats: StationMaterials) {
  const L1 = 7.8
  const L2 = 7.8
  const base = new THREE.Group()
  baked(base, (g) => put(g, mesh(new THREE.BoxGeometry(5.5, 0.8, 5), mats.truss), 0, -0.8, 0))
  const yaw = put(base, new THREE.Group(), 0, 0.2, 0)
  baked(yaw, (g) => put(g, mesh(cyl(0.45, 0.9, 'y', 16), mats.armWhite)))
  const shoulder = put(yaw, new THREE.Group(), 0, 0.7, 0)
  baked(shoulder, (g) => {
    put(g, mesh(cyl(0.45, 0.9, 'x', 16), mats.armWhite))
    put(g, mesh(cyl(0.2, L1, 'y', 12), mats.armWhite), 0, L1 / 2, 0)
    for (const yy of [1.5, L1 - 1.5]) put(g, mesh(cyl(0.24, 0.5, 'y', 12), mats.dark), 0, yy, 0)
  })
  const elbow = put(shoulder, new THREE.Group(), 0, L1, 0)
  baked(elbow, (g) => {
    put(g, mesh(cyl(0.42, 0.85, 'x', 16), mats.armWhite))
    put(g, mesh(cyl(0.19, L2, 'y', 12), mats.armWhite), 0, L2 / 2, 0)
  })
  const wrist = put(elbow, new THREE.Group(), 0, L2, 0)
  baked(wrist, (g) => {
    put(g, mesh(cyl(0.38, 0.9, 'x', 14), mats.armWhite))
    put(g, mesh(cyl(0.3, 1.1, 'y', 14), mats.dark), 0, 0.6, 0)
    put(g, mesh(new THREE.BoxGeometry(0.9, 0.12, 0.7), mats.rail), 0, 1.2, 0)
  })
  const local = new THREE.Vector3()
  return {
    base,
    reach: L1 + L2,
    /** Vinkla armen så att handleden hamnar vid punkten (i stationens koordinater). */
    reachTo(p: THREE.Vector3) {
      local.copy(p).sub(base.position).sub(new THREE.Vector3(0, 0.9, 0))
      yaw.rotation.y = Math.atan2(local.x, local.z)
      const horiz = Math.hypot(local.x, local.z)
      const d = THREE.MathUtils.clamp(Math.hypot(horiz, local.y), 0.5, L1 + L2 - 0.01)
      // Cosinussatsen: vinkeln i armbågen och axelns lutning
      const cosE = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)
      const e = Math.PI - Math.acos(THREE.MathUtils.clamp(cosE, -1, 1))
      const toTarget = Math.atan2(horiz, local.y)
      const cosS = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
      const s = toTarget - Math.acos(THREE.MathUtils.clamp(cosS, -1, 1))
      shoulder.rotation.x += (s - shoulder.rotation.x) * 0.05
      elbow.rotation.x += (e - elbow.rotation.x) * 0.05
      wrist.rotation.x = -(shoulder.rotation.x + elbow.rotation.x)
    },
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

/** Miljön som stationen speglar: svart rymd, Jorden under (dag eller natt) och solen. */
export function spaceEnvironment(pmrem: THREE.PMREMGenerator, sunDir: THREE.Vector3, earthDir: THREE.Vector3, earthAngle: number): THREE.Texture {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const dist = 60
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uSun; varying vec3 vN;
      void main(){
        float mu = dot(normalize(vN), uSun);
        vec3 day = vec3(0.16, 0.26, 0.42) * max(mu, 0.0) * 2.2;
        gl_FragColor = vec4(day + vec3(0.012, 0.01, 0.008), 1.0);
      }`,
    side: THREE.DoubleSide,
  })
  const earth = new THREE.Mesh(new THREE.SphereGeometry(dist * Math.sin(earthAngle), 48, 24), earthMat)
  earth.position.copy(earthDir).normalize().multiplyScalar(dist)
  scene.add(earth)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 37, 33) }))
  sun.position.copy(sunDir).normalize().multiplyScalar(dist)
  scene.add(sun)
  const tex = pmrem.fromScene(scene, 0, 0.1, 200).texture
  earth.geometry.dispose()
  earthMat.dispose()
  sun.geometry.dispose()
  sun.material.dispose()
  return tex
}

