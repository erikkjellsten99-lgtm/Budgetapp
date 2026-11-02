// Kartan över universumet i galaxen (CosmosView): var Jorden, rymdbasen och galaxerna ligger,
// var solen står efter dagens poäng och var kameran befinner sig. Ren matematik utan ritande,
// tester i universe.test.ts.
//
// Jorden ligger i mitten med nordpolen uppåt (+y). Startbilden tittar ner mot Europa från sydväst,
// med Jorden lågt i bilden och himlen ovanför. Galaxerna ligger långt bort bakom Jordens horisont.

import * as THREE from 'three'

const deg = THREE.MathUtils.degToRad

export const EARTH_R = 3.2
/** Jorden vrids så att longitud 15° ö (Sverige) vetter mot startbilden. */
export const EARTH_YAW = -deg(90 + 15)
/** Startbildens kamera: över 42° n, 15° ö, så långt bort att halva klotet syns. */
export const HOME_DIST = 11
export const HOME_DIR = new THREE.Vector3(0, Math.sin(deg(42)), Math.cos(deg(42)))
export const HOME_CAM = HOME_DIR.clone().multiplyScalar(HOME_DIST)
/** Startbildens riktningar: framåt (mot Jordens mitt), uppåt och åt höger på skärmen. */
export const HOME_FORWARD = HOME_DIR.clone().negate()
export const HOME_UP = new THREE.Vector3(0, Math.cos(deg(42)), -Math.sin(deg(42)))
export const HOME_RIGHT = new THREE.Vector3().crossVectors(HOME_FORWARD, HOME_UP)

/** Hur mycket startbilden tittar upp, så att Jordens mitt hamnar 78 % ner på skärmen. */
export function homePitch(fovDeg: number): number {
  return Math.atan(0.56 * Math.tan(deg(fovDeg / 2)))
}

/** Riktning från startbilden: `elevation` grader upp från Jordens mitt och `azimuth` grader åt höger. */
export function homeSky(elevation: number, azimuth: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = deg(elevation)
  const h = deg(azimuth)
  return out
    .copy(HOME_FORWARD)
    .multiplyScalar(Math.cos(e) * Math.cos(h))
    .addScaledVector(HOME_UP, Math.sin(e))
    .addScaledVector(HOME_RIGHT, Math.cos(e) * Math.sin(h))
    .normalize()
}

/* ---------- Galaxerna ---------- */

export interface GalaxySpot {
  pos: THREE.Vector3
  radius: number
  /** Skivans läge: lokalt ligger skivan i xz-planet och lokal z pekar mot startbilden. */
  quat: THREE.Quaternion
}

/**
 * En galax på himlen sett från startbilden. Skivan lutar `inclination` grader från siktlinjen
 * (0 = rakt framifrån), vriden `roll` grader runt den.
 */
function galaxySpot(elevation: number, azimuth: number, dist: number, radius: number, inclination: number, roll: number): GalaxySpot {
  const pos = HOME_CAM.clone().addScaledVector(homeSky(elevation, azimuth), dist)
  const toCam = HOME_CAM.clone().sub(pos).normalize()
  const up = HOME_UP.clone().addScaledVector(toCam, -HOME_UP.dot(toCam)).normalize().applyAxisAngle(toCam, deg(roll))
  const normal = toCam.clone().multiplyScalar(Math.cos(deg(inclination))).addScaledVector(up, Math.sin(deg(inclination))).normalize()
  const z = toCam.clone().addScaledVector(normal, -toCam.dot(normal)).normalize()
  const x = new THREE.Vector3().crossVectors(normal, z)
  return { pos, radius, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, normal, z)) }
}

/** Hälsogalaxen (dina vanor) och Ekonomigalaxen, på var sin sida ovanför horisonten. */
export const HEALTH = galaxySpot(24, -6.8, 150, 9.6, 60, 18)
export const ECONOMY = galaxySpot(26.5, 6.8, 170, 9.6, 64, -24)

/** En punkt i galaxens skiva (lokala koordinater) i världen. */
export function inGalaxy(g: GalaxySpot, local: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(local).applyQuaternion(g.quat).add(g.pos)
}

/* ---------- Rymdbasen ---------- */

