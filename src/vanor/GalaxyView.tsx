// Din galax i 3D: varje månad är ett solsystem i en spiralgalax som växer utåt för varje månad,
// och varje bock är en stjärna i armen. Börjar aldrig om. Laddas bara när den öppnas (three.js är stort).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { isoWeek, weekStart, type DateKey } from './dates'
import type { Habit, Log, Paused } from './habits'
import { planetColor, planetKind, type PlanetKind } from './planets'
import { onDataChange } from '../db'
import { holeShare, loadEconomy, type BudgetMoon, type Economy } from './economy'
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
/** Det svarta hålet (skulderna) i galaxens kärna, och sparmålets nya planet. */
const HOLE = -2
const SAVE = -3
const SAVE_POS = new THREE.Vector3(-3.4, 1.6, 0.9)
/** Budgetens månsystem, önskelistans kometer och tillgångarna (de två sista visas från hela galaxen). */
const MOONS = -4
const MOONS_POS = new THREE.Vector3(3.4, 1.4, -1.0)
const WISH = -5
const WORTH = -6
const TYPE_COLORS = { fixed: '#c9d1e0', variable: '#f0aa6c', savings: '#7be3b2' } as const
const TYPE_NAMES = { fixed: 'Fast', variable: 'Rörlig', savings: 'Sparande' } as const
const LIST_COLORS = { erik: '#8fc2ff', cassandra: '#ff9ec8' } as const

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
            <i className="gv-ico hole" aria-hidden="true" />
            Svart hål
          </dt>
          <dd>Skulderna, i galaxens kärna. Hålet krymper för varje krona ni betalar av, och slocknar när ni är skuldfria.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico newplanet" aria-hidden="true" />
            Ny planet
          </dt>
          <dd>Sparmålet. En skiva av stoft samlas ihop till en planet ju närmare målet ni kommer.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico moons" aria-hidden="true" />
            Månsystem
          </dt>
          <dd>Budgeten: en måne per kategori runt en gasjätte. Månen lyser när kategorin är betald den här månaden.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico wish" aria-hidden="true" />
            Önskekometer
          </dt>
          <dd>Önskelistan. Det som ryms i månadens överskott är nära galaxen, det som kostar flera månader ligger långt ute.</dd>
        </div>
        <div>
          <dt>
            <i className="gv-ico worth" aria-hidden="true" />
            Galaxens sken
          </dt>
          <dd>Tillgångarna. Hela galaxen lyser starkare ju större ert netto är.</dd>
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

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

const metal = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6, transparent: true, ...extra })

/** Ytor för stationen och satelliterna, ritade en gång och återanvända. */
let hardware: { cells: THREE.Texture; foil: THREE.Texture; hull: THREE.Texture } | null = null
function hardwareTextures() {
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

const cellMat = () => metal('#ffffff', { map: hardwareTextures().cells, metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide })
const foilMat = () => metal('#ffffff', { map: hardwareTextures().foil, metalness: 0.95, roughness: 0.32 })
const hullMat = () => metal('#ffffff', { map: hardwareTextures().hull, metalness: 0.15, roughness: 0.55 })
const frameMat = () => metal('#aeb6c4', { metalness: 0.8, roughness: 0.35 })

/** Ett solpanelsfält: ram och celler, på en bom. */
function solarArray(length: number, width: number) {
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
function makeSatellite(): THREE.Group {
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
function buildStation(built: Set<ModuleKind>) {
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
    return { group, spin, beacon: null as THREE.Mesh | null, lights }
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
  return { group, spin, beacon, lights }
}

/** Ackretionsskivans ljus: varmt nära hålet, med virvlande stråk, och genomskinligt längst ut. */
function diskTexture(): THREE.Texture {
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
function haloTexture(): THREE.Texture {
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
function buildBlackHole(share: number, glow: THREE.Texture) {
  const group = new THREE.Group()
  const disk = diskTexture()
  const halo = haloTexture()
  const textures = [disk, halo]
  const r = share > 0 ? 0.16 + 0.4 * share : 0.3
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
  let ring: THREE.Mesh | null = null
  if (share > 0) {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: '#000000' })))
    ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.25, r * 4.6, 160, 1), new THREE.MeshBasicMaterial({ map: disk, side: THREE.DoubleSide, ...additive }))
    ring.rotation.x = -Math.PI / 2 + 0.16
    group.add(ring)
    // Ljuset från skivans baksida böjs över och under hålet, och en tunn fotonring precis utanför horisonten
    const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#ffc98a', ...additive, opacity: 0.75 }))
    lens.scale.setScalar(r * 3.1)
    group.add(lens)
    const photon = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#fff3dc', ...additive }))
    photon.scale.setScalar(r * 2.35)
    group.add(photon)
  } else {
    // Skuldfri: en lugn, ljus ring där hålet var
    const free = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#bff5d6', ...additive }))
    free.scale.setScalar(r * 4)
    group.add(free)
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e8fff2', ...additive, opacity: 0.6 }))
    core.scale.setScalar(r * 2)
    group.add(core)
  }
  return {
    group,
    radius: r,
    update(now: number) {
      if (ring) ring.rotation.z = -now / 3000
    },
    dispose: () => textures.forEach((t) => t.dispose()),
  }
}

