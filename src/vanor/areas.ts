// Områden: vanorna delas in i livsområden, som blir solsystem i Hälsa-galaxen (se CosmosView).

import type { Habit } from './habits'

/** Områdena man kan välja, i den ordning de visas. */
export const AREAS = ['Träning', 'Sinne', 'Sömn', 'Kost', 'Kropp och vård', 'Projekt'] as const
/** För vanor utan valt område. */
export const NO_AREA = 'Övrigt'

/** Tom eller okänd text blir inget område (undefined); annars namnet som det står i listan. */
export function cleanArea(area: string | null | undefined): string | undefined {
  const text = (area ?? '').trim()
  if (!text) return undefined
  const known = [...AREAS, NO_AREA].find((a) => a.toLowerCase() === text.toLowerCase())
  return known ?? text.slice(0, 30)
}

/** Ett förslag utifrån vanans namn (för att fylla i rutan), eller null om inget passar. */
export function guessArea(name: string): string | null {
  const n = name.toLowerCase()
  if (/gym|träna|träning|löp|spring|cykl|simm|styrka|workout|promenad|steg|steps|yoga|padel|fotboll|stretch|rörlighet|rehab|prehab/.test(n)) return 'Träning'
  if (/medit|andning|journal|dagbok|läs|tacksam|mindful|reflek|mental/.test(n)) return 'Sinne'
  if (/sömn|sova|sov |säng|lägg dig|vakna|skärm/.test(n)) return 'Sömn'
  if (/kost|mat|ät|frukost|protein|vatten|drick|frukt|grönsak|socker|kalori|snus|alkohol/.test(n)) return 'Kost'
  if (/tand|hud|massage|dusch|bastu|kall|vård|hälsa|vitamin|tillskott/.test(n)) return 'Kropp och vård'
  if (/projekt|bygg|kod|plugg|studera|skriv|franska|språk|jobba|företag/.test(n)) return 'Projekt'
  return null
}

/** Vanans område (eller Övrigt). */
export const areaOf = (h: Pick<Habit, 'area'>) => h.area || NO_AREA
