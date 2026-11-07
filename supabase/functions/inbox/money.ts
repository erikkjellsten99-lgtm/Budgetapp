/** Visar ett belopp i kronor, t.ex. "1 500 kr" eller "49,90 kr". */
export function formatKr(amount: number): string {
  return amount.toLocaleString('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

/** Förändring som procent med tecken, t.ex. "+4,2 %" eller "−1,3 %" (riktigt minustecken). Ett tal som avrundas till 0,0 får inget tecken. */
export function formatPct(fraction: number): string {
  const text = Math.abs(fraction * 100).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sign = text === '0,0' ? '' : fraction < 0 ? '\u2212' : '+';
  return `${sign}${text}\u00a0%`;
}

/** Belopp som text i ett inmatningsfält, t.ex. "49,9". Tomt för 0 så att du kan skriva direkt. */
export function toInputKr(amount: number | undefined): string {
  return amount ? String(amount).replace('.', ',') : '';
}

/** Tolkar ett inskrivet belopp, t.ex. "1 500" eller "49,90". Tomt blir 0 och ogiltigt blir NaN. */
export function parseKr(text: string): number {
  return Number(text.replace(/\s/g, '').replace(',', '.'));
}
