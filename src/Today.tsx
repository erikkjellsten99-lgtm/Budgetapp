import { useCallback, useEffect, useState } from 'react';
import { loadFacts } from './jarvis';
import { onDataChange } from './db';
import { onHabitChange } from './vanor/store';
import { longDate } from './vanor/dates';
import type { SummaryFacts } from '../supabase/functions/inbox/summary';
import { dayBrief } from '../supabase/functions/inbox/ask';

type Target = 'overview' | 'budget' | 'goal' | 'vanor' | 'nyheter';

function greeting(hour: number): string {
  if (hour < 5) return 'God natt';
  if (hour < 10) return 'God morgon';
  if (hour < 18) return 'Hej';
  return 'God kväll';
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isNegative = (amount: string) => /^[−-]/.test(amount);

/** Så många obetalda poster nämns på raden; resten blir "och 2 till". */
const UNPAID_SHOWN = 3;

/** "Hyra, El och 2 till", eller alla namn när de är få. */
function unpaidNames(unpaid: NonNullable<SummaryFacts['unpaid']>): string {
  const names = unpaid.items.slice(0, UNPAID_SHOWN).map((item) => item.name);
  const more = unpaid.items.length - names.length;
  if (more > 0) return `${names.join(', ')} och ${more} till`;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}` : names.join('');
}

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
      <div className="today-main">
        <div className="view-intro">
          <p className="eyebrow">{facts ? capitalize(longDate(facts.today)) : ' '}</p>
          <h2>{greeting(hour)}</h2>
        </div>
        {facts && <TodayHero facts={facts} onOpen={onOpen} />}
      </div>

      <div className="today-side">
        {failed && !facts && (
          <div className="group today-error" role="alert">
            <p>Det gick inte att läsa Groundwork just nu.</p>
            <button type="button" onClick={load}>
              Försök igen
            </button>
          </div>
        )}

        {!facts && !failed && (
          <div className="today-loading" aria-busy="true" aria-label="Laddar">
            <div className="hero">
              <span className="skeleton-line short" />
              <span className="skeleton-line tall" />
            </div>
            {[0, 1].map((group) => (
              <div key={group} className="group">
                <span className="skeleton-row" />
                <span className="skeleton-row" />
                <span className="skeleton-row" />
              </div>
            ))}
          </div>
        )}

        {facts && <TodayGroups facts={facts} onOpen={onOpen} />}
      </div>
    </div>
  );
}

/** Huvudsiffran och Jarvis rad. */
function TodayHero({ facts, onOpen }: { facts: SummaryFacts; onOpen: (target: Target) => void }) {
  return (
    <>
      <button type="button" className="hero" onClick={() => onOpen('overview')}>
        <span className="hero-label">Blir över i {facts.month}</span>
        <strong className={isNegative(facts.left) ? 'hero-amount negative' : 'hero-amount positive'}>{facts.left}</strong>
        <span className="hero-text">Efter utgifter och planerat sparande</span>
      </button>

      {/* Utan vanor och hälsa säger Jarvis bara "Klart idag: 0 av 0." – då visas raden inte. */}
      {(facts.total > 0 || !!facts.health) && (
        <p className="today-say">
          <span className="today-say-dot" aria-hidden="true" />
          <span>
            <span className="visually-hidden">Jarvis säger: </span>
            {dayBrief(facts, { hideMoney: true })}
          </span>
        </p>
      )}
    </>
  );
}

/** Grupperna Idag och Sparande. */
function TodayGroups({ facts, onOpen }: { facts: SummaryFacts; onOpen: (target: Target) => void }) {
  const habitValue = facts.total ? `${facts.done} av ${facts.total}` : '';
  const habitSub = facts.paused
    ? 'Pausad dag, inget måste.'
    : facts.first
      ? `Börja med ${facts.first}`
      : facts.must.length
        ? `Måste: ${facts.must.join(', ')}`
        : 'Inget måste idag.';
  const hasToday = facts.total > 0 || facts.tasks.length > 0 || !!facts.health;

  return (
    <>
      <section className="group-block" aria-labelledby="today-group-idag">
        <h3 className="group-title" id="today-group-idag">
          Idag
        </h3>
        {(hasToday || facts.unpaid) && (
          <div className="group">
            {/* Kvar att betala: det som inte är bockat som betalt i Budget den här månaden. Ingen budget: ingen rad. */}
            {facts.unpaid && (
              <button type="button" className="group-row" onClick={() => onOpen('budget')}>
                <span className="row-main">
                  <span className="row-name">Kvar att betala</span>
                  <span className="row-sub">
                    {facts.unpaid.items.length ? unpaidNames(facts.unpaid) : 'Allt är bockat som betalt i Budget.'}
                  </span>
                </span>
                <span className="row-value">{facts.unpaid.items.length ? facts.unpaid.total : 'Klart'}</span>
              </button>
            )}
            {facts.total > 0 && (
              <button type="button" className="group-row" onClick={() => onOpen('vanor')}>
                <span className="row-main">
                  <span className="row-name">Vanor</span>
                  <span className="row-sub">{habitSub}</span>
                </span>
                <span className="row-value">{habitValue}</span>
              </button>
            )}
            {facts.tasks.length > 0 && (
              <button type="button" className="group-row" onClick={() => onOpen('vanor')}>
                <span className="row-main">
                  <span className="row-name">Att göra</span>
                  <span className="row-sub">{facts.tasks.join(', ')}</span>
                </span>
                <span className="row-value">{facts.tasks.length}</span>
              </button>
            )}
            {facts.health?.values.map((v) => (
              <button key={v.metric} type="button" className="group-row" onClick={() => onOpen('vanor')}>
                <span className="row-main">
                  <span className="row-name">{v.label}</span>
                  <span className="row-sub">Hälsa {facts.health?.when}</span>
                </span>
                <span className="row-value">{v.text}</span>
              </button>
            ))}
          </div>
        )}
        {!hasToday && (
          <div className="empty">
            <p>Inga vanor eller att göra än.</p>
            <button type="button" className="primary" onClick={() => onOpen('vanor')}>
              Lägg till i Vanor
            </button>
          </div>
        )}
      </section>

      {(facts.goal || facts.loan) && (
        <section className="group-block" aria-labelledby="today-group-sparande">
          <h3 className="group-title" id="today-group-sparande">
            Sparande
          </h3>
          <div className="group">
            {facts.goal && (
              <button type="button" className="group-row" onClick={() => onOpen('goal')}>
                <span className="row-main">
                  <span className="row-name">{facts.goal.name}</span>
                  <span className="row-sub">
                    {facts.goal.current} av {facts.goal.target}
                  </span>
                  <span className="row-sub">{facts.goal.status}</span>
                </span>
                <span className="row-value">{facts.goal.percent} %</span>
              </button>
            )}
            {facts.loan && (
              <button type="button" className="group-row" onClick={() => onOpen('goal')}>
                <span className="row-main">
                  <span className="row-name">{facts.loan.name}</span>
                  <span className="row-sub">
                    Nästa betalning {facts.loan.payment} i {facts.loan.nextMonth}
                  </span>
                </span>
                <span className="row-value">{facts.loan.left} kvar</span>
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
