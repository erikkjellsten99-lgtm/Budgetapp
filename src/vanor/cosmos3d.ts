// 3D-byggstenar för galaxen (CosmosView): Jorden med stadsljus och atmosfär, spiralgalaxer,
// nebulosor, stjärnhimmel och en stjärna per vana. Rena three.js-funktioner utan React.

import * as THREE from 'three'
import { noise2, seeded } from './space3d'
import { STAR_KINDS, type StarKind } from './cosmos'

const gaussOf = (rand: () => number) => () => (rand() + rand() + rand() - 1.5) / 1.5

/** Stjärnor långt bort, jämnt över himlen. */
export function starfield(count: number, radius: number, seed: number, glow: THREE.Texture) {
  const rand = seeded(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(radius * (0.8 + rand() * 0.4))
    pos.set([v.x, v.y, v.z], i * 3)
    c.set(rand() < 0.75 ? '#dfe6ff' : rand() < 0.5 ? '#ffe2b8' : '#b8ccff').multiplyScalar(0.35 + 0.65 * rand() ** 2)
    col.set([c.r, c.g, c.b], i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: radius * 0.006, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
}

/** Mjuk, rökig moln-textur för nebulosor (vit med genomskinliga kanter; färgen sätts på materialet). */
let smoke: THREE.Texture | null = null
export function smokeTexture(): THREE.Texture {
  if (smoke) return smoke
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const n = noise2(4711)
  const m = noise2(815)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5
      const dy = y / size - 0.5
      const r = Math.hypot(dx, dy) * 2
      const edge = Math.max(0, 1 - r) ** 1.6
      const v = n(x / 22 + m(x / 40, y / 40) * 3, y / 22) * 0.75 + m(x / 9, y / 9) * 0.25
      const a = Math.max(0, v - 0.38) * 2.4 * edge
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.min(255, a * 255)
    }
  ctx.putImageData(img, 0, 0)
  smoke = new THREE.CanvasTexture(canvas)
  smoke.colorSpace = THREE.SRGBColorSpace
  return smoke
}

/** Ett moln av rök i bakgrunden (nebulosa). */
export function nebula(pos: THREE.Vector3, scale: number, color: string, opacity: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color, transparent: true, opacity, depthWrite: false }))
  s.position.copy(pos)
  s.scale.setScalar(scale)
  s.material.rotation = pos.x * 1.7 + pos.y
  return s
}

export interface SpiralOptions {
  seed: number
  /** Galaxens radie. */
  radius: number
  count: number
  /** Färg nära kärnan och längst ut. */
  inner: string
  outer: string
  /** Punktstorlek. */
  size: number
  /** Hur många varv armarna vrider sig (radianer från kärnan till kanten). */
  twist?: number
  glow: THREE.Texture
}

/** En spiralgalax med två armar, en tät kärna och ett varmt sken i mitten. */
export function buildSpiral(o: SpiralOptions) {
  const rand = seeded(o.seed)
  const gauss = gaussOf(rand)
  const twist = o.twist ?? 4.6
  const group = new THREE.Group()
  const inner = new THREE.Color(o.inner)
  const outer = new THREE.Color(o.outer)
  const c = new THREE.Color()
  const layer = (count: number, size: number, scatter: number, bright: number) => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const s = Math.pow(rand(), 0.72)
      const arm = rand() < 0.5 ? 0 : Math.PI
      const angle = arm + s * twist + gauss() * (0.32 - 0.12 * s) * scatter
      const r = o.radius * (0.06 + 0.94 * s) + gauss() * o.radius * 0.05 * scatter
      pos.set([Math.cos(angle) * r, gauss() * o.radius * (0.05 - 0.035 * s), Math.sin(angle) * r], i * 3)
      c.copy(inner).lerp(outer, Math.min(1, s * 1.2)).multiplyScalar(bright * (0.4 + 0.6 * rand()))
      col.set([c.r, c.g, c.b], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size, map: o.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    group.add(points)
    return points
  }
  layer(o.count, o.size, 2.2, 0.55)
  layer(Math.round(o.count * 0.22), o.size * 1.8, 0.8, 0.95)
  // Kärnans bula
  const bulge = Math.round(o.count * 0.25)
  const pos = new Float32Array(bulge * 3)
  for (let i = 0; i < bulge; i++) {
    const r = Math.abs(gauss()) * o.radius * 0.28
    const a = rand() * Math.PI * 2
    pos.set([Math.cos(a) * r, gauss() * o.radius * 0.07, Math.sin(a) * r], i * 3)
  }
  const bulgeGeo = new THREE.BufferGeometry()
  bulgeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  group.add(
    new THREE.Points(
      bulgeGeo,
      new THREE.PointsMaterial({ size: o.size * 1.1, color: inner, map: o.glow, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    ),
  )
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.glow, color: inner, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }))
  core.scale.setScalar(o.radius * 0.75)
  group.add(core)
  return { group, core }
}

