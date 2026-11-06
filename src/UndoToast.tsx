import { useEffect, useState } from 'react';
import { dismissUndo, onUndoOffer, runUndo, UNDO_MS, type UndoOffer } from './undo';

/** Rutan längst ner efter en borttagning: "Netflix togs bort · Ångra". */
export default function UndoToast() {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  // Efter Ångra: rutan ligger kvar en kort stund, så att ett dubbelklick inte trycker på det som ligger under.
  const [result, setResult] = useState<'done' | 'failed' | null>(null);

  useEffect(() => onUndoOffer((next) => {
    setOffer(next);
    if (next) setResult(null);
  }), []);

  // Stängs av sig själv efter en stund. En ny borttagning startar om tiden.
  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => dismissUndo(offer.id), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [offer]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), result === 'done' ? 1500 : 4000);
    return () => window.clearTimeout(timer);
  }, [result]);

  if (!offer && !result) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      {offer ? (
        <>
          <span className="undo-message">{offer.message}</span>
          <button
            type="button"
            className="undo-button"
            onClick={() => {
              setResult('done');
              runUndo(offer.id).catch(() => setResult('failed'));
            }}
          >
            Ångra
          </button>
        </>
      ) : (
        <span className="undo-message">{result === 'failed' ? 'Det gick inte att ångra.' : 'Återställt'}</span>
      )}
    </div>
  );
}
