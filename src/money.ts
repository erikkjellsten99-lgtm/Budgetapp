/** Visar ett belopp i kronor, t.ex. "1 500 kr" eller "49,90 kr". */
export function formatKr(amount: number): string {
  return amount.toLocaleString('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

/** Tolkar ett inskrivet belopp, t.ex. "1 500" eller "49,90". Tomt blir 0 och ogiltigt blir NaN. */
export function parseKr(text: string): number {
  return Number(text.replace(/\s/g, '').replace(',', '.'));
}
