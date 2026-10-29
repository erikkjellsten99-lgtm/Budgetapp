import { useEffect, useState } from 'react'
import { getSyncState } from '../sync'
import { remindText, type Habit } from './habits'
import { PushError, currentSubscription, disablePush, enablePush, loadEvening, pushSupport, saveEvening, sendTest } from './push'

const DEFAULT_EVENING = '20:00'

type Status = 'loading' | 'off' | 'on'

/** Påminnelser: slå på notiser på den här telefonen, kvällspåminnelse och testnotis. */
export default function PushSettings({ habits }: { habits: Habit[] }) {
  const support = pushSupport()
  const [status, setStatus] = useState<Status>('loading')
  const [sub, setSub] = useState<PushSubscription | null>(null)
  const [evening, setEvening] = useState<string | null>(DEFAULT_EVENING)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const loggedIn = getSyncState().status !== 'utloggad'
  const withTime = habits.filter((h) => !h.archived && h.remind).sort((a, b) => a.remind!.localeCompare(b.remind!))

  useEffect(() => {
    let alive = true
    if (support !== 'ok') return
    currentSubscription().then(async (s) => {
      if (!alive) return
      setSub(s)
      if (s) setEvening(await loadEvening(s))
      if (alive) setStatus(s ? 'on' : 'off')
    })
    return () => {
      alive = false
    }
  }, [support])

  async function turnOn() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const s = await enablePush(evening)
      setSub(s)
      setStatus('on')
      setMessage({ kind: 'ok', text: 'Klart! Påminnelser är på för den här telefonen.' })
    } catch (e) {
      const reason = e instanceof PushError ? e.reason : 'failed'
      setMessage({
        kind: 'error',
        text:
          reason === 'denied'
            ? 'Notiser är blockerade. Tillåt dem i telefonens inställningar för Groundwork och försök igen.'
            : reason === 'login'
              ? 'Logga in först (personikonen uppe till höger), så kan påminnelserna skickas.'
              : 'Det gick inte att slå på. Kontrollera uppkopplingen och försök igen.',
      })
    }
    setBusy(false)
  }

  async function turnOff() {
    if (!sub || busy) return
    setBusy(true)
    setMessage(null)
    try {
      await disablePush(sub)
      setSub(null)
      setStatus('off')
    } catch {
      setMessage({ kind: 'error', text: 'Det gick inte att stänga av. Försök igen.' })
    }
    setBusy(false)
  }

  async function changeEvening(next: string | null) {
    setEvening(next)
    if (!sub) return
    try {
      await saveEvening(sub, next)
    } catch {
      setMessage({ kind: 'error', text: 'Kunde inte spara tiden. Försök igen.' })
    }
  }

  async function test() {
    if (!sub || busy) return
    setBusy(true)
    const ok = await sendTest(sub)
    setMessage(
      ok
        ? { kind: 'ok', text: 'Testnotisen är skickad. Den kommer inom några sekunder.' }
        : { kind: 'error', text: 'Testnotisen gick inte att skicka. Stäng av och slå på igen.' },
    )
    setBusy(false)
  }

  return (
    <section className="push-settings" aria-labelledby="push-title">
      <h3 id="push-title">Påminnelser</h3>

      {support === 'ios-home' ? (
        <p className="push-note">
          På iPhone kommer notiser bara när Groundwork ligger på hemskärmen. Öppna appen i Safari, tryck på dela-knappen och
          välj <b>Lägg till på hemskärmen</b>. Öppna den sedan därifrån och kom tillbaka hit.
        </p>
      ) : support === 'unsupported' ? (
        <p className="push-note">Den här webbläsaren kan inte visa notiser. Prova i Safari eller Chrome.</p>
      ) : status === 'loading' ? (
        <p className="push-note">Kollar …</p>
      ) : (
        <div className="push-card">
          {status === 'off' ? (
            <>
              <p className="push-lead">
                Få en notis vid tiden du valt för en vana, och en på kvällen om något måste göras för att hinna veckomålet.
              </p>
              {!loggedIn && <p className="push-note">Du behöver vara inloggad (personikonen uppe till höger).</p>}
              <button type="button" className="primary" disabled={busy} onClick={turnOn}>
                Slå på påminnelser
              </button>
            </>
          ) : (
            <>
              <p className="push-on">
                <span aria-hidden="true">●</span> På för den här telefonen
              </p>
              <div className="push-row">
                <label className="push-toggle">
                  <input
                    type="checkbox"
                    checked={evening !== null}
                    onChange={(e) => changeEvening(e.target.checked ? DEFAULT_EVENING : null)}
                  />
                  <span>
                    <b>Kvällspåminnelse</b>
                    <small>Om något måste göras idag för veckomålet</small>
                  </span>
                </label>
                {evening !== null && (
                  <input
                    className="push-time"
                    type="time"
                    value={evening}
                    step={300}
                    aria-label="Tid för kvällspåminnelse"
                    onChange={(e) => e.target.value && changeEvening(e.target.value)}
                  />
                )}
              </div>
              <p className="push-note">
                {withTime.length
                  ? `Påminnelse per vana: ${withTime.map((h) => `${h.name} ${remindText(h)}`).join(', ')}.`
                  : 'Vill du ha en påminnelse för en viss vana? Tryck Ändra på vanan nedan och välj en tid.'}
              </p>
              <div className="push-actions">
                <button type="button" className="text-btn" disabled={busy} onClick={test}>
                  Skicka testnotis
                </button>
                <button type="button" className="text-btn quiet" disabled={busy} onClick={turnOff}>
                  Stäng av
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {message && (
        <p className={message.kind === 'ok' ? 'field-ok push-msg' : 'field-error push-msg'} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