/**
 * Sparmålet som en planet som föds: en roterande skiva av gas och stoft som samlas ihop ju närmare målet
 * ni kommer. Vid 100 % är planeten färdig, med ringar och en måne.
 */
function buildNewPlanet(progress: number, surface: THREE.Texture, glow: THREE.Texture) {
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
function buildMoonSystem(moons: BudgetMoon[], surface: THREE.Texture, glow: THREE.Texture) {
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
  // Hushållets ekonomi (skulder och sparmål). undefined = laddas, null = gick inte att läsa.
  const [economy, setEconomy] = useState<Economy | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () =>
      loadEconomy()
        // Samma siffror som förut: behåll det gamla, så att scenen inte byggs om i onödan.
        .then((e) => alive && setEconomy((current) => (current && JSON.stringify(current) === JSON.stringify(e) ? current : e)))
        .catch(() => alive && setEconomy((current) => current ?? null))
    load()
    // Ändras något i Groundwork (här eller via synk från en annan telefon) uppdateras galaxen direkt.
    const stop = onDataChange(load)
    return () => {
      alive = false
      stop()
    }
  }, [])
  // Var kameran stod, så att galaxen kan byggas om (nya siffror eller bockar) utan att du hamnar på start.
  const viewRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3; rotating: boolean } | null>(null)
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
    // Vänta tills ekonomin är läst, så att scenen inte byggs om direkt efter att den öppnats.
    if (!mount || economy === undefined) return
    const n = Math.max(1, months.length)
    const rMax = armPoint(n - 1).r + 2.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x03050c)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // Svag miljöreflektion så att metall och guldfolie på stationen glänser som i rymden.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    scene.environmentIntensity = 0.45
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
    // Byggs galaxen om medan den är öppen står kameran kvar där den var.
    const saved = viewRef.current
    if (saved) {
      camera.position.copy(saved.position)
      controls.target.copy(saved.target)
      controls.autoRotate = saved.rotating
      controls.update()
    }

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
            envMapIntensity: 0.15,
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
    // Landmärken utanför armarna, som man kan flyga till: rymdbasen, det svarta hålet och sparplaneten.
    // Var och en har en markering (ring och sken) på avstånd och en närbild som tonas in.
    interface Landmark {
      id: number
      pos: THREE.Vector3
      /** Var kameran siktar och står, i förhållande till landmärket. */
      aim: THREE.Vector3
      view: THREE.Vector3
      /** Varifrån ljuset kommer när man är här. */
      light: THREE.Vector3
      ring: THREE.Sprite
      glow: THREE.Sprite
      group: THREE.Group
      /** Närbilden syns alltid (det svarta hålet), annars bara när man är nära. */
      always?: boolean
      /** Avstånd där närbilden börjar tonas in, och där man räknas som framme. Standard: som solsystemen. */
      from?: number
      inside?: number
      update: (now: number, fade: number) => void
    }
    const landmarks: Landmark[] = []
    const marker = (pos: THREE.Vector3, color: string, scale: number) => {
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, depthWrite: false, opacity: 0.9 }))
      ring.position.copy(pos)
      ring.scale.setScalar(scale)
      scene.add(ring)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }),
      )
      halo.position.copy(pos)
      halo.scale.setScalar(scale * 0.6)
      scene.add(halo)
      return { ring, glow: halo }
    }
    const fadeGroup = (group: THREE.Object3D, fade: number) =>
      group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m && !m.userData.own) m.opacity = fade * ((m.userData.opacity as number | undefined) ?? 1)
      })

    const station = buildStation(built)
    station.group.position.copy(BASE_POS)
    station.group.visible = false
    scene.add(station.group)
    if (station.beacon) (station.beacon.material as THREE.Material).userData.own = true
    landmarks.push({
      id: BASE,
      pos: BASE_POS,
      // Vid rymdbasen siktar kameran lite under stationen, så att den syns ovanför den höga panelen.
      aim: new THREE.Vector3(0, -0.16, 0),
      view: new THREE.Vector3(0.3, 0.38, 0.95),
      light: new THREE.Vector3(1.2, 0.8, 0.6),
      ...marker(BASE_POS, '#7fe0ff', 1.1),
      group: station.group,
      update(now, fade) {
        station.group.rotation.y = now / 14000
        for (const r of station.spin) r.rotation.x = now / 5000
        if (station.beacon) (station.beacon.material as THREE.MeshBasicMaterial).opacity = fade * (Math.sin(now / 400) > 0.6 ? 1 : 0.2)
        fadeGroup(station.group, fade)
      },
    })

    let hole: ReturnType<typeof buildBlackHole> | null = null
    if (economy && (economy.debtLeft > 0 || economy.debtMax > 0)) {
      hole = buildBlackHole(holeShare(economy.debtLeft, economy.debtMax), glow)
      scene.add(hole.group)
      const h = hole
      landmarks.push({
        id: HOLE,
        pos: new THREE.Vector3(),
        aim: new THREE.Vector3(0, -h.radius * 0.6, 0),
        view: new THREE.Vector3(0, h.radius * 2.2, h.radius * 9),
        light: new THREE.Vector3(1, 1, 1),
        ...marker(new THREE.Vector3(), '#ff9a5a', 0.9),
        group: h.group,
        always: true,
        // Hålet är större än ett solsystem, så man är framme på längre avstånd.
        from: h.radius * 15,
        inside: h.radius * 11,
        update: (now) => h.update(now),
      })
    }

    if (economy?.savings) {
      const s = economy.savings
      const born = buildNewPlanet(s.current / s.target, surfaceFor(0), glow)
      born.group.position.copy(SAVE_POS)
      born.group.visible = false
      scene.add(born.group)
      landmarks.push({
        id: SAVE,
        pos: SAVE_POS,
        aim: new THREE.Vector3(0, -0.1, 0),
        view: new THREE.Vector3(0.2, 0.55, 1.35),
        light: new THREE.Vector3(1.3, 0.7, 0.9),
        ...marker(SAVE_POS, '#7be3b2', 1.1),
        group: born.group,
        update(now, fade) {
          born.update(now)
          fadeGroup(born.group, fade)
        },
      })
    }
    if (economy && economy.budget.moons.length) {
      const moonSystem = buildMoonSystem(economy.budget.moons, surfaceFor(2), glow)
      moonSystem.group.position.copy(MOONS_POS)
      moonSystem.group.visible = false
      scene.add(moonSystem.group)
      landmarks.push({
        id: MOONS,
        pos: MOONS_POS,
        // Panelen är hög här (en rad per kategori), så kameran siktar under systemet och lyfter det uppåt.
        aim: new THREE.Vector3(0, -0.3, 0),
        view: new THREE.Vector3(-0.2, 0.55, 1.4),
        light: new THREE.Vector3(-1.2, 0.8, 0.9),
        ...marker(MOONS_POS, '#e8b46b', 1.1),
        group: moonSystem.group,
        update(now, fade) {
          moonSystem.update(now)
          fadeGroup(moonSystem.group, fade)
        },
      })
    }

    // Önskelistan: en komet per önskan. Det som ryms i månadens överskott dras in mot galaxen,
    // det som skulle ta många månader ligger långt ute.
    const comets: { head: THREE.Sprite; tail: THREE.Line; r: number; a: number; y: number }[] = []
    if (economy) {
      const list = economy.wishes.slice(0, 14)
      list.forEach((w, i) => {
        const near = rMax * 0.6
        const farthest = rMax + 3
        const reach = w.months === null ? 1 : w.months <= 1 ? 0 : Math.min(1, Math.log2(w.months) / 5)
        const r = near + reach * (farthest - near)
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.4
        const head = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glow, color: LIST_COLORS[w.list], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        )
        head.scale.setScalar(0.5)
        scene.add(head)
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
        geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))
        const tail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
        scene.add(tail)
        comets.push({ head, tail, r, a, y: 0.6 + (i % 3) * 0.35 })
      })
    }

    // Tillgångarna: hela galaxen lyser starkare ju större nettot är (1 000 kr → svagt, 1 miljon → starkt).
    const worthGlow = economy ? THREE.MathUtils.clamp((Math.log10(Math.max(1000, economy.worth.net)) - 3) / 3, 0, 1) : 0
    coreSprite.scale.multiplyScalar(0.85 + 0.4 * worthGlow)
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#ffd9a8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    halo.scale.setScalar(rMax * 3.2)
    scene.add(halo)
    fadeInside.push({ m: halo.material, base: 0.04 + 0.14 * worthGlow })

    const landmarkOf = (id: number) => landmarks.find((l) => l.id === id)

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
    const posOf = (index: number) => (index < 0 ? (landmarkOf(index)?.pos ?? new THREE.Vector3()) : systems[index].position)
    flyToRef.current = (index) => {
      const lm = index !== null && index < 0 ? landmarkOf(index) : undefined
      const target = index === null ? new THREE.Vector3() : posOf(index).clone().add(lm ? lm.aim : new THREE.Vector3())
      const dest = index === null ? home.clone() : target.clone().add(lm ? lm.view : new THREE.Vector3(0, 0.95, 1.4))
      flight = { from: camera.position.clone(), to: dest, fromT: controls.target.clone(), toT: target, start: performance.now() }
      controls.autoRotate = index === null
    }

    // Allt man kan flyga till: rymdbasen och varje månad.
    const targets = (): [number, THREE.Vector3][] => [
      ...landmarks.map((l): [number, THREE.Vector3] => [l.id, l.pos]),
      ...systems.map((sun, i): [number, THREE.Vector3] => [i, sun.position]),
    ]

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
      if (insideIndex !== null && insideIndex >= 0) {
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
      // Tryck på en komet visar önskelistan.
      for (const c of comets) {
        const projected = c.head.position.clone().project(camera)
        if (projected.z < 1 && Math.hypot(projected.x - pointer.x, projected.y - pointer.y) < 0.07) {
          setSelected(WISH)
          return
        }
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
      // Landmärkena tonas in på samma sätt när man kommer nära, och månaderna tonas bort runt dem.
      let landmarkFade = 0
      let holeFade = 0
      for (const l of landmarks) {
        const d = camera.position.distanceTo(l.pos)
        const from = l.from ?? DETAIL_FROM
        const inside = l.inside ?? INSIDE
        const fade = THREE.MathUtils.clamp((from - d) / (from - inside), 0, 1)
        landmarkFade = Math.max(landmarkFade, fade)
        if (l.id === HOLE) holeFade = fade
        l.group.visible = l.always || fade > 0
        if (l.group.visible) l.update(now, fade)
        l.ring.material.opacity = 0.9 * (1 - fade)
        l.glow.material.opacity = 0.8 * (1 - fade)
        // Avståndet räknas om så att varje landmärke är "framme" vid samma värde som solsystemen.
        const scaled = (d / inside) * INSIDE
        if (!near || scaled < (near as { d: number }).d) near = { i: l.id, d: scaled }
      }
      rings.forEach((r) => (r.material.opacity *= 1 - landmarkFade))
      systems.forEach((sun) => (sun.material.opacity = sun.userData.opacity * (1 - 0.9 * landmarkFade)))

      const maxFade = THREE.MathUtils.clamp((DETAIL_FROM - (near as { d: number } | null ?? { d: 99 }).d) / (DETAIL_FROM - INSIDE), 0, 1)
      const closest = near as { i: number; d: number } | null
      // Solen lyser upp planeterna; vid rymdbasen kommer ljuset från sidan så att stationen får skuggor.
      if (closest) {
        const lm = closest.i < 0 ? landmarkOf(closest.i) : undefined
        sunLight.position.copy(lm ? tmp.copy(lm.pos).add(lm.light) : systems[closest.i].position)
      }
      const inside =
        closest && closest.d < INSIDE && controls.target.distanceTo(posOf(closest.i)) < 0.3 ? closest.i : null
      if (inside !== insideIndex) {
        insideIndex = inside
        if (!flight) setSelected(inside)
      }

      // Kometerna glider runt, med svansen bort från galaxens kärna.
      for (const c of comets) {
        const a = c.a + now / 90000
        c.head.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r)
        const away = tmp.copy(c.head.position).setY(c.y * 0.3).normalize().multiplyScalar(0.9).add(c.head.position)
        const pos = c.tail.geometry.getAttribute('position') as THREE.BufferAttribute
        pos.setXYZ(0, c.head.position.x, c.head.position.y, c.head.position.z)
        pos.setXYZ(1, away.x, away.y, away.z)
        pos.needsUpdate = true
        const visible = 1 - landmarkFade
        c.head.material.opacity = 0.9 * visible
        ;(c.tail.material as THREE.LineBasicMaterial).opacity = 0.6 * visible
      }

      const beat = 0.5 + 0.5 * Math.sin(now / 600)
      if (current) current.material.opacity = (0.55 + 0.25 * beat) * (1 - 0.9 * landmarkFade)
      if (currentRing && currentRing.material.opacity > 0.01) currentRing.scale.setScalar(0.85 + 0.3 * beat)
      dust.rotation.y += 0.00015
      const closeness = camera.position.distanceTo(controls.target) / home.length()
      // Inne i ett solsystem tonas galaxens stjärnor ner så att solen och planeterna syns.
      // Vid det svarta hålet ligger kärnans stjärnor mellan dig och hålet – de tonas bort helt.
      for (const m of fadeWhenClose) m.opacity = Math.min(1, 0.22 + closeness * 1.1) * (1 - 0.97 * maxFade) * (1 - holeFade)
      earnedMaterial.opacity = (1 - 0.85 * maxFade) * (1 - holeFade)
      for (const f of fadeInside) (f.m as THREE.SpriteMaterial).opacity = f.base * (1 - 0.92 * maxFade) * (1 - holeFade)
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
      viewRef.current = { position: camera.position.clone(), target: controls.target.clone(), rotating: controls.autoRotate }
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
      envMap.dispose()
      hole?.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [months, log, planets, sats, built, economy])

  const selectedMonth = selected === null || selected < 0 ? null : months[selected]
  const selectedPlanets: MonthPlanet[] = selectedMonth ? planets[selected!] : []
  const selectedSats = selectedMonth ? sats[selected!] : []
  const next = nextMilestone(milestones)
  const chosenPlanet = planetSel === null ? null : (selectedPlanets[planetSel] ?? null)
  const monthComets = selectedPlanets.reduce((n, p) => n + p.comets, 0)

  const open = (i: number) => {
    setSelected(i)
    // Önskelistan och tillgångarna syns bäst från hela galaxen.
    flyToRef.current?.(i === WISH || i === WORTH ? null : i)
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
      ) : selected === HOLE && economy ? (
        <section className="gv-panel gv-economy" aria-live="polite">
          <span className="gv-label">Det svarta hålet · skulder</span>
          <b className="gv-big">{economy.debtLeft > 0 ? `${kr(economy.debtLeft)} kvar` : 'Skuldfria'}</b>
          {economy.debtMax > economy.debtLeft && (
            <p className="gv-good">
              {kr(economy.debtMax - economy.debtLeft)} avbetalt sedan du öppnade galaxen första gången. Hålet har krympt med{' '}
              {Math.round((1 - holeShare(economy.debtLeft, economy.debtMax)) * 100)}&nbsp;%.
            </p>
          )}
          {economy.debts.length > 0 && (
            <ul className="gv-rows">
              {economy.debts.map((d) => (
                <li key={d.name}>
                  <span>{d.name}</span>
                  <b>{kr(d.amount)}</b>
                </li>
              ))}
            </ul>
          )}
          <p>
            {economy.debtLeft === 0
              ? 'Hålet har slocknat. Kvar finns bara ljuset där det var.'
              : economy.loanPaidIn
                ? `Enligt prognosen är lånet betalt i ${economy.loanPaidIn}.`
                : 'Hålet krymper när ni betalar av, i takt med siffrorna under Konton och Prognos.'}
          </p>
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : selected === SAVE && economy?.savings ? (
        <section className="gv-panel gv-economy" aria-live="polite">
          <span className="gv-label">En ny planet · {economy.savings.name}</span>
          <b className="gv-big">{Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))}&nbsp;%</b>
          <div className="gv-next">
            <span>
              <b>{kr(economy.savings.current)}</b> av {kr(economy.savings.target)}
            </span>
            <span className="gv-next-bar save" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (economy.savings.current / economy.savings.target) * 100)}%` }} />
            </span>
          </div>
          <p>
            {economy.savings.current >= economy.savings.target
              ? 'Planeten är färdig. Målet är nått.'
              : `Stoftet samlas ihop för varje krona ni sparar. ${
                  economy.savings.reachedIn ? `Enligt prognosen är planeten färdig i ${economy.savings.reachedIn}.` : ''
                }`}
          </p>
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : selected === MOONS && economy ? (
        <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
          <span className="gv-label">Budgetens månar · {monthName(economy.budget.month, today)}</span>
          <b className="gv-big">
            {kr(economy.budget.paid)} <small>av {kr(economy.budget.total)} betalt</small>
          </b>
          <p>En måne per kategori, större ju större budget. Den lyser när kategorin är betald den här månaden.</p>
          <ul className="gv-rows">
            {economy.budget.moons.map((m) => (
              <li key={`${m.type}-${m.name}`} className={m.paid >= m.budget ? 'is-paid' : undefined}>
                <span>
                  <i className="gv-dot" style={{ background: TYPE_COLORS[m.type] }} aria-hidden="true" />
                  {m.name} <em>{TYPE_NAMES[m.type]}</em>
                </span>
                <b>
                  {m.paid >= m.budget ? '✓ ' : m.paid > 0 ? `${kr(m.paid)} av ` : ''}
                  {kr(m.budget)}
                </b>
              </li>
            ))}
          </ul>
          <p>
            {economy.extraPerMonth >= 0
              ? `Det blir ${kr(economy.extraPerMonth)} över att spara extra i månaden.`
              : `Budgeten går ${kr(-economy.extraPerMonth)} back i månaden.`}
          </p>
          <button type="button" className="gv-back" onClick={back}>
            Tillbaka till hela galaxen
          </button>
        </section>
      ) : selected === WISH && economy ? (
        <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
          <span className="gv-label">Önskelistan · kometer</span>
          <b className="gv-big">
            {economy.wishes.length} {economy.wishes.length === 1 ? 'önskan' : 'önskningar'}
          </b>
          <p>
            {economy.extraPerMonth > 0
              ? `Det som ryms i månadens överskott (${kr(economy.extraPerMonth)}) är nära galaxen. Ju fler månader en önskan kostar, desto längre ut ligger kometen.`
              : 'Inget blir över i budgeten den här månaden, så alla kometer ligger långt ute.'}
          </p>
          {economy.wishes.length > 0 ? (
            <ul className="gv-rows">
              {economy.wishes.map((w) => (
                <li key={`${w.list}-${w.name}`} className={w.months !== null && w.months <= 1 ? 'is-paid' : undefined}>
                  <span>
                    <i className="gv-dot" style={{ background: LIST_COLORS[w.list] }} aria-hidden="true" />
                    {w.name}
                    <em>{w.months === null ? '' : w.months <= 1 ? 'ryms nu' : `≈ ${Math.ceil(w.months)} mån`}</em>
                  </span>
                  <b>{kr(w.amount)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p>Önskelistan är tom.</p>
          )}
          <p className="gv-legend">
            <i className="gv-dot" style={{ background: LIST_COLORS.erik }} aria-hidden="true" /> Erik{' '}
            <i className="gv-dot" style={{ background: LIST_COLORS.cassandra }} aria-hidden="true" /> Cassandra
          </p>
          <button type="button" className="gv-back" onClick={() => setSelected(null)}>
            Stäng
          </button>
        </section>
      ) : selected === WORTH && economy ? (
        <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
          <span className="gv-label">Tillgångar · galaxens sken</span>
          <b className="gv-big">{kr(economy.worth.net)}</b>
          <p>Nettot: det ni äger minus lånet. Hela galaxen lyser starkare ju större det blir.</p>
          <ul className="gv-rows">
            {economy.worth.assets.map((a) => (
              <li key={a.name}>
                <span>{a.name}</span>
                <b>{kr(a.amount)}</b>
              </li>
            ))}
            {economy.worth.loan > 0 && (
              <li>
                <span>Lån</span>
                <b>− {kr(economy.worth.loan)}</b>
              </li>
            )}
          </ul>
          <button type="button" className="gv-back" onClick={() => setSelected(null)}>
            Stäng
          </button>
        </section>
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
              ? 'Gul ring: månaden. Blå: rymdbasen. Orange: skulderna. Grön: sparmålet. Guld: budgeten.'
              : 'Gula ringar är månader, blå rymdbasen, orange skulderna, grön sparmålet och guld budgeten. Tryck, eller välj nedan.'}
          </p>
          <div className="gv-months" role="list" ref={(el) => {
              if (el) el.scrollLeft = el.scrollWidth
            }}>
            {economy && (economy.debtLeft > 0 || economy.debtMax > 0) && (
              <button type="button" role="listitem" className="gv-month gv-hole-chip" onClick={() => open(HOLE)}>
                <span>Skulder</span>
                <b>{economy.debtLeft > 0 ? kr(economy.debtLeft) : '0 kr'}</b>
              </button>
            )}
            {economy?.savings && (
              <button type="button" role="listitem" className="gv-month gv-save-chip" onClick={() => open(SAVE)}>
                <span>Sparmål</span>
                <b>{Math.min(100, Math.floor((economy.savings.current / economy.savings.target) * 100))}&nbsp;%</b>
              </button>
            )}
            {economy && economy.budget.moons.length > 0 && (
              <button type="button" role="listitem" className="gv-month gv-moon-chip" onClick={() => open(MOONS)}>
                <span>Budget</span>
                <b>{economy.budget.total > 0 ? Math.round((economy.budget.paid / economy.budget.total) * 100) : 0}&nbsp;%</b>
              </button>
            )}
            {economy && economy.wishes.length > 0 && (
              <button type="button" role="listitem" className="gv-month gv-wish-chip" onClick={() => open(WISH)}>
                <span>Önskningar</span>
                <b>{economy.wishes.length}</b>
              </button>
            )}
            {economy && (
              <button type="button" role="listitem" className="gv-month gv-worth-chip" onClick={() => open(WORTH)}>
                <span>Tillgångar</span>
                <b>{kr(economy.worth.net)}</b>
              </button>
            )}
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
