// Himlen och galaxerna i galaxen (CosmosView): Vintergatan och stjärnhimlen långt bort, avlägsna galaxer,
// spiralgalaxerna för Hälsa och Ekonomi, och en stjärna per vana. Rena three.js-funktioner utan React.
// Punkterna (stjärnorna) ritas med egen skuggning: mjuka, runda och aldrig mindre än en pixel, så att
// tusentals stjärnor långt bort smälter ihop till ett jämnt sken i stället för att flimra.

import * as THREE from 'three'
import { seeded } from './space3d'
import type { StarKind } from './cosmos'
import { billboard } from './earth3d'

/* ---------- Gemensamt ---------- */

/** Pixlar per världsenhet på avståndet 1 (sätts när fönstret ändrar storlek). */
export const pointScale = { value: 900 }
/** Skärmens pixeltäthet. */
export const pixelRatio = { value: 1 }
/** Tid i sekunder, för det som rör sig. */
export const cosmosTime = { value: 0 }

const gaussOf = (rand: () => number) => () => (rand() + rand() + rand() + rand() - 2) / 1.15

export const NOISE = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return v;
  }`

/** Stjärnfärger efter spektralklass, med ungefär den fördelning man ser på himlen. */
const STAR_COLORS: [number, string][] = [
  [0.05, '#9cb2ff'],
  [0.11, '#c0d1ff'],
  [0.2, '#e9eeff'],
  [0.27, '#fff2e2'],
  [0.23, '#ffdcb5'],
  [0.14, '#ffc488'],
]
function starColor(rand: () => number, out: THREE.Color) {
  let r = rand()
  for (const [w, c] of STAR_COLORS) {
    if ((r -= w) <= 0) return out.set(c)
  }
  return out.set(STAR_COLORS[STAR_COLORS.length - 1][1])
}

const pointFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float a = exp(-r2 * 7.0) + exp(-r2 * 1.8) * 0.07;
    a *= 1.0 - smoothstep(0.8, 1.0, r2);
    gl_FragColor = vec4(vColor * a, 1.0);
  }`

/**
 * Material för stjärnor i rummet: storleken i världens enheter, men aldrig under `min` pixlar.
 * Mindre stjärnor blir svagare i stället, så att ljuset blir rätt.
 */
