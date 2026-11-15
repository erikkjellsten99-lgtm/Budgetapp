// Mallar för "Starta från mall". En mall är bara förifyllda värden i samma formulär som en egen utmaning,
// så en ny mall är ett nytt objekt här och inget annat.

import type { ChallengeRules, ChallengeSettings, TaskType } from './types';

export interface TemplateTask {
  title: string;
  subtitle: string;
  type: TaskType;
  target: number | null;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  length_days: number;
  tasks: TemplateTask[];
  rules: ChallengeRules;
  settings: ChallengeSettings;
  /** Visa fältet för kostplan när utmaningen skapas. */
  asksDietPlan?: boolean;
}

const check = (title: string, subtitle = ''): TemplateTask => ({ title, subtitle, type: 'check', target: null });

export const TEMPLATES: Template[] = [
  {
    id: '75-hard',
    title: '75 Hard',
    description: '75 dagar i rad. Missar du en dag börjar du om från dag 1.',
    length_days: 75,
    tasks: [
      check('Uppe 05:00'),
      { title: 'Lätt pass (45 min)', subtitle: 'T.ex. promenad, lugn jogg, rörlighet, yoga. Puls låg, ska kännas återhämtande.', type: 'workout', target: null },
      { title: 'Tufft pass (45 min)', subtitle: 'T.ex. gym, intervaller, tempolöpning.', type: 'workout', target: null },
      check('Följ kostplanen – inga fuskmåltider'),
      check('Ingen alkohol'),
      { title: 'Drick 3,8 l vatten', subtitle: '', type: 'counter', target: 3.8 },
      { title: 'Läs 10 sidor facklitteratur', subtitle: '', type: 'reading', target: 10 },
      { title: 'Progressbild', subtitle: '', type: 'photo', target: null },
      check('Skärmstopp 19:45'),
      check('I säng 20:30'),
    ],
    rules: { max_misses_per_week: 0, on_fail: 'restart_challenge', workout_requires: ['outdoor', 'morning_run'] },
    settings: {
      wake_time: '05:00',
      bedtime: '20:30',
      reminders: [
        { time: '19:45', title: 'Skärmstopp', body: 'Läggdags 20:30.' },
        { time: '20:30', title: 'I säng nu', body: 'Uppe 05:00 i morgon.' },
      ],
    },
    asksDietPlan: true,
  },
];
