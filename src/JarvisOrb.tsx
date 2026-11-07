// Dörren till specialrummet (designspec "Två rum"). Ligger i egen fil så att Jarvis.tsx, med rummets
// typsnitt, laddas först när rummet öppnas.
import { forwardRef } from 'react';

const Mic = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

/** Orben i sidhuvudet: öppnar Jarvis. Det enda som lyser i vardagsrummet. */
const JarvisOrb = forwardRef<HTMLButtonElement, { onOpen: () => void }>(function JarvisOrb({ onOpen }, ref) {
  return (
    <button ref={ref} type="button" className="jarvis-orb" onClick={onOpen} aria-label="Öppna Jarvis">
      <span className="jarvis-orb-core" aria-hidden="true" />
    </button>
  );
});

export default JarvisOrb;

/** Knappen på Idag som öppnar Jarvis. Tas bort när Idag byggs om (uppgift 3). */
export function JarvisButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="card jarvis-open" onClick={onOpen}>
      <span className="jarvis-open-text">
        <span className="jarvis-eyebrow">Fråga Jarvis</span>
        <span className="jarvis-open-hint">Prata eller skriv: Vad blir över? Hur sov jag?</span>
      </span>
      <span className="jarvis-mic">
        <Mic />
      </span>
    </button>
  );
}
