// Panelerna i galaxen (CosmosView): ekonomins objekt, tidsreglaget för prognosen och rymdbasen.

import type { DateKey } from './dates'
import { holeShare, type Economy } from './economy'
import { monthName } from './progress'
import { nextMilestone, type Crew, type Milestone } from './space'
import { LIST_COLORS, TYPE_COLORS, TYPE_NAMES } from './space3d'

export type EcoId = 'hole' | 'save' | 'moons' | 'wish' | 'worth'

const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
/** "2026-10-05" → "5 okt" (med år om det inte är i år). */
export const shortDate = (d: string, today: string) =>
  `${Number(d.slice(8))} ${SHORT_MONTHS[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== today.slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}`
export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
export const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

/** Panelen för ett av ekonomins objekt. */
export function EconomyPanel({ id, economy, future, today, onBack }: { id: EcoId; economy: Economy; future: number; today: DateKey; onBack: () => void }) {
  const futurePoint = economy.timeline[Math.min(future, economy.timeline.length - 1)]
  const back = (
    <button type="button" className="gv-back" onClick={onBack}>
      Tillbaka
    </button>
  )
  if (id === 'hole')
    return (
      <section className="gv-panel gv-economy" aria-live="polite">
        <span className="gv-label">Det svarta hålet · skulder</span>
        <b className="gv-big">{economy.debtLeft > 0 ? `${kr(economy.debtLeft)} kvar` : 'Skuldfria'}</b>
        {economy.debtMax > economy.debtLeft && (
          <p className="gv-good">
            {kr(economy.debtMax - economy.debtLeft)} avbetalt sedan du öppnade galaxen första gången. Hålet har krympt med{' '}
            {Math.round((1 - holeShare(economy.debtLeft, economy.debtMax)) * 100)}&nbsp;%.
          </p>
        )}
        {economy.debts.length > 0 && (
          <ul className="gv-rows">
            {economy.debts.map((d) => (
              <li key={d.name}>
                <span>{d.name}</span>
                <b>{kr(d.amount)}</b>
              </li>
            ))}
          </ul>
        )}
        {future > 0 && futurePoint && (
          <p className="gv-future">
            Om {future} mån ({monthName(futurePoint.month, today)}):{' '}
            {futurePoint.loanLeft > 0 ? `${kr(futurePoint.loanLeft)} kvar enligt prognosen.` : 'lånet är betalt enligt prognosen.'}
          </p>
        )}
        <p>
          {economy.debtLeft === 0
            ? 'Hålet har slocknat. Kvar finns bara ljuset där det var.'
            : economy.loanPaidIn
              ? `Enligt prognosen är lånet betalt i ${economy.loanPaidIn}.`
              : 'Hålet krymper när ni betalar av, i takt med siffrorna under Konton och Prognos.'}
        </p>
        {back}
      </section>
    )
  if (id === 'save' && economy.savings) {
    const s = economy.savings
    return (
      <section className="gv-panel gv-economy" aria-live="polite">
        <span className="gv-label">En ny planet · {s.name}</span>
        <b className="gv-big">{Math.min(100, Math.floor((s.current / s.target) * 100))}&nbsp;%</b>
        <div className="gv-next">
          <span>
            <b>{kr(s.current)}</b> av {kr(s.target)}
          </span>
          <span className="gv-next-bar save" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (s.current / s.target) * 100)}%` }} />
          </span>
        </div>
        {future > 0 && futurePoint && futurePoint.goalSaved !== null && (
          <p className="gv-future">
            Om {future} mån ({monthName(futurePoint.month, today)}): {kr(futurePoint.goalSaved)},{' '}
            {Math.min(100, Math.floor((futurePoint.goalSaved / s.target) * 100))}&nbsp;% enligt Sparmål-prognosen.
          </p>
        )}
        <p>
          {s.current >= s.target
            ? 'Planeten är färdig. Målet är nått.'
            : `Stoftet samlas ihop för varje krona ni sparar. ${s.reachedIn ? `Enligt prognosen är planeten färdig i ${s.reachedIn}.` : ''}`}
        </p>
        {back}
      </section>
    )
  }
  if (id === 'moons')
    return (
      <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
        <span className="gv-label">Budgetens månar · {monthName(economy.budget.month, today)}</span>
        <b className="gv-big">
          {kr(economy.budget.paid)} <small>av {kr(economy.budget.total)} betalt</small>
        </b>
        <p>En måne per kategori, större ju större budget. Den lyser när kategorin är betald den här månaden.</p>
        <ul className="gv-rows">
          {economy.budget.moons.map((m) => (
            <li key={`${m.type}-${m.name}`} className={m.paid >= m.budget ? 'is-paid' : undefined}>
              <span>
                <i className="gv-dot" style={{ background: TYPE_COLORS[m.type] }} aria-hidden="true" />
                {m.name} <em>{TYPE_NAMES[m.type]}</em>
              </span>
              <b>
                {m.paid >= m.budget ? '✓ ' : m.paid > 0 ? `${kr(m.paid)} av ` : ''}
                {kr(m.budget)}
              </b>
            </li>
          ))}
        </ul>
        <p>
          {economy.extraPerMonth >= 0
            ? `Det blir ${kr(economy.extraPerMonth)} över att spara extra i månaden.`
            : `Budgeten går ${kr(-economy.extraPerMonth)} back i månaden.`}
        </p>
        {back}
      </section>
    )
  if (id === 'wish')
    return (
      <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
        <span className="gv-label">Önskelistan · kometer</span>
        <b className="gv-big">
          {economy.wishes.length} {economy.wishes.length === 1 ? 'önskan' : 'önskningar'}
        </b>
        <p>
          {economy.extraPerMonth > 0
            ? `Det som ryms i månadens överskott (${kr(economy.extraPerMonth)}) är nära kärnan. Ju fler månader en önskan kostar, desto längre ut ligger kometen.`
            : 'Inget blir över i budgeten den här månaden, så alla kometer ligger långt ute.'}
        </p>
        {economy.wishes.length > 0 ? (
          <ul className="gv-rows">
            {economy.wishes.map((w) => (
              <li key={`${w.list}-${w.name}`} className={w.months !== null && w.months <= 1 ? 'is-paid' : undefined}>
                <span>
                  <i className="gv-dot" style={{ background: LIST_COLORS[w.list] }} aria-hidden="true" />
                  {w.name}
                  <em>{w.months === null ? '' : w.months <= 1 ? 'ryms nu' : `≈ ${Math.ceil(w.months)} mån`}</em>
                </span>
                <b>{kr(w.amount)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p>Önskelistan är tom.</p>
        )}
        <p className="gv-legend">
          <i className="gv-dot" style={{ background: LIST_COLORS.erik }} aria-hidden="true" /> Erik{' '}
          <i className="gv-dot" style={{ background: LIST_COLORS.cassandra }} aria-hidden="true" /> Cassandra
        </p>
        {back}
      </section>
    )
  return (
    <section className="gv-panel gv-economy gv-scroll" aria-live="polite">
      <span className="gv-label">Tillgångar · galaxens sken</span>
      <b className="gv-big">{kr(economy.worth.net)}</b>
      <p>Nettot: det ni äger minus lånet. Hela galaxen lyser starkare ju större det blir.</p>
      <ul className="gv-rows">
        {economy.worth.assets.map((a) => (
          <li key={a.name}>
            <span>{a.name}</span>
            <b>{kr(a.amount)}</b>
          </li>
        ))}
        {economy.worth.loan > 0 && (
          <li>
            <span>Lån</span>
            <b>− {kr(economy.worth.loan)}</b>
          </li>
        )}
      </ul>
      {back}
    </section>
  )
}

/** Tidsreglaget: visa ekonomin som prognosen säger att den ser ut om några månader. */
export function TimeSlider({ economy, future, setFuture, today }: { economy: Economy; future: number; setFuture: (k: number) => void; today: DateKey }) {
  if (economy.timeline.length <= 1) return null
  const point = economy.timeline[Math.min(future, economy.timeline.length - 1)]
  return (
    <div className={future > 0 ? 'gv-time is-future' : 'gv-time'}>
      <div className="gv-time-head">
        <label htmlFor="cv-time">Tid</label>
        <b>{future === 0 ? 'Nu' : `${capital(monthName(point.month, today))} · om ${future} mån`}</b>
        {future > 0 && (
          <button type="button" className="gv-time-now" onClick={() => setFuture(0)}>
            Tillbaka till nu
          </button>
        )}
      </div>
      <input
        id="cv-time"
        type="range"
        min={0}
        max={economy.timeline.length - 1}
        step={1}
        value={future}
        onChange={(e) => setFuture(Number(e.target.value))}
        aria-valuetext={future === 0 ? 'Nu' : `Om ${future} månader`}
      />
      {future > 0 && (
        <p className="gv-time-sum">
          Prognos: {point.loanLeft > 0 ? `lånet ${kr(point.loanLeft)} kvar` : 'lånet betalt'}
          {economy.savings && point.goalSaved !== null ? ` · sparmålet ${Math.min(100, Math.floor((point.goalSaved / economy.savings.target) * 100))} %` : ''}
          {` · netto ${kr(point.net)}`}
        </p>
      )}
    </div>
  )
}

/** Rymdbasen: modulerna och arbetslaget (en astronaut per vana). */
export function BasePanel({ milestones, crew, crewSel, today }: { milestones: Milestone[]; crew: Crew; crewSel: number | null; today: DateKey }) {
  const built = milestones.filter((m) => m.done).length
  const next = nextMilestone(milestones)
  return (
    <section className="gv-panel gv-base gv-scroll" aria-live="polite">
      <span className="gv-label">Rymdbasen</span>
      <b className="gv-big">
        {built} av {milestones.length} moduler
      </b>
      {next?.progress && (
        <div className="gv-next">
          <span>
            Nästa: <b>{next.module}</b> vid {next.title.toLowerCase()}
          </span>
          <span className="gv-next-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.round((next.progress.now / next.progress.target) * 100))}%` }} />
          </span>
          <span className="gv-next-num">
            {Math.min(next.progress.now, next.progress.target)} av {next.progress.target} {next.progress.unit}
          </span>
        </div>
      )}
      <div className="gv-crew">
        <span className="gv-crew-title">
          Arbetslaget
          {crew.celebrate ? ' · modulen blev klar idag!' : crew.paused ? ' · vilar inne idag (pausad dag)' : ''}
        </span>
        {crew.members.length === 0 ? (
          <p className="gv-crew-empty">Lägg till en vana så får den en egen astronaut.</p>
        ) : (
          <ul>
            {crew.members.map((m, i) => (
              <li key={m.id} className={[m.working && !crew.paused ? 'working' : '', crewSel === i ? 'sel' : ''].join(' ').trim() || undefined}>
                <span className="gv-crew-dot" aria-hidden="true" />
                <span>
                  <b>{m.name}</b>
                  <small>{crew.paused ? 'Vilar inne idag' : m.working ? 'Ute och bygger – bockad idag' : 'Inne i basen – kommer ut när du bockar av'}</small>
                </span>
                <span className="gv-crew-streak">{m.streak > 0 ? `${m.streak} ${m.streak === 1 ? 'dag' : 'dagar'} i rad` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {crew.extra > 0 && !crew.paused && (
          <p className="gv-crew-extra">
            +{crew.extra} extra byggare för din serie på {Math.max(...crew.members.map((m) => m.streak))} dagar i rad (en ny var sjunde dag).
          </p>
        )}
      </div>
      <ol className="gv-modules">
        {milestones.map((m) => (
          <li key={m.id} className={m.done ? 'done' : undefined}>
            <span className="gv-module-check" aria-hidden="true">
              {m.done ? '✓' : ''}
            </span>
            <span>
              <b>{m.module}</b> · {m.title}
            </span>
            <span className="gv-module-date">{m.done ? shortDate(m.done, today) : ''}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