export function starPoints(opts: { min?: number; max?: number; near?: number; blending?: THREE.Blending; fragment?: string } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: pointScale, uPx: pixelRatio, uMin: { value: opts.min ?? 1.15 }, uMax: { value: opts.max ?? 26 }, uNear: { value: opts.near ?? 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aSize;
      uniform float uScale;
      uniform float uPx;
      uniform float uMin;
      uniform float uMax;
      varying vec3 vColor;
      uniform float uNear;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aSize * uScale / max(-mv.z, 1e-5);
        float s = clamp(px, uMin * uPx, uMax * uPx);
        gl_PointSize = s;
        // Stjärnor alldeles intill kameran tonas bort (annars blir de stora, suddiga prickar)
        vColor = color * min(1.0, (px * px) / (s * s)) * smoothstep(uNear * 0.3, uNear, -mv.z);
      }`,
    fragmentShader: opts.fragment ?? pointFragment,
    transparent: true,
    depthWrite: false,
    blending: opts.blending ?? THREE.AdditiveBlending,
  })
}

function pointsGeo(pos: number[], col: number[], size: number[]) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1))
  return geo
}

/* ---------- Himlen: Vintergatan och stjärnorna, oändligt långt bort ---------- */

export interface Sky {
  /** Följer kameran (så att himlen alltid är oändligt långt bort). */
  group: THREE.Group
  update(camera: THREE.Camera): void
  dispose(): void
}

/**
 * Himlen bakas en gång till en bild (Vintergatans band med stoftmoln, stjärnmoln och rosa nebulosor),
 * och stjärnorna ritas ovanpå med verkliga färger och ljusstyrkor. `galaxyNormal` = bandets lutning,
 * `galaxyCenter` = riktningen mot Vintergatans ljusa mitt.
 */
export function buildSky(renderer: THREE.WebGLRenderer, galaxyNormal: THREE.Vector3, galaxyCenter: THREE.Vector3): Sky {
  const N = galaxyNormal.clone().normalize()
  const C = galaxyCenter.clone().addScaledVector(N, -galaxyCenter.dot(N)).normalize()
  const B = new THREE.Vector3().crossVectors(N, C)
  const W = renderer.capabilities.maxTextureSize >= 4096 ? 2048 : 1024
  const target = new THREE.WebGLRenderTarget(W, W / 2, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter })
  target.texture.wrapS = THREE.RepeatWrapping
  {
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uN: { value: N }, uC: { value: C }, uB: { value: B } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uN;
          uniform vec3 uC;
          uniform vec3 uB;
          varying vec2 vUv;
          ${NOISE}
          void main() {
            float lon = (vUv.x - 0.5) * 6.2831853;
            float lat = (vUv.y - 0.5) * 3.1415927;
            vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
            float b = asin(clamp(dot(d, uN), -1.0, 1.0));
            float l = atan(dot(d, uB), ((dot(d, uC)) + 1e-6 * step(abs(dot(d, uC)), 1e-6)));
            float cl = cos(l);
            float width = 0.07 + 0.08 * smoothstep(-0.2, 1.0, cl);
            float disk = exp(-((b / width) * (b / width)));
            float wide = exp(-((b / (width * 3.2)) * (b / (width * 3.2)))) * 0.22;
            float bulge = exp(-(b * b / 0.025 + l * l / 0.08));
            float clouds = fbm(d * 6.0);
            float clumps = smoothstep(0.3, 0.85, fbm(d * 15.0 + 3.0));
            float lum = (disk * (0.25 + clouds) + wide * 0.6 + bulge * 1.4) * (0.6 + 0.7 * clumps);
            // Stoftet: mörka stråk tätt längs bandet, tydligast mot mitten (som Stora riftet)
            float dn = fbm(d * 9.0 + 11.0) * 0.65 + fbm(d * 28.0) * 0.35;
            float dust = smoothstep(0.42, 0.68, dn) * exp(-(((b - 0.012) / (width * 0.6)) * ((b - 0.012) / (width * 0.6)))) * (0.45 + 0.55 * smoothstep(-0.5, 0.8, cl));
            lum *= 1.0 - 0.88 * dust;
            vec3 col = mix(vec3(0.6, 0.69, 1.0), vec3(1.0, 0.8, 0.58), clamp(smoothstep(0.2, 1.0, cl) * 0.65 + bulge * 0.6, 0.0, 1.0)) * lum;
            float neb = smoothstep(0.6, 0.78, fbm(d * 20.0 + 5.0)) * disk * (1.0 - dust);
            col += vec3(1.0, 0.28, 0.42) * neb * 0.35;
            col += vec3(0.01, 0.012, 0.022);
            gl_FragColor = vec4(col * 0.11, 1.0);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    )
    const scene = new THREE.Scene()
    scene.add(quad)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    renderer.render(scene, cam)
    renderer.setRenderTarget(prev)
    quad.geometry.dispose()
    quad.material.dispose()
  }

  const group = new THREE.Group()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { uMap: { value: target.texture } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec2 uv = vec2(atan(d.z, ((d.x) + 1e-6 * step(abs(d.x), 1e-6))) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
          gl_FragColor = vec4(texture2D(uMap, uv).rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    }),
  )
  dome.renderOrder = -20
  dome.frustumCulled = false
  group.add(dome)

  // Stjärnorna: jämnt över himlen, tätare längs Vintergatan, och de ljusaste med strålar
  const rand = seeded(1977)
  const gauss = gaussOf(rand)
  const c = new THREE.Color()
  const dir = new THREE.Vector3()
  const R = 2000
  const make = (count: number, plane: boolean, bright: [number, number]) => {
    const pos: number[] = []
    const col: number[] = []
    const size: number[] = []
    for (let i = 0; i < count; i++) {
      if (plane) {
        const l = rand() * Math.PI * 2
        const b = gauss() * 0.13
        dir.copy(C).multiplyScalar(Math.cos(l) * Math.cos(b)).addScaledVector(B, Math.sin(l) * Math.cos(b)).addScaledVector(N, Math.sin(b))
      } else dir.set(gauss(), gauss(), gauss()).normalize()
      pos.push(dir.x * R, dir.y * R, dir.z * R)
      const k = Math.pow(rand(), bright[1])
      starColor(rand, c).multiplyScalar(bright[0] * (0.18 + 1.9 * k))
      col.push(c.r, c.g, c.b)
      // Storleken i pixlar (vid pixeltäthet 1) räknas om till "världens enheter" på avståndet R
      size.push(((1.1 + 2.4 * k) * R) / pointScale.value)
    }
    return pointsGeo(pos, col, size)
  }
  const skyPoints = (geo: THREE.BufferGeometry, fragment?: string) => {
    // Himlens stjärnor har fast storlek i pixlar: avståndet är alltid detsamma
    const mat = starPoints({ min: 1.2, max: 30, fragment })
    const p = new THREE.Points(geo, mat)
    p.frustumCulled = false
    p.renderOrder = -19
    return p
  }
  group.add(skyPoints(make(7000, false, [1, 4.2])))
  group.add(skyPoints(make(6500, true, [0.8, 5.5])))
  // De ljusaste: större, med svaga diffraktionsstrålar som på ett fotografi
  const brightGeo = (() => {
    const pos: number[] = []
    const col: number[] = []
    const size: number[] = []
    for (let i = 0; i < 70; i++) {
      dir.set(gauss(), gauss(), gauss()).normalize()
      pos.push(dir.x * R, dir.y * R, dir.z * R)
      starColor(rand, c).multiplyScalar(1.6 + rand() * 2.2)
      col.push(c.r, c.g, c.b)
      size.push(((11 + rand() * 9) * R) / pointScale.value)
    }
    return pointsGeo(pos, col, size)
  })()
  group.add(
    skyPoints(
      brightGeo,
      /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        float core = exp(-r2 * 60.0) * 1.4 + exp(-r2 * 9.0) * 0.18;
        float spikes = (exp(-abs(p.x) * 34.0) * exp(-abs(p.y) * 3.4) + exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 3.4)) * 0.35;
        float a = (core + spikes) * (1.0 - smoothstep(0.85, 1.0, max(abs(p.x), abs(p.y))));
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    ),
  )
  return {
    group,
    update(camera) {
      group.position.copy(camera.position)
    },
    dispose() {
      target.dispose()
    },
  }
}

/* ---------- Avlägsna galaxer: små suddiga fläckar långt bort, så att universum känns stort ---------- */

function farGalaxyTexture(seed: number, kind: 'spiral' | 'elliptical' | 'edge'): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = seeded(seed)
  const gauss = gaussOf(rand)
  ctx.translate(size / 2, size / 2)
  ctx.rotate(rand() * Math.PI)
  const tilt = kind === 'edge' ? 0.14 : kind === 'elliptical' ? 0.55 + rand() * 0.4 : 0.35 + rand() * 0.6
  ctx.scale(1, tilt)
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * (kind === 'elliptical' ? 0.42 : 0.22))
  core.addColorStop(0, 'rgba(255,236,210,0.95)')
  core.addColorStop(0.35, 'rgba(255,214,170,0.35)')
  core.addColorStop(1, 'rgba(255,200,150,0)')
  ctx.fillStyle = core
  ctx.fillRect(-size, -size, size * 2, size * 2)
  if (kind !== 'elliptical') {
    for (let i = 0; i < 900; i++) {
      const s = Math.pow(rand(), 0.7)
      const arm = rand() < 0.5 ? 0 : Math.PI
      const a = arm + s * 5 + gauss() * 0.35
      const r = s * size * 0.46
      const blue = rand() < 0.7
      ctx.fillStyle = blue ? `rgba(180,200,255,${0.25 + rand() * 0.3})` : `rgba(255,150,190,${0.3 + rand() * 0.3})`
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.4, 1.4)
    }
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Ett trettiotal avlägsna galaxer i alla riktningar (utom där våra egna galaxer ligger). */
export function farGalaxies(avoid: THREE.Vector3[]) {
  const group = new THREE.Group()
  const textures = Array.from({ length: 6 }, (_, i) => farGalaxyTexture(500 + i, i < 3 ? 'spiral' : i < 5 ? 'elliptical' : 'edge'))
  const rand = seeded(31337)
  const gauss = gaussOf(rand)
  const dir = new THREE.Vector3()
  let placed = 0
  for (let k = 0; k < 120 && placed < 34; k++) {
    dir.set(gauss(), gauss(), gauss()).normalize()
    if (avoid.some((a) => a.clone().normalize().dot(dir) > 0.93)) continue
    const dist = 650 + rand() * 750
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures[placed % textures.length], color: '#ffffff', transparent: true, opacity: 0.35 + rand() * 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    s.position.copy(dir).multiplyScalar(dist)
    s.scale.setScalar(12 + rand() * 30)
    s.material.rotation = rand() * Math.PI
    group.add(s)
    placed++
  }
  return {
    group,
    dispose() {
      textures.forEach((t) => t.dispose())
      group.children.forEach((s) => (s as THREE.Sprite).material.dispose())
    },
  }
}

/* ---------- Spiralgalaxerna ---------- */

export interface GalaxyLook {
  seed: number
  radius: number
  arms: number
  /** Hur mycket armarna vrider sig från kärnan ut till kanten (radianer). */
  twist: number
  count: number
  /** Kärnans gamla, varma stjärnor. */
  core: string
  /** De unga, heta stjärnorna i armarna. */
  young: string
  /** Hur mycket rosa stjärnbildningsområden (0–1). */
  nebulae: number
  /** Hur mycket mörkt stoft längs armarna (0–1). */
  dust: number
}

export interface Galaxy {
  group: THREE.Group
  /** Kärnans sken (kan döljas när ett svart hål sitter där). */
  core: THREE.Object3D
  /** Var en arm ligger: andel ut från mitten (0–1) → punkt i galaxens skiva. */
  armPoint(t: number, arm: number, out?: THREE.Vector3): THREE.Vector3
  dispose(): void
}

/**
 * En spiralgalax av tiotusentals stjärnor: en tät, varm kärna, en gammal skiva, blåvita unga stjärnor
 * i armarna med rosa stjärnbildningsområden, mörka stoftstråk på armarnas insida och ett mjukt sken
 * av allt ljus som är för svagt för att synas som enskilda stjärnor.
 */
export function buildGalaxy(o: GalaxyLook): Galaxy {
  const rand = seeded(o.seed)
  const gauss = gaussOf(rand)
  const R = o.radius
  const group = new THREE.Group()
  const coreC = new THREE.Color(o.core)
  const youngC = new THREE.Color(o.young)
  const c = new THREE.Color()
  const armAngle = (s: number, arm: number) => (arm * Math.PI * 2) / o.arms + s * o.twist
  const armPoint = (t: number, arm: number, out = new THREE.Vector3()) => {
    const a = armAngle(t, arm)
    const r = R * (0.08 + 0.92 * t)
    return out.set(Math.cos(a) * r, 0, Math.sin(a) * r)
  }
  const pos: number[] = []
  const col: number[] = []
  const size: number[] = []
  const push = (x: number, y: number, z: number, color: THREE.Color, s: number) => {
    pos.push(x, y, z)
    col.push(color.r, color.g, color.b)
    size.push(s)
  }
  // Kärnans bula
  for (let i = 0; i < o.count * 0.16; i++) {
    const r = Math.abs(gauss()) * R * 0.15
    const v = new THREE.Vector3(gauss(), gauss() * 0.55, gauss()).normalize().multiplyScalar(r)
    c.copy(coreC).lerp(new THREE.Color('#fff4e4'), rand() * 0.4).multiplyScalar(0.35 + 0.6 * rand())
    push(v.x, v.y, v.z, c, R * 0.005 * (0.6 + rand()))
  }
  // Den gamla skivan: jämnt mellan armarna, tätast in mot mitten
  for (let i = 0; i < o.count * 0.36; i++) {
    const r = -Math.log(1 - rand() * 0.97) * R * 0.28
    const a = rand() * Math.PI * 2
    c.copy(coreC).lerp(new THREE.Color('#fff7ee'), 0.5).multiplyScalar(0.12 + 0.26 * rand())
    push(Math.cos(a) * r, gauss() * R * 0.014, Math.sin(a) * r, c, R * 0.004 * (0.6 + rand()))
  }
  // Armarna: unga blåvita stjärnor, breda och luddiga, med enstaka ljusa klungor
  for (let i = 0; i < o.count * 0.4; i++) {
    const s = Math.pow(rand(), 0.8)
    const arm = Math.floor(rand() * o.arms)
    const spread = 0.42 * (1 - 0.45 * s)
    const a = armAngle(s, arm) + gauss() * spread
    const r = R * (0.08 + 0.92 * s) + gauss() * R * 0.06
    const bright = rand() < 0.04 ? 2.2 : 0.35 + 1.0 * Math.pow(rand(), 2)
    c.copy(youngC).lerp(new THREE.Color('#ffffff'), rand() * 0.5).multiplyScalar(bright * (1 - 0.35 * s))
    push(Math.cos(a) * r, gauss() * R * 0.012, Math.sin(a) * r, c, R * 0.004 * (0.6 + rand()))
  }
  // Rosa stjärnbildningsområden längs armarnas framkant
  const nebC = [new THREE.Color('#ff6f9c'), new THREE.Color('#ff92b4'), new THREE.Color('#ffb0c8')]
  for (let k = 0; k < 34 * o.nebulae; k++) {
    const s = 0.2 + rand() * 0.7
    const arm = Math.floor(rand() * o.arms)
    const a = armAngle(s, arm) + 0.06 + gauss() * 0.16
    const r = R * (0.08 + 0.92 * s)
    const cx = Math.cos(a) * r
    const cz = Math.sin(a) * r
    for (let j = 0; j < 14; j++) {
      c.copy(nebC[j % 3]).multiplyScalar(0.5 + rand() * 0.9)
      push(cx + gauss() * R * 0.012, gauss() * R * 0.004, cz + gauss() * R * 0.012, c, R * 0.006 * (0.6 + rand()))
    }
  }
  const material = starPoints({ min: 1.05, max: 3.2, near: 2.4 })
  const stars = new THREE.Points(pointsGeo(pos, col, size), material)
  stars.frustumCulled = false
  group.add(stars)

  // Stoftet: mörka, trådiga stråk längs armarnas insida som skymmer stjärnorna bakom (ritas efter dem)
  let dust: THREE.Mesh | null = null
  if (o.dust > 0) {
    dust = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 2.3, R * 2.3),
      new THREE.ShaderMaterial({
        uniforms: { uArms: { value: o.arms }, uTwist: { value: o.twist }, uAmount: { value: o.dust }, uSeed: { value: (o.seed % 31) * 1.7 } },
        vertexShader: `varying vec2 vP; void main() { vP = position.xy / ${(R * 1.15).toFixed(3)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uArms;
          uniform float uTwist;
          uniform float uAmount;
          uniform float uSeed;
          varying vec2 vP;
          ${NOISE}
          void main() {
            float r = length(vP) * 1.15;
            float a = atan(-vP.y, ((vP.x) + 1e-6 * step(abs(vP.x), 1e-6)));
            float s = clamp((r - 0.08) / 0.92, 0.0, 1.0);
            // Vinkeln till närmaste arm, och stoftet strax innanför den
            float phase = uArms * (a - s * uTwist) / 6.2831853;
            float d = (fract(phase + 0.5) - 0.5) * 6.2831853 / uArms;
            float lane = exp(-(((d + 0.15) / 0.07) * ((d + 0.15) / 0.07)));
            float threads = smoothstep(0.38, 0.72, fbm(vec3(vP * 9.0, uSeed)));
            float alpha = lane * threads * smoothstep(0.1, 0.25, r) * (1.0 - smoothstep(0.7, 0.95, r));
            gl_FragColor = vec4(0.04, 0.028, 0.02, alpha * 0.55 * uAmount);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    dust.rotation.x = -Math.PI / 2
    dust.renderOrder = 3
    group.add(dust)
  }

  // Det mjuka skenet i skivan: ljuset från alla stjärnor som är för svaga för att synas en och en
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.3, R * 2.3),
    new THREE.ShaderMaterial({
      uniforms: { uCore: { value: coreC }, uYoung: { value: youngC }, uArms: { value: o.arms }, uTwist: { value: o.twist } },
      vertexShader: `varying vec2 vP; void main() { vP = position.xy / ${(R * 1.15).toFixed(3)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uYoung;
        uniform float uArms;
        uniform float uTwist;
        varying vec2 vP;
        void main() {
          float r = length(vP) * 1.15;
          // Planet är vridet ner i skivan (lokal y = −z), så vinkeln spegelvänds för att stämma med stjärnorna
          float a = atan(-vP.y, ((vP.x) + 1e-6 * step(abs(vP.x), 1e-6)));
          float s = clamp((r - 0.08) / 0.92, 0.0, 1.0);
          float arms = pow(max(0.5 + 0.5 * cos(uArms * (a - s * uTwist)), 0.0), 1.6);
          float disk = exp(-r / 0.3) * (0.3 + 1.1 * arms * smoothstep(0.04, 0.22, r));
          float bulge = exp(-r * r / 0.02) * 2.6;
          vec3 col = mix(uCore, uYoung, smoothstep(0.08, 0.55, r)) * disk + uCore * bulge;
          col *= 1.0 - smoothstep(0.8, 1.0, r);
          gl_FragColor = vec4(col * 0.42, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  )
  haze.rotation.x = -Math.PI / 2
  haze.renderOrder = -1
  group.add(haze)

  // Kärnans sken
  const core = billboard(
    /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float g = exp(-r * 16.0) * 3.2 + exp(-r * 5.0) * 0.55;
        g *= 1.0 - smoothstep(0.7, 1.0, r);
        gl_FragColor = vec4(uColor * g, 1.0);
      }`,
    { uColor: { value: coreC.clone().lerp(new THREE.Color('#ffffff'), 0.3) } },
  )
  core.material.uniforms.uSize.value = R * 0.6
  group.add(core)

  return {
    group,
    core,
    armPoint,
    dispose() {
      material.dispose()
      if (dust) (dust.material as THREE.Material).dispose()
    },
  }
}

/* ---------- En stjärna per vana ---------- */

/** Storlek, färg (efter yttemperatur) och hur starkt varje klass lyser. */
const LOOK: Record<StarKind, { r: number; color: string; heat: number; corona: number; spikes: number }> = {
  proto: { r: 0.018, color: '#ff7a48', heat: 0.95, corona: 5, spikes: 0 },
  red: { r: 0.032, color: '#ff6c3a', heat: 1.05, corona: 4.2, spikes: 0 },
  orange: { r: 0.044, color: '#ffa24f', heat: 1.15, corona: 4.6, spikes: 0.25 },
  yellow: { r: 0.06, color: '#ffe5ad', heat: 1.3, corona: 5, spikes: 0.5 },
  blue: { r: 0.085, color: '#a9c2ff', heat: 1.45, corona: 5.6, spikes: 0.9 },
}

const photosphere = (color: THREE.Color, heat: number, seed: number) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uHeat: { value: heat }, uSeed: { value: seed % 97 }, uTime: cosmosTime },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vPos;
      void main() {
        vObj = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uHeat;
      uniform float uSeed;
      uniform float uTime;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vPos;
      ${NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vPos);
        float mu = max(dot(normalize(vN), V), 0.0);
        // Randmörkning: kanten är svalare och mörkare, som på solen
        float limb = 0.3 + 0.7 * pow(max(mu, 0.0), 0.55);
        vec3 p = normalize(vObj) * 11.0 + uSeed;
        float gran = fbm(p + vec3(uTime * 0.045, uTime * 0.02, 0.0));
        float cells = 0.72 + 0.56 * gran;
        float spots = smoothstep(0.66, 0.74, fbm(normalize(vObj) * 3.0 + uSeed + 40.0)) * 0.45;
        vec3 col = mix(uColor * vec3(1.0, 0.7, 0.5), uColor, pow(max(mu, 0.0), 0.35)) * limb * cells * (1.0 - spots) * uHeat;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })

