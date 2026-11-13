import { useEffect, useReducer, useRef, type Ref } from 'react';
import { larReducer, visiblePerson } from './larState';
import { AREAS, EVIDENCE_LABEL, PEOPLE, type AreaId, type Person, type Source } from './people';
import './lar.css';

const areaLabel = (id: AreaId) => AREAS.find((a) => a.id === id)?.label ?? id;

function Links({ sources }: { sources: Source[] }) {
  return (
    <ul className="lar-links">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.title}
            <span className="visually-hidden"> (öppnas i ny flik)</span>
          </a>
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
            <li key={c.text} className="lar-claim">
              <span className={`lar-evidence ${c.evidence}`}>{EVIDENCE_LABEL[c.evidence]}</span>
              <p>{c.text}</p>
              {c.note && <p className="lar-note">{c.note}</p>}
              <Links sources={c.sources} />
            </li>
          ))}
        </ul>
      </section>
      <section className="card lar-section">
        <h3>Börja här</h3>
        <Links sources={person.startHere} />
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
