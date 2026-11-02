import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  EARTH_R,
  ECONOMY,
  HEALTH,
  HOME_CAM,
  HOME_DIR,
  HOME_FORWARD,
  STATION_POS,
  fitDistance,
  hiddenBySphere,
  homePitch,
  inGalaxy,
  sunAngle,
  sunDirection,
  zoneAt,
} from './universe'

const ORIGIN = new THREE.Vector3()

/** Var på skärmen en punkt hamnar i startbilden: x och y från −1 till 1 (y uppåt). */
function onHomeScreen(p: THREE.Vector3, fov = 50, aspect = 390 / 844) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 5000)
  cam.position.copy(HOME_CAM)
  cam.lookAt(ORIGIN)
  cam.rotateX(homePitch(fov))
  cam.updateMatrixWorld()
  return p.clone().project(cam)
}

describe('solen', () => {
  it('stiger med poängen', () => {
    const angles = [0, 5, 10, 25, 50, 75, 100].map(sunAngle)
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1])
    expect(sunAngle(-10)).toBe(sunAngle(0))
    expect(sunAngle(140)).toBe(sunAngle(100))
  })

  it('natt bakom Jorden, full sol mot kameran', () => {
    // 0 poäng: solen nästan rakt bakom Jorden, sett från startbilden
    expect(sunDirection(0).dot(HOME_FORWARD)).toBeGreaterThan(0.98)
    // 100 poäng: solen på kamerans sida, nästan hela klotet upplyst
    expect(sunDirection(100).dot(HOME_DIR)).toBeGreaterThan(0.85)
    // Solen är dold bakom Jorden vid 0 men har gått upp vid 25
    const sun = (s: number) => HOME_CAM.clone().addScaledVector(sunDirection(s), 2000)
    expect(hiddenBySphere(HOME_CAM, sun(0), ORIGIN, EARTH_R)).toBe(true)
    // Gryning: fortfarande bakom kanten; soluppgång (25): solen har tittat fram
    expect(hiddenBySphere(HOME_CAM, sun(20), ORIGIN, EARTH_R)).toBe(true)
    expect(hiddenBySphere(HOME_CAM, sun(25), ORIGIN, EARTH_R)).toBe(false)
  })
})

describe('startbilden', () => {
  it('Jorden ligger lågt med himlen ovanför', () => {
    const center = onHomeScreen(ORIGIN)
    expect(center.y).toBeLessThan(-0.5)
    expect(center.y).toBeGreaterThan(-0.62)
  })

  it('basen syns precis ovanför horisonten', () => {
    expect(hiddenBySphere(HOME_CAM, STATION_POS, ORIGIN, EARTH_R)).toBe(false)
    expect(STATION_POS.length() - EARTH_R).toBeCloseTo(0.36, 5)
    const p = onHomeScreen(STATION_POS)
    expect(Math.abs(p.x)).toBeLessThan(0.85)
    expect(Math.abs(p.y)).toBeLessThan(0.6)
  })

  it('båda galaxerna syns på himlen även på en smal telefon', () => {
    for (const g of [HEALTH, ECONOMY]) {
      expect(hiddenBySphere(HOME_CAM, g.pos, ORIGIN, EARTH_R)).toBe(false)
      const p = onHomeScreen(g.pos)
      expect(Math.abs(p.x)).toBeLessThan(0.8)
      expect(p.y).toBeGreaterThan(-0.1)
      expect(p.y).toBeLessThan(0.75)
    }
  })

  it('galaxens lokala z pekar mot startbilden, skivan lutar', () => {
    const toward = inGalaxy(HEALTH, new THREE.Vector3(0, 0, 1)).sub(HEALTH.pos)
    expect(toward.dot(HOME_CAM.clone().sub(HEALTH.pos).normalize())).toBeGreaterThan(0.3)
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(HEALTH.quat)
    expect(Math.abs(normal.dot(HOME_CAM.clone().sub(HEALTH.pos).normalize()))).toBeLessThan(0.8)
  })
})

describe('var kameran är', () => {
  const zones = [
    { key: 'base', center: STATION_POS, radius: 1.6 },
    { key: 'earth', center: ORIGIN, radius: 45 },
    { key: 'health', center: HEALTH.pos, radius: HEALTH.radius * 3.2 },
  ]
  it('den zon kameran är djupast inne i, annars universum', () => {
    expect(zoneAt(HOME_CAM, zones, 'earth', 'universe')).toBe('earth')
    expect(zoneAt(STATION_POS.clone().add(new THREE.Vector3(0.5, 0, 0)), zones, 'earth', 'universe')).toBe('base')
    expect(zoneAt(HEALTH.pos.clone().add(new THREE.Vector3(0, 10, 0)), zones, 'earth', 'universe')).toBe('health')
    expect(zoneAt(new THREE.Vector3(0, 400, 0), zones, 'earth', 'universe')).toBe('universe')
  })

  it('två zoner som överlappar: den man är närmast mitten av vinner', () => {
    const a = { key: 'a', center: new THREE.Vector3(0, 0, 0), radius: 60 }
    const b = { key: 'b', center: new THREE.Vector3(40, 0, 0), radius: 60 }
    expect(zoneAt(new THREE.Vector3(32, 0, 0), [a, b], 'universe', 'universe')).toBe('b')
    expect(zoneAt(new THREE.Vector3(8, 0, 0), [a, b], 'universe', 'universe')).toBe('a')
  })

  it('zonen man är i räknas lite större', () => {
    const edge = STATION_POS.clone().add(new THREE.Vector3(1.75, 0, 0))
    expect(zoneAt(edge, zones, 'earth', 'universe')).toBe('earth')
    expect(zoneAt(edge, zones, 'base', 'universe')).toBe('base')
  })

  it('bakom Jorden', () => {
    const cam = new THREE.Vector3(0, 0, 10)
    expect(hiddenBySphere(cam, new THREE.Vector3(0, 0, -10), ORIGIN, EARTH_R)).toBe(true)
    expect(hiddenBySphere(cam, new THREE.Vector3(0, 9, -10), ORIGIN, EARTH_R)).toBe(false)
    expect(hiddenBySphere(cam, new THREE.Vector3(0, 0, 5), ORIGIN, EARTH_R)).toBe(false)
  })

  it('avstånd så att något ryms', () => {
    // Smal telefon: bredden avgör
    expect(fitDistance(1, 50, 0.46)).toBeGreaterThan(fitDistance(1, 50, 1.6))
    expect(fitDistance(1, 50, 1.6)).toBeCloseTo(1.1 / Math.sin(THREE.MathUtils.degToRad(25)), 5)
  })
})
