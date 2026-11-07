import { useCallback, useEffect, useState } from 'react';
import { JarvisButton } from './Jarvis';
import { loadFacts } from './jarvis';
import { onDataChange } from './db';
import { onHabitChange } from './vanor/store';
import { longDate } from './vanor/dates';
import type { SummaryFacts } from '../supabase/functions/inbox/summary';
import { dayBrief } from '../supabase/functions/inbox/ask';

type Target = 'overview' | 'budget' | 'goal' | 'vanor' | 'jarvis' | 'nyheter';

const QUICK: { id: Target; label: string; icon: string }[] = [
  { id: 'overview', label: 'Översikt', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' },
  { id: 'budget', label: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'goal', label: 'Prognos', icon: 'M3 19l5.5-6 4 3.5L21 7M15 7h6v6' },
  { id: 'nyheter', label: 'Nyheter', icon: 'M5 4h11v15a1 1 0 0 0 2 0V8h2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM8 8h5M8 12h5M8 16h3' },
];

function greeting(hour: number): string {
  if (hour < 5) return 'God natt';
  if (hour < 10) return 'God morgon';
  if (hour < 18) return 'Hej';
  return 'God kväll';
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** Så många obetalda poster visas på kortet; resten blir "och 2 till". */
const UNPAID_SHOWN = 4;
const isNegative =(amount: string) => /^[−-]/.test(amount);

/**
 * Idag: startsidan. Visar dagens viktigaste siffror och leder vidare till rätt flik.
 * Siffrorna kommer från summaryFacts (jarvis.ts), samma uträkning som Översikt, Sparmål och Siri.
 * Läser bara.
 */
export default function Today({ active, onOpen }: { active: boolean; onOpen: (target: Target) => void }) {
  const [facts, setFacts] = useState<SummaryFacts | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadFacts()
      .then((next) => {
        setFacts(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  useEffect(() => {
    const offData = onDataChange(load);
    const offHabits = onHabitChange(load);
    return () => {
      offData();
      offHabits();
    };
  }, [load]);

  const hour = new Date().getHours();

  return (
    <div className="today">
      <div className="view-intro">
        <p className="eyebrow">{facts ? capitalize(longDate(facts.today)) : ' '}</p>
        <h2>{greeting(hour)}</h2>
      </div>

      <JarvisButton onOpen={() => onOpen('jarvis')} />

      {/* Utan pengameningen: beloppet står redan stort i kortet "Blir över" här nedanför.
          Samma flagga som visningsläget, så Jarvis egen text är orörd (Siri och morgonbeskedet säger allt). */}
      {facts && (
        <section className="card today-say" aria-label="Jarvis säger">
          <span className="today-say-dot" aria-hidden="true" />
          <p>
            <span className="jarvis-eyebrow">Jarvis säger</span>
            {dayBrief(facts, { hideMoney: true })}
          </p>
        </section>
      )}

      <nav className="today-quick" aria-label="Snabbval">
        {QUICK.map((q) => (
          <button key={q.id} type="button" onClick={() => onOpen(q.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={q.icon} />
            </svg>
            {q.label}
          </button>
        ))}
      </nav>

      {failed && !facts && (
        <div className="card today-error" role="alert">
          <p>Det gick inte att läsa Groundwork just nu.</p>
          <button type="button" onClick={load}>
            Försök igen
          </button>
        </div>
      )}

      {!facts && !failed && (
        <div className="today-grid" aria-busy="true">
          <div className="card today-card today-skeleton" />
          <div className="card today-card today-skeleton" />
          <div className="card today-card today-skeleton" />
        </div>
      )}

      {facts && (
        <div className="today-grid">
          <button type="button" className="card today-card today-money" onClick={() => onOpen('overview')}>
            <span className="today-label">Blir över i {facts.month}</span>
            <strong className={isNegative(facts.left) ? 'today-amount negative' : 'today-amount'}>{facts.left}</strong>
            <span className="today-rows">
              <span>
                <span>Inkomster</span>
                <span>{facts.income}</span>
              </span>
              <span>
                <span>Kostnader</span>
                <span>− {facts.costs}</span>
              </span>
              <span>
                <span>Planerat sparande</span>
                <span>− {facts.plannedSavings}</span>
              </span>
            </span>
            <span className="today-more" aria-hidden="true">
              Ekonomi ›
            </span>
          </button>

          {/* Kvar att betala: det som inte är bockat som betalt i Budget den här månaden. Ingen budget: inget kort. */}
          {facts.unpaid && (
            <button type="button" className="card today-card" onClick={() => onOpen('budget')}>
              <span className="today-label">Kvar att betala i {facts.month}</span>
              <strong className="today-amount small">
                {facts.unpaid.items.length ? facts.unpaid.total : 'Allt betalt'}
              </strong>
              {facts.unpaid.items.length > 0 ? (
                <span className="today-rows">
                  {facts.unpaid.items.slice(0, UNPAID_SHOWN).map((item, i) => (
                    <span key={`${item.name}-${i}`}>
                      <span>{item.name}</span>
                      <span>{item.left}</span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="today-meta">Allt i budgeten är bockat som betalt.</span>
              )}
              {facts.unpaid.items.length > UNPAID_SHOWN && (
                <span className="today-meta">och {facts.unpaid.items.length - UNPAID_SHOWN} till</span>
              )}
              <span className="today-more" aria-hidden="true">
                Budget ›
              </span>
            </button>
          )}

          <button type="button" className="card today-card" onClick={() => onOpen('vanor')}>
            <span className="today-label">Vanor idag</span>
            <strong className="today-amount small">
              {facts.total ? `${facts.done} av ${facts.total} klart` : 'Inga vanor än'}
            </strong>
            <span className="today-bar" aria-hidden="true">
              <span style={{ width: `${facts.total ? Math.round((facts.done / facts.total) * 100) : 0}%` }} />
            </span>
            <span className="today-meta">
              {!facts.total
                ? 'Lägg till vanor och att göra i Vanor.'
                : facts.paused
                ? 'Pausad dag, inget måste.'
                : facts.must.length
                  ? `Måste: ${facts.must.join(', ')}`
                  : 'Inget måste idag.'}
            </span>
            {facts.first && <span className="today-first">Börja med {facts.first}</span>}
          </button>

          {facts.goal && (
            <button type="button" className="card today-card" onClick={() => onOpen('goal')}>
              <span className="today-label">{facts.goal.name}</span>
              <strong className="today-amount small">{facts.goal.percent} %</strong>
              <span className="today-bar" aria-hidden="true">
                <span style={{ width: `${facts.goal.percent}%` }} />
              </span>
              <span className="today-meta">
                {facts.goal.current} av {facts.goal.target}
              </span>
              <span className="today-meta">{facts.goal.status}</span>
            </button>
          )}

          {facts.loan && (
            <button type="button" className="card today-card" onClick={() => onOpen('goal')}>
              <span className="today-label">{facts.loan.name}</span>
              <strong className="today-amount small">{facts.loan.left} kvar</strong>
              <span className="today-meta">
                Nästa betalning {facts.loan.payment} i {facts.loan.nextMonth}
              </span>
            </button>
          )}

          {facts.health && (
            <button type="button" className="card today-card" onClick={() => onOpen('vanor')}>
              <span className="today-label">Hälsa {facts.health.when}</span>
              <span className="today-rows">
                {facts.health.values.map((v) => (
                  <span key={v.metric}>
                    <span>{v.label}</span>
                    <span>{v.text}</span>
                  </span>
                ))}
              </span>
            </button>
          )}

          {facts.tasks.length > 0 && (
            <button type="button" className="card today-card" onClick={() => onOpen('vanor')}>
              <span className="today-label">Att göra idag</span>
              <span className="today-list">
                {facts.tasks.map((task) => (
                  <span key={task}>{task}</span>
                ))}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
