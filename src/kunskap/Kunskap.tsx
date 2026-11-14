import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Lar from '../lar/Lar';
import { PEOPLE } from '../lar/people';
import { EXAMPLE_CARDS, SUGGESTED, TYPE_LABEL, type KunskapCard } from './cards';
import { discover, GENRES } from './discover';
import { askAboutCard, QUESTION_MAX, TURNS_BACK, type ChatTurn } from './chatApi';
import {
  COUNT_MAX,
  MAX_BATCHES_PER_DAY,
  PREF_LABEL_MAX,
  prefKey,
  MAX_SEARCHES_PER_DAY,
  type Batch,
  type FoundPerson,
  type Frequency,
  type KunskapPrefs,
  type KunskapSettings,
  type ManualLevel,
  type PrefKind,
  type Weight,
} from '../../supabase/functions/kunskap-generera/shared.ts';
import {
  allCards,
  batchLog,
  cardsOf,
  cleanName,
  describeWeight,
  feed,
  FILTERS,
  formatUsd,
  formatWhen,
  isFollowed,
  monthCost,
  moreKind,
  NAME_MAX,
  ownPeople,
  sessionOrder,
  parseTopics,
  personKey,
  tasteOf,
  voteMap,
  waiting,
  withManual,
  type Filter,
  type FollowedPerson,
  type MoreKind,
  type Vote,
} from './kunskapState';
import {
  follow,
  generateNow,
  savePrefs,
  saveSettings,
  searchPeople,
  unfollow,
  useKunskap,
  vote,
  writeProfile,
  type GenerateReply,
  type SearchReply,
} from './kunskapStore';
import './kunskap.css';

