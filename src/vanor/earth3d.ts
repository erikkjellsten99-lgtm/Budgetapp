// Jorden och solen i galaxen (CosmosView). Riktiga satellitbilder: dagsidan, stadsljusen på natten,
// molnen (som driver och kastar skuggor) och höjdkartan som ger bergen relief i lågt solljus.
// Havet glittrar där solen speglas, och runt kanten ligger en tunn atmosfär som lyser blått på dagen
// och glöder orange där solen går upp. Bilderna: Solar System Scope (CC BY 4.0), byggda på NASA:s data.

import * as THREE from 'three'
import dayUrl from './assets/earth-day.jpg'
import lightsUrl from './assets/earth-lights.jpg'
import envUrl from './assets/earth-env.jpg'

/** Hur högt molnen ligger över ytan (i världens enheter). */
const CLOUD_H = 0.022

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vEastW;
  varying vec3 vNorthW;
  varying float vCosLat;
  varying vec3 vObj;
  void main() {
    vUv = uv;
    vec3 p = normalize(position);
    vObj = p;
    vec3 e = vec3(p.z, 0.0, -p.x);
    float le = length(e);
    vec3 east = le > 1e-4 ? e / le : vec3(1.0, 0.0, 0.0);
    vec3 north = cross(p, east);
    mat3 m = mat3(modelMatrix);
    vNormalW = normalize(m * p);
    vEastW = normalize(m * east);
    vNorthW = normalize(m * north);
    vCosLat = sqrt(max(0.0, 1.0 - p.y * p.y));
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const common = /* glsl */ `
  // Solljuset blir varmt och rött nära skymningslinjen, där det går genom mer atmosfär.
  vec3 sunTint(float mu) {
    return mix(vec3(1.0, 0.45, 0.18), vec3(1.0, 0.97, 0.92), smoothstep(-0.02, 0.09, mu));
  }
  // Himlens färg sett mot kanten: blå på dagsidan, orange i skymningen, mörk på natten.
  float hashN(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoiseN(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hashN(i), hashN(i + vec3(1, 0, 0)), f.x), mix(hashN(i + vec3(0, 1, 0)), hashN(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hashN(i + vec3(0, 0, 1)), hashN(i + vec3(1, 0, 1)), f.x), mix(hashN(i + vec3(0, 1, 1)), hashN(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // Fina detaljer som bara behövs på nära håll (bilderna räcker inte till där)
  float detailN(vec3 p) {
    return vnoiseN(p) * 0.55 + vnoiseN(p * 2.07 + 13.1) * 0.3 + vnoiseN(p * 4.3 + 7.7) * 0.15;
  }
  vec3 skyTint(float mu) {
    return mix(vec3(0.95, 0.38, 0.12) * 0.55, vec3(0.24, 0.5, 1.0), smoothstep(-0.04, 0.14, mu)) * smoothstep(-0.22, 0.06, mu);
  }`

export interface Earth {
  group: THREE.Group
  /** Riktningen mot solen (från Jordens mitt, i världen). */
  setSun(dir: THREE.Vector3): void
  update(now: number): void
  /** Bilderna är laddade (eller misslyckades): klotet tonas in. */
  ready: Promise<void>
  dispose(): void
}

export function buildEarth(renderer: THREE.WebGLRenderer, radius: number, yaw: number): Earth {
  const group = new THREE.Group()
  const loader = new THREE.TextureLoader()
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const load = (url: string, setup: (t: THREE.Texture) => void) =>
    new Promise<THREE.Texture>((resolve) => {
      const t = loader.load(
        url,
        () => resolve(t),
        undefined,
        () => resolve(t),
      )
      t.wrapS = THREE.RepeatWrapping
      t.anisotropy = aniso
      setup(t)
    })
  const textures: THREE.Texture[] = []
  const day = load(dayUrl, (t) => (t.colorSpace = THREE.SRGBColorSpace))
  const lights = load(lightsUrl, (t) => {
    // Bara en kanal behövs: sparar minne i telefonen
    t.format = THREE.RedFormat
  })
  const env = load(envUrl, () => {})

  const sun = { value: new THREE.Vector3(0, 0, -1) }
  const ready = { value: 0 }
  const cloudShift = { value: 0 }
  const uniforms = {
    uDay: { value: null as THREE.Texture | null },
    uLights: { value: null as THREE.Texture | null },
    uEnv: { value: null as THREE.Texture | null },
    uSun: sun,
    uReady: ready,
    uCloudShift: cloudShift,
    uBump: { value: 2.6 },
    uTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
    uR: { value: radius },
    uCloudH: { value: CLOUD_H },
  }

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 192, 96),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDay;
        uniform sampler2D uLights;
        uniform sampler2D uEnv;
        uniform vec3 uSun;
        uniform float uReady;
        uniform float uCloudShift;
        uniform float uBump;
        uniform vec2 uTexel;
        uniform float uR;
        uniform float uCloudH;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying vec3 vEastW;
        varying vec3 vNorthW;
        varying float vCosLat;
        varying vec3 vObj;
        ${common}
        void main() {
          vec3 n = normalize(vNormalW);
          vec3 V = normalize(cameraPosition - vPosW);
          float mu = dot(n, uSun);
          vec3 day = texture2D(uDay, vUv).rgb;
          vec4 env = texture2D(uEnv, vUv);
          float land = smoothstep(0.3, 0.7, env.g);
          // Höjdkartan: bergen får ljus- och skuggsida när solen står lågt
          float hL = texture2D(uEnv, vUv - vec2(uTexel.x * 1.5, 0.0)).b;
          float hR = texture2D(uEnv, vUv + vec2(uTexel.x * 1.5, 0.0)).b;
          float hD = texture2D(uEnv, vUv - vec2(0.0, uTexel.y * 1.5)).b;
          float hU = texture2D(uEnv, vUv + vec2(0.0, uTexel.y * 1.5)).b;
          vec3 grad = (vEastW * (hR - hL) / max(vCosLat, 0.2) + vNorthW * (hU - hD)) / 1.5;
          vec3 nb = normalize(n - grad * uBump * land);
          // Havet är mörkare och djupare blått än i bilden
          vec3 albedo = mix(day * vec3(0.34, 0.47, 0.66), day, land);
          // På nära håll: lite fin struktur i marken
          float zoom = smoothstep(0.006, 0.0015, length(fwidth(vObj)));
          if (zoom > 0.0) albedo *= 1.0 + (detailN(vObj * 900.0) - 0.5) * 0.35 * zoom * land;
          // Reliefen får bara ändra ljuset där solen faktiskt står över horisonten
          float ndl = max(dot(nb, uSun), 0.0) * smoothstep(-0.03, 0.1, mu);
          // Molnens skuggor: molnet som skymmer solen ligger en bit åt solens håll
          vec2 tang = vec2(dot(uSun, vEastW), dot(uSun, vNorthW));
          vec2 off = tang / max(mu, 0.12) * uCloudH;
          vec2 duv = vec2(off.x / (6.2832 * uR * max(vCosLat, 0.2)), off.y / (3.1416 * uR));
          float cloudHere = texture2D(uEnv, vUv + vec2(uCloudShift, 0.0)).r;
          float cloudSun = texture2D(uEnv, vUv + vec2(uCloudShift, 0.0) + duv).r;
          float shade = 1.0 - 0.55 * smoothstep(0.2, 0.85, cloudSun);
          vec3 tint = sunTint(mu);
          vec3 col = albedo * tint * ndl * shade * 2.3;
          // Havsglitter: solen speglas i vattnet
          vec3 H = normalize(V + uSun);
          float nh = max(dot(n, H), 0.0);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          float glint = (pow(nh, 500.0) * 7.0 + pow(nh, 70.0) * 0.45) * (0.35 + fres);
          col += tint * glint * (1.0 - land) * (1.0 - smoothstep(0.2, 0.7, cloudHere)) * smoothstep(0.0, 0.12, mu) * shade;
          // Natten: stadsljusen (sparade med gamma), lite dämpade under molnen. På nära håll delas
          // bildens suddiga ljus upp i små ljuspunkter, så att städerna inte blir till kladd.
          float lights = pow(texture2D(uLights, vUv).r, 2.2);
          vec2 q = vUv * vec2(12000.0, 6000.0);
          float px = length(fwidth(q));
          float speck = step(0.62, hashN(vec3(floor(q), 3.0))) * 2.6;
          lights *= mix(1.0, speck, smoothstep(1.6, 0.5, px));
          float night = smoothstep(0.06, -0.14, mu);
          col += vec3(1.0, 0.62, 0.28) * lights * night * (1.0 - 0.45 * smoothstep(0.3, 0.9, cloudHere)) * 2.6;
          // Atmosfären mot kanten
          float edge = 1.0 - max(dot(n, V), 0.0);
          vec3 sky = skyTint(mu);
          col = mix(col, sky * 1.1, pow(edge, 2.6) * 0.7) + sky * 0.035;
          // Innan bilderna har laddats: ett mörkblått klot
          col = mix(vec3(0.01, 0.02, 0.05) * (0.25 + max(mu, 0.0)), col, uReady);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  )
  group.add(surface)

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius + CLOUD_H, 192, 96),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        uniform sampler2D uEnv;
        uniform vec3 uSun;
        uniform float uReady;
        uniform float uCloudShift;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying vec3 vObj;
        ${common}
        void main() {
          vec3 n = normalize(vNormalW);
          vec3 V = normalize(cameraPosition - vPosW);
          float mu = dot(n, uSun);
          float c = texture2D(uEnv, vUv + vec2(uCloudShift, 0.0)).r;
          // På nära håll blir molnkanterna skarpare och får tofsar (bilden är för grov där)
          float zoom = smoothstep(0.006, 0.0015, length(fwidth(vObj)));
          float lump = 1.0;
          if (zoom > 0.0) {
            float ang = uCloudShift * 6.2831853;
            vec3 d = vec3(vObj.x * cos(ang) + vObj.z * sin(ang), vObj.y, -vObj.x * sin(ang) + vObj.z * cos(ang));
            float edge = smoothstep(0.03, 0.3, c) * (1.0 - smoothstep(0.8, 1.0, c));
            float dn = detailN(d * 520.0) * 0.7 + detailN(d * 1900.0) * 0.3;
            c = clamp(c + (dn - 0.5) * 0.9 * zoom * edge, 0.0, 1.0);
            lump = 1.0 + (dn - 0.5) * 0.35 * zoom;
          }
          float a = smoothstep(0.1, 0.85, c);
          // Tjockare mot kanten, där man ser snett genom molnen
          float ndv = max(dot(n, V), 0.0);
          a = clamp(a * (1.0 + (1.0 - ndv) * 0.7), 0.0, 1.0);
          float lit = smoothstep(-0.1, 0.2, mu);
          vec3 col = sunTint(mu) * (max(mu, 0.0) * 0.9 + 0.1 * lit) * 2.15 * lump;
          col += vec3(0.008, 0.011, 0.02) * (1.0 - lit);
          col = mix(col, skyTint(mu) * 1.1, pow(1.0 - ndv, 3.0) * 0.5);
          // På natten syns molnen knappt, och stadsljusen lyser igenom
          a *= mix(0.45, 1.0, lit) * uReady;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    }),
  )
  group.add(clouds)

  // Atmosfären runt kanten: räknas fram längs synlinjen, så att den blir tunn och skarp som på bilder från rymden.
  const atmoR = radius * 1.034
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(atmoR, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: { uSun: sun, uR: { value: radius }, uRa: { value: atmoR } },
      vertexShader: /* glsl */ `
        varying vec3 vPosW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vPosW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        uniform float uR;
        uniform float uRa;
        varying vec3 vPosW;
        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vPosW - ro);
          vec3 pc = ro + rd * (-dot(ro, rd));
          float b = length(pc);
          float h = clamp((b - uR) / (uRa - uR), 0.0, 1.0);
          float dens = exp(-h * 6.0) * (1.0 - h);
          vec3 nC = pc / max(b, 1e-4);
          float muC = dot(nC, uSun);
          float lit = smoothstep(-0.3, 0.1, muC);
          vec3 col = mix(vec3(1.0, 0.4, 0.14), vec3(0.2, 0.46, 1.0), smoothstep(-0.06, 0.18, muC)) * lit;
          // Motljus: när solen står bakom Jorden lyser kanten upp
          float g = max(dot(rd, uSun), 0.0);
          // Rött och orange där ljuset går genom skymningen, vitare där kanten redan är i sol
          vec3 fwd = mix(vec3(1.0, 0.55, 0.3), vec3(0.85, 0.9, 1.0), smoothstep(0.0, 0.35, muC));
          col += fwd * (pow(g, 26.0) * 0.6 + pow(g, 160.0) * 5.0) * smoothstep(-0.45, 0.05, muC);
          // Svagt luftsken på nattsidan
          col += vec3(0.03, 0.09, 0.07) * (1.0 - lit) * 0.5;
          gl_FragColor = vec4(col * dens * 1.7, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  group.add(atmosphere)

  const all = Promise.all([day, lights, env]).then(([d, l, e]) => {
    textures.push(d, l, e)
    uniforms.uDay.value = d
    uniforms.uLights.value = l
    uniforms.uEnv.value = e
    const img = e.image as { width?: number; height?: number } | undefined
    if (img?.width && img.height) uniforms.uTexel.value.set(1 / img.width, 1 / img.height)
  })
  let fadeStart: number | null = null
  all.then(() => (fadeStart = performance.now()))

  return {
    group,
    setSun(dir) {
      sun.value.copy(dir).normalize()
    },
    update(now) {
      if (fadeStart !== null) ready.value = Math.min(1, (performance.now() - fadeStart) / 900)
      // Jorden snurrar knappt märkbart, molnen driver lite fortare
      surface.rotation.y = clouds.rotation.y = yaw + now / 3_000_000
      cloudShift.value = (now / 9_000_000) % 1
    },
    ready: all,
    dispose() {
      textures.forEach((t) => t.dispose())
    },
  }
}

/* ---------- Solen ---------- */

const billboardVertex = /* glsl */ `
  uniform float uSize;
  varying vec2 vP;
  void main() {
    vP = position.xy;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }`

/** En skiva som alltid vänds mot kameran, med egen skuggning (kan lysa starkare än vitt, för bloom). */
export function billboard(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, opts: { depthTest?: boolean } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 1 }, ...uniforms },
      vertexShader: billboardVertex,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.frustumCulled = false
  return mesh
}

export interface Sun {
  group: THREE.Group
  /** Lägg solen långt bort i solens riktning sett från kameran; `visible` = 0 bakom Jorden. */
  update(camera: THREE.Camera, dir: THREE.Vector3, visible: number, now: number): void
}

const SUN_DIST = 1600

export function buildSun(): Sun {
  const group = new THREE.Group()
  // Skivan och glorian (skyms av Jorden via djupet)
  const disk = billboard(
    /* glsl */ `
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float core = smoothstep(1.0, 0.82, r);
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.86) * core * 30.0, 1.0);
      }`,
    {},
  )
  disk.material.uniforms.uSize.value = SUN_DIST * Math.tan(THREE.MathUtils.degToRad(0.55))
  const glow = billboard(
    /* glsl */ `
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float g = exp(-r * 10.0) * 1.6 + exp(-r * 3.5) * 0.18 + 0.02 / (r * r * 60.0 + 0.4);
        g *= smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * g, 1.0);
      }`,
    {},
  )
  glow.material.uniforms.uSize.value = SUN_DIST * Math.tan(THREE.MathUtils.degToRad(16))
  // Strålar och en svag horisontell strimma, som i en kameralins (syns inte bakom Jorden)
  const vis = { value: 1 }
  const time = { value: 0 }
  const rays = billboard(
    /* glsl */ `
      uniform float uVis;
      uniform float uTime;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = atan(vP.y, vP.x) + uTime * 0.02;
        float spikes = pow(abs(cos(a * 3.0)), 260.0) * 1.0 + pow(abs(cos(a * 8.0 + 0.4)), 900.0) * 0.3;
        float fall = exp(-r * 8.0);
        float streak = exp(-abs(vP.y) * 140.0) * exp(-abs(vP.x) * 2.2) * 0.9;
        vec3 col = vec3(1.0, 0.9, 0.75) * spikes * fall * 0.7 + vec3(0.55, 0.7, 1.0) * streak * 0.35;
        gl_FragColor = vec4(col * uVis, 1.0);
      }`,
    { uVis: vis, uTime: time },
    { depthTest: false },
  )
  rays.material.uniforms.uSize.value = SUN_DIST * Math.tan(THREE.MathUtils.degToRad(16))
  rays.renderOrder = 5
  group.add(glow, disk, rays)
  group.renderOrder = -1
  const tmp = new THREE.Vector3()
  return {
    group,
    update(camera, dir, visible, now) {
      tmp.copy(camera.position).addScaledVector(dir, SUN_DIST)
      group.position.copy(tmp)
      vis.value = visible
      time.value = now / 1000
    },
  }
}
