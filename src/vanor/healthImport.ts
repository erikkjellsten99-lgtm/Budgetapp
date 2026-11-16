// Importfil med hälsodata (groundwork-halsa.json, gjord av scripts/halsa-export.ts ur Apple Hälsas export).
// Här läses filen och slås ihop med det som redan finns. Det som redan finns i Groundwork ändras aldrig:
// filen fyller bara i dagar och mått som saknas.

import { METRIC_KEYS, METRICS, type HealthDay, type HealthMetric, type SleepStage } from '../../supabase/functions/inbox/health.ts';
import { HEALTH_FILE_FORMAT, type ImportDay } from './appleExport.ts';

const STAGE_KINDS = ['awake', 'rem', 'core', 'deep', 'asleep'];
const isRealDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Läser en importfil. Kastar ett fel med en förklaring om filen inte går att läsa. */
export function parseHealthFile(text: string): ImportDay[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Filen går inte att läsa. Välj filen groundwork-halsa.json.');
  }
  const file = raw as { format?: unknown; days?: unknown } | null;
  if (!file || file.format !== HEALTH_FILE_FORMAT || !Array.isArray(file.days)) {
    throw new Error('Det här är ingen hälsofil för Groundwork. Välj filen groundwork-halsa.json.');
  }
  const byDate = new Map<string, ImportDay>();
  for (const d of file.days as { date?: unknown; values?: unknown; stages?: unknown }[]) {
    if (!d || !isRealDate(d.date) || !d.values || typeof d.values !== 'object') continue;
    const values: Partial<Record<HealthMetric, number>> = {};
    for (const metric of METRIC_KEYS) {
      const v = (d.values as Record<string, unknown>)[metric];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) values[metric] = v;
    }
    if (!Object.keys(values).length) continue;
    const day: ImportDay = { date: d.date, values };
    const stages = (Array.isArray(d.stages) ? d.stages : []).filter(
      (s): s is SleepStage => !!s && STAGE_KINDS.includes(s.k) && Number.isFinite(s.s) && Number.isFinite(s.e) && s.e > s.s,
    );
    if (stages.length) day.stages = stages.map((s) => ({ k: s.k, s: s.s, e: s.e }));
    byDate.set(day.date, day);
  }
  if (!byDate.size) throw new Error('Filen innehåller inga dagar med hälsodata.');
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface HealthMerge {
  /** Dagarna som ska sparas (nya och kompletterade). */
  puts: HealthDay[];
  newDays: number;
  filledDays: number;
  /** Antal värden som lades till. */
  values: number;
}

/**
 * Slår ihop filen med det som finns. Värden som redan finns en dag vinner alltid. Har dagen redan sömn
 * (från genvägen) lämnas hela sömnen orörd, så att faser och total alltid kommer från samma källa.
 */
export function mergeHealthImport(existing: HealthDay[], days: ImportDay[], now: number): HealthMerge {
  const old = new Map(existing.map((d) => [d.date, d]));
  const out: HealthMerge = { puts: [], newDays: 0, filledDays: 0, values: 0 };
  for (const day of days) {
    const before = old.get(day.date);
    const hasSleep = before?.values.sleepH !== undefined;
    const added: Partial<Record<HealthMetric, number>> = {};
    for (const metric of METRIC_KEYS) {
      const v = day.values[metric];
      if (v === undefined || before?.values[metric] !== undefined) continue;
      if (hasSleep && METRICS[metric].derived) continue;
      added[metric] = v;
    }
    const count = Object.keys(added).length;
    if (!count) continue;
    const next: HealthDay = { date: day.date, updated: now, values: { ...added, ...before?.values } };
    const stages = before?.stages?.length ? before.stages : hasSleep ? undefined : day.stages;
    if (stages?.length) next.stages = stages;
    out.puts.push(next);
    out.values += count;
    if (before) out.filledDays += 1;
    else out.newDays += 1;
  }
  return out;
}

export interface MetricSummary {
  metric: HealthMetric;
  /** Antal dagar med ett värde. */
  days: number;
  /** Summan över alla dagar (för mått som läggs ihop) eller snittet per dag (övriga). */
  total: number;
  kind: 'sum' | 'mean';
  first: string;
  last: string;
}

/** Antal dagar och summa eller snitt per mått, för att kunna jämföra filen med det som finns i Groundwork. */
export function summarizeHealth(days: { date: string; values: Partial<Record<HealthMetric, number>> }[]): MetricSummary[] {
  const out: MetricSummary[] = [];
  for (const metric of METRIC_KEYS) {
    const have = days.filter((d) => d.values[metric] !== undefined).sort((a, b) => a.date.localeCompare(b.date));
    if (!have.length) continue;
    const sum = have.reduce((a, d) => a + d.values[metric]!, 0);
    const info = METRICS[metric];
    const kind = info.kind === 'sum' && !info.clock ? 'sum' : 'mean';
    const total = kind === 'sum' ? sum : sum / have.length;
    out.push({ metric, days: have.length, total: Math.round(total * 100) / 100, kind, first: have[0].date, last: have[have.length - 1].date });
  }
  return out;
}
