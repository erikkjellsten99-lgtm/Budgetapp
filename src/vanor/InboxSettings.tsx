import { useState } from 'react'
import { getSyncState, supabase } from '../sync'
import { METRIC_KEYS, METRICS } from '../../supabase/functions/inbox/health'

// Koppla iPhone: genvägar i appen Genvägar skickar till Groundwork (Supabase-funktionen "inbox") med en
// personlig nyckel – listan "Groundwork" i Påminnelser, saker du säger till Siri och siffror från Apple Hälsa.
// Här skapas nyckeln och de tre genvägarna förklaras.

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

/** Koppla iPhone (Påminnelser, Siri och Apple Hälsa) till Vanor. */
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
      <h3 id="inbox-title">Koppla iPhone</h3>
      <div className="push-card">
        <p className="push-lead">
          Påminnelser, Siri och Apple Hälsa kan skicka till Groundwork: saker hamnar under <b>Att göra</b>, och vanor kan bockas
          automatiskt från t.ex. dina steg.
        </p>

        {!loggedIn ? (
          <p className="push-note">Du behöver vara inloggad (personikonen uppe till höger).</p>
        ) : !key ? (
          <button type="button" className="primary" disabled={busy} onClick={createKey}>
            {busy ? 'Skapar …' : 'Koppla iPhone'}
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
              <summary>Påminnelser → Att göra</summary>
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

            <details className="inbox-steps">
              <summary>Siri: "Ny uppgift"</summary>
              <ol>
                <li>
                  Gör en kopia av genvägen ovan (håll fingret på den → <b>Duplicera</b>) och döp den till <b>Ny uppgift</b>.
                </li>
                <li>
                  Ta bort allt utom <b>Hämta innehåll från URL</b>. Lägg till <b>Be om Text</b> överst med frågan{' '}
                  <b>Vad ska du göra?</b> och stäng av <b>Tillåt flera rader</b>.
                </li>
                <li>
                  I <b>Hämta innehåll från URL</b>: byt fältet <code>rader</code> mot <code>sak</code> med värdet <b>Angiven inmatning</b>.
                </li>
                <li>
                  Lägg till <b>Visa resultat</b> sist. Säg sedan <b>"Hej Siri, ny uppgift"</b> och t.ex. "ringa mamma imorgon klockan 18".
                </li>
              </ol>
              <p className="push-note">
                Siri förstår idag, i morgon, veckodagar, datum som "25 november" och tider som "klockan 18" eller "17.30". Döp inte
                genvägen till bara "Groundwork", då blandar Siri ihop dem.
              </p>
            </details>

            <details className="inbox-steps">
              <summary>Apple Hälsa → vanor och siffror</summary>
              <ol>
                <li>
                  Öppna <b>Genvägar</b>, tryck <b>+</b> och döp genvägen till <b>Hälsa till Groundwork</b>.
                </li>
                <li>
                  Sök efter <b>hälso</b> och lägg till <b>Sök efter hälsoprov</b>. Tryck på typen och välj t.ex. <b>Steg</b>. Ändra
                  filtret till <b>Startdatum är idag</b> och <b>Gruppera efter</b> till <b>Dag</b>. Första gången frågar iPhone om
                  Genvägar får läsa Hälsa: tryck <b>Fortsätt</b>.
                </li>
                <li>Gör likadant för varje sak du vill skicka (tabellen nedan). Börja gärna med steg och lägg till fler sedan.</li>
                <li>
                  Lägg till <b>Hämta innehåll från URL</b> sist: adressen ovan, <b>Metod</b> POST, rubriken <b>Authorization</b> med
                  värdet ovan, <b>Text i begäran</b> JSON. Lägg till ett fält <b>Text</b> per sak, med nyckeln i tabellen och värdet från
                  rätt <b>Hälsoprover</b> (tryck <b>Välj variabel</b>).
                </li>
                <li>
                  Lägg till <b>Visa resultat</b> och tryck ▶ (välj <b>Tillåt alltid</b>). Du ser t.ex.{' '}
                  <code>"Hälsa sparad: 8 432 steg."</code>
                </li>
                <li>
                  Gör det automatiskt: <b>Automatisering</b> → <b>Tidpunkt på dagen</b>, t.ex. 21:30, <b>Kör omedelbart</b>, välj{' '}
                  <b>Hälsa till Groundwork</b>.
                </li>
                <li>
                  Bocka vanor automatiskt: tryck <b>Ändra</b> på en vana i listan nedan och slå på{' '}
                  <b>Bocka automatiskt från Apple Hälsa</b>, t.ex. steg minst 10 000.
                </li>
              </ol>
              <table className="health-fields">
                <thead>
                  <tr>
                    <th scope="col">I Hälsa</th>
                    <th scope="col">Nyckel</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_KEYS.map((m) => (
                    <tr key={m}>
                      <td>{METRICS[m].health}</td>
                      <td>
                        <code>{METRICS[m].field}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="push-note">
                Sömn: välj filtret <b>Slutdatum är idag</b> i stället, så räknas natten som just tog slut. Vikt och puls: sortera på
                senaste först med gränsen 1. iPhone låser hälsodatan när telefonen är låst, så välj en tid då du brukar ha den i
                handen, eller säg "Hej Siri, hälsa till Groundwork". Siffrorna sparas privat på ditt konto.
              </p>
            </details>

            <div className="push-actions">
              {confirmNew ? (
                <>
                  <button type="button" className="text-btn" disabled={busy} onClick={createKey}>
                    Ja, skapa ny (alla genvägar måste få den nya)
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
