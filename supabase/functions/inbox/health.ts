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
  | 'sleepScore'
  | 'inBedH'
  | 'sleepDeepH'
  | 'sleepCoreH'
  | 'sleepRemH'
  | 'sleepAwakeMin'
  | 'sleepWakes'
  | 'bedtime'
  | 'wakeTime'
  | 'respRate'
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
  /** sum = flera mätningar under dagen läggs ihop, latest = senaste mätningen gäller, avg = medelvärde. */
  kind: 'sum' | 'latest' | 'avg'
  /** Räknas fram ur sömnfältet (somn) i stället för att ha ett eget fält i genvägen. */
  derived?: true
  /** Ett klockslag i timmar (23,5 = 23:30; efter midnatt räknas läggtid som 24+). */
  clock?: true
  /**
   * Värdet är en tid. Skrivs den utan enhet gäller: 'min' = minuter, 'h' = timmar (över 24 = sekunder),
   * 's' = sekunder (Genvägars "Tidslängd" för mindfulness är sekunder, t.ex. 180 = 3 min).
   */
  duration?: 'min' | 'h' | 's'
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
  sleepScore: { field: 'somnpoang', label: 'Sömnpoäng', health: 'Sömnpoäng (skrivs in från klockan)', unit: 'p', kind: 'latest', decimals: 0 },
  inBedH: { field: 'somn', derived: true, label: 'I säng', health: 'Sömn', unit: 'h', kind: 'sum', duration: 'h', decimals: 1 },
  sleepDeepH: { field: 'somn', derived: true, label: 'Djup', health: 'Sömn', unit: 'h', kind: 'sum', duration: 'h', decimals: 1 },
  sleepCoreH: { field: 'somn', derived: true, label: 'Kärna', health: 'Sömn', unit: 'h', kind: 'sum', duration: 'h', decimals: 1 },
  sleepRemH: { field: 'somn', derived: true, label: 'REM', health: 'Sömn', unit: 'h', kind: 'sum', duration: 'h', decimals: 1 },
  sleepAwakeMin: { field: 'somn', derived: true, label: 'Vaken', health: 'Sömn', unit: 'min', kind: 'sum', decimals: 0 },
  sleepWakes: { field: 'somn', derived: true, label: 'Uppvaknanden', health: 'Sömn', unit: 'ggr', kind: 'sum', decimals: 0 },
  bedtime: { field: 'somn', derived: true, clock: true, label: 'Somnade', health: 'Sömn', unit: 'kl', kind: 'latest', decimals: 2 },
  wakeTime: { field: 'somn', derived: true, clock: true, label: 'Vaknade', health: 'Sömn', unit: 'kl', kind: 'latest', decimals: 2 },
  respRate: { field: 'andning', label: 'Andning', health: 'Andningsfrekvens', unit: 'andetag/min', kind: 'avg', decimals: 1 },
  mindfulMin: { field: 'mindfulness', label: 'Mindfulness', health: 'Mindfulnessminuter', unit: 'min', kind: 'sum', duration: 's', rule: { default: 10, step: 5 }, decimals: 0 },
  waterL: { field: 'vatten', label: 'Vatten', health: 'Vatten', unit: 'l', kind: 'sum', rule: { default: 2, step: 0.25 }, decimals: 1 },
  weightKg: { field: 'vikt', label: 'Vikt', health: 'Vikt', unit: 'kg', kind: 'latest', decimals: 1 },
  restingHr: { field: 'vilopuls', label: 'Vilopuls', health: 'Vilopuls', unit: 'slag/min', kind: 'latest', decimals: 0 },
  hrvMs: { field: 'hrv', label: 'Pulsvariabilitet', health: 'Pulsvariabilitet', unit: 'ms', kind: 'latest', decimals: 0 },
}

export const METRIC_KEYS = Object.keys(METRICS) as HealthMetric[]
export const RULE_METRICS = METRIC_KEYS.filter((m) => METRICS[m].rule)
/** Mått med eget fält i genvägen (de som räknas fram ur sömnen har inget). */
export const FIELD_METRICS = METRIC_KEYS.filter((m) => !METRICS[m].derived)
/** Allt om sömnen, visas tillsammans i appen. */
export const SLEEP_METRICS: HealthMetric[] = ['sleepH', 'sleepScore', 'inBedH', 'sleepDeepH', 'sleepCoreH', 'sleepRemH', 'sleepAwakeMin', 'sleepWakes', 'bedtime', 'wakeTime', 'respRate']

