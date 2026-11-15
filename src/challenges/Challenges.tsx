import { useEffect, useMemo, useState } from 'react';
import '../vanor/vanor.css';
import './challenges.css';
import { todayKey, type DateKey } from '../vanor/dates';
import { evaluate, progress, toMap, type CheckinMap, type Progress } from './logic';
import { loadAll, onChallengeChange, saveRows } from './store';
import { startChallengeSync, syncNow } from './sync';
import type { Challenge, ChallengeData } from './types';
import ChallengeDetail from './ChallengeDetail';
import CreateSheet from './CreateSheet';

/** Dagens datum, uppdateras vid midnatt och när appen visas igen. */
function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday(todayKey());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [today]);
  return today;
}

function useChallengeData(): ChallengeData | null {
  const [data, setData] = useState<ChallengeData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => loadAll().then((next) => alive && setData(next));
    load();
    const off = onChallengeChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return data;
}

type Tab = 'active' | 'done';

export default function Challenges() {
  const today = useToday();
  const data = useChallengeData();
  const [tab, setTab] = useState<Tab>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Dagen som reglerna får tillämpas för: sätts först när synken hunnit hämta det som bockats på andra telefoner.
  const [syncedFor, setSyncedFor] = useState<DateKey | null>(null);

  useEffect(() => {
    startChallengeSync();
  }, []);

  useEffect(() => {
    let alive = true;
    syncNow().then(() => alive && setSyncedFor(today));
    return () => {
      alive = false;
    };
  }, [today]);

  const map = useMemo<CheckinMap>(() => toMap(data?.checkins ?? []), [data]);

  // Reglerna: missade dagar, omstart och avklarat. Sparar bara när något faktiskt ändrats.
  useEffect(() => {
    if (!data || syncedFor !== today) return;
    const writes: Parameters<typeof saveRows>[0] = [];
    for (const challenge of data.challenges) {
      const tasks = data.tasks.filter((t) => t.challenge_id === challenge.id);
      const result = evaluate(challenge, tasks, map, today);
      if (!result.changed) continue;
      writes.push({ table: 'challenges', row: result.challenge });
      for (const attempt of result.attempts) writes.push({ table: 'challenge_attempts', row: attempt });
    }
    if (writes.length) saveRows(writes);
  }, [data, map, today, syncedFor]);

  if (!data) {
    return (
      <div className="vanor challenges" aria-busy="true" aria-label="Laddar">
        <div className="ch-card ch-skeleton" />
        <div className="ch-card ch-skeleton" />
      </div>
    );
  }

  const open = openId ? data.challenges.find((c) => c.id === openId) : undefined;
  if (open) {
    return (
      <div className="vanor challenges">
        <ChallengeDetail
          challenge={open}
          tasks={data.tasks.filter((t) => t.challenge_id === open.id)}
          attempts={data.attempts.filter((a) => a.challenge_id === open.id)}
          checkins={data.checkins.filter((c) => c.challenge_id === open.id)}
          map={map}
          today={today}
          onBack={() => {
            setOpenId(null);
            window.scrollTo(0, 0);
          }}
        />
      </div>
    );
  }

  const active = data.challenges.filter((c) => c.status === 'active' || c.status === 'paused');
  const finished = data.challenges.filter((c) => c.status === 'completed' || c.status === 'failed');
  const shown = tab === 'active' ? active : finished;

  return (
    <div className="vanor challenges">
      <header className="ch-head">
        <div>
          <h2 className="headline">Challenges</h2>
          <p className="date-line">Utmaningar du bockar av varje dag.</p>
        </div>
        <button type="button" className="primary" onClick={() => setCreating(true)}>
          Ny utmaning
        </button>
      </header>

      <div className="segmented-row ch-tabs" role="tablist" aria-label="Utmaningar">
        {(['active', 'done'] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'seg active' : 'seg'} onClick={() => setTab(id)}>
            {id === 'active' ? `Aktiva${active.length ? ` (${active.length})` : ''}` : `Avklarade${finished.length ? ` (${finished.length})` : ''}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="ch-empty">
          {tab === 'active' ? (
            <>
              <p className="ch-empty-title">Ingen utmaning igång</p>
              <p>Starta från en mall, till exempel 75 Hard, eller bygg en egen med dina uppgifter och regler.</p>
              <button type="button" className="primary" onClick={() => setCreating(true)}>
                Starta en utmaning
              </button>
            </>
          ) : (
            <>
              <p className="ch-empty-title">Inga avklarade än</p>
              <p>När du klarat alla dagar i en utmaning hamnar den här.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="ch-list">
          {shown.map((challenge) => (
            <li key={challenge.id}>
              <ChallengeCard
                challenge={challenge}
                progress={progress(challenge, data.tasks.filter((t) => t.challenge_id === challenge.id), map, today)}
                today={today}
                onOpen={() => {
                  setOpenId(challenge.id);
                  window.scrollTo(0, 0);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CreateSheet
          today={today}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setTab('active');
            setOpenId(id);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}

/** Ring som visar hur långt man kommit: dag X av Y. */
export function Ring({ day, length, done }: { day: number; length: number; done?: boolean }) {
  const r = 26;
  const full = 2 * Math.PI * r;
  const share = Math.min(1, Math.max(0, day / length));
  return (
    <svg className={done ? 'ch-ring is-done' : 'ch-ring'} viewBox="0 0 64 64" aria-hidden="true">
      <circle className="ch-ring-track" cx="32" cy="32" r={r} />
      <circle className="ch-ring-fill" cx="32" cy="32" r={r} strokeDasharray={`${share * full} ${full}`} transform="rotate(-90 32 32)" />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="middle">
        {day}
      </text>
    </svg>
  );
}

export function statusLine(challenge: Challenge, p: Progress, today: DateKey): string {
  if (challenge.status === 'completed') return `Klar ${p.endDate}`;
  if (challenge.status === 'paused') return 'Pausad';
  if (challenge.start_date > today) return `Startar ${challenge.start_date}`;
  if (p.today?.state === 'done') return 'Allt klart idag';
  const left = p.today?.missing.length ?? 0;
  return left === 1 ? '1 sak kvar idag' : `${left} saker kvar idag`;
}

function ChallengeCard({ challenge, progress: p, today, onOpen }: { challenge: Challenge; progress: Progress; today: DateKey; onOpen: () => void }) {
  const notice = challenge.settings.notice;
  return (
    <button type="button" className="ch-card ch-card-btn" onClick={onOpen}>
      <Ring day={p.day} length={challenge.length_days} done={challenge.status === 'completed'} />
      <span className="ch-card-main">
        <span className="ch-card-title">{challenge.title}</span>
        <span className="ch-card-meta">
          Dag {p.day}/{challenge.length_days} · Streak {p.streak} · Försök #{challenge.attempt_number}
        </span>
        <span className={p.today?.state === 'done' || challenge.status === 'completed' ? 'ch-card-status ok' : 'ch-card-status'}>
          {statusLine(challenge, p, today)}
        </span>
        {notice && notice.type !== 'completed' && (
          <span className="ch-card-notice">{notice.type === 'restart_challenge' ? 'Började om efter en missad dag' : 'Veckan började om efter en missad dag'}</span>
        )}
      </span>
    </button>
  );
}
