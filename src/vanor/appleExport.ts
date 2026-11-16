// Apple Hälsas export (export.xml) → en post per dag i Groundworks mått, samma mått som genvägen skickar.
// Används av skriptet scripts/halsa-export.ts på datorn; filen det skriver läses in i appen (healthImport.ts).
// Ren kod utan Node eller webbläsare, så att den går att testa. Sömnen räknas med samma kod som genvägens.

import {
  METRICS,
  parseSleep,
  parseSleepStages,
  type HealthMetric,
  type SleepStage,
} from '../../supabase/functions/inbox/health.ts';

/** En dag i importfilen. */
export interface ImportDay {
  date: string;
  values: Partial<Record<HealthMetric, number>>;
  stages?: SleepStage[];
}

export const HEALTH_FILE_FORMAT = 'groundwork-halsa';

/** Filen som skriptet skriver och appen läser. */
export interface HealthFile {
  format: typeof HEALTH_FILE_FORMAT;
  version: 1;
  /** När Hälsa gjorde exporten, som det står i export.xml. */
  exported?: string;
  days: ImportDay[];
}

const POUND = 0.45359237;
const MILE = 1.609344;

/** Hälsas typer som har ett mått i Groundwork, och hur värdet görs om till måttets enhet. */
const QUANTITIES: Record<string, { metric: HealthMetric; convert?: (value: number, unit: string) => number }> = {
  StepCount: { metric: 'steps' },
  DistanceWalkingRunning: { metric: 'distanceKm', convert: (v, u) => (u === 'mi' ? v * MILE : u === 'm' ? v / 1000 : v) },
  ActiveEnergyBurned: { metric: 'activeKcal', convert: (v, u) => (u === 'kJ' ? v / 4.184 : v) },
  AppleExerciseTime: { metric: 'exerciseMin' },
  FlightsClimbed: { metric: 'flights' },
  RespiratoryRate: { metric: 'respRate' },
  DietaryWater: { metric: 'waterL', convert: (v, u) => (u === 'mL' ? v / 1000 : u === 'fl_oz_us' ? v * 0.0295735 : v) },
  BodyMass: { metric: 'weightKg', convert: (v, u) => (u === 'lb' ? v * POUND : u === 'g' ? v / 1000 : v) },
  RestingHeartRate: { metric: 'restingHr' },
  HeartRateVariabilitySDNN: { metric: 'hrvMs' },
  VO2Max: { metric: 'vo2Max' },
  HeartRateRecoveryOneMinute: { metric: 'hrRecovery' },
  WalkingHeartRateAverage: { metric: 'walkingHr' },
  // Procent står som andel (0,97) i exporten
  OxygenSaturation: { metric: 'spo2', convert: (v) => (v <= 1 ? v * 100 : v) },
  BodyFatPercentage: { metric: 'bodyFat', convert: (v) => (v <= 1 ? v * 100 : v) },
  AppleSleepingWristTemperature: { metric: 'wristTemp', convert: (v, u) => (u === 'degF' ? (v - 32) / 1.8 : v) },
};

/** Sömnvärden i exporten → ordet som health.ts känner igen. */
const SLEEP_WORDS: Record<string, string> = {
  HKCategoryValueSleepAnalysisInBed: 'I säng',
  HKCategoryValueSleepAnalysisAsleep: 'Sover',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'Sover',
  HKCategoryValueSleepAnalysisAsleepCore: 'Kärna',
  HKCategoryValueSleepAnalysisAsleepDeep: 'Djup',
  HKCategoryValueSleepAnalysisAsleepREM: 'REM',
  HKCategoryValueSleepAnalysisAwake: 'Vaken',
};

/** En mätning med start och slut (ms), värde och källans rang (0 = klocka, 1 = telefon, 2 = annat). */
interface Sample {
  s: number;
  e: number;
  v: number;
  rank: number;
}

interface SleepLine {
  word: string;
  text: string;
  mins: number;
}

const ATTR = /([A-Za-z]+)="([^"]*)"/g;
const STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/;
const HOUR = 3600000;