const ICON = {
  up: 'M7 10v10H4V10h3zm0 0 4.2-6.3a1.6 1.6 0 0 1 2.9 1.2L13.4 10H18a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.8 20H7',
  down: 'M17 14V4h3v10h-3zm0 0-4.2 6.3a1.6 1.6 0 0 1-2.9-1.2l.7-5.1H6a2 2 0 0 1-2-2.4l1.2-6A2 2 0 0 1 7.2 4H17',
  chat: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z',
  close: 'M6 6l12 12M18 6 6 18',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  taste: 'M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z',
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
        <blockquote className="kunskap-quote" lang={card.sv ? (card.created ? undefined : 'en') : 'sv'}>
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
      {card.discovery && <span className="kunskap-type upptackt">Upptäckt</span>}
      <span className="kunskap-topic">{card.topic}</span>
      {card.label && <span className="kunskap-label">{card.label}</span>}
      {card.verified && <span className="kunskap-label">Ordagrant ur källan</span>}
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
  onFollow,
  onPerson,
}: {
  card: KunskapCard;
  value?: 1 | -1;
  onVote: (pressed: 1 | -1) => void;
  onDeeper: () => void;
  /** Finns bara på upptäcktskort om en person du inte följer. */
  onFollow?: () => void;
  /** Finns när personen har en sida i biblioteket. */
  onPerson?: () => void;
}) {
  return (
    <article className="card kunskap-card" aria-label={`${TYPE_LABEL[card.type]} från ${card.person}`}>
      <CardMeta card={card} />
      <CardBody card={card} />
      <p className="kunskap-person">
        {onPerson ? (
          <button type="button" className="kunskap-person-link" onClick={onPerson}>
            {card.person}
            <span className="visually-hidden">, öppna i biblioteket</span>
          </button>
        ) : (
          card.person
        )}
        {onFollow && (
          <button type="button" className="kunskap-follow" onClick={onFollow}>
            Följ
            <span className="visually-hidden"> {card.person}</span>
          </button>
        )}
      </p>
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
      <p className="kunskap-hint">
        Alla i biblioteket följs från början. Ta bort dem du inte vill ha kort om, och lägg till andra nedan.
      </p>
      {people.length === 0 ? (
        <p className="kunskap-hint">Du följer ingen just nu. Lägg till en person nedan eller välj bland förslagen.</p>
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
          <p className="kunskap-hint">De här finns i biblioteket och har redan kort i flödet.</p>
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

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'av', label: 'Av' },
  { id: 'dag', label: 'Varje dag' },
  { id: 'vecka', label: 'Varje vecka' },
];

const STATUS: Record<Batch['status'], string> = { pagar: 'Pågår', klar: 'Klar', fel: 'Misslyckades' };
const tokens = (n: number) => n.toLocaleString('sv-SE');

/** Inställningar för genereringen, knappen Generera nu och kostnadsloggen per batch. */
function SettingsSheet({
  settings,
  batches,
  hasPeople,
  onClose,
}: {
  settings: KunskapSettings;
  batches: Batch[];
  hasPeople: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // Egen kopia, så att två snabba tryck på plus blir två steg och inte ett (inställningen kommer tillbaka först efter sparningen).
  const [draft, setDraft] = useState(settings);
  const latest = useRef(settings);
  function change(part: Partial<Pick<KunskapSettings, 'frequency' | 'count' | 'auto'>>) {
    latest.current = { ...latest.current, ...part };
    setDraft(latest.current);
    void saveSettings(latest.current);
  }
  const now = Date.now();
  const log = batchLog(batches, now);
  const thisMonth = monthCost(batches, now);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const reply = await generateNow();
    if (!alive.current) return;
    setBusy(false);
    setResult(
      reply.ok
        ? { text: `${reply.cards === 1 ? '1 nytt kort' : `${reply.cards} nya kort`}. Batchen kostade ${formatUsd(reply.costUsd)}.`, error: false }
        : { text: reply.message, error: true },
    );
  }

  return (
    <Sheet title="Nya kort" onClose={onClose}>
      <p className="kunskap-hint">
        Korten görs på servern av Claude med webbsökning, från dem du följer. Varje kort får en källa, och citat som inte står
        ordagrant i källan görs om till insikter. Ungefär vart femte kort är en upptäckt: en ny person eller ett nytt ämne nära
        det du gillar. Varje batch kostar pengar, se nedan.
      </p>
      <fieldset className="kunskap-field">
        <legend>Hur ofta</legend>
        <div className="kunskap-segment">
          {FREQUENCIES.map((f) => (
            <label key={f.id} className={f.id === draft.frequency ? 'active' : undefined}>
              <input
                type="radio"
                name="kunskap-frequency"
                className="visually-hidden"
                checked={f.id === draft.frequency}
                onChange={() => change({ frequency: f.id })}
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="kunskap-field">
        <span id="kunskap-count-label">Kort per batch</span>
        <div className="kunskap-stepper" role="group" aria-labelledby="kunskap-count-label">
          <button type="button" aria-label="Färre kort" disabled={draft.count <= 1} onClick={() => change({ count: Math.max(1, latest.current.count - 1) })}>
            −
          </button>
          <output aria-live="polite">{draft.count}</output>
          <button
            type="button"
            aria-label="Fler kort"
            disabled={draft.count >= COUNT_MAX}
            onClick={() => change({ count: Math.min(COUNT_MAX, latest.current.count + 1) })}
          >
            +
          </button>
        </div>
      </div>
      <label className="kunskap-check">
        <input type="checkbox" checked={draft.auto} onChange={(e) => change({ auto: e.target.checked })} />
        <span>
          Hämta nya kort när jag bläddrar
          <small>När du bläddrat förbi de nya korten görs en omgång till, högst {MAX_BATCHES_PER_DAY} per dygn. Varje omgång kostar.</small>
        </span>
      </label>
      <div className="kunskap-generate">
        <button type="button" className="primary" disabled={busy || !hasPeople} onClick={() => void run()}>
          {busy ? 'Genererar …' : 'Generera nu'}
        </button>
        {busy && <p className="kunskap-hint">Det tar upp till ett par minuter. Du kan stänga arket under tiden.</p>}
        {!hasPeople && <p className="kunskap-hint">Följ minst en person först.</p>}
        {result && (
          <p className={result.error ? 'kunskap-error' : 'kunskap-ok'} role={result.error ? 'alert' : 'status'}>
            {result.text}
          </p>
        )}
      </div>
      <section className="kunskap-cost" aria-labelledby="kunskap-cost-title">
        <h3 id="kunskap-cost-title">Kostnad</h3>
        {log.length === 0 ? (
          <p className="kunskap-hint">Ingen batch har körts än. Här visas token, sökningar och kostnad för varje batch.</p>
        ) : (
          <>
            <p className="kunskap-cost-sum">
              Den här månaden: <strong>{formatUsd(thisMonth)}</strong>
            </p>
            <ul className="kunskap-batches">
              {log.slice(0, 20).map((b) => (
                <li key={b.id}>
                  <p className="kunskap-batch-head">
                    <span>{formatWhen(b.created)}</span>
                    <strong>{formatUsd(b.costUsd)}</strong>
                  </p>
                  <p className={b.status === 'fel' || b.stale ? 'kunskap-batch-line bad' : 'kunskap-batch-line'}>
                    {b.trigger === 'schema'
                      ? 'Schemat'
                      : b.search
                        ? `Sökning efter personer inom ${b.person ?? 'en genre'}`
                        : b.trigger === 'profil'
                          ? `Presentation av ${b.person ?? 'en person'}`
                          : 'Manuellt'}
                    {': '}
                    {b.stale ? 'avbröts' : STATUS[b.status].toLowerCase()}
                    {b.status === 'klar' && b.trigger !== 'profil' && `, ${b.cards} kort`}
                    {b.status === 'klar' && !!b.discovery && `, varav ${b.discovery} upptäckt`}
                    {b.status === 'klar' && b.quotesVerified + b.quotesRewritten > 0 && ` (${b.quotesVerified} citat bekräftade, ${b.quotesRewritten} omskrivna)`}
                    {b.status === 'fel' && b.error ? `. ${b.error}` : ''}
                  </p>
                  <p className="kunskap-batch-line">
                    {tokens(b.usage.input + b.usage.cacheRead + b.usage.cacheWrite)} token in, {tokens(b.usage.output)} ut, {b.usage.searches}{' '}
                    {b.usage.searches === 1 ? 'sökning' : 'sökningar'}
                  </p>
                </li>
              ))}
            </ul>
            <p className="kunskap-hint">Räknat med listpriser. Fakturan från Anthropic är det som gäller.</p>
          </>
        )}
      </section>
    </Sheet>
  );
}

const GROUPS: { kind: PrefKind; title: string; empty: string }[] = [
  { kind: 'person', title: 'Personer', empty: 'Följ någon eller rösta på ett kort, så fylls listan.' },
  { kind: 'topic', title: 'Ämnen', empty: 'Inga ämnen än. Rösta på kort eller lägg till ett ämne nedan.' },
  { kind: 'type', title: 'Korttyper', empty: '' },
];
const LEVELS: { id: ManualLevel | null; label: string }[] = [
  { id: 'mindre', label: 'Mindre' },
  { id: null, label: 'Auto' },
  { id: 'mer', label: 'Mer' },
];
const typeName = (w: Weight) => (w.kind === 'type' ? (TYPE_LABEL[w.label as keyof typeof TYPE_LABEL] ?? w.label) : w.label);

/** Vad Claude tror du gillar: viktningen från gilla/ogilla, som du kan ändra rad för rad. */
function TasteSheet({ votes, prefs, people, onClose }: { votes: Vote[]; prefs: KunskapPrefs; people: FollowedPerson[]; onClose: () => void }) {
  // Egen kopia, så att snabba tryck inte skriver över varandra innan sparningen kommit tillbaka.
  const [draft, setDraft] = useState(prefs);
  const latest = useRef(prefs);
  const [topic, setTopic] = useState('');
  // Ordningen låses när arket öppnas (mest gillat först), så att en rad inte hoppar iväg när man ändrar den.
  const order = useRef<string[]>(tasteOf(votes, prefs, people).map((w) => w.key));
  const rank = (key: string) => {
    const i = order.current.indexOf(key);
    return i === -1 ? order.current.length : i;
  };
  const taste = tasteOf(votes, draft, people).sort((a, b) => rank(a.key) - rank(b.key));

  function set(kind: PrefKind, label: string, key: string, level: ManualLevel | null) {
    latest.current = withManual(latest.current, kind, label, key, level);
    setDraft(latest.current);
    void savePrefs(latest.current);
  }

  function addTopic(e: FormEvent) {
    e.preventDefault();
    const label = topic.trim().replace(/\s+/g, ' ').slice(0, PREF_LABEL_MAX).trim();
    if (!label) return;
    set('topic', label, prefKey('topic', label), 'mer');
    setTopic('');
  }

  return (
    <Sheet title="Vad Claude tror du gillar" onClose={onClose}>
      <p className="kunskap-hint">
        Uträknat från dina gilla och ogilla, per person, ämne och korttyp. Det styr nästa generering: mer av det du gillar och
        närliggande ämnen, mindre av resten. Ändra det som inte stämmer. Auto låter rösterna bestämma.
      </p>
      {GROUPS.map((g) => {
        const rows = taste.filter((w) => w.kind === g.kind);
        return (
          <section key={g.kind} className="kunskap-taste" aria-labelledby={`kunskap-taste-${g.kind}`}>
            <h3 id={`kunskap-taste-${g.kind}`}>{g.title}</h3>
            {rows.length === 0 ? (
              <p className="kunskap-hint">{g.empty}</p>
            ) : (
              <ul className="kunskap-taste-list">
                {rows.map((w) => (
                  <li key={w.key}>
                    <div>
                      <span className="kunskap-people-name">{typeName(w)}</span>
                      <span className="kunskap-people-topics">{describeWeight(w)}</span>
                    </div>
                    <div className="kunskap-levels" role="group" aria-label={`Hur mycket av ${typeName(w)}`}>
                      {LEVELS.map((l) => (
                        <button
                          key={l.label}
                          type="button"
                          className={(w.manual ?? null) === l.id ? `active ${l.id ?? 'auto'}` : undefined}
                          aria-pressed={(w.manual ?? null) === l.id}
                          onClick={() => set(w.kind, w.label, w.key, l.id)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <form className="kunskap-chat-form" onSubmit={addTopic}>
        <input value={topic} maxLength={PREF_LABEL_MAX} placeholder="Lägg till ett ämne, t.ex. sömn" aria-label="Nytt ämne du vill ha mer av" autoComplete="off" onChange={(e) => setTopic(e.target.value)} />
        <button type="submit" className="primary" disabled={!topic.trim()}>
          Lägg till
        </button>
      </form>
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

/**
 * Sidan för en person du lagt till själv. Den är inte granskad som bibliotekets egna sidor: den visar bara
 * ämnena du angett och korten som gjorts om personen, vart och ett med sin källa.
 */
export function OwnPersonPage({
  person,
  cards,
  votes,
  onBack,
  onVote,
  onDeeper,
  onRemove,
  onWrite,
}: {
  person: FollowedPerson;
  cards: KunskapCard[];
  votes: Map<string, 1 | -1>;
  onBack: () => void;
  onVote: (card: KunskapCard, pressed: 1 | -1) => void;
  onDeeper: (card: KunskapCard) => void;
  onRemove: () => void;
  /** Ber servern skriva (eller skriva om) presentationen. Kostar pengar, så bara på en tryckning. */
  onWrite: () => Promise<GenerateReply>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function write() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const reply = await onWrite();
    if (!alive.current) return;
    setBusy(false);
    setResult(reply.ok ? { text: `Klart. Det kostade ${formatUsd(reply.costUsd)}.`, error: false } : { text: reply.message, error: true });
  }
  const profile = person.profile;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <article className="lar-person kunskap-own">
      <button type="button" className="lar-back" onClick={onBack}>
        Tillbaka
      </button>
      <div className="view-intro">
        <div>
          <p className="eyebrow">{['Egen person', ...person.topics].join(', ')}</p>
          <h2 tabIndex={-1} ref={heading}>
            {person.name}
          </h2>
        </div>
      </div>
      <p className="kunskap-notice" role="note">
        Du har lagt till den här personen själv. Sidan är inte granskad som de andra i biblioteket: den visar korten som
        gjorts om personen, med källa på varje kort.
      </p>
      <section className="card lar-section kunskap-profile" aria-labelledby="kunskap-profile-title">
        <h3 id="kunskap-profile-title">Om {person.name}</h3>
        {profile ? (
          <>
            {profile.text.map((p) => (
              <p key={p} className="kunskap-profile-text">
                {p}
              </p>
            ))}
            <p className="kunskap-profile-heading">{profile.sources.length === 1 ? 'Källa' : 'Källor'}</p>
            <ul className="kunskap-profile-sources">
              {profile.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                    <span className="visually-hidden"> (öppnas i ny flik)</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="kunskap-profile-note">
              Skriven av Claude med webbsökning {formatWhen(profile.created).slice(0, 10)}. Inte granskad: kontrollera mot källorna.
            </p>
          </>
        ) : (
          <p className="kunskap-hint">
            Ingen presentation än. Claude kan skriva en kort text om vem personen är, med källor. Den blir inte granskad, och det
            kostar en liten summa.
          </p>
        )}
        <button type="button" className="kunskap-manage" disabled={busy} onClick={() => void write()}>
          {busy ? 'Skriver …' : profile ? 'Skriv om presentationen' : 'Skriv en presentation'}
        </button>
        {busy && <p className="kunskap-hint">Det tar upp till en minut.</p>}
        {result && (
          <p className={result.error ? 'kunskap-error' : 'kunskap-ok'} role={result.error ? 'alert' : 'status'}>
            {result.text}
          </p>
        )}
      </section>
      {cards.length === 0 ? (
        <div className="empty">
          <p>Inga kort om {person.name} än. De kommer vid nästa generering.</p>
        </div>
      ) : (
        <div className="kunskap-feed">
          {cards.map((card) => (
            <CardView key={card.id} card={card} value={votes.get(card.id)} onVote={(pressed) => onVote(card, pressed)} onDeeper={() => onDeeper(card)} />
          ))}
        </div>
      )}
      <button type="button" className="kunskap-remove kunskap-own-remove" onClick={onRemove}>
        Ta bort {person.name} ur biblioteket
      </button>
    </article>
  );
}

/**
 * Platsen i flödet där nästa omgång kort hämtas: efter de genererade korten, före exemplen. När den syns
 * (man har bläddrat hit) säger den till, och visar vad som händer.
 */
export function MoreCards({
  kind,
  message,
  note,
  onVisible,
  onEnable,
  onRetry,
  onFollow,
}: {
  kind: MoreKind;
  /** Felet från förra försöket (kind error). */
  message?: string | null;
  /** Resultatet av förra omgången, t.ex. "4 nya kort". */
  note?: string | null;
  onVisible: (visible: boolean) => void;
  onEnable: () => void;
  onRetry: () => void;
  onFollow: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const report = useRef(onVisible);
  report.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => report.current(entries.some((e) => e.isIntersecting)), { rootMargin: '200px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`kunskap-more ${kind}`} role="status" aria-live="polite">
      {kind === 'off' && (
        <>
          <p>
            <strong>Nya kort när du bläddrar hit?</strong> Claude gör en ny omgång kort när du kommit förbi de förra, högst{' '}
            {MAX_BATCHES_PER_DAY} gånger per dygn. Varje omgång kostar pengar, och kostnaden syns under inställningarna.
          </p>
          <button type="button" className="primary" onClick={onEnable}>
            Slå på
          </button>
        </>
      )}
      {kind === 'nopeople' && (
        <>
          <p>Följ minst en person, så hämtas nya kort hit.</p>
          <button type="button" onClick={onFollow}>
            Följ personer
          </button>
        </>
      )}
      {kind === 'busy' && (
        <p className="kunskap-more-busy">
          <span className="kunskap-msg claude thinking" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Hämtar nya kort. Det tar upp till ett par minuter, bläddra gärna vidare så länge.
        </p>
      )}
      {kind === 'error' && (
        <>
          <p className="kunskap-error">{message || 'Det gick inte att hämta nya kort.'}</p>
          <button type="button" onClick={onRetry}>
            Försök igen
          </button>
        </>
      )}
      {kind === 'limit' && <p>{note ? `${note} ` : ''}Dagens {MAX_BATCHES_PER_DAY} omgångar är slut. Nya kort kommer i morgon.</p>}
      {kind === 'ready' && <p>{note ?? 'Nya kort hämtas när du bläddrar hit.'}</p>}
    </div>
  );
}

/** Personens sida i biblioteket (Lär), om hen har en. */
const libraryId = (name: string) => PEOPLE.find((p) => personKey(p.name) === personKey(name))?.id;

type Mode = 'flode' | 'bibliotek' | 'upptack';
const MODES: { id: Mode; label: string }[] = [
  { id: 'flode', label: 'Flöde' },
  { id: 'bibliotek', label: 'Bibliotek' },
  { id: 'upptack', label: 'Upptäck' },
];
const EYEBROW: Record<Mode, string> = { flode: 'Flöde', bibliotek: 'Bibliotek', upptack: 'Upptäck' };

/**
 * Upptäck: sök på genre och få förslag på personer att följa, med det som passar dig först. Katalogen är fast
 * (discover.ts), så inget hämtas och inget kostar. Den som följs blir en egen person i biblioteket.
 */
export function Discover({
  taste,
  already,
  found = [],
  onFollow,
  onSearch,
}: {
  taste: Weight[];
  already: string[];
  /** Personer som Claude hittat åt tidigare sökningar. */
  found?: FoundPerson[];
  onFollow: (name: string, topics: string[]) => void;
  /** Ber Claude söka efter personer i en genre. Kostar pengar, så bara på en tryckning. */
  onSearch?: (genre: string) => Promise<SearchReply>;
}) {
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const matches = discover(taste, already, query, only ?? undefined);
  // Det Claude ska söka på: det du skrivit, annars den valda genren.
  const genre = query.trim() || GENRES.find((g) => g.id === only)?.label || '';
  const followed = new Set(already.map(personKey));
  const q = personKey(query);
  const hits = found.filter((p) => !q || [p.name, p.about, p.genre, ...p.topics].some((text) => personKey(text).includes(q)));

  async function search() {
    if (busy || !onSearch || genre.length < 2) return;
    setBusy(true);
    setResult(null);
    const reply = await onSearch(genre);
    if (!alive.current) return;
    setBusy(false);
    setResult(
      reply.ok
        ? { text: `${reply.people.length === 1 ? '1 person hittad' : `${reply.people.length} personer hittade`}. Det kostade ${formatUsd(reply.costUsd)}.`, error: false }
        : { text: reply.message, error: true },
    );
  }
  return (
    <div className="kunskap-discover">
      <p className="kunskap-hint">
        Förslag på personer att följa, sorterade efter vad du gillar. Beskrivningarna är korta och inte granskade som biblioteket.
        Den du följer får en egen sida och kommer med i flödet.
      </p>
      <input
        className="kunskap-search"
        type="search"
        value={query}
        maxLength={60}
        placeholder="Sök genre eller person, t.ex. framgång"
        aria-label="Sök genre eller person"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />
      <nav className="kunskap-chips" aria-label="Genrer">
        <button type="button" className={only === null ? 'chip active' : 'chip'} aria-pressed={only === null} onClick={() => setOnly(null)}>
          Alla
        </button>
        {discover(taste, already).map(({ genre }) => (
          <button key={genre.id} type="button" className={only === genre.id ? 'chip active' : 'chip'} aria-pressed={only === genre.id} onClick={() => setOnly(genre.id)}>
            {genre.label}
          </button>
        ))}
      </nav>
      {hits.length > 0 && only === null && (
        <section className="kunskap-genre" aria-labelledby="kunskap-genre-found">
          <h3 id="kunskap-genre-found">Hittade av Claude</h3>
          <ul className="kunskap-suggestions">
            {hits.map((p) => (
              <li key={p.name}>
                <div>
                  <span className="kunskap-people-name">{p.name}</span>
                  <span className="kunskap-suggestion-about">{p.about}</span>
                  <span className="kunskap-people-topics">
                    {[p.genre, ...p.topics].filter(Boolean).join(', ')}
                    {'. Källa: '}
                    <a href={p.source.url} target="_blank" rel="noopener noreferrer">
                      {p.source.title}
                      <span className="visually-hidden"> (öppnas i ny flik)</span>
                    </a>
                  </span>
                </div>
                {followed.has(personKey(p.name)) ? (
                  <span className="kunskap-followed">Följer</span>
                ) : (
                  <button type="button" className="kunskap-follow" onClick={() => onFollow(p.name, p.topics.length ? p.topics : [p.genre])}>
                    Följ
                    <span className="visually-hidden"> {p.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="kunskap-hint">Hittade med webbsökning. Inte granskade: öppna källan om du vill kontrollera.</p>
        </section>
      )}
      {matches.length === 0 && hits.length === 0 ? (
        <div className="empty">
          <p>Inga förslag för ”{query.trim()}” i katalogen. Fråga Claude nedan, eller lägg till personen själv under Bibliotek.</p>
        </div>
      ) : (
        matches.map(({ genre, fits, people }) => (
          <section key={genre.id} className="kunskap-genre" aria-labelledby={`kunskap-genre-${genre.id}`}>
            <h3 id={`kunskap-genre-${genre.id}`}>
              {genre.label}
              {fits && <span className="kunskap-type upptackt">Passar dig</span>}
            </h3>
            <ul className="kunskap-suggestions">
              {people.map((p) => (
                <li key={p.name}>
                  <div>
                    <span className="kunskap-people-name">{p.name}</span>
                    <span className="kunskap-suggestion-about">{p.about}</span>
                    <span className="kunskap-people-topics">{p.topics.join(', ')}</span>
                  </div>
                  {p.followed ? (
                    <span className="kunskap-followed">Följer</span>
                  ) : (
                    <button type="button" className="kunskap-follow" onClick={() => onFollow(p.name, p.topics)}>
                      Följ
                      <span className="visually-hidden"> {p.name}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {onSearch && (
        <section className="kunskap-more kunskap-ask" aria-labelledby="kunskap-ask-title">
          <p>
            <strong id="kunskap-ask-title">Fråga Claude efter fler</strong>
            {genre.length >= 2
              ? ` Claude söker på nätet efter personer inom ”${genre}” som passar dig. Det tar upp till en minut och kostar en liten summa, högst ${MAX_SEARCHES_PER_DAY} sökningar per dygn.`
              : ' Skriv en genre i sökfältet ovan, eller välj en, så kan Claude söka på nätet efter fler personer.'}
          </p>
          <button type="button" className="primary" disabled={busy || genre.length < 2} onClick={() => void search()}>
            {busy ? 'Söker …' : 'Sök med Claude'}
          </button>
          {result && (
            <p className={result.error ? 'kunskap-error' : 'kunskap-ok'} role={result.error ? 'alert' : 'status'}>
              {result.text}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Kunskap: två lägen. Flödet är korta kort från personer du följer, med gilla/ogilla och en chatt per kort.
 * Biblioteket är Lär: en granskad sida per person. Personens namn på ett kort öppnar sidan.
 */
export default function Kunskap({ initialFilter = 'alla', initialMode = 'flode' }: { initialFilter?: Filter; initialMode?: Mode }) {
  const { data, failed } = useKunskap();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [managing, setManaging] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [tasting, setTasting] = useState(false);
  const [chat, setChat] = useState<KunskapCard | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  // Personsidan som öppnats från ett kort (då går Tillbaka till flödet, på samma ställe som förut).
  const [fromCard, setFromCard] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  // Sidan för en person du lagt till själv (id i kunskap_people), och om den öppnades från ett kort.
  const [own, setOwn] = useState<{ id: string; fromCard: boolean } | null>(null);
  const scrollBack = useRef(0);

  function showMode(next: Mode) {
    setFromCard(null);
    setPersonOpen(false);
    setOwn(null);
    setMode(next);
  }

  function openOwn(id: string, fromFeed: boolean) {
    if (fromFeed) scrollBack.current = window.scrollY;
    setFromCard(null);
    setOwn({ id, fromCard: fromFeed });
    setMode('bibliotek');
  }

  function openPerson(id: string) {
    scrollBack.current = window.scrollY;
    setFromCard(id);
    setMode('bibliotek');
  }

  function backToFeed() {
    showMode('flode');
    const y = scrollBack.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  const people = data?.people ?? [];
  const votes = voteMap(data?.votes ?? []);
  // Kort som kommer till medan Kunskap är öppen läggs efter de förra, där man är, inte överst.
  const order = useRef<string[] | null>(null);
  if (data) order.current = sessionOrder(order.current, data.cards);
  const everything = allCards(data?.cards ?? [], EXAMPLE_CARDS, order.current ?? undefined);

  // Nya kort när man bläddrar: en omgång startas när platsen efter de nya korten kommer i bild.
  const [more, setMore] = useState<{ busy: boolean; error: string | null; note: string | null }>({ busy: false, error: null, note: null });
  const moreVisible = useRef(false);
  // Laddad = platsen har kommit i bild sedan förra omgången. Hindrar att en omgång till startar av sig själv.
  const moreArmed = useRef(false);
  const kind: MoreKind | null = data
    ? moreKind({ auto: data.settings.auto, people: people.length, batches: data.batches, now: Date.now(), busy: more.busy, error: !!more.error })
    : null;

  async function loadMore() {
    if (more.busy) return;
    moreArmed.current = false;
    setMore({ busy: true, error: null, note: null });
    const reply = await generateNow();
    setMore(
      reply.ok
        ? { busy: false, error: null, note: reply.cards === 0 ? 'Inga nya kort den här gången.' : reply.cards === 1 ? '1 nytt kort ovanför.' : `${reply.cards} nya kort ovanför.` }
        : { busy: false, error: reply.message, note: null },
    );
  }

  function moreSeen(visible: boolean) {
    if (visible && !moreVisible.current) moreArmed.current = true;
    moreVisible.current = visible;
    if (visible && moreArmed.current && kind === 'ready') void loadMore();
  }

  // Om platsen redan syns när allt blir klart (appen öppnas, datan har laddats): starta då.
  useEffect(() => {
    if (kind === 'ready' && mode === 'flode' && moreVisible.current && moreArmed.current) void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, mode]);

  const moreCards =
    kind && filter !== 'gillade' ? (
      <MoreCards
        key="more"
        kind={kind}
        message={more.error}
        note={more.note}
        onVisible={moreSeen}
        onEnable={() => {
          if (!data) return;
          void saveSettings({ ...data.settings, auto: true });
          if (people.length > 0) void loadMore();
        }}
        onRetry={() => void loadMore()}
        onFollow={() => setManaging(true)}
      />
    ) : null;
  const cards = feed(everything, people, votes, filter);
  const pending = waiting(everything, people);
  /** Sista genererade kortet i det som visas. Platsen för nya kort ligger direkt efter (eller överst om inget finns). */
  const lastGenerated = cards.reduce((last, c, i) => (c.created ? i : last), -1);
  const mine = ownPeople(people, PEOPLE.map((p) => p.name));
  const ownPerson = own ? people.find((p) => p.id === own.id) : undefined;
  /** Raden på kortet i biblioteket för en person du lagt till själv: vem det är, om det är känt, annars antal kort. */
  const ownTeaser = (p: FollowedPerson) => {
    const about =
      p.profile?.text[0] ??
      GENRES.flatMap((g) => g.people).find((x) => personKey(x.name) === personKey(p.name))?.about ??
      (data?.found ?? []).find((x) => personKey(x.name) === personKey(p.name))?.about;
    const n = cardsOf(everything, p.name).length;
    return about ?? (n === 0 ? 'Inga kort än. De kommer vid nästa generering.' : n === 1 ? '1 kort.' : `${n} kort.`);
  };
  /** Knappen på kortets namn: den granskade sidan, annars din egen sida, annars ingen. */
  const personLink = (name: string) => {
    const id = libraryId(name);
    if (id) return () => openPerson(id);
    const followed = mine.find((p) => personKey(p.name) === personKey(name));
    return followed ? () => openOwn(followed.id, true) : undefined;
  };

  return (
    <div className="kunskap">
      {!personOpen && !ownPerson && (
        <>
      <div className="view-intro">
        <div>
          <p className="eyebrow">{EYEBROW[mode]}</p>
          <h2>Mindhub</h2>
        </div>
        {mode === 'flode' && (
        <div className="kunskap-head-actions">
          <button type="button" className="kunskap-manage" onClick={() => setManaging(true)}>
            {people.length === 0 ? 'Följ personer' : `Följer ${people.length}`}
          </button>
          <button type="button" className="kunskap-close" onClick={() => setTasting(true)} aria-label="Vad Claude tror du gillar" disabled={!data}>
            <Icon d={ICON.taste} />
          </button>
          <button type="button" className="kunskap-close" onClick={() => setConfiguring(true)} aria-label="Inställningar för nya kort" disabled={!data}>
            <Icon d={ICON.settings} />
          </button>
        </div>
        )}
      </div>
      <div className="kunskap-segment kunskap-modes" role="group" aria-label="Läge">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={m.id === mode ? 'active' : undefined} aria-pressed={m.id === mode} onClick={() => showMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
        </>
      )}
      {mode === 'upptack' && (
        <Discover
          taste={tasteOf(data?.votes ?? [], data?.prefs ?? { id: 'prefs', manual: {} }, people)}
          already={[...people.map((p) => p.name), ...PEOPLE.map((p) => p.name)]}
          found={data?.found ?? []}
          onFollow={(name, topics) => void follow(name, topics)}
          onSearch={(genre) => searchPeople(genre, [...PEOPLE.map((p) => p.name), ...GENRES.flatMap((g) => g.people.map((p) => p.name))])}
        />
      )}
      {mode === 'bibliotek' && ownPerson && (
        <OwnPersonPage
          person={ownPerson}
          cards={cardsOf(everything, ownPerson.name)}
          votes={votes}
          onBack={own?.fromCard ? backToFeed : () => setOwn(null)}
          onVote={(card, pressed) => void vote(card, pressed)}
          onDeeper={setChat}
          onWrite={() => writeProfile(ownPerson.id)}
          onRemove={() => {
            void unfollow(ownPerson.id);
            if (own?.fromCard) backToFeed();
            else setOwn(null);
          }}
        />
      )}
      {mode === 'bibliotek' && !ownPerson && (
        <Lar
          key={fromCard ?? 'lista'}
          embedded
          initialOpenId={fromCard ?? undefined}
          onBack={fromCard ? backToFeed : undefined}
          onOpenChange={setPersonOpen}
          extra={mine.map((p) => ({ id: p.id, name: p.name, kind: p.topics.length > 0 ? p.topics.join(', ') : 'Tillagd av dig', teaser: ownTeaser(p) }))}
          onOpenExtra={(id) => openOwn(id, false)}
        />
      )}
      {mode === 'bibliotek' && !ownPerson && !personOpen && (
        <div className="kunskap-own-list">
          <button type="button" className="kunskap-manage" onClick={() => setManaging(true)} disabled={!data}>
            Lägg till person
          </button>
        </div>
      )}
      <div hidden={mode !== 'flode'}>
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
              Inga kort än för {pending.map((p) => p.name).join(', ')}. De får kort vid nästa generering.
            </p>
          )}
          {cards.length === 0 && moreCards}
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
              {lastGenerated === -1 && moreCards}
              {cards.flatMap((card, i) => [
                <CardView
                  key={card.id}
                  card={card}
                  value={votes.get(card.id)}
                  onVote={(pressed) => void vote(card, pressed)}
                  onDeeper={() => setChat(card)}
                  onFollow={card.discovery && !isFollowed(people, card.person) ? () => void follow(card.person, [card.topic]) : undefined}
                  onPerson={personLink(card.person)}
                />,
                i === lastGenerated ? moreCards : null,
              ])}
            </div>
          )}
        </>
      )}

      </div>
      {managing && <PeopleSheet people={people} onClose={() => setManaging(false)} />}
      {configuring && data && <SettingsSheet settings={data.settings} batches={data.batches} hasPeople={people.length > 0} onClose={() => setConfiguring(false)} />}
      {tasting && data && <TasteSheet votes={data.votes} prefs={data.prefs} people={people} onClose={() => setTasting(false)} />}
      {chat && <ChatSheet card={chat} onClose={() => setChat(null)} />}
    </div>
  );
}
