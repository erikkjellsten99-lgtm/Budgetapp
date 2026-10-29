import { useState } from 'react';
import Vanor from '../vanor/Vanor';
import Traning from './Traning';

type Part = 'vanor' | 'traning';
const PART_KEY = 'vanor-del';

function savedPart(): Part {
  try {
    // Fliken Träning fanns en kort tid som egen flik – den öppnas nu här.
    if (localStorage.getItem('view') === 'traning') return 'traning';
    return localStorage.getItem(PART_KEY) === 'traning' ? 'traning' : 'vanor';
  } catch {
    return 'vanor';
  }
}

/** Fliken Vanor: dagens vanor och träningsloggen, med en växel överst. */
export default function HealthTab() {
  const [part, setPart] = useState<Part>(savedPart);

  function choose(next: Part) {
    setPart(next);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem(PART_KEY, next);
    } catch {
      // Valet sparas bara inte till nästa gång.
    }
  }

  return (
    <div className="health-tab">
      <div className="segmented-row two" role="tablist" aria-label="Vanor eller träning">
        {(
          [
            ['vanor', 'Vanor'],
            ['traning', 'Träning'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={part === id}
            className={part === id ? 'seg active' : 'seg'}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Båda ligger kvar, så att ett påbörjat val eller utkast inte tappas när du byter. */}
      <div hidden={part !== 'vanor'}>
        <Vanor />
      </div>
      <div hidden={part !== 'traning'}>
        <Traning />
      </div>
    </div>
  );
}
