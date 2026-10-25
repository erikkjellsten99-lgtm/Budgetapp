interface Template {
  name: string;
  goal: number;
  /** Namn på vanorna den här görs efter. */
  after?: string[];
  /** Minsta godkända version. */
  minimum?: string;
}

/** Startpaket som kan läggas in med ett tryck när listan är tom. */
export const START_HABITS: Template[] = [
  { name: 'Gym', goal: 4, minimum: '20 min' },
  { name: 'Löpning', goal: 2, minimum: '10 min' },
  { name: 'Stretching', goal: 4, after: ['Gym'], minimum: '5 min' },
  { name: 'Meditation', goal: 3, minimum: '2 min' },
  { name: 'I säng före 23', goal: 7 },
  { name: 'Bygga på mina projekt', goal: 7, minimum: '15 min' },
];

/** Förslag som kan läggas till med ett tryck. */
export const SUGGESTIONS: Template[] = [
  { name: 'Proteinmål', goal: 7 },
  { name: 'Skärmfri sista timmen', goal: 7 },
  { name: 'Franska 15 min', goal: 5, minimum: '5 min' },
  { name: 'Promenad med Diesel', goal: 7, minimum: 'Runt kvarteret' },
  { name: 'Läsa 20 min', goal: 5, minimum: 'En sida' },
  { name: 'Studier', goal: 5, minimum: '15 min' },
  { name: 'Knärehab', goal: 3, minimum: 'En övning' },
];
