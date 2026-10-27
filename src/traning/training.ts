// Träning: datamodell och logik som rena funktioner (testas i training.test.ts).
// Datum är text 'ÅÅÅÅ-MM-DD' precis som i vanorna (se ../vanor/dates.ts).

import { addDays, weekStart, type DateKey } from '../vanor/dates';

export interface WorkSet {
  kg: number;
  reps: number;
}

export interface Exercise {
  name: string;
  sets: WorkSet[];
}

export type WorkoutKind = 'gym' | 'run';

export interface Workout {
  id: string;
  date: DateKey;
  kind: WorkoutKind;
  /** Gympass: övningarna i den ordning de gjordes. */
  exercises?: Exercise[];
  /** Löppass: distans i km och tid i sekunder. */
  km?: number;
  seconds?: number;
  note?: string;
  /** När passet sparades första gången (ms), för ordning inom samma dag. */
  created: number;
}

/** Övningar som föreslås innan du har egna. */
export const DEFAULT_EXERCISES = [
  'Knäböj',
  'Bänkpress',
  'Marklyft',
  'Militärpress',
  'Skivstångsrodd',
  'Chins',
  'Latsdrag',
  'Sittande rodd',
  'Benpress',
  'Höftlyft',
  'Utfall',
  'Rumänsk marklyft',
  'Lårcurl',
  'Dips',
  'Bicepscurl',
  'Triceps pushdown',
  'Sidolyft',
  'Vadpress',
];

/** Standardmålet för 5 km: under 25 minuter. */
export const DEFAULT_5K_GOAL = 25 * 60;

// Tal och tider

/** "62,5" eller "62.5" → 62.5. Tomt eller ogiltigt → null. */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 62.5 → "62,5", 60 → "60". */
export function formatNumber(n: number, decimals = 2): string {
  return String(Math.round(n * 10 ** decimals) / 10 ** decimals).replace('.', ',');
}

/**
 * Tid som text → sekunder. "24:30" = 24 min 30 s, "1:02:10" = 1 h 2 min 10 s,
 * "25" = 25 minuter. Ogiltigt eller 0 → null.
 */
export function parseDuration(text: string): number | null {
  const clean = text.trim().replace(/[.,]/g, ':').replace(/\s/g, '');
  if (!/^\d+(:\d{1,2}){0,2}$/.test(clean)) return null;
  const parts = clean.split(':').map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  const seconds =
    parts.length === 1
      ? parts[0] * 60
      : parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
  return seconds > 0 ? seconds : null;
}

/** 1470 → "24:30", 3730 → "1:02:10". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Tempo i sekunder per km. */
export const pace = (km: number, seconds: number) => seconds / km;

/** "4:54 /km". */
export const formatPace = (km: number, seconds: number) => `${formatDuration(pace(km, seconds))} /km`;

// Löpning

/**
 * 5 km-tid för ett löppass: den riktiga tiden om passet var 5 km, annars räknad på
 * tempot om passet var längre. Kortare pass räknas inte (det är lättare att hålla tempo på kort sträcka).
 */
export function fiveKTime(w: Workout): number | null {
  if (w.kind !== 'run' || !w.km || !w.seconds || w.km < 5) return null;
  return Math.round((w.seconds / w.km) * 5);
}

/** Snabbaste 5 km-tiden, och när. */
export function best5k(workouts: Workout[]): { seconds: number; date: DateKey } | null {
  let best: { seconds: number; date: DateKey } | null = null;
  for (const w of workouts) {
    const t = fiveKTime(w);
    if (t !== null && (!best || t < best.seconds)) best = { seconds: t, date: w.date };
  }
  return best;
}

/** 5 km-tiderna i datumordning, för grafen. */
export function fiveKHistory(workouts: Workout[]): { date: DateKey; seconds: number }[] {
  return sortByDate(workouts)
    .map((w) => ({ date: w.date, seconds: fiveKTime(w) }))
    .filter((p): p is { date: DateKey; seconds: number } => p.seconds !== null);
}

// Gym

/** Tyngsta setet (vid lika vikt: flest reps). */
export function topSet(sets: WorkSet[]): WorkSet | null {
  let top: WorkSet | null = null;
  for (const s of sets) {
    if (s.reps <= 0) continue;
    if (!top || s.kg > top.kg || (s.kg === top.kg && s.reps > top.reps)) top = s;
  }
  return top;
}

/** Total volym: kg × reps för alla set. */
export const volume = (sets: WorkSet[]) => sets.reduce((sum, s) => sum + s.kg * s.reps, 0);

export const sameExercise = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('sv') === b.trim().toLocaleLowerCase('sv');

/** Äldst först; samma dag i den ordning passen sparades. */
export function sortByDate(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
}

/** Nyast först. */
export const newestFirst = (workouts: Workout[]) => sortByDate(workouts).reverse();

/**
 * Seten från senaste gången övningen gjordes, före passet `exceptId` (när ett pass ändras).
 * Används för att fylla i vikterna automatiskt.
 */