/** Hälsodata för en dag, som den sparas (en post per datum). */
export interface HealthDay {
  date: string
  /** När den senast uppdaterades (ms). */
  updated: number
  values: Partial<Record<HealthMetric, number>>
  /** Nattens faser i tidsordning, för sömndiagrammet. Saknas om genvägen bara skickade tider utan start och slut. */
  stages?: SleepStage[]
}

/** En sömnfas: k = fas, s och e = start och slut i ms. */
export interface SleepStage {
  k: 'awake' | 'rem' | 'core' | 'deep' | 'asleep'
  s: number
  e: number
}

/** En vana som bockas automatiskt när måttet når gränsen, t.ex. steg ≥ 10 000. */
export interface AutoRule {
  metric: HealthMetric
  min: number
  /** Gränsen följer vanans gradvisa ökning (t.ex. meditation +1 min per dag) i stället för att vara fast. */
  follow?: boolean
}

/** En vanas gradvisa ökning (samma fält som Ramp i appen). */
export interface RampInfo {
  start: string
  from: number
  step: number
  max: number
}

/** Dagens längd i en ökning: start + steg för varje gjord dag före idag, upp till taket (samma som rampToday i appen). */
export const rampLength = (r: RampInfo, doneBefore: number) => Math.min(r.max, r.from + r.step * doneBefore)

/** Första talet i en minimiversion, t.ex. "2 min" → 2. */
export function minimumAmount(text: string | undefined): number | null {
  const m = text ? NUMBER.exec(text) : null
  return m ? toNumber(m[0]) : null
}

/** Vad en vana med regel behöver idag: hel gräns och ev. minimiversion. */
export function ruleTarget(
  habit: { auto?: AutoRule; ramp?: RampInfo; minimum?: string },
  doneBefore: number,
): { full: number; minimum: number | null } | null {
  const rule = habit.auto
  if (!rule) return null
  const full = rule.follow && habit.ramp ? rampLength(habit.ramp, doneBefore) : rule.min
  const min = rule.follow ? minimumAmount(habit.minimum) : null
  return { full, minimum: min !== null && min < full ? min : null }
}

// Siffror som "8 432", "8 432", "5,2", "1.5" och "12"
const NUMBER = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/
const toNumber = (s: string) => Number(s.replace(/[   ]/g, '').replace(',', '.'))

/** Tid i minuter ur t.ex. "7 h 32 min", "7 tim 32 min", "7:32", "452 min", "27120 s" eller "7,5 h". */
function minutes(line: string, plain: 'min' | 'h' | 's'): number | null {
  const l = line.toLowerCase()
  const clock = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(l)
  if (clock) {
    // Genvägars Tidslängd skrivs som m:ss ("3:00" = 3 min) eller h:mm:ss. Sömn "7:30" är h:mm.
    if (plain === 's' && clock[3] === undefined) return Number(clock[1]) + Number(clock[2]) / 60
    return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3] ?? 0) / 60
  }
  const h = /(\d+(?:[.,]\d+)?)\s*(?:h|tim|timmar|timme|hr|hours?)(?![a-zåäö])/.exec(l)
  const m = /(\d+(?:[.,]\d+)?)\s*(?:min|minuter|minut|m)(?![a-zåäö])/.exec(l)
  const s = /(\d+(?:[.,]\d+)?)\s*(?:s|sek|sekunder|sec)(?![a-zåäö])/.exec(l)
  if (h || m || s) return (h ? toNumber(h[1]) * 60 : 0) + (m ? toNumber(m[1]) : 0) + (s ? toNumber(s[1]) / 60 : 0)
  const n = NUMBER.exec(l)
  if (!n) return null
  const v = toNumber(n[0])
  if (plain === 's') return v / 60
  // Sömn utan enhet: upp till 24 är timmar, mer än så är sekunder (Genvägars Tidslängd)
  if (plain === 'h') return v > 24 ? v / 60 : v * 60
  return v
}