/** "2025-11-10 23:41:12 +0100" → datum och klocka som de står (lokal tid), tid i ms och ISO-text. */
function readStamp(text: string | undefined) {
  const m = text ? STAMP.exec(text) : null;
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}:${m[8]}`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  // Väggklockan som ett UTC-tal, för att kunna räkna fram "natten till"-datumet utan tidszoner
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return { date: `${m[1]}-${m[2]}-${m[3]}`, ms, iso, wall };
}

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;

/**
 * Lägger ihop mätningar utan att räkna samma sak två gånger: klockan går före telefonen, som går före andra
 * appar. En mätning från en lägre källa hoppas över när den överlappar en från en högre. Ungefär som Hälsa gör
 * (Hälsa delar upp överlappande mätningar exakt, så summan kan skilja någon procent).
 */
export function sumWithoutOverlap(samples: Sample[]): number {
  const ranks = [...new Set(samples.map((x) => x.rank))].sort((a, b) => a - b);
  if (ranks.length === 1) return samples.reduce((a, x) => a + x.v, 0);
  let covered: [number, number][] = [];
  let total = 0;
  for (const rank of ranks) {
    const kept = samples.filter((x) => x.rank === rank && !covered.some(([s, e]) => x.s < e && Math.max(x.e, x.s + 1) > s));
    for (const x of kept) total += x.v;
    covered = mergeIntervals([...covered, ...kept.map((x): [number, number] => [x.s, Math.max(x.e, x.s + 1)])]);
  }
  return total;
}

function mergeIntervals(list: [number, number][]): [number, number][] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Läser export.xml rad för rad (filen är hundratals MB) och ger en post per dag. */
export class AppleExportReader {
  /** När exporten gjordes. */
  exported: string | undefined;
  /** Typer i exporten som inte har något mått i Groundwork, med antal mätningar. */
  readonly skipped = new Map<string, number>();
  /** Antal mätningar som lästes in, per typ. */
  readonly read = new Map<string, number>();

  private readonly sums = new Map<string, Sample[]>();
  private readonly latest = new Map<string, { ms: number; v: number }>();
  private readonly avgs = new Map<string, { total: number; n: number }>();
  private readonly counts = new Map<string, number>();
  private readonly sleep = new Map<string, Map<string, SleepLine[]>>();

  line(raw: string): void {
    const line = raw.trimStart();
    if (line.startsWith('<Record ')) this.record(line);
    else if (line.startsWith('<Workout ')) this.workout(line);
    else if (line.startsWith('<ExportDate ')) this.exported = /value="([^"]*)"/.exec(line)?.[1];
  }

  private attrs(line: string): Record<string, string> {
    const end = line.indexOf('>');
    const out: Record<string, string> = {};
    for (const m of line.slice(0, end < 0 ? undefined : end).matchAll(ATTR)) out[m[1]] = m[2];
    return out;
  }

  private note(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private record(line: string) {
    const full = /type="([^"]*)"/.exec(line)?.[1] ?? '';
    const type = full.replace(/^HK(?:Quantity|Category|Data)TypeIdentifier/, '').replace(/^HKDataType/, '');
    const quantity = QUANTITIES[type] ?? (/SleepScore/i.test(type) ? { metric: 'sleepScore' as const } : undefined);
    const known = quantity || type === 'SleepAnalysis' || type === 'AppleStandHour' || type === 'MindfulSession';
    if (!known) return this.note(this.skipped, type);

    const a = this.attrs(line);
    const start = readStamp(a.startDate);
    const end = readStamp(a.endDate) ?? start;
    if (!start || !end) return;
    this.note(this.read, type);

    if (type === 'SleepAnalysis') {
      const word = SLEEP_WORDS[a.value];
      const mins = (end.ms - start.ms) / 60000;
      if (!word || mins <= 0 || mins > 24 * 60) return;
      // Natten hör till dagen du vaknar: allt som börjar efter 15:00 räknas till nästa dag (samma gräns som health.ts)
      const night = new Date(start.wall + 9 * HOUR).toISOString().slice(0, 10);
      const sources = this.sleep.get(night) ?? new Map<string, SleepLine[]>();
      this.sleep.set(night, sources);
      const source = a.sourceName ?? '';
      const lines = sources.get(source) ?? [];
      sources.set(source, lines);
      lines.push({ word, mins, text: `${word} | ${start.iso} | ${end.iso}` });
      return;
    }
    if (type === 'AppleStandHour') {
      if (a.value === 'HKCategoryValueAppleStandHourStood') this.note(this.counts, `standHours|${start.date}`);
      return;
    }
    if (type === 'MindfulSession') {
      this.addSum('mindfulMin', start.date, { s: start.ms, e: end.ms, v: (end.ms - start.ms) / 60000, rank: this.rank(a) });
      return;
    }

    const number = Number(a.value);
    if (!quantity || !Number.isFinite(number) || number < 0) return;
    const value = quantity.convert ? quantity.convert(number, a.unit ?? '') : number;
    const metric = quantity.metric;
    const key = `${metric}|${start.date}`;
    const kind = METRICS[metric].kind;
    if (kind === 'sum') this.addSum(metric, start.date, { s: start.ms, e: end.ms, v: value, rank: this.rank(a) });
    else if (kind === 'avg') {
      const avg = this.avgs.get(key) ?? { total: 0, n: 0 };
      avg.total += value;
      avg.n += 1;
      this.avgs.set(key, avg);
    } else {
      const old = this.latest.get(key);
      if (!old || start.ms >= old.ms) this.latest.set(key, { ms: start.ms, v: value });
    }
  }

  private workout(line: string) {
    const start = readStamp(this.attrs(line).startDate);
    if (!start) return;
    this.note(this.read, 'Workout');
    this.note(this.counts, `workouts|${start.date}`);
  }

  private rank(a: Record<string, string>): number {
    const from = `${a.sourceName ?? ''} ${a.device ?? ''}`;
    return /watch/i.test(from) ? 0 : /iphone/i.test(from) ? 1 : 2;
  }

  private addSum(metric: HealthMetric, date: string, sample: Sample) {
    const key = `${metric}|${date}`;
    const list = this.sums.get(key);
    if (list) list.push(sample);
    else this.sums.set(key, [sample]);
  }

  /** Alla dagar med minst ett värde, i datumordning. */
  days(): ImportDay[] {
    const byDate = new Map<string, ImportDay>();
    const day = (date: string) => {
      let d = byDate.get(date);
      if (!d) byDate.set(date, (d = { date, values: {} }));
      return d;
    };
    const set = (key: string, value: number) => {
      const [metric, date] = key.split('|') as [HealthMetric, string];
      if (Number.isFinite(value) && value >= 0) day(date).values[metric] = round(value, METRICS[metric].decimals + 1);
    };
    for (const [key, samples] of this.sums) set(key, sumWithoutOverlap(samples));
    for (const [key, avg] of this.avgs) set(key, avg.total / avg.n);
    for (const [key, last] of this.latest) set(key, last.v);
    for (const [key, n] of this.counts) set(key, n);

    for (const [night, sources] of this.sleep) {
      const lines = pickSleepLines(sources);
      const values = parseSleep(lines);
      if (!values || !Object.keys(values).length) continue;
      const d = day(night);
      Object.assign(d.values, values);
      const stages = parseSleepStages(lines);
      if (stages.length) d.stages = stages;
    }
    return [...byDate.values()].filter((d) => Object.keys(d.values).length).sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * En natt kan finnas från flera källor (klockan, telefonen, en sömnapp). För att inte räkna sömnen dubbelt
 * väljs en källa för sömnen (den med faser, annars den med mest sömn) och en för "I säng" (den med mest tid).
 */
function pickSleepLines(sources: Map<string, SleepLine[]>): string[] {
  const mins = (lines: SleepLine[], words: string[]) => lines.filter((l) => words.includes(l.word)).reduce((a, l) => a + l.mins, 0);
  const best = (words: string[]) => {
    let top: SleepLine[] | null = null;
    let most = 0;
    for (const lines of sources.values()) {
      const m = mins(lines, words);
      if (m > most) [top, most] = [lines, m];
    }
    return top;
  };
  const asleep = best(['Kärna', 'Djup', 'REM']) ?? best(['Sover']);
  const bed = best(['I säng']);
  return [
    ...(asleep ?? []).filter((l) => l.word !== 'I säng').map((l) => l.text),
    ...(bed ?? []).filter((l) => l.word === 'I säng').map((l) => l.text),
  ];
}
