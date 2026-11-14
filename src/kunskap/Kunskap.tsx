import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EXAMPLE_CARDS, SUGGESTED, TYPE_LABEL, type KunskapCard } from './cards';
import { askAboutCard, QUESTION_MAX, TURNS_BACK, type ChatTurn } from './chatApi';
import { cleanName, feed, FILTERS, isFollowed, NAME_MAX, parseTopics, voteMap, waiting, type Filter, type FollowedPerson } from './kunskapState';
import { follow, unfollow, useKunskap, vote } from './kunskapStore';
import './kunskap.css';

const ICON = {
  up: 'M7 10v10H4V10h3zm0 0 4.2-6.3a1.6 1.6 0 0 1 2.9 1.2L13.4 10H18a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.8 20H7',
  down: 'M17 14V4h3v10h-3zm0 0-4.2 6.3a1.6 1.6 0 0 1-2.9-1.2l.7-5.1H6a2 2 0 0 1-2-2.4l1.2-6A2 2 0 0 1 7.2 4H17',
  chat: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z',
  close: 'M6 6l12 12M18 6 6 18',
};

function Icon({ d }: { d: string }) {
  return (
    <svg className="kunskap-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Kortets innehåll: citat med översättning, insikt eller protokoll i steg. Används i flödet och i chatten. */
function CardBody({ card }: { card: KunskapCard }) {
  if (card.type === 'citat')
    return (
      <>
        <blockquote className="kunskap-quote" lang="en">
          <p>{card.text}</p>
        </blockquote>
        {card.sv && <p className="kunskap-sv">{card.sv}</p>}
      </>
    );
  if (card.type === 'protokoll')
    return (
      <>
        <ol className="kunskap-steps">
          {(card.steps ?? []).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {card.warning && (
          <p className="kunskap-warning" role="note">
            <strong>Var försiktig. </strong>
            {card.warning}
          </p>
        )}
      </>
    );
  return <p className="kunskap-text">{card.text}</p>;
}

function CardMeta({ card }: { card: KunskapCard }) {
  return (
    <p className="kunskap-meta">
      <span className={`kunskap-type ${card.type}`}>{TYPE_LABEL[card.type]}</span>
      <span className="kunskap-topic">{card.topic}</span>
      {card.label && <span className="kunskap-label">{card.label}</span>}
    </p>
  );
}

function SourceLine({ card }: { card: KunskapCard }) {
  return (
    <p className="kunskap-source">
      Källa:{' '}
      <a href={card.source.url} target="_blank" rel="noopener noreferrer">
        {card.source.title}
        <span className="visually-hidden"> (öppnas i ny flik)</span>
      </a>
    </p>
  );
}

export function CardView({
  card,
  value,
  onVote,
  onDeeper,
}: {
  card: KunskapCard;
  value?: 1 | -1;
  onVote: (pressed: 1 | -1) => void;
  onDeeper: () => void;
}) {
  return (
    <article className="card kunskap-card" aria-label={`${TYPE_LABEL[card.type]} från ${card.person}`}>
      <CardMeta card={card} />
      <CardBody card={card} />
      <p className="kunskap-person">{card.person}</p>
      <SourceLine card={card} />
      <div className="kunskap-actions">
        <button type="button" className={value === 1 ? 'kunskap-vote liked' : 'kunskap-vote'} aria-pressed={value === 1} onClick={() => onVote(1)}>
          <Icon d={ICON.up} />
          Gilla
        </button>
        <button type="button" className={value === -1 ? 'kunskap-vote disliked' : 'kunskap-vote'} aria-pressed={value === -1} onClick={() => onVote(-1)}>
          <Icon d={ICON.down} />
          Ogilla
        </button>
        <button type="button" className="kunskap-deeper" onClick={onDeeper}>
          <Icon d={ICON.chat} />
          Gå djupare
        </button>
      </div>
    </article>
  );
}

/** Ark som glider upp nerifrån. Stängs med Escape, krysset eller ett tryck utanför. */
function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);
  return (
    <div className="kunskap-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'kunskap-sheet chat' : 'kunskap-sheet'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="kunskap-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="kunskap-close" onClick={onClose} aria-label="Stäng">
            <Icon d={ICON.close} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Personer att följa: listan, formuläret (namn och ämnen) och förslag. */
function PeopleSheet({ people, onClose }: { people: FollowedPerson[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [topics, setTopics] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const suggestions = SUGGESTED.filter((s) => !isFollowed(people, s.name));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!cleanName(name)) return setError('Skriv ett namn.');
    if (isFollowed(people, name)) return setError('Du följer redan den personen.');
    setBusy(true);
    try {
      await follow(name, topics);
      setName('');
      setTopics('');
      setError(null);
      nameRef.current?.focus();
    } catch {
      setError('Det gick inte att spara. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Personer du följer" onClose={onClose}>
      {people.length === 0 ? (
        <p className="kunskap-hint">Du följer ingen än. Lägg till en person nedan eller välj bland förslagen.</p>
      ) : (
        <ul className="kunskap-people">
          {people.map((p) => (
            <li key={p.id}>
              <div>
                <span className="kunskap-people-name">{p.name}</span>
                {p.topics.length > 0 && <span className="kunskap-people-topics">{p.topics.join(', ')}</span>}
              </div>
              <button type="button" className="kunskap-remove" onClick={() => void unfollow(p.id)} aria-label={`Sluta följa ${p.name}`}>
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="kunskap-form" onSubmit={add} noValidate>
        <h3>Lägg till person</h3>
        <label>
          <span>Namn</span>
          <input
            ref={nameRef}
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            placeholder="Susanna Søberg"
            aria-invalid={!!error}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>
        <label>
          <span>Ämnen, med komma emellan</span>
          <input value={topics} maxLength={200} autoComplete="off" placeholder="bastu, kallbad" onChange={(e) => setTopics(e.target.value)} />
        </label>
        {parseTopics(topics).length > 0 && (
          <p className="kunskap-tags" aria-label="Ämnen som sparas">
            {parseTopics(topics).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </p>
        )}
        {error && (
          <p className="kunskap-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          Följ
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="kunskap-suggest">
          <h3>Förslag</h3>
          <p className="kunskap-hint">De här har redan kort i flödet.</p>
          <div className="kunskap-suggest-list">
            {suggestions.map((s) => (
              <button key={s.name} type="button" className="chip" onClick={() => void follow(s.name, s.topics)}>
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

const STARTERS = ['Vad säger forskningen?', 'Hur gör jag i praktiken?', 'Vad talar emot?'];

type Message = { from: 'du' | 'claude'; text: string; error?: boolean };

/** Gå djupare: en chatt med Claude om just det här kortet. Samtalet glöms när arket stängs. */
function ChatSheet({ card, onClose }: { card: KunskapCard; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, busy]);

  async function ask(text: string) {
    const question = text.trim().slice(0, QUESTION_MAX);
    if (!question || busy) return;
    setBusy(true);
    setInput('');
    setMessages((m) => [...m, { from: 'du', text: question }]);
    const reply = await askAboutCard(card, question, turns);
    if (!alive.current) return;
    setMessages((m) => [...m, reply.ok ? { from: 'claude', text: reply.answer } : { from: 'claude', text: reply.message, error: true }]);
    if (reply.ok) setTurns((t) => [...t, { question, answer: reply.answer }].slice(-TURNS_BACK));
    setBusy(false);
  }

  return (
    <Sheet title="Gå djupare" onClose={onClose} wide>
      <div className="kunskap-chat-scroll">
        <div className="kunskap-chat-card">
          <CardMeta card={card} />
          <CardBody card={card} />
          <p className="kunskap-person">{card.person}</p>
          <SourceLine card={card} />
        </div>
        {messages.length === 0 && (
          <div className="kunskap-starters">
            <p className="kunskap-hint">Fråga Claude om kortet, eller börja med en av de här:</p>
            {STARTERS.map((s) => (
              <button key={s} type="button" className="chip" disabled={busy} onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="kunskap-messages" aria-live="polite">
          {messages.map((m, i) => (
            <p key={i} className={`kunskap-msg ${m.from}${m.error ? ' error' : ''}`}>
              <span className="visually-hidden">{m.from === 'du' ? 'Du: ' : 'Claude: '}</span>
              {m.text}
            </p>
          ))}
          {busy && (
            <p className="kunskap-msg claude thinking" aria-label="Claude skriver">
              <span />
              <span />
              <span />
            </p>
          )}
        </div>
        <div ref={endRef} />
      </div>
      <form
        className="kunskap-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          maxLength={QUESTION_MAX}
          placeholder="Skriv en fråga"
          aria-label="Din fråga"
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="primary" disabled={busy || !input.trim()}>
          Skicka
        </button>
      </form>
      <p className="kunskap-chat-note">Svaren kommer från Claude och kan innehålla fel. Kontrollera mot källan.</p>
    </Sheet>
  );
}

/** Kunskap: ett flöde av korta kort från personer du följer, med gilla/ogilla och en chatt per kort. */
export default function Kunskap({ initialFilter = 'alla' }: { initialFilter?: Filter }) {
  const { data, failed } = useKunskap();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [managing, setManaging] = useState(false);
  const [chat, setChat] = useState<KunskapCard | null>(null);

  const people = data?.people ?? [];
  const votes = voteMap(data?.votes ?? []);
  const cards = feed(EXAMPLE_CARDS, people, votes, filter);
  const pending = waiting(EXAMPLE_CARDS, people);

  return (
    <div className="kunskap">
      <div className="view-intro">
        <div>
          <p className="eyebrow">Flöde</p>
          <h2>Kunskap</h2>
        </div>
        <button type="button" className="kunskap-manage" onClick={() => setManaging(true)}>
          {people.length === 0 ? 'Följ personer' : `Följer ${people.length}`}
        </button>
      </div>
      <nav className="kunskap-chips" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={f.id === filter ? 'chip active' : 'chip'} aria-pressed={f.id === filter} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </nav>

      {failed ? (
        <div className="empty" role="alert">
          <p>Det gick inte att läsa det som sparats i telefonen. Stäng appen helt och öppna den igen.</p>
        </div>
      ) : !data ? (
        <div className="kunskap-feed" aria-busy="true" aria-label="Laddar">
          <div className="card kunskap-skeleton" />
          <div className="card kunskap-skeleton" />
        </div>
      ) : (
        <>
          {people.length === 0 && filter !== 'gillade' && (
            <p className="kunskap-notice">Du följer ingen än, så här visas exempelkort från alla. Följ personer för att få ditt eget flöde.</p>
          )}
          {pending.length > 0 && filter !== 'gillade' && (
            <p className="kunskap-notice">
              Inga kort än för {pending.map((p) => p.name).join(', ')}. De får kort när genereringen är påkopplad.
            </p>
          )}
          {cards.length === 0 ? (
            <div className="empty">
              <p>
                {filter === 'gillade'
                  ? 'Du har inte gillat något kort än.'
                  : filter === 'alla'
                    ? 'Inga kort att visa än.'
                    : 'Inga kort av den här typen från dem du följer.'}
              </p>
              {filter !== 'gillade' && (
                <button type="button" onClick={() => setManaging(true)}>
                  Följ fler personer
                </button>
              )}
            </div>
          ) : (
            <div className="kunskap-feed">
              {cards.map((card) => (
                <CardView
                  key={card.id}
                  card={card}
                  value={votes.get(card.id)}
                  onVote={(pressed) => void vote(card, pressed)}
                  onDeeper={() => setChat(card)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {managing && <PeopleSheet people={people} onClose={() => setManaging(false)} />}
      {chat && <ChatSheet card={chat} onClose={() => setChat(null)} />}
    </div>
  );
}
