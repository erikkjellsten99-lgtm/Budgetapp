import { useEffect, useRef, type ReactNode } from 'react';

const ROOM_BAR = '#050912';

/** Escape stänger rummet, utom när Jarvis är i helskärm: då lämnar Escape helskärmen först (Jarvis.tsx). */
export const escapeClosesRoom = (body: { classList: { contains(name: string): boolean } }) => !body.classList.contains('jarvis-locked');

/**
 * Specialrummet (designspec "Två rum"): ett mörkt rum ovanpå appen, för Jarvis.
 * Tillbaka-knappen eller Escape stänger. Medan rummet är öppet går sidan under inte att rulla,
 * och telefonens statusfält får rummets färg.
 */
export default function Room({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = metas.map((meta) => meta.content);
    metas.forEach((meta) => (meta.content = ROOM_BAR));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Resten av appen går inte att nå med tangentbord eller skärmläsare medan rummet är öppet.
    const behind = [...document.querySelectorAll<HTMLElement>('.app-shell > :not(.room-sheet)')];
    behind.forEach((el) => (el.inert = true));
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && escapeClosesRoom(document.body) && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      metas.forEach((meta, i) => (meta.content = before[i]));
      document.body.style.overflow = overflow;
      behind.forEach((el) => (el.inert = false));
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="room room-sheet" role="dialog" aria-modal="true" aria-label="Jarvis">
      <button ref={back} type="button" className="room-back" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Tillbaka
      </button>
      {children}
    </div>
  );
}