export function lastSets(workouts: Workout[], name: string, exceptId?: string): WorkSet[] | null {
  for (const w of newestFirst(workouts)) {
    if (w.id === exceptId || w.kind !== 'gym') continue;
    const ex = w.exercises?.find((e) => sameExercise(e.name, name));
    if (ex && ex.sets.length) return ex.sets;
  }
  return null;
}

/** Övningarnas namn, senast gjorda först, sedan standardlistan. Utan dubbletter. */
export function exerciseNames(workouts: Workout[]): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (name.trim() && !names.some((n) => sameExercise(n, name))) names.push(name.trim());
  };
  for (const w of newestFirst(workouts)) for (const e of w.exercises ?? []) add(e.name);
  DEFAULT_EXERCISES.forEach(add);
  return names;
}

export interface ExercisePoint {
  date: DateKey;
  top: WorkSet;
}

/** Tyngsta setet per pass för en övning, äldst först. */
export function exerciseHistory(workouts: Workout[], name: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const w of sortByDate(workouts)) {
    if (w.kind !== 'gym') continue;
    for (const e of w.exercises ?? []) {
      if (!sameExercise(e.name, name)) continue;
      const top = topSet(e.sets);
      if (top) points.push({ date: w.date, top });
    }
  }
  return points;
}

export interface ExerciseSummary {
  name: string;
  /** Senaste passets tyngsta set. */
  latest: ExercisePoint;
  /** Tyngsta vikten någonsin. */
  bestKg: number;
  /** Ändring i kg från första gången till senaste. */
  change: number;
  first: ExercisePoint;
  points: ExercisePoint[];
}

/** En rad per övning, senast gjorda först. */
export function exerciseSummaries(workouts: Workout[]): ExerciseSummary[] {
  const used = new Set<string>();
  const out: ExerciseSummary[] = [];
  for (const w of newestFirst(workouts)) {
    for (const e of w.exercises ?? []) {
      const key = e.name.trim().toLocaleLowerCase('sv');
      if (used.has(key)) continue;
      used.add(key);
      const points = exerciseHistory(workouts, e.name);
      if (!points.length) continue;
      const first = points[0];
      const latest = points[points.length - 1];
      out.push({
        name: e.name.trim(),
        latest,
        first,
        bestKg: Math.max(...points.map((p) => p.top.kg)),
        change: latest.top.kg - first.top.kg,
        points,
      });
    }
  }
  return out;
}

/**
 * Övningar där passet slog rekord: tyngre vikt än i alla tidigare pass (minst ett tidigare).
 * Samma vikt med fler reps räknas också.
 */
export function records(workout: Workout, workouts: Workout[]): string[] {
  if (workout.kind !== 'gym') return [];
  const earlier = workouts.filter(
    (w) => w.id !== workout.id && (w.date < workout.date || (w.date === workout.date && w.created < workout.created)),
  );
  const out: string[] = [];
  for (const e of workout.exercises ?? []) {
    const top = topSet(e.sets);
    if (!top) continue;
    const before = earlier.flatMap((w) => w.exercises ?? []).filter((x) => sameExercise(x.name, e.name));
    const prev = topSet(before.flatMap((x) => x.sets));
    if (prev && (top.kg > prev.kg || (top.kg === prev.kg && top.reps > prev.reps))) out.push(e.name);
  }
  return out;
}

// Veckan

export interface WeekStats {
  gym: number;
  runs: number;
  km: number;
}

export function weekStats(workouts: Workout[], today: DateKey): WeekStats {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const week = workouts.filter((w) => w.date >= monday && w.date <= sunday);
  const gymDays = new Set(week.filter((w) => w.kind === 'gym').map((w) => w.date));
  return {
    gym: gymDays.size,
    runs: week.filter((w) => w.kind === 'run').length,
    km: week.reduce((sum, w) => sum + (w.kind === 'run' ? (w.km ?? 0) : 0), 0),
  };
}

// Sparande

/** Städar ett pass innan det sparas: tar bort tomma set och övningar utan namn eller set. */
export function cleanWorkout(w: Workout): Workout {
  if (w.kind === 'run') {
    const { exercises: _drop, ...rest } = w;
    return { ...rest, note: w.note?.trim() || undefined };
  }
  const exercises = (w.exercises ?? [])
    .map((e) => ({
      name: e.name.trim().replace(/\s+/g, ' ').slice(0, 40),
      sets: e.sets.filter((s) => s.reps > 0).map((s) => ({ kg: Math.max(0, s.kg), reps: Math.round(s.reps) })),
    }))
    .filter((e) => e.name && e.sets.length);
  const { km: _km, seconds: _s, ...rest } = w;
  return { ...rest, exercises, note: w.note?.trim() || undefined };
}

/** Kort text om ett pass för listan. */
export function workoutSummary(w: Workout): string {
  if (w.kind === 'run') {
    if (!w.km || !w.seconds) return 'Löpning';
    return `${formatNumber(w.km)} km · ${formatDuration(w.seconds)} · ${formatPace(w.km, w.seconds)}`;
  }
  const ex = w.exercises ?? [];
  const sets = ex.reduce((n, e) => n + e.sets.length, 0);
  return `${ex.map((e) => e.name).join(', ')} · ${sets} set`;
}
