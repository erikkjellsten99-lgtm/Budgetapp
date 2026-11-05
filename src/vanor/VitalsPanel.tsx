// Panelen för hälsodatan i Hälsogalaxen: kärnan (puls och kondition), sömnnebulosan och stegringen.

import { formatHealth, sleepRating } from '../../supabase/functions/inbox/health'
import type { Vitals } from './vitals'
import { STAGE_COLORS } from './vitals3d'

export type VitalId = 'vital:pulse' | 'vital:sleep' | 'vital:steps'
export const VITAL_IDS: VitalId[] = ['vital:pulse', 'vital:sleep', 'vital:steps']

/** "3 lägre än ditt snitt", eller null utan snitt. */
function vsUsual(diff: number | null | undefined, decimals: number): string | null {
  if (diff === null || diff === undefined) return null
  const step = 10 ** -decimals
  if (Math.abs(diff) < step / 2) return 'som ditt snitt'
  const n = Math.abs(diff).toLocaleString('sv-SE', { maximumFractionDigits: decimals })
  return `${n} ${diff > 0 ? 'högre' : 'lägre'} än ditt snitt`
}

const STAGE_NAMES: Record<string, string> = { core: 'kärna', deep: 'djup', rem: 'REM', awake: 'vaken', asleep: 'sömn' }

export function VitalsPanel({ id, vitals, onBack }: { id: VitalId; vitals: Vitals; onBack: () => void }) {
  const when = vitals.isToday ? 'idag' : 'i går'
  const back = (
    <button type="button" className="gv-back" onClick={onBack}>
      Tillbaka
    </button>
  )

  if (id === 'vital:pulse') {
    const pulse = vitals.pulse
    const trend = vsUsual(pulse?.trend, 0)
    return (
      <section className="gv-panel gv-vitals" aria-live="polite">
        <span className="gv-label gv-pulse">Kärnan · puls och kondition</span>
        <b className="gv-big">{pulse ? formatHealth('restingHr', pulse.bpm) : 'Ingen vilopuls än'}</b>
        <p>
          {pulse
            ? `Kärnan slår i din vilopuls ${when}${trend ? `, ${trend}` : ''}.`
            : 'Skicka vilopulsen från genvägen (nyckeln vilopuls), så börjar kärnan slå i din puls.'}
        </p>
        {(vitals.vo2 || vitals.hrv) && (
          <ul className="gv-rows">
            {vitals.vo2 && (
              <li>
                <span>VO₂ max{vsUsual(vitals.vo2.trend, 1) ? ` · ${vsUsual(vitals.vo2.trend, 1)}` : ''}</span>
                <b>{formatHealth('vo2Max', vitals.vo2.value)}</b>
              </li>
            )}
            {vitals.hrv && (
              <li>
                <span>Pulsvariabilitet{vsUsual(vitals.hrv.trend, 0) ? ` · ${vsUsual(vitals.hrv.trend, 0)}` : ''}</span>
                <b>{formatHealth('hrvMs', vitals.hrv.value)}</b>
              </li>
            )}
          </ul>
        )}
        <p>Kärnan lyser starkare ju bättre kondition du har.</p>
        <div className="cv-card-actions">{back}</div>
      </section>
    )
  }

  if (id === 'vital:sleep') {
    const sleep = vitals.sleep
    return (
      <section className="gv-panel gv-vitals" aria-live="polite">
        <span className="gv-label gv-sleep">Nebulosan · sömn</span>
        <b className="gv-big">{sleep ? formatHealth('sleepH', sleep.hours) : 'Ingen sömn än'}</b>
        {sleep ? (
          <>
            {sleep.bands.length > 0 && (
              <div className="gv-stagebar" role="img" aria-label="Nattens faser i ordning">
                {sleep.bands.map((b, i) => (
                  <i key={i} style={{ flexGrow: b.share, background: STAGE_COLORS[b.k] }} title={STAGE_NAMES[b.k]} />
                ))}
              </div>
            )}
            <ul className="gv-rows">
              {sleep.score !== null && (
                <li>
                  <span>Sömnpoäng</span>
                  <b>
                    {sleep.score} · {sleepRating(sleep.score)}
                  </b>
                </li>
              )}
              {sleep.deepH !== null && (
                <li>
                  <span>Djup sömn</span>
                  <b>{formatHealth('sleepDeepH', sleep.deepH)}</b>
                </li>
              )}
              {sleep.remH !== null && (
                <li>
                  <span>REM</span>
                  <b>{formatHealth('sleepRemH', sleep.remH)}</b>
                </li>
              )}
            </ul>
            <p>Färgbanden runt kärnan är nattens faser i ordning. Ju bättre natt, desto starkare lyser nebulosan.</p>
          </>
        ) : (
          <p>Sömnen kommer in när genvägen körs på morgonen.</p>
        )}
        <div className="cv-card-actions">{back}</div>
      </section>
    )
  }

  const steps = vitals.steps
  const left = steps ? Math.max(0, steps.goal - steps.value) : 0
  return (
    <section className="gv-panel gv-vitals" aria-live="polite">
      <span className="gv-label gv-steps">Ringen · steg</span>
      <b className="gv-big">{steps ? formatHealth('steps', steps.value) : 'Inga steg än'}</b>
      <p>
        {steps
          ? left > 0
            ? `${formatHealth('steps', left)} kvar till ${steps.habit ?? formatHealth('steps', steps.goal)}. Ringen runt galaxen sluts när du är där.`
            : `Ringen är sluten – ${steps.habit ?? 'målet'} klart ${when}.`
          : 'Stegen kommer in när genvägen körs.'}
      </p>
      {vitals.workouts > 0 && (
        <p>
          {vitals.workouts} träningspass {when} – en meteor per pass.
        </p>
      )}
      <div className="cv-card-actions">{back}</div>
    </section>
  )
}
