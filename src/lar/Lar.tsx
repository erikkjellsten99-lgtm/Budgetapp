import { useEffect, useReducer, useRef, type Ref } from 'react';
import { larReducer, visiblePerson } from './larState';
import { AREAS, EVIDENCE_LABEL, PEOPLE, type AreaId, type Claim, type Person, type Quote, type Source } from './people';
import './lar.css';

const areaLabel = (id: AreaId) => AREAS.find((a) => a.id === id)?.label ?? id;

function SourceLink({ source }: { source: Source }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.title}
      <span className="visually-hidden"> (öppnas i ny flik)</span>
    </a>
  );
}

function Links({ sources }: { sources: Source[] }) {
  return (
    <ul className="lar-links">
      {sources.map((s) => (
        <li key={s.url}>
          <SourceLink source={s} />
        </li>
      ))}
    </ul>
  );
}

/** Ett påstående som en enhet: märkning, rubrik, sammanfattning, förbehåll och källor. */
function ClaimItem({ claim }: { claim: Claim }) {
  return (
    <li className="lar-claim">
      <span className={`lar-evidence ${claim.evidence}`}>{EVIDENCE_LABEL[claim.evidence]}</span>
      <h4 className="lar-claim-text">{claim.text}</h4>
      <div className="lar-summary">
        {claim.summary.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>
      {claim.note && <p className="lar-note">{claim.note}</p>}
      <p className="lar-sources-heading">{claim.sources.length === 1 ? 'Källa' : 'Källor'}</p>
      <Links sources={claim.sources} />
    </li>
  );
}

/** Citat: ordagrant på originalspråket, svensk översättning och källa. Tom lista ger ingen sektion. */
export function QuoteSection({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) return null;
  return (
    <section className="card lar-section">
      <h3>Citat</h3>
      <div className="lar-quotes">
        {quotes.map((q) => (
          <figure key={q.text} className="lar-quote">
            <blockquote lang="en">
              <p>{q.text}</p>
            </blockquote>
            <p className="lar-quote-sv">
              <span className="lar-quote-label">Översättning:</span> {q.sv}
            </p>
            <figcaption>
              <SourceLink source={q.source} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Börja här: varje titel följs av sina huvudpunkter, synliga utan klick. */
function StartHere({ sources }: { sources: Source[] }) {
  return (
    <ul className="lar-start">
      {sources.map((s) => (
        <li key={s.url} className="lar-start-item">
          <SourceLink source={s} />
          {s.summary && s.summary.length > 0 && (
            <ul className="lar-points">
              {s.summary.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** En person som visas i listan men inte hör till det fasta innehållet (tillagd av användaren i Kunskap). */
export type ExtraPerson = { id: string; name: string; kind: string; teaser: string };

/** Korten i listan. `extra` visas i samma lista, efter de fasta. Tom lista får en förklaring. */
export function LarList({
  people,
  onOpen,
  cardRef,
  extra = [],
  onOpenExtra,
}: {
  people: Person[];
  onOpen: (id: string) => void;
  cardRef?: (id: string) => (el: HTMLButtonElement | null) => void;
  extra?: ExtraPerson[];
  onOpenExtra?: (id: string) => void;
}) {
  if (people.length + extra.length === 0)
    return (
      <div className="empty">
        <p>Inga personer i det här området än.</p>
      </div>
    );
  return (
    <div className="lar-list">
      {people.map((p) => (
        <button key={p.id} type="button" className="card lar-card" ref={cardRef?.(p.id)} onClick={() => onOpen(p.id)}>
          <span className="lar-card-name">{p.name}</span>
          <span className="lar-kind">{p.kind}</span>
          <span className="lar-teaser">{p.teaser}</span>
        </button>
      ))}
      {extra.map((p) => (
        <button key={`extra-${p.id}`} type="button" className="card lar-card" onClick={() => onOpenExtra?.(p.id)}>
          <span className="lar-card-name">{p.name}</span>
          <span className="lar-kind">{p.kind}</span>
          <span className="lar-teaser">{p.teaser}</span>
        </button>
      ))}
    </div>
  );
}

function PersonPage({
  person,
  onBack,
  headingRef,
}: {
  person: Person;
  onBack: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <article className="lar-person">
      <button type="button" className="lar-back" onClick={onBack}>
        Tillbaka
      </button>
      <div className="view-intro">
        <div>
          <p className="eyebrow">{[person.kind, ...person.areas.map(areaLabel)].join(', ')}</p>
          <h2 tabIndex={-1} ref={headingRef}>
            {person.name}
          </h2>
        </div>
      </div>
      <p className="lar-about">{person.about}</p>
      {person.warning && (
        <p className="lar-warning" role="note">
          <strong>Var försiktig. </strong>
          {person.warning}
        </p>
      )}
      <section className="card lar-section">
        <h3>Metod</h3>
        <ul className="lar-method">
          {person.method.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      <QuoteSection quotes={person.quotes} />
      <section className="card lar-section">
        <h3>Påståenden</h3>
        <ul className="lar-claims">
          {person.claims.map((c) => (
            <ClaimItem key={c.text} claim={c} />
          ))}
        </ul>
      </section>
      <section className="card lar-section">
        <h3>Börja här</h3>
        <StartHere sources={person.startHere} />
      </section>
    </article>
  );
}

/**
 * Lär: lista över personer och en sida per person. Fast innehåll ur people.ts. Visas som biblioteket i Kunskap
 * (`embedded`: utan egen rubrik). `onBack` tar över Tillbaka på personsidan (när sidan öppnats från ett kort),
 * och `onOpenChange` säger till när en personsida visas. `extra` är personer som lagts till i Kunskap.
 */
export default function Lar({
  initialArea,
  initialOpenId,
  embedded,
  onBack,
  onOpenChange,
  extra,
  onOpenExtra,
}: {
  initialArea?: AreaId | 'alla';
  initialOpenId?: string;
  embedded?: boolean;
  onBack?: () => void;
  onOpenChange?: (open: boolean) => void;
  /** Personer som användaren lagt till själv i Kunskap. Visas i samma lista under Alla (de har inget område). */
  extra?: ExtraPerson[];
  onOpenExtra?: (id: string) => void;
}) {
  const [state, dispatch] = useReducer(larReducer, { area: initialArea ?? 'alla', openId: initialOpenId ?? null });
  const person = visiblePerson(state);
  const cards = useRef(new Map<string, HTMLButtonElement | null>());
  const from = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = PEOPLE.filter((p) => state.area === 'alla' || p.areas.includes(state.area));

  useEffect(() => {
    if (person) {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    } else if (from.current) {
      cards.current.get(from.current)?.focus();
      from.current = null;
    }
  }, [person]);

  const open = !!person;
  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  if (person)
    return (
      <div className="lar">
        <PersonPage person={person} onBack={onBack ?? (() => dispatch({ type: 'back' }))} headingRef={heading} />
      </div>
    );

  return (
    <div className="lar">
      {!embedded && (
        <div className="view-intro">
          <div>
            <p className="eyebrow">Bibliotek</p>
            <h2>Lär</h2>
          </div>
        </div>
      )}
      <nav className="lar-chips" aria-label="Områden">
        {[{ id: 'alla' as const, label: 'Alla' }, ...AREAS].map((a) => (
          <button
            key={a.id}
            type="button"
            className={a.id === state.area ? 'chip active' : 'chip'}
            aria-pressed={a.id === state.area}
            onClick={() => dispatch({ type: 'filter', area: a.id })}
          >
            {a.label}
          </button>
        ))}
      </nav>
      <LarList
        people={shown}
        extra={state.area === 'alla' ? extra : []}
        onOpenExtra={onOpenExtra}
        cardRef={(id) => (el) => void cards.current.set(id, el)}
        onOpen={(id) => {
          from.current = id;
          dispatch({ type: 'open', id });
        }}
      />
    </div>
  );
}
