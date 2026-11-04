// Apple Hälsa → Groundwork. Delas av servern (inbox) och appen (Vanor), så att måtten, tolkningen
// och reglerna alltid är samma på båda ställena. Rena funktioner utan importer, tester i health.test.ts.
//
// Genvägen skickar JSON där varje fält är ett mått, t.ex. { steg: "8 432 steg", somn: "7 h 12 min" }.
// Värdet kan vara en siffra, en text med enhet eller flera rader (en per mätning) – allt tolkas här.

export type HealthMetric =
  | 'steps'
  | 'distanceKm'
  | 'activeKcal'
  | 'exerciseMin'
  | 'standHours'
  | 'flights'
  | 'sleepH'
  | 'mindfulMin'
  | 'waterL'
  | 'weightKg'
  | 'restingHr'
  | 'hrvMs'

interface MetricInfo {
  /** Fältets namn i genvägen (enkla bokstäver, så att det är lätt att skriva). */
  field: string
  /** Vad måttet heter i appen. */
  label: string
  /** Ungefär vad det heter i Hälsa/Genvägar, för instruktionerna. */
  health: string
  unit: string
  /** sum = flera mätningar under dagen läggs ihop, latest = senaste mätningen gäller. */
  kind: 'sum' | 'latest'
  /** Hur värdet är skrivet utan enhet: tid i minuter eller timmar, annars en vanlig siffra. */
  duration?: 'min' | 'h'
  /** Kan bocka en vana automatiskt (t.ex. 10 000 steg). Vikt och puls är bara siffror att se. */
  rule?: { default: number; step: number }
  decimals: number
}

export const METRICS: Record<HealthMetric, MetricInfo> = {
  steps: { field: 'steg', label: 'Steg', health: 'Steg', unit: 'steg', kind: 'sum', rule: { default: 10000, step: 500 }, decimals: 0 },
  distanceKm: { field: 'distans', label: 'Distans', health: 'Gång- och löpdistans', unit: 'km', kind: 'sum', rule: { default: 5, step: 0.5 }, decimals: 1 },
  activeKcal: { field: 'energi', label: 'Aktiv energi', health: 'Aktiv energi', unit: 'kcal', kind: 'sum', rule: { default: 500, step: 50 }, decimals: 0 },
  exerciseMin: { field: 'traning', label: 'Träning', health: 'Träningsminuter', unit: 'min', kind: 'sum', duration: 'min', rule: { default: 30, step: 5 }, decimals: 0 },
  standHours: { field: 'sta', label: 'Ståtimmar', health: 'Ståtimmar', unit: 'h', kind: 'sum', rule: { default: 12, step: 1 }, decimals: 0 },
  flights: { field: 'trappor', label: 'Trappor', health: 'Våningar uppför trappor', unit: 'våningar', kind: 'sum', rule: { default: 10, step: 1 }, decimals: 0 },
  sleepH: { field: 'somn', label: 'Sömn', health: 'Sömn', unit: 'h', kind: 'sum', duration: 'h', rule: { default: 7, step: 0.5 }, decimals: 1 },
  mindfulMin: { field: 'mindfulness', label: 'Mindfulness', health: 'Mindfulnessminuter', unit: 'min', kind: 'sum', duration: 'min', rule: { default: 10, step: 5 }, decimals: 0 },
  waterL: { field: 'vatten', label: 'Vatten', health: 'Vatten', unit: 'l', kind: 'sum', rule: { default: 2, step: 0.25 }, decimals: 1 },
  weightKg: { field: 'vikt', label: 'Vikt', health: 'Vikt', unit: 'kg', kind: 'latest', decimals: 1 },
  restingHr: { field: 'vilopuls', label: 'Vilopuls', health: 'Vilopuls', unit: 'slag/min', kind: 'latest', decimals: 0 },
  hrvMs: { field: 'hrv', label: 'Pulsvariabilitet', health: 'Pulsvariabilitet', unit: 'ms', kind: 'latest', decimals: 0 },
}

