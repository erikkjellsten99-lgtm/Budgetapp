import { useEffect, useState } from 'react';
import { getMembers, invite, sendPasswordReset, setNewPassword, signIn, signOut, signUp, syncNow, type Member, type SyncState } from './sync';

const STATUS_TEXT: Record<SyncState['status'], string> = {
  utloggad: 'Inte inloggad. Datan finns bara på den här enheten.',
  synkar: 'Synkar…',
  synkad: 'Synkad',
  offline: 'Ingen internetanslutning. Ändringarna skickas när nätet är tillbaka.',
  fel: 'Synken misslyckades',
};

/** Konto: logga in, se synkstatus och bjud in Cassandra till hushållet. */
export default function Account({ sync }: { sync: SyncState }) {
  return (
    <>
      <h2>Konto och synk</h2>
      <p className="hint">
        Logga in för att dela budgeten med hushållet. Den som loggar in först skapar hushållet och tar med sig
        siffrorna från sin telefon. Allt sparas fortfarande på telefonen, så appen fungerar
        även utan internet.
      </p>
      {sync.notice && <p className="info notice">{sync.notice}</p>}
      {!sync.email && sync.pending > 0 && (
        <p className="info notice">
          Du är inte inloggad här, så {sync.pending} {sync.pending === 1 ? 'ändring' : 'ändringar'} på den här enheten
          syns inte för hushållet. Logga in för att skicka dem.
        </p>
      )}
      {sync.recovering ? <NewPassword /> : sync.email ? <SignedIn sync={sync} /> : <SignIn />}
    </>
  );
}

type Mode = 'login' | 'signup' | 'reset';

function SignIn() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = password.length >= 8;
  const valid = emailOk && (mode === 'reset' || passwordOk);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        const mustConfirm = await signUp(email, password);
        if (mustConfirm) {
          setInfo('Kontot är skapat. Öppna mejlet och tryck på bekräftelselänken, kom sedan tillbaka hit och logga in.');
          setMode('login');
        }
      } else {
        await sendPasswordReset(email);
        setInfo('Vi har skickat en länk för att välja nytt lösenord. Öppna den, välj lösenord och logga sedan in här.');
        setMode('login');
      }
    } catch (err) {
      setError(swedishError(err));
    } finally {
      setBusy(false);
    }
  }

  const title = { login: 'Logga in', signup: 'Skapa konto', reset: 'Glömt lösenord' }[mode];
  const button = { login: 'Logga in', signup: 'Skapa konto', reset: 'Skicka länk' }[mode];

  return (
    <section className="card">
      <h3>{title}</h3>
      <form
        className="category-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) submit();
        }}
      >
        {info && <p className="info">{info}</p>}
        <label>
          Mejladress
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="namn@exempel.se"
          />
        </label>
        {mode !== 'reset' && (
          <label>
            Lösenord{mode === 'signup' && ' (minst 8 tecken)'}
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="primary" disabled={!valid || busy}>
            {busy ? 'Vänta…' : button}
          </button>
        </div>
        <div className="auth-links">
          {mode !== 'login' && (
            <button type="button" className="link-button" onClick={() => switchMode('login')}>
              Har du redan ett konto? Logga in
            </button>
          )}
          {mode !== 'signup' && (
            <button type="button" className="link-button" onClick={() => switchMode('signup')}>
              Inget konto? Skapa ett
            </button>
          )}
          {mode === 'login' && (
            <button type="button" className="link-button" onClick={() => switchMode('reset')}>
              Glömt lösenordet?
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function NewPassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="card">
      <h3>Välj nytt lösenord</h3>
      <form
        className="category-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (password.length < 8) return;
          setBusy(true);
          setError(null);
          try {
            await setNewPassword(password);
          } catch (err) {
            setError(swedishError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nytt lösenord (minst 8 tecken)
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="primary" disabled={password.length < 8 || busy}>
            Spara lösenord
          </button>
        </div>
      </form>
    </section>
  );
}

function SignedIn({ sync }: { sync: SyncState }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadMembers() {
    if (!sync.householdId) return;
    try {
      const result = await getMembers(sync.householdId);
      setMembers(result.members);
      setInvites(result.invites);
    } catch {
      // Offline: listan visas när nätet är tillbaka.
    }
  }

  useEffect(() => {
    loadMembers();
  }, [sync.householdId, sync.lastSynced]);

  const inviteOk = /^\S+@\S+\.\S+$/.test(inviteEmail.trim());

  return (
    <>
      <section className="card summary">
        <p>
          <span>Inloggad som</span>
          <span>{sync.email}</span>
        </p>
        <p className={sync.status === 'fel' ? 'negative' : undefined}>
          <span>
            {STATUS_TEXT[sync.status]}
            {sync.pending > 0 && ` · ${sync.pending} ${sync.pending === 1 ? 'ändring väntar' : 'ändringar väntar'}`}
          </span>
          <span>{sync.lastSynced && sync.status === 'synkad' ? sync.lastSynced.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </p>
        {sync.error && <p className="note negative">{sync.error}</p>}
        <div className="actions account-actions">
          <button type="button" onClick={() => syncNow()} disabled={sync.status === 'synkar'}>
            Synka nu
          </button>
          <button type="button" className="danger" onClick={() => signOut()}>
            Logga ut
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Hushållet</h3>
        <ul>
          {members.map((member) => (
            <li key={member.email} className="row">
              <span>{member.email}</span>
              <span>{member.email === sync.email ? 'Du' : 'Medlem'}</span>
            </li>
          ))}
          {invites.map((email) => (
            <li key={email} className="row">
              <span>{email}</span>
              <span className="muted-text">Inbjuden</span>
            </li>
          ))}
        </ul>
        <form
          className="category-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!inviteOk || !sync.householdId) return;
            setError(null);
            try {
              await invite(sync.householdId, inviteEmail);
              setInviteEmail('');
              await loadMembers();
            } catch (err) {
              setError(swedishError(err));
            }
          }}
        >
          <label>
            Bjud in med mejladress
            <input
              type="email"
              inputMode="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="cassandra@exempel.se"
            />
          </label>
          <p className="hint small">Den du bjuder in loggar in i appen med samma mejladress och går då med automatiskt.</p>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={!inviteOk || !sync.householdId}>
              Bjud in
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

/** Gör om vanliga fel från servern till begriplig svenska. */
function swedishError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate limit|security purposes|too many/i.test(message)) return 'För många försök. Vänta en minut och försök igen.';
  if (/invalid login credentials/i.test(message)) return 'Fel mejladress eller lösenord.';
  if (/email not confirmed/i.test(message)) return 'Mejladressen är inte bekräftad än. Tryck på länken i mejlet först.';
  if (/password should|weak password/i.test(message)) return 'Lösenordet är för svagt. Välj minst 8 tecken.';
  if (/same password|different from the old/i.test(message)) return 'Välj ett annat lösenord än det gamla.';
  if (/fetch|network/i.test(message)) return 'Ingen internetanslutning. Försök igen när du har nät.';
  return message;
}
