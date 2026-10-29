// Planeternas utseende, gemensamt för månadsbilden (Galaxy.tsx) och 3D-galaxen (GalaxyView.tsx),
// så att samma vana ser likadan ut överallt: en planet per vana, i vanornas ordning.

export type PlanetKind = 'ocean' | 'rock' | 'gas' | 'ring' | 'ice'
export const PLANET_KINDS: PlanetKind[] = ['ocean', 'rock', 'gas', 'ring', 'ice']
export const planetKind = (i: number) => PLANET_KINDS[i % PLANET_KINDS.length]

/** Planetfärger, en per vana i den ordning vanorna ligger. */
export const PLANET_COLORS = ['#7fb2ff', '#ff9a6b', '#8ee0b0', '#e7a8ff', '#ffd36b', '#6be0e6', '#ff7f9e', '#c9d1e8']
export const planetColor = (i: number) => PLANET_COLORS[i % PLANET_COLORS.length]