export interface HabitStar {
  group: THREE.Group
  /** Ungefärlig storlek (för kameran och för att träffa med fingret). */
  size: number
  dispose(): void
}

/**
 * En vana som stjärna. Protostjärnan föds i ett moln av stoft, med en glödande skiva runt sig och
 * jetstrålar ut från polerna. De andra är riktiga stjärnor: kokande yta (granulering), mörkare kant,
 * en korona med strålar runt och – för de hetaste – diffraktionsstrålar.
 */
export function buildHabitStar(kind: StarKind, seed: number): HabitStar {
  const look = LOOK[kind]
  const color = new THREE.Color(look.color)
  const group = new THREE.Group()
  const disposables: { dispose(): void }[] = []
  const core = new THREE.Mesh(new THREE.SphereGeometry(look.r, 48, 32), photosphere(color, look.heat, seed))
  disposables.push(core.geometry, core.material)
  group.add(core)

  // Koronan: ett sken med strålar som långsamt ändrar sig
  const corona = billboard(
    /* glsl */ `
      uniform vec3 uColor;
      uniform float uHeat;
      uniform float uCore;
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vP;
      ${NOISE}
      void main() {
        float r = length(vP);
        float a = atan(vP.y, ((vP.x) + 1e-6 * step(abs(vP.x), 1e-6)));
        float rr = max(r - uCore, 0.0) / (1.0 - uCore);
        float streak = 0.5 + 0.6 * vnoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.06 + uSeed)) + 0.3 * vnoise(vec3(cos(a) * 9.0, sin(a) * 9.0, uTime * 0.1));
        float g = exp(-rr * 10.0 / streak) * 1.5 + exp(-rr * 3.4) * 0.28 + exp(-rr * 1.3) * 0.05;
        g *= 1.0 - smoothstep(0.82, 1.0, r);
        gl_FragColor = vec4(uColor * g * uHeat * 0.55, 1.0);
      }`,
    { uColor: { value: color }, uHeat: { value: look.heat }, uCore: { value: 1 / look.corona }, uTime: cosmosTime, uSeed: { value: (seed % 50) / 7 } },
  )
  corona.material.uniforms.uSize.value = look.r * look.corona
  disposables.push(corona.geometry, corona.material)
  group.add(corona)

  // Syns som en ljus punkt även på långt håll (från galaxen)
  const far = new THREE.Points(pointsGeo([0, 0, 0], [color.r * look.heat * 2, color.g * look.heat * 2, color.b * look.heat * 2], [look.r * 7]), starPoints({ min: 3.2, max: 9 }))
  far.frustumCulled = false
  disposables.push(far.geometry, far.material)
  group.add(far)

  if (look.spikes > 0) {
    const spikes = billboard(
      /* glsl */ `
        uniform vec3 uColor;
        uniform float uAmount;
        varying vec2 vP;
        void main() {
          vec2 p = vP;
          float s = exp(-abs(p.y) * 90.0) * exp(-abs(p.x) * 3.2) + exp(-abs(p.x) * 90.0) * exp(-abs(p.y) * 3.2);
          vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
          s += (exp(-abs(q.y) * 160.0) * exp(-abs(q.x) * 6.0) + exp(-abs(q.x) * 160.0) * exp(-abs(q.y) * 6.0)) * 0.35;
          gl_FragColor = vec4(uColor * s * uAmount * 0.6, 1.0);
        }`,
      { uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), 0.5) }, uAmount: { value: look.spikes } },
    )
    spikes.material.uniforms.uSize.value = look.r * 7
    disposables.push(spikes.geometry, spikes.material)
    group.add(spikes)
  }

  if (kind === 'proto') {
    const rand = seeded(seed)
    const gauss = gaussOf(rand)
    // Stoftmolnet runt den nyfödda stjärnan
    const pos: number[] = []
    const col: number[] = []
    const size: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i < 900; i++) {
      const r = 0.04 + Math.pow(rand(), 0.65) * 0.24
      const a = rand() * Math.PI * 2 + r * 7
      pos.push(Math.cos(a) * r, gauss() * 0.05 * (0.4 + r * 3), Math.sin(a) * r)
      c.set(rand() < 0.55 ? '#c8553e' : rand() < 0.5 ? '#9a4a8c' : '#ff9a6a').multiplyScalar(0.12 + 0.4 * rand() * (1 - r * 2.5))
      col.push(c.r, c.g, c.b)
      size.push(0.012 + rand() * 0.02)
    }
    const cloud = new THREE.Points(pointsGeo(pos, col, size), starPoints({ min: 1.2, max: 40 }))
    cloud.rotation.x = 0.35
    cloud.frustumCulled = false
    disposables.push(cloud.geometry, cloud.material)
    group.add(cloud)
    // Den glödande skivan av gas och stoft som faller in mot stjärnan
    const diskMat = new THREE.ShaderMaterial({
      uniforms: { uTime: cosmosTime },
      vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vP;
        ${NOISE}
        void main() {
          float r = length(vP);
          float a = atan(vP.y, ((vP.x) + 1e-6 * step(abs(vP.x), 1e-6)));
          float bands = vnoise(vec3(r * 70.0, cos(a - uTime * 0.25 / max(r, 0.03)) * 2.0, sin(a - uTime * 0.25 / max(r, 0.03)) * 2.0));
          float heat = exp(-(r - 0.026) / 0.03);
          vec3 col = mix(vec3(0.5, 0.12, 0.05), vec3(1.0, 0.62, 0.3), clamp(heat, 0.0, 1.0)) * (0.35 + 0.8 * bands) * (heat * 2.0 + 0.15);
          col *= smoothstep(0.022, 0.03, r) * (1.0 - smoothstep(0.13, 0.17, r));
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.17, 96, 1), diskMat)
    disk.rotation.x = -Math.PI / 2 + 0.35
    disposables.push(disk.geometry, diskMat)
    group.add(disk)
    // Jetstrålarna ut från polerna, med ljusa knutar som rör sig utåt
    const jetMat = new THREE.ShaderMaterial({
      uniforms: { uTime: cosmosTime },
      vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vP;
        void main() {
          float y = abs(vP.y);
          float w = 0.004 + y * 0.03;
          float beam = exp(-((vP.x / w) * (vP.x / w))) * smoothstep(0.03, 0.06, y) * exp(-y * 5.0);
          float knots = 0.55 + 0.45 * sin(y * 55.0 - uTime * 2.2);
          gl_FragColor = vec4(vec3(0.55, 0.72, 1.0) * beam * knots * 1.1, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const jetGeo = new THREE.PlaneGeometry(0.08, 0.52)
    for (let i = 0; i < 2; i++) {
      const jet = new THREE.Mesh(jetGeo, jetMat)
      jet.rotation.set(0.35, (i * Math.PI) / 2, 0)
      group.add(jet)
    }
    disposables.push(jetGeo, jetMat)
  }
  return {
    group,
    size: kind === 'proto' ? 0.28 : look.r * look.corona,
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}

/** En tunn ring som alltid är lika stor på skärmen: markerar var ett solsystem ligger i galaxen. */
export function screenRing(color: THREE.Color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uPx: { value: 21 }, uScale: pointScale, uPr: pixelRatio, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uPx;
        uniform float uScale;
        uniform float uPr;
        varying vec2 vP;
        void main() {
          vP = position.xy;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy * uPx * uPr * -mv.z / uScale;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uFade;
        varying vec2 vP;
        void main() {
          float r = length(vP);
          float ring = smoothstep(0.06, 0.0, abs(r - 0.84)) * 0.5 + exp(-r * r * 6.0) * 0.04;
          gl_FragColor = vec4(uColor * ring * uFade, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.frustumCulled = false
  return mesh
}
