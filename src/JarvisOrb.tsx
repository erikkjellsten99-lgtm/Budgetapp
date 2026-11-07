// Dörren till specialrummet (designspec "Två rum"). Ligger i egen fil så att Jarvis.tsx, med rummets
// typsnitt, laddas först när rummet öppnas.
import { forwardRef } from 'react';

/** Orben i sidhuvudet: öppnar Jarvis. Det enda som lyser i vardagsrummet. */
const JarvisOrb = forwardRef<HTMLButtonElement, { onOpen: () => void }>(function JarvisOrb({ onOpen }, ref) {
  return (
    <button ref={ref} type="button" className="jarvis-orb" onClick={onOpen} aria-label="Öppna Jarvis">
      <span className="jarvis-orb-core" aria-hidden="true" />
    </button>
  );
});

export default JarvisOrb;