export const METRIC_KEYS = Object.keys(METRICS) as HealthMetric[]
export const RULE_METRICS = METRIC_KEYS.filter((m) => METRICS[m].rule)

/** Hälsodata för en dag, som den sparas (en post per datum). */
export interface HealthDay {
  date: string
  /** När den senast uppdaterades (ms). */
  updated: number
  values: Partial<Record<HealthMetric, number>>
}

/** En vana som bockas automatiskt när måttet når gränsen, t.ex. steg ≥ 10 000. */
export interface AutoRule {
  metric: HealthMetric
  min: number
}

// Siffror som "8 432", "8 432", "5,2", "1.5" och "12"
const NUMBER = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/
const toNumber = (s: string) => Number(s.replace(/[   ]/g, '').replace(',', '.'))

/** Tid i minuter ur t.ex. "7 h 32 min", "7 tim 32 min", "7:32", "452 min", "27120 s" eller "7,5 h". */
function minutes(line: string, plain: 'min' | 'h'): number | null {
  const l = line.toLowerCase()
  const clock = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(l)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3] ?? 0) / 60
  const h = /(\d+(?:[.,]\d+)?)\s*(?:h|tim|timmar|timme|hr|hours?)(?![a-zåäö])/.exec(l)
  const m = /(\d+(?:[.,]\d+)?)\s*(?:min|minuter|minut|m)(?![a-zåäö])/.exec(l)
  const s = /(\d+(?:[.,]\d+)?)\s*(?:s|sek|sekunder|sec)(?![a-zåäö])/.exec(l)
  if (h || m || s) return (h ? toNumber(h[1]) * 60 : 0) + (m ? toNumber(m[1]) : 0) + (s ? toNumber(s[1]) / 60 : 0)
  const n = NUMBER.exec(l)
  if (!n) return null
  return plain === 'h' ? toNumber(n[0]) * 60 : toNumber(n[0])
}

/** Ett värde ur en rad, i måttets enhet. Null om raden inte innehåller någon siffra. */
function lineValue(line: string, metric: HealthMetric): number | null {
  const info = METRICS[metric]
  if (info.duration) {
    const mins = minutes(line, info.duration)
    return mins === null ? null : info.duration === 'h' ? mins / 60 : mins
  }
  const n = NUMBER.exec(line)
  if (!n) return null
  let value = toNumber(n[0])
  const unit = line.slice(n.index + n[0].length).trim().toLowerCase()
  if (metric === 'distanceKm' && /^(?:m|meter)(?![a-zåäö])/.test(unit)) value /= 1000
  if (metric === 'distanceKm' && /^(?:mi|miles?)/.test(unit)) value *= 1.609
  if (metric === 'activeKcal' && /^kj/.test(unit)) value /= 4.184
  if (metric === 'waterL' && /^ml/.test(unit)) value /= 1000
  if (metric === 'waterL' && /^dl/.test(unit)) value /= 10
  if (metric === 'waterL' && /^cl/.test(unit)) value /= 100
  if (metric === 'weightKg' && /^(?:lb|lbs|pund)/.test(unit)) value *= 0.4536
  if (metric === 'standHours' && /^min/.test(unit)) value /= 60
  return value
}

/**
 * Tolkar ett fält från genvägen. Flera rader (en per mätning) läggs ihop för steg, distans m.m.,
 * och för vikt och puls gäller den första raden (genvägen sorterar senaste först).
 */
export function parseHealthValue(raw: unknown, metric: HealthMetric): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null
  const lines = (Array.isArray(raw) ? raw.map(String) : String(raw).split(/\r?\n/)).map((l) => l.trim()).filter(Boolean)
  const values = lines.map((l) => lineValue(l, metric)).filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0)
  if (!values.length) return null
  const value = METRICS[metric].kind === 'sum' ? values.reduce((a, b) => a + b, 0) : values[0]
  return round(value, METRICS[metric].decimals + 1)
}

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals

