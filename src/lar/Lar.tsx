import { useEffect, useReducer, useRef, type Ref } from 'react';
import { larReducer, visiblePerson } from './larState';
import { AREAS, EVIDENCE_LABEL, PEOPLE, type AreaId, type Claim, type Person, type Source } from './people';
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
      <p className="lar-claim-text">{claim.text}</p>
      <div className="lar-summary">
        {claim.summary.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>
      {claim.note && <p className="lar-note">{claim.note}</p>}
      <h4 className="lar-sources-heading">{claim.sources.length === 1 ? 'Källa' : 'Källor'}</h4>
      <Links sources={claim.sources} />
    </li>
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

/** Korten i listan. Tom lista får en förklaring. */
export function LarList({
  people,
  onOpen,
  cardRef,
}: {
  people: Person[];
  onOpen: (id: string) => void;
  cardRef?: (id: string) => (el: HTMLButtonElement | null) => void;
}) {
  if (people.length === 0)
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

/** Lär: lista över personer och en sida per person. Fast innehåll ur people.ts. */
export default function Lar({ initialArea, initialOpenId }: { initialArea?: AreaId | 'alla'; initialOpenId?: string }) {
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

  if (person)
    return (
      <div className="lar">
        <PersonPage person={person} onBack={() => dispatch({ type: 'back' })} headingRef={heading} />
      </div>
    );

  return (
    <div className="lar">
      <div className="view-intro">
        <div>
          <p className="eyebrow">Bibliotek</p>
          <h2>Lär</h2>
        </div>
      </div>
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
        cardRef={(id) => (el) => void cards.current.set(id, el)}
        onOpen={(id) => {
          from.current = id;
          dispatch({ type: 'open', id });
        }}
      />
    </div>
  );
}