/** Jordens yta, ritad en gång (stadsljusen räknas fram i skuggningen, se buildEarth). */
let earthTex: { day: THREE.Texture } | null = null
function earthTextures() {
  if (earthTex) return earthTex
  const W = 1536
  const H = 768
  const land = noise2(2026)
  const detail = noise2(1102)
  const cloud = noise2(77)
  // Sömlös runt hela klotet: nära kanten blandas mönstret med det som börjar på andra sidan.
  const seamless = (fn: (u: number, v: number) => number) => (u: number, v: number) => {
    const k = Math.max(0, (u - 0.85) / 0.15)
    return fn(u, v) * (1 - k) + fn(u - 1, v) * k
  }
  const height = seamless((u, v) => land(u * 4, v * 4) + (detail(u * 14, v * 14) - 0.5) * 0.18 - 0.47)
  const fine = seamless((u, v) => detail(u * 30, v * 30))
  const dryness = seamless((u, v) => detail(u * 6 + 3, v * 6))
  const clouds = seamless((u, v) => cloud(u * 9 + v * 2, v * 7))
  const day = document.createElement('canvas')
  day.width = W
  day.height = H
  const ctx = day.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const lat = Math.abs(v - 0.5) * 2
      // Mjuk kustlinje: blanda hav och land över ett smalt band
      const k0 = Math.max(0, Math.min(1, height(u, v) / 0.012 + 0.5))
      const d = fine(u, v)
      const dry = dryness(u, v)
      let r = 10 + 10 * d + (60 + 70 * dry + 20 * d - 10 - 10 * d) * k0
      let g = 30 + 18 * d + (74 + 40 * dry + 18 * d - 30 - 18 * d) * k0
      let b = 62 + 26 * d + (44 + 20 * dry - 62 - 26 * d) * k0
      if (lat > 0.94) [r, g, b] = [200, 208, 218]
      const cl = clouds(u, v)
      const k = Math.max(0, Math.min(1, (cl - 0.56) * 3.2))
      const i = (y * W + x) * 4
      img.data[i] = r + (245 - r) * k
      img.data[i + 1] = g + (248 - g) * k
      img.data[i + 2] = b + (252 - b) * k
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)

  const dayTex = new THREE.CanvasTexture(day)
  dayTex.colorSpace = THREE.SRGBColorSpace
  dayTex.anisotropy = 4
  earthTex = { day: dayTex }
  return earthTex
}

/**
 * Jorden: dagsidan lyses upp av solen, på nattsidan lyser städerna, och runt kanten en tunn atmosfär
 * som glöder orange där solen går upp.
 */