/** Läser alla mått ur det genvägen skickade. Fält som saknas eller inte går att tolka hoppas över. */
export function parseHealthBody(body: Record<string, unknown>): Partial<Record<HealthMetric, number>> {
  const out: Partial<Record<HealthMetric, number>> = {}
  for (const metric of METRIC_KEYS) {
    const field = METRICS[metric].field
    if (!(field in body)) continue
    const value = parseHealthValue(body[field], metric)
    if (value !== null) out[metric] = value
  }
  return out
}

/** Skickade genvägen hälsodata? (minst ett känt fält) */
export const isHealthBody = (body: Record<string, unknown>) => METRIC_KEYS.some((m) => METRICS[m].field in body)

/** Vanor (id) vars regel är uppfylld av dagens värden. Borttagna vanor och vanor som inte fanns än räknas inte. */
export function metRules(
  habits: { id: string; archived?: boolean; created?: string; auto?: AutoRule }[],
  values: Partial<Record<HealthMetric, number>>,
  date: string,
): string[] {
  return habits
    .filter((h) => !h.archived && h.auto && (!h.created || h.created <= date))
    .filter((h) => {
      const v = values[h.auto!.metric]
      return v !== undefined && v >= h.auto!.min
    })
    .map((h) => h.id)
}

/** "8 432 steg", "5,2 km", "7 h 12 min", "34 min" – svenska siffror. */
export function formatHealth(metric: HealthMetric, value: number): string {
  const info = METRICS[metric]
  const num = (n: number, d: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: d, minimumFractionDigits: 0 })
  if (metric === 'sleepH') {
    const total = Math.round(value * 60)
    const h = Math.floor(total / 60)
    const m = total % 60
    return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
  }
  return `${num(value, info.decimals)} ${info.unit}`
}

/** "8 432 av 10 000 steg", "6 h 30 min av 7 h" – enheten skrivs bara en gång när den är samma. */
export function formatProgress(metric: HealthMetric, value: number, goal: number): string {
  const a = formatHealth(metric, value)
  const b = formatHealth(metric, goal)
  const unit = `\u00a0${METRICS[metric].unit}`
  return metric !== 'sleepH' && a.endsWith(unit) ? `${a.slice(0, -unit.length)} av ${b}` : `${a} av ${b}`
}

/** "10 000 steg", "10 min mindfulness", "7 h sömn" – gränsen i en regel, som text. */
export function formatGoal(metric: HealthMetric, value: number): string {
  const info = METRICS[metric]
  const v = formatHealth(metric, value)
  return info.unit === info.label.toLowerCase() ? v : `${v} ${info.label.toLowerCase()}`
}

/** Förslag på regel utifrån vanans namn, t.ex. "10k steg" → steg ≥ 10 000. */
export function guessRule(name: string): AutoRule | null {
  const n = name.toLowerCase()
  const k = /(\d+(?:[.,]\d+)?)\s*k\s*steg/.exec(n)
  if (k) return { metric: 'steps', min: toNumber(k[1]) * 1000 }
  const steps = /(\d[\d  ]*)\s*steg/.exec(n)
  if (steps) return { metric: 'steps', min: toNumber(steps[1].trim()) }
  if (/steg|gå|promenad/.test(n)) return { metric: 'steps', min: 10000 }
  if (/medit|mindful|andning/.test(n)) return { metric: 'mindfulMin', min: 10 }
  if (/sömn|sova|sov /.test(n)) return { metric: 'sleepH', min: 7 }
  if (/vatten|dricka/.test(n)) return { metric: 'waterL', min: 2 }
  if (/gym|träning|träna|löp|spring|cykl|simn/.test(n)) return { metric: 'exerciseMin', min: 30 }
  return null
}
