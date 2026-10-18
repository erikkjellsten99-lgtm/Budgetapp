import { useEffect, useState } from 'react';
import { getMembers, invite, sendLoginCode, signOut, syncNow, verifyLoginCode, type Member, type SyncState } from './sync';

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
        Logga in för att dela budgeten med hushållet. Allt sparas fortfarande på telefonen, så appen fungerar
        även utan internet.
      </p>
      {sync.email ? <SignedIn sync={sync} /> : <SignIn />}
    </>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(swedishError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3>Logga in</h3>
      {!sent ? (
        <form
          className="category-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (emailOk) run(async () => {
              await sendLoginCode(email);
              setSent(true);
            });
          }}
        >
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
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={!emailOk || busy}>
              {busy ? 'Skickar…' : 'Skicka inloggningskod'}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="category-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => verifyLoginCode(email, code));
          }}
        >
          <p className="hint">
            Vi har skickat ett mejl till <strong>{email.trim()}</strong>. Skriv in koden från mejlet här, eller
            tryck på länken i mejlet.
          </p>
          <label>
            Kod från mejlet
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              autoFocus
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={code.trim().length < 6 || busy}>
              {busy ? 'Loggar in…' : 'Logga in'}
            </button>
            <button type="button" onClick={() => setSent(false)}>
              Byt mejladress
            </button>
          </div>
        </form>
      )}
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
          <span>{STATUS_TEXT[sync.status]}</span>
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
  if (/expired|invalid|otp/i.test(message)) return 'Koden stämmer inte eller har gått ut. Försök igen eller skicka en ny kod.';
  if (/fetch|network/i.test(message)) return 'Ingen internetanslutning. Försök igen när du har nät.';
  return message;
}