export function buildEarth(radius: number) {
  const tex = earthTextures()
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(radius, 128, 96)
  // Bara solen lyser upp Jorden (Lambert tar inget ljus från miljön), så att nattsidan blir mörk som i rymden.
  const surface = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.day }))
  group.add(surface)
  const sunDir = { value: new THREE.Vector3(0, 0, -1) }
  const vertex = `
    varying vec2 vUv;
    varying vec3 vN;
    varying vec3 vPos;
    varying vec3 vObj;
    void main() {
      vUv = uv;
      vObj = position;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vPos = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`
  // Stadsljus på nattsidan: små ljuspunkter i kluster på land, räknade i skuggningen så att de
  // är skarpa hur nära man än kommer.
  const lights = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { day: { value: tex.day }, sunDir },
      vertexShader: vertex,
      fragmentShader: `
        uniform sampler2D day;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vObj;
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        // Mjukt brus: var städerna ligger tätt
        float vnoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
            mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
            f.z);
        }
        void main() {
          float night = smoothstep(0.1, -0.22, dot(normalize(vN), sunDir));
          vec3 c = texture2D(day, vUv).rgb;
          float land = smoothstep(0.02, 0.07, c.g - c.b);
          vec3 dir = normalize(vObj);
          float region = smoothstep(0.5, 0.8, vnoise(dir * 7.0) * 0.6 + vnoise(dir * 23.0) * 0.4);
          vec3 q = dir * 260.0;
          vec3 cell = floor(q);
          float h = hash(cell);
          float on = step(0.985 - region * 0.35, h);
          // Punkten ligger lite olika i varje ruta, så att det inte blir ett rutnät
          vec3 jitter = vec3(hash(cell + 7.1), hash(cell + 3.3), hash(cell + 5.7)) - 0.5;
          float d = length(fract(q) - 0.5 - jitter * 0.5);
          // Mindre än en pixel: ett jämnt sken i stället för flimmer
          float px = fwidth(q.x) + fwidth(q.y);
          float sharp = smoothstep(1.4, 0.5, px);
          float dotLight = smoothstep(0.32, 0.0, d) * on * sharp + region * 0.05 * (1.0 - sharp);
          vec3 col = vec3(1.0, 0.72, 0.38) * (dotLight * 2.0 + region * region * 0.05) * land * night;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  lights.scale.setScalar(1.0015)
  group.add(lights)
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.022, 128, 96),
    new THREE.ShaderMaterial({
      uniforms: { sunDir },
      vertexShader: vertex,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vN;
        varying vec3 vPos;
        void main() {
          vec3 n = normalize(vN);
          float facing = max(dot(n, normalize(cameraPosition - vPos)), 0.0);
          float fres = pow(1.0 - facing, 4.5);
          float day = dot(n, sunDir);
          float lit = smoothstep(-0.45, 0.25, day);
          vec3 col = mix(vec3(1.0, 0.48, 0.2), vec3(0.38, 0.62, 1.0), smoothstep(-0.08, 0.5, day));
          gl_FragColor = vec4(col * fres * lit * 1.5, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  group.add(atmosphere)
  return {
    group,
    /** Riktningen mot solen (från Jordens mitt). */
    setSun(dir: THREE.Vector3) {
      sunDir.value.copy(dir).normalize()
    },
    update(now: number) {
      surface.rotation.y = lights.rotation.y = now / 240000
    },
  }
}

/** Storlek på stjärnans kärna per klass. */
const STAR_SIZE: Record<StarKind, number> = { proto: 0.035, red: 0.05, orange: 0.07, yellow: 0.095, blue: 0.13 }

/**
 * En vana som stjärna: protostjärnan är ett rött gasmoln som drar ihop sig kring en svag kärna,
 * de andra en glödande stjärna – större och vitare ju bättre vanan sitter. Gul och blå får strålar.
 */
export function buildHabitStar(kind: StarKind, seed: number, tex: { glow: THREE.Texture; sun: THREE.Texture; rays: THREE.Texture }) {
  const group = new THREE.Group()
  const color = new THREE.Color(STAR_KINDS[kind].color)
  const size = STAR_SIZE[kind]
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const
  let cloud: THREE.Points | null = null
  if (kind === 'proto') {
    const rand = seeded(seed)
    const gauss = gaussOf(rand)
    const n = 700
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const r = 0.03 + Math.pow(rand(), 0.7) * 0.28
      const a = rand() * Math.PI * 2 + r * 6
      pos.set([Math.cos(a) * r, gauss() * 0.03, Math.sin(a) * r], i * 3)
      c.set(rand() < 0.6 ? '#ff7d6a' : rand() < 0.5 ? '#c76bd6' : '#ffb38a').multiplyScalar(0.25 + 0.6 * rand())
      col.set([c.r, c.g, c.b], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.022, map: tex.glow, vertexColors: true, ...additive }))
    cloud.rotation.x = 0.35
    group.add(cloud)
  }
  // Den blå jätten är het och vit-blå; de andra har solens gula granulering, tonad i sin färg.
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshBasicMaterial(kind === 'blue' ? { color: '#dfe9ff' } : { map: tex.sun, color: color.clone().lerp(new THREE.Color('#ffffff'), 0.35) }),
  )
  core.scale.setScalar(size)
  group.add(core)
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color, opacity: kind === 'proto' ? 0.55 : 0.95, ...additive }))
  corona.scale.setScalar(size * (kind === 'proto' ? 6 : 9))
  group.add(corona)
  let rays: THREE.Sprite | null = null
  if (kind === 'yellow' || kind === 'blue') {
    rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.rays, color, opacity: 0.5, ...additive }))
    rays.scale.setScalar(size * 10)
    group.add(rays)
  }
  const phase = (seed % 100) / 16
  return {
    group,
    /** Ungefärlig storlek, för kameran. */
    size: kind === 'proto' ? 0.3 : size * 5,
    update(now: number) {
      const pulse = 1 + 0.05 * Math.sin(now / 900 + phase)
      corona.scale.setScalar(size * (kind === 'proto' ? 6 : 9) * pulse)
      core.rotation.y = now / 6000
      if (rays) rays.material.rotation = now / 20000 + phase
      if (cloud) cloud.rotation.y = now / 9000 + phase
    },
  }
}