export const STATION_ALT = 0.36
/** Basen svävar precis ovanför horisonten uppe till vänster i startbilden. */
export const STATION_POS = (() => {
  const limb = Math.acos(EARTH_R / HOME_DIST)
  const side = HOME_UP.clone().multiplyScalar(Math.cos(deg(30))).addScaledVector(HOME_RIGHT, -Math.sin(deg(30)))
  const a = limb + deg(1.2)
  return HOME_DIR.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a)).multiplyScalar(EARTH_R + STATION_ALT)
})()
/** Basens läge: lokal y rakt ut från Jorden, fackverket (lokal x) tvärs över startbilden. */
export const STATION_QUAT = (() => {
  const y = STATION_POS.clone().normalize()
  const x = HOME_RIGHT.clone().addScaledVector(y, -HOME_RIGHT.dot(y)).normalize()
  const z = new THREE.Vector3().crossVectors(x, y)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
})()

/* ---------- Solen ---------- */

/** Solens vinkel från rakt bakom Jorden (sett från startbilden), i grader, efter dagens poäng. */
const SUN_PATH: [number, number][] = [
  // Natt: rakt bakom Jorden. Gryning: kanten börjar glöda. Soluppgång vid 25: solen tittar fram.
  [0, 2],
  [1, 6],
  [24, 16.3],
  [25, 17.4],
  [50, 42],
  [75, 95],
  [100, 152],
]

export function sunAngle(score: number): number {
  const s = THREE.MathUtils.clamp(score, 0, 100)
  for (let i = 1; i < SUN_PATH.length; i++) {
    const [s0, a0] = SUN_PATH[i - 1]
    const [s1, a1] = SUN_PATH[i]
    if (s <= s1) return a0 + ((s - s0) / (s1 - s0)) * (a1 - a0)
  }
  return SUN_PATH[SUN_PATH.length - 1][1]
}

/**
 * Riktningen mot solen. 0 poäng: solen står bakom Jorden och du ser nattsidan med stadsljusen.
 * Solen går upp över Jordens kant och lyser till slut upp hela klotet (100 poäng).
 */
export function sunDirection(score: number, out = new THREE.Vector3()): THREE.Vector3 {
  const b = deg(sunAngle(score))
  return out.copy(HOME_FORWARD).multiplyScalar(Math.cos(b)).addScaledVector(HOME_UP, Math.sin(b)).normalize()
}

/* ---------- Var kameran är ---------- */

export interface Zone {
  key: string
  center: THREE.Vector3
  /** Kameran är i zonen när den är närmare än så här. */
  radius: number
}

/**
 * Av zonerna kameran är inne i: den vars mitt är närmast (basen inne i Jordens zon vinner när man är
 * vid basen, och av två galaxer vinner den man är närmast). Zonen man redan är i räknas lite större,
 * så att nivån inte fladdrar fram och tillbaka vid kanten.
 */
export function zoneAt(cam: THREE.Vector3, zones: Zone[], prev: string, fallback: string): string {
  let best = fallback
  let bestD = Infinity
  for (const z of zones) {
    const keep = z.key === prev ? 1.2 : 1
    const d = cam.distanceTo(z.center)
    if (d < z.radius * keep && d / keep < bestD) {
      best = z.key
      bestD = d / keep
    }
  }
  return best
}

/** Ligger punkten bakom klotet sett från kameran (för etiketter på andra sidan Jorden)? */
export function hiddenBySphere(cam: THREE.Vector3, point: THREE.Vector3, center: THREE.Vector3, radius: number): boolean {
  const dx = point.x - cam.x
  const dy = point.y - cam.y
  const dz = point.z - cam.z
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-9) return false
  const ox = cam.x - center.x
  const oy = cam.y - center.y
  const oz = cam.z - center.z
  const b = (ox * dx + oy * dy + oz * dz) / len
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  const disc = b * b - c
  if (disc < 0) return false
  const t = -b - Math.sqrt(disc)
  return t > 0 && t < len
}

/** Avståndet där ett klot med radien `radius` ryms i bilden (smalaste hållet), med lite luft. */
export function fitDistance(radius: number, fovDeg: number, aspect: number, margin = 1.1): number {
  const half = Math.min(deg(fovDeg / 2), Math.atan(Math.tan(deg(fovDeg / 2)) * aspect))
  return (radius * margin) / Math.sin(half)
}
