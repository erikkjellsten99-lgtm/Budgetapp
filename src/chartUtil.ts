import { formatKr } from './money';

// Små hjälpfunktioner för visning i Investeringar och innehavets kursgraf.

/** "2026-11-05" som "5 nov". */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

/** Belopp med plustecken för vinst, t.ex. "+199,39 kr". */
export function signedKr(amount: number): string {
  return amount > 0 ? `+${formatKr(amount)}` : formatKr(amount);
}

/** "250 000" som "250 tkr", "1 500 000" som "1,5 mkr". */
export function axisLabel(v: number): string {
  if (v === 0) return '0';
  if (v >= 1000000) return `${String(Math.round(v / 100000) / 10).replace('.', ',')} mkr`;
  if (v >= 1000) return `${Math.round(v / 1000)} tkr`;
  return String(Math.round(v));
}

/** Steg för y-axeln (1, 2 eller 5 gånger en tiopotens) så att det blir högst fyra rutor. */
export function niceStep(max: number): number {
  const base = 10 ** Math.floor(Math.log10(Math.max(max, 1) / 4));
  return [1, 2, 5, 10].map((m) => m * base).find((s) => max / s <= 4) ?? base * 10;
}
