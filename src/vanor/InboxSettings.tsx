import { useState } from 'react'
import { getSyncState, supabase } from '../sync'

// Påminnelser från iPhone: en genväg i appen Genvägar skickar listan "Groundwork" i Påminnelser
// till Vanor → Att göra (Supabase-funktionen "inbox"). Här skapas nyckeln och genvägen förklaras.

export const INBOX_URL = 'https://gnmbtioxwgzdooswpwxy.supabase.co/functions/v1/inbox'
const STORAGE_KEY = 'vanor-inbox-nyckel'

function readKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // Privat läge: nyckeln visas ändå nu, den sparas bara inte till nästa gång.
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  return (
    <div className="inbox-field">
      <span className="inbox-label">{label}</span>
      <div className="inbox-copy">
        <code>{value}</code>
        <button
          type="button"
          className="text-btn"
          onClick={async () => {
            setState((await copy(value)) ? 'ok' : 'fail')
            setTimeout(() => setState('idle'), 2000)
          }}
        >
          {state === 'ok' ? 'Kopierat ✓' : state === 'fail' ? 'Markera och kopiera' : 'Kopiera'}
        </button>
      </div>
    </div>
  )
}

/** Koppla iPhones Påminnelser till Vanor. */
export default function InboxSettings() {
  const loggedIn = getSyncState().status !== 'utloggad'
  const [key, setKey] = useState<string | null>(readKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  async function createKey() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('login')
      const res = await fetch(`${INBOX_URL}?action=token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      const body = (await res.json()) as { token?: string; error?: string }
      if (!res.ok || !body.token) throw new Error(body.error ?? 'failed')
      storeKey(body.token)
      setKey(body.token)
      setConfirmNew(false)
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'login'
          ? 'Logga in först (personikonen uppe till höger).'
          : 'Det gick inte att skapa nyckeln. Kontrollera uppkopplingen och försök igen.',
      )
    }
    setBusy(false)
  }

  return (
    <section className="push-settings inbox-settings" aria-labelledby="inbox-title">
      <h3 id="inbox-title">Från iPhones Påminnelser</h3>
      <div className="push-card">
        <p className="push-lead">
          Skriv i listan <b>Groundwork</b> i appen Påminnelser, så hamnar sakerna under <b>Att göra</b> här, med datum och tid.
        </p>

        {!loggedIn ? (
          <p className="push-note">Du behöver vara inloggad (personikonen uppe till höger).</p>
        ) : !key ? (
          <button type="button" className="primary" disabled={busy} onClick={createKey}>
            {busy ? 'Skapar …' : 'Koppla Påminnelser'}
          </button>
        ) : (
          <>
            <p className="push-on">
              <span aria-hidden="true">●</span> Nyckel skapad
            </p>
            <CopyField label="Adress (URL)" value={INBOX_URL} />
            <CopyField label="Rubrik: Authorization" value={`Bearer ${key}`} />
            <p className="push-note">Nyckeln är personlig. Dela den inte, den kan lägga in saker hos dig.</p>

            <details className="inbox-steps">
              <summary>Så gör du genvägen (5 min, en gång)</summary>
              <ol>
                <li>
                  Öppna <b>Påminnelser</b> och skapa en lista som heter <b>Groundwork</b>.
                </li>
                <li>
                  Öppna <b>Genvägar</b>, tryck <b>+</b> och döp genvägen till <b>Till Groundwork</b>.
                </li>
                <li>
                  Sök efter åtgärden <b>Sök efter påminnelser</b> och lägg till den. Tryck <b>Lägg till filter</b>: <b>Lista</b> är{' '}
                  <b>Groundwork</b>. Lägg till ett filter till: <b>Är inte klart</b>.
                </li>
                <li>
                  Lägg till <b>Upprepa med varje</b> (den tar påminnelserna). Lägg till <b>Text</b> och dra in den mellan{' '}
                  <b>Upprepa</b> och <b>Avsluta upprepning</b>. Skriv i den: <b>Upprepa objekt</b>, sedan ett lodrätt streck{' '}
                  <code>|</code> (tangentbordet: 123 → #+=), sedan <b>Upprepa objekt</b> igen. Tryck på det sista och välj{' '}
                  <b>Klardatum</b>.
                </li>
                <li>
                  Under <b>Avsluta upprepning</b>: lägg till <b>Hämta innehåll från URL</b>. Klistra in adressen ovan. Tryck på pilen:{' '}
                  <b>Metod</b> POST, <b>Rubriker</b>: lägg till <b>Authorization</b> med värdet ovan (Bearer …). <b>Brödtext</b>: JSON,
                  lägg till fält <b>Text</b> med nyckeln <code>rader</code> och värdet <b>Upprepningsresultat</b>.
                </li>
                <li>
                  Tryck ▶ för att testa. Du ser t.ex. <code>"1 ny i Groundwork"</code>.
                </li>
                <li>
                  Gör det automatiskt: <b>Automatisering</b> → <b>+</b> → <b>Tidpunkt på dagen</b>, t.ex. 07:00, Dagligen,{' '}
                  <b>Kör omedelbart</b>, välj <b>Till Groundwork</b>. Lägg gärna fler tider (12:00, 17:00, 21:00).
                </li>
              </ol>
              <p className="push-note">
                Varje påminnelse läggs in en gång, även om genvägen körs många gånger. Bocka av i Groundwork. I Påminnelser kan du
                radera eller bocka av när du vill, det påverkar inte Groundwork. Ändrar du datum i Påminnelser blir det en ny sak.
              </p>
            </details>

            <div className="push-actions">
              {confirmNew ? (
                <>
                  <button type="button" className="text-btn" disabled={busy} onClick={createKey}>
                    Ja, skapa ny (den gamla slutar gälla)
                  </button>
                  <button type="button" className="text-btn quiet" onClick={() => setConfirmNew(false)}>
                    Avbryt
                  </button>
                </>
              ) : (
                <button type="button" className="text-btn quiet" onClick={() => setConfirmNew(true)}>
                  Skapa ny nyckel
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="field-error push-msg" role="status">
          {error}
        </p>
      )}
    </section>
  )
}
