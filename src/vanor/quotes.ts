// Dagens citat i Vanor, på engelska. Samma citat hela dagen, nytt vid midnatt.
// Motiverande citat från mentala coacher och före detta militärer (Erik vill ha den stilen).
// Bara citat där personen och källan är kända (bok eller tal inom parentes).
// Inga egna peppande rader och inga vanliga felattribueringar från nätet.

import type { DateKey } from './dates';

export interface Quote {
  text: string;
  /** Vem som sa det, med källa. */
  by: string;
}

export const QUOTES: Quote[] = [
  // David Goggins, f.d. Navy SEAL
  { text: "Who's gonna carry the boats?", by: 'David Goggins, ex-Navy SEAL' },
  {
    text: 'You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.',
    by: "David Goggins (Can't Hurt Me)",
  },
  { text: "When you think you're done, you're only at 40 percent of what you're capable of.", by: 'David Goggins (the 40% rule)' },
  { text: 'Stay hard.', by: 'David Goggins, ex-Navy SEAL' },
  // Jocko Willink, f.d. Navy SEAL
  { text: 'Discipline equals freedom.', by: 'Jocko Willink, ex-Navy SEAL' },
  { text: "Don't count on motivation. Count on discipline.", by: 'Jocko Willink (Discipline Equals Freedom)' },
  { text: 'When things are going bad… just look at the issue and say: “Good.”', by: 'Jocko Willink, ex-Navy SEAL' },
  { text: 'There are no bad teams, only bad leaders.', by: 'Jocko Willink & Leif Babin (Extreme Ownership)' },
  { text: 'Get after it.', by: 'Jocko Willink, ex-Navy SEAL' },
  // William H. McRaven, f.d. amiral, Navy SEAL
  { text: 'If you want to change the world, start off by making your bed.', by: 'Admiral William H. McRaven (Make Your Bed)' },
  {
    text: 'If you make your bed every morning you will have accomplished the first task of the day.',
    by: 'Admiral William H. McRaven (Make Your Bed)',
  },
  { text: 'The only easy day was yesterday.', by: 'U.S. Navy SEALs (motto)' },
  // Coacher och talare
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', by: 'Jim Rohn' },
  { text: 'Discipline is the bridge between goals and accomplishment.', by: 'Jim Rohn' },
  {
    text: "People often say that motivation doesn't last. Well, neither does bathing – that's why we recommend it daily.",
    by: 'Zig Ziglar',
  },
  { text: 'Where focus goes, energy flows.', by: 'Tony Robbins' },
  {
    text: "It's not about the goal. It's about growing to become the person that can accomplish that goal.",
    by: 'Tony Robbins',
  },
  { text: "You're never going to feel like it.", by: 'Mel Robbins (The 5 Second Rule)' },
  { text: "When you want to succeed as bad as you want to breathe, then you'll be successful.", by: 'Eric Thomas' },
];

/** Antal dagar sedan 1970-01-01 för ett datum (UTC, så sommartid inte flyttar något). */
function dayNumber(date: DateKey): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Dagens citat. Går igenom alla citat innan något upprepas, i en blandad ordning
 * (steget 7 är relativt primt med antalet, så varje citat kommer en gång per varv).
 * `offset` bläddrar vidare när man trycker på citatet.
 */
export function dayQuote(date: DateKey, offset = 0, list: Quote[] = QUOTES): Quote {
  const n = list.length;
  const step = stepFor(n);
  const index = (((dayNumber(date) + offset) * step) % n + n) % n;
  return list[index];
}

function stepFor(n: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (let s = 7; s < n + 7; s++) if (gcd(s, n) === 1) return s % n || 1;
  return 1;
}
