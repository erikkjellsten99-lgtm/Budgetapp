// Dagens datum som hook, delad av Vanor, Challenges och Akademin.
import { useEffect, useState } from 'react';
import { todayKey, type DateKey } from './dates';

/** Dagens datum som byter vid midnatt, även om appen står öppen, och när appen visas igen. */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday(todayKey());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000);
    // Telefonen kan sova över midnatt – kolla igen när appen visas.
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [today]);
  return today;
}
