// Datamodellen för Challenges. Fälten heter som kolumnerna i Supabase (se migrationen `challenges`),
// så att raderna kan skickas upp och hämtas hem utan översättning.

import type { DateKey } from '../vanor/dates';

export type ChallengeStatus = 'active' | 'completed' | 'failed' | 'paused';
export type TaskType = 'check' | 'counter' | 'photo' | 'workout' | 'reading';
export type OnFail = 'restart_week' | 'restart_challenge';
export type WorkoutFlag = 'outdoor' | 'morning_run';

/** En pushnotis vid ett klockslag varje dag medan utmaningen är aktiv. */
export interface ChallengeReminder {
  time: string; // "19:45"
  title: string;
  body?: string;
}

/** Dagar som inte räknas: en vecka som börjat om, eller en paus. */
export interface VoidRange {
  from: DateKey;
  to: DateKey;
  reason: 'restart_week' | 'paused';
}

/** Det senaste som reglerna gjorde, visas tills man tryckt Okej. */
export interface Notice {
  type: 'restart_challenge' | 'restart_week' | 'completed';
  /** Dagen som missades (eller sista dagen, när utmaningen är klar). */
  date: DateKey;
  /** Det som inte var klart den dagen. */
  missing: string[];
  /** Försöket som tog slut. */
  attempt: number;
  days_completed: number;
}

export interface ChallengeSettings {
  diet_plan?: string;
  wake_time?: string;
  bedtime?: string;
  reminders?: ChallengeReminder[];
  voided?: VoidRange[];
  paused_from?: DateKey;
  notice?: Notice | null;
}

export interface ChallengeRules {
  max_misses_per_week: number;
  on_fail: OnFail;
  /** Krav på dagens pass tillsammans: minst ett utomhus, minst ett som morgonlöpning. */
  workout_requires?: WorkoutFlag[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  length_days: number;
  start_date: DateKey;
  status: ChallengeStatus;
  attempt_number: number;
  best_streak: number;
  settings: ChallengeSettings;
  rules: ChallengeRules;
  created_at: string;
  deleted?: boolean;
}

export interface ChallengeTask {
  id: string;
  challenge_id: string;
  title: string;
  subtitle: string;
  type: TaskType;
  target: number | null;
  sort_order: number;
}

export interface CheckinData {
  /** Passtyp: Löpning, Gym, Promenad, Rörlighet, Annat. */
  kind?: string;
  outdoor?: boolean;
  morning_run?: boolean;
  note?: string;
  book?: string;
  pages?: number;
  /** Bildens sökväg i bucketen challenge-photos, utan användarens mapp. */
  photo?: string;
}

export interface Checkin {
  /** Lokalt: `${task_id}|${date}` (en rad per uppgift och dag). */
  id: string;
  challenge_id: string;
  task_id: string;
  date: DateKey;
  done: boolean;
  value: number | null;
  data: CheckinData;
}

export interface Attempt {
  /** Lokalt: `${challenge_id}|${attempt_number}`. */
  id: string;
  challenge_id: string;
  attempt_number: number;
  started_at: DateKey;
  ended_at: DateKey;
  days_completed: number;
}

export interface ChallengeData {
  challenges: Challenge[];
  tasks: ChallengeTask[];
  checkins: Checkin[];
  attempts: Attempt[];
}

export const WORKOUT_KINDS = ['Löpning', 'Gym', 'Promenad', 'Rörlighet', 'Annat'] as const;

export const checkinId = (taskId: string, date: DateKey) => `${taskId}|${date}`;
export const attemptId = (challengeId: string, attempt: number) => `${challengeId}|${attempt}`;
