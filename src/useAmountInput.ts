import { useEffect, useRef, useState } from 'react';
import { parseKr, toInputKr } from './money';

/**
 * Vad som ska sparas när du lämnar ett beloppsfält. Svarar med beloppet, eller null när inget
 * ska sparas: fältet är tomt eller ogiltigt (då kommer det gamla beloppet tillbaka), eller
 * beloppet är detsamma som förut. Vill du ha 0 kr skriver du 0.
 */
export function amountToSave(text: string, saved: number, max?: number): number | null {
  if (text.trim() === '') return null;
  const amount = parseKr(text);
  if (!Number.isFinite(amount) || amount < 0 || (max !== undefined && amount > max)) return null;
  return amount === saved ? null : amount;
}

/** Ogiltig text, för att markera fältet medan du skriver. Tomt räknas inte som fel. */
export function isInvalidAmount(text: string, max?: number): boolean {
  if (text.trim() === '') return false;
  const amount = parseKr(text);
  return !Number.isFinite(amount) || amount < 0 || (max !== undefined && amount > max);
}

/**
 * Ett beloppsfält som sparas först när du lämnar det (eller trycker Enter, eller lägger appen i
 * bakgrunden), inte för varje siffra. Då synkas inga halva belopp till den andra telefonen,
 * och ett tömt fält blir aldrig 0 kr av misstag.
 */
export function useAmountInput(saved: number, onSave: (amount: number) => void, max?: number) {
  const [text, setText] = useState(toInputKr(saved));
  const focused = useRef(false);

  // Nytt belopp från den andra telefonen visas, men inte mitt i att du skriver.
  useEffect(() => {
    if (!focused.current) setText(toInputKr(saved));
  }, [saved]);

  // Senaste versionen, så att bakgrundslyssnaren nedan alltid sparar det du skrivit nu.
  const commit = useRef(() => {});
  commit.current = () => {
    const amount = amountToSave(text, saved, max);
    if (amount === null) setText(toInputKr(saved));
    else onSave(amount);
  };

  // iPhone pausar appen i bakgrunden utan att fältet tappar fokus. Spara då också.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && focused.current && commit.current();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  return {
    invalid: isInvalidAmount(text, max),
    props: {
      value: text,
      inputMode: 'decimal' as const,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value),
      onFocus: () => {
        focused.current = true;
      },
      onBlur: () => {
        focused.current = false;
        commit.current();
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      },
    },
  };
}
