// Dagens citat i Vanor, på engelska. Samma citat hela dagen, nytt vid midnatt.
// Bara riktiga citat där källan är känd (verk och kapitel inom parentes), i vanliga engelska översättningar.
// Inga egna peppande rader och inga vanliga felattribueringar (t.ex. "We first make our habits…").

import type { DateKey } from './dates';

export interface Quote {
  text: string;
  /** Vem som sa det, med källa. */
  by: string;
}

export const QUOTES: Quote[] = [
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', by: 'Will Durant, on Aristotle' },
  { text: 'We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.', by: 'Aristotle (Nicomachean Ethics II.1)' },
  { text: 'One swallow does not make a summer, nor does one day.', by: 'Aristotle (Nicomachean Ethics I.7)' },
  { text: 'Every habit and faculty is maintained and increased by the corresponding actions.', by: 'Epictetus (Discourses 2.18)' },
  { text: 'If you wish to be a writer, write.', by: 'Epictetus (Discourses 2.18)' },
  { text: 'No great thing is created suddenly.', by: 'Epictetus (Discourses 1.15)' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', by: 'Epictetus (Discourses 3.23)' },
  { text: 'Men are disturbed not by things, but by the views which they take of things.', by: 'Epictetus (Enchiridion 5)' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', by: 'Marcus Aurelius (Meditations 5.20)' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', by: 'Marcus Aurelius (Meditations 10.16)' },
  { text: 'Such as are your habitual thoughts, such also will be the character of your mind.', by: 'Marcus Aurelius (Meditations 5.16)' },
  { text: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', by: 'Marcus Aurelius (Meditations 7.67)' },
  { text: 'We suffer more often in imagination than in reality.', by: 'Seneca (Letters 13)' },
  { text: 'While we are postponing, life speeds by.', by: 'Seneca (Letters 1)' },
  { text: 'If a man knows not to which port he sails, no wind is favorable.', by: 'Seneca (Letters 71)' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', by: 'Seneca (On the Shortness of Life)' },
  { text: 'It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.', by: 'Seneca (Letters 104)' },
  { text: 'As long as you live, keep learning how to live.', by: 'Seneca (Letters 76)' },
  { text: 'Habit creates, as it were, a second nature.', by: 'Cicero (De Finibus V.74)' },
  { text: 'Dripping water hollows out stone.', by: 'Ovid (Epistulae ex Ponto IV.10)' },
  { text: 'A journey of a thousand miles begins with a single step.', by: 'Laozi (Tao Te Ching 64)' },
  { text: 'Deal with the difficult while it is still easy.', by: 'Laozi (Tao Te Ching 63)' },
  { text: 'Mastering others is strength. Mastering yourself is true power.', by: 'Laozi (Tao Te Ching 33)' },
  { text: 'No man ever steps in the same river twice.', by: 'Heraclitus' },
  { text: 'An ounce of prevention is worth a pound of cure.', by: 'Benjamin Franklin' },
  { text: 'Never suffer an exception to occur till the new habit is securely rooted in your life.', by: 'William James (The Principles of Psychology)' },
  { text: 'Seize the very first possible opportunity to act on every resolution you make.', by: 'William James (The Principles of Psychology)' },
  {
    text: 'I know of no more encouraging fact than the unquestionable ability of man to elevate his life by a conscious endeavor.',
    by: 'Henry David Thoreau (Walden)',
  },
  { text: 'How we spend our days is, of course, how we spend our lives.', by: 'Annie Dillard (The Writing Life)' },
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