/** Ett värde ur en rad, i måttets enhet. Null om raden inte innehåller någon siffra. */
function lineValue(line: string, metric: HealthMetric): number | null {
  const info = METRICS[metric]
  if (info.duration) {
    const mins = minutes(line, info.duration)
    return mins === null ? null : metric === 'sleepH' ? mins / 60 : mins
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

// Sömnfaser som klockan skriver till Hälsa (svenska och engelska namn)
const AWAKE = /vaken|awake/i
const IN_BED = /i säng|in bed|inbed/i
const DEEP = /djup|deep/i
const CORE = /kärna|core/i
const REM = /(?<![a-zåäö])rem(?![a-zåäö])/i
const ASLEEP = /sover|asleep|sömn|unspecified/i
const ISO_TIME = /(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g

type SleepKind = 'awake' | 'bed' | 'deep' | 'core' | 'rem' | 'asleep'

function sleepKind(line: string): SleepKind | null {
  if (AWAKE.test(line)) return 'awake'
  if (IN_BED.test(line)) return 'bed'
  if (DEEP.test(line)) return 'deep'
  if (CORE.test(line)) return 'core'
  if (REM.test(line)) return 'rem'
  if (ASLEEP.test(line)) return 'asleep'
  return null
}

interface SleepPart {
  kind: SleepKind
  mins: number
  /** Start och slut i ms, och starten som klockslag (timmar, lokal tid ur texten). Saknas utan datum på raden. */
  start?: number
  end?: number
  clock?: number
}

/** Läser raderna ("Kärna | start | slut" eller "Kärna | 45:00") till faser. Rader utan fas eller tid hoppas över. */
function readSleepParts(raw: unknown): SleepPart[] {
  if (raw === null || raw === undefined) return []
  const lines = (Array.isArray(raw) ? raw.map(String) : String(raw).split(/\r?\n/)).map((l) => l.trim()).filter(Boolean)
  const parts: SleepPart[] = []
  for (const line of lines) {
    const kind = sleepKind(line)
    if (!kind) continue
    const stamps = [...line.matchAll(ISO_TIME)]
    let rest = line
    for (const m of stamps) rest = rest.replace(m[0], ' ')
    rest = rest.replace(/[|]/g, ' ').replace(/[a-zåäö]+/gi, (w) => (/^(h|tim|timmar|timme|min|minuter|minut|m|s|sek|sekunder|sec)$/i.test(w) ? w : ' '))
    const ms = stamps.map((m) => Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}${m[5] ? (m[5] === 'Z' ? 'Z' : m[5].length === 5 ? `${m[5].slice(0, 3)}:${m[5].slice(3)}` : m[5]) : 'Z'}`))
    let mins: number | null = null
    if (stamps.length >= 2 && Number.isFinite(ms[0]) && Number.isFinite(ms[1])) mins = (ms[1] - ms[0]) / 60000
    else if (/\d/.test(rest)) mins = minutes(rest, 's')
    if (mins === null || !Number.isFinite(mins) || mins < 0 || mins > 24 * 60) continue
    const part: SleepPart = { kind, mins }
    if (stamps.length && Number.isFinite(ms[0])) {
      part.start = ms[0]
      part.end = stamps.length >= 2 && Number.isFinite(ms[1]) ? ms[1] : ms[0] + mins * 60000
      part.clock = Number(stamps[0][2]) + Number(stamps[0][3]) / 60
    }
    parts.push(part)
  }
  return parts
}

/** Nattens faser med start och slut i tidsordning, för sömndiagrammet. "I säng" och rader utan tider tas inte med. */
export function parseSleepStages(raw: unknown): SleepStage[] {
  const out: SleepStage[] = []
  for (const p of readSleepParts(raw)) {
    if (p.kind === 'bed' || p.start === undefined || p.end === undefined || p.end <= p.start) continue
    out.push({ k: p.kind, s: p.start, e: p.end })
  }
  return out.sort((x, y) => x.s - y.s)
}

/**
 * Sömn från genvägen: en rad per mätning med fas och tid, t.ex. "Kärna | 2026-11-04T01:10:00+01:00 | 2026-11-04T01:55:00+01:00"
 * (fas, start, slut) eller "Kärna | 45:00" (fas och Genvägars Tidslängd). Ger total sömn, faserna, vaken tid,
 * uppvaknanden, i säng och när du somnade och vaknade. Vaken räknas inte som sömn. Finns faser (klockan)
 * räknas de, annars "I säng" (bara telefonen). Null om inga rader har en fas.
 */
export function parseSleep(raw: unknown): Partial<Record<HealthMetric, number>> | null {
  const parts = readSleepParts(raw)
  if (!parts.length) return null

  const sum = (kinds: SleepKind[]) => parts.filter((p) => kinds.includes(p.kind)).reduce((a, p) => a + p.mins, 0)
  const asleepKinds: SleepKind[] = ['deep', 'core', 'rem', 'asleep']
  const asleep = sum(asleepKinds)
  const inBed = sum(['bed'])
  const out: Partial<Record<HealthMetric, number>> = {}
  const set = (metric: HealthMetric, value: number) => {
    out[metric] = round(value, METRICS[metric].decimals + 1)
  }
  if (asleep || inBed) set('sleepH', (asleep || inBed) / 60)
  if (inBed) set('inBedH', inBed / 60)
  if (asleep) {
    set('sleepDeepH', sum(['deep']) / 60)
    set('sleepCoreH', sum(['core']) / 60)
    set('sleepRemH', sum(['rem']) / 60)
  }
  const awakeParts = parts.filter((p) => p.kind === 'awake')
  if (awakeParts.length || asleep) set('sleepAwakeMin', sum(['awake']))

  // Klockslag: när första sömnfasen började och den sista slutade
  const timed = parts.filter((p) => asleepKinds.includes(p.kind) && p.start !== undefined) as Required<SleepPart>[]
  const pool = timed.length ? timed : (parts.filter((p) => p.kind === 'bed' && p.start !== undefined) as Required<SleepPart>[])
  if (pool.length) {
    const first = pool.reduce((a, p) => (p.start < a.start ? p : a))
    const last = pool.reduce((a, p) => (p.start + p.mins * 60000 > a.start + a.mins * 60000 ? p : a))
    set('bedtime', first.clock < 15 ? first.clock + 24 : first.clock)
    set('wakeTime', (last.clock + last.mins / 60) % 24)
    // Uppvaknanden = vakna perioder mellan insomning och uppvaknande (inte den sista när du går upp)
    const sleepStart = first.start
    const sleepEnd = last.start + last.mins * 60000
    set('sleepWakes', awakeParts.filter((p) => p.start !== undefined && p.start > sleepStart && p.start + p.mins * 60000 < sleepEnd).length)
  }
  return out
}

/**
 * Tolkar ett fält från genvägen. Flera rader (en per mätning) läggs ihop för steg, distans m.m.,
 * och för vikt och puls gäller den första raden (genvägen sorterar senaste först).
 */
export function parseHealthValue(raw: unknown, metric: HealthMetric): number | null {
  if (raw === null || raw === undefined) return null
  // En siffra (t.ex. Tidslängd som tal) tolkas som text utan enhet, så att sekunder blir minuter
  if (typeof raw === 'number') raw = Number.isFinite(raw) && raw >= 0 ? String(raw) : ''
  const lines = (Array.isArray(raw) ? raw.map(String) : String(raw).split(/\r?\n/)).map((l) => l.trim()).filter(Boolean)
  if (metric === 'sleepH') {
    const sleep = parseSleep(lines)
    if (sleep?.sleepH !== undefined) return sleep.sleepH
  }
  const values = lines.map((l) => lineValue(l, metric)).filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0)
  if (!values.length) return null
  const kind = METRICS[metric].kind
  const total = values.reduce((a, b) => a + b, 0)
  const value = kind === 'sum' ? total : kind === 'avg' ? total / values.length : values[0]
  return round(value, METRICS[metric].decimals + 1)
}

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals

/** Läser alla mått ur det genvägen skickade. Fält som saknas eller inte går att tolka hoppas över. */
export function parseHealthBody(body: Record<string, unknown>): Partial<Record<HealthMetric, number>> {
  const out: Partial<Record<HealthMetric, number>> = {}
  for (const metric of FIELD_METRICS) {
    const field = METRICS[metric].field
    if (!(field in body)) continue
    const value = parseHealthValue(body[field], metric)
    if (value !== null) out[metric] = value
  }
  // Sömn med faser och tider ger fler mått än bara total sömn
  if ('somn' in body) Object.assign(out, parseSleep(body.somn) ?? {})
  return out
}

/** Skickade genvägen hälsodata? (minst ett känt fält) */
export const isHealthBody = (body: Record<string, unknown>) => METRIC_KEYS.some((m) => METRICS[m].field in body)

/**
 * Vanor vars regel är uppfylld av dagens värden: 'full' när gränsen nås, 'min' när bara minimiversionen nås.
 * Borttagna vanor och vanor som inte fanns än räknas inte. `doneBefore` = gjorda dagar i ökningen före idag.
 */
export function metRules(
  habits: { id: string; archived?: boolean; created?: string; auto?: AutoRule; ramp?: RampInfo; minimum?: string }[],
  values: Partial<Record<HealthMetric, number>>,
  date: string,
  doneBefore: (habitId: string) => number = () => 0,
): { id: string; min: boolean }[] {
  const out: { id: string; min: boolean }[] = []
  for (const h of habits) {
    if (h.archived || !h.auto || (h.created && h.created > date)) continue
    const v = values[h.auto.metric]
    const target = ruleTarget(h, doneBefore(h.id))
    if (v === undefined || !target) continue
    if (v >= target.full) out.push({ id: h.id, min: false })
    else if (target.minimum !== null && v >= target.minimum) out.push({ id: h.id, min: true })
  }
  return out
}

/** "8 432 steg", "5,2 km", "7 h 12 min", "34 min" – svenska siffror. */
export function formatHealth(metric: HealthMetric, value: number): string {
  const info = METRICS[metric]
  const num = (n: number, d: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: d, minimumFractionDigits: 0 })
  if (info.clock) {
    const total = Math.round((((value % 24) + 24) % 24) * 60) % (24 * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  if (info.duration === 'h') {
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

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Apples nivåer för sömnpoäng. */
export function sleepRating(score: number): string {
  if (score >= 96) return 'Mycket hög'
  if (score >= 81) return 'Hög'
  if (score >= 61) return 'OK'
  if (score >= 41) return 'Låg'
  return 'Mycket låg'
}

export interface SleepScore {
  score: number
  /** Poäng per del: längd (av 50), läggtid (av 30, null utan minst 3 tidigare nätter), avbrott (av 20). */
  duration: number
  bedtime: number | null
  interruptions: number
}

/**
 * Uppskattad sömnpoäng 0–100 enligt samma delar som Apple använder: längd 50 p, regelbunden läggtid 30 p
 * (jämfört med upp till 13 tidigare nätter) och avbrott 20 p. Apples exakta formel är inte offentlig, så det
 * här är en uppskattning. `pastBedtimes` = när du somnade tidigare nätter (som i måttet bedtime).
 */
export function estimateSleepScore(values: Partial<Record<HealthMetric, number>>, pastBedtimes: number[]): SleepScore | null {
  const hours = values.sleepH
  if (hours === undefined || hours <= 0) return null
  // Längd: full poäng från 7,5 h, inget under 4 h
  const duration = 50 * clamp01((hours - 4) / 3.5)
  // Läggtid: full poäng inom 30 min från ditt snitt, inget vid 2,5 h ifrån
  const past = pastBedtimes.slice(-13)
  let bedtime: number | null = null
  if (values.bedtime !== undefined && past.length >= 3) {
    const mean = past.reduce((a, b) => a + b, 0) / past.length
    bedtime = 30 * clamp01(1 - (Math.abs(values.bedtime - mean) - 0.5) / 2)
  }
  // Avbrott: vaken tid och antal uppvaknanden (de 3 första är vanliga och kostar inget)
  const awake = values.sleepAwakeMin ?? 0
  const wakes = values.sleepWakes ?? 0
  const interruptions = Math.max(0, 20 * clamp01(1 - awake / 60) - Math.max(0, wakes - 3))
  const raw = bedtime === null ? ((duration + interruptions) / 70) * 100 : duration + bedtime + interruptions
  return { score: Math.round(raw), duration: Math.round(duration), bedtime: bedtime === null ? null : Math.round(bedtime), interruptions: Math.round(interruptions) }
}
