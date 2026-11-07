import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { cachedNews, clock, fetchNews, newsMeta, TOPICS, type NewsResult, type NewsTopic, type Tone } from './news';

const FRESH = 10 * 60 * 1000;
const TONE_LABEL: Record<Tone, string> = { positiv: 'Positiv', negativ: 'Negativ', neutral: 'Neutral' };
const topicLabel = (id: NewsTopic) => TOPICS.find((t) => t.id === id)?.label ?? id;

type ToneFilter = 'alla' | 'positiv' | 'negativ';

/** Nyheter om ekonomi, krig, fotboll och Sverige, med en enkel bedömning av tonen. */
export default function Nyheter({ active }: { active: boolean }) {
  const [news, setNews] = useState<NewsResult | null>(cachedNews);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState<NewsTopic | 'alla'>('alla');
  const [tone, setTone] = useState<ToneFilter>('alla');

  const load = useCallback(() => {
    setLoading(true);
    fetchNews()
      .then((result) => {
        setNews(result);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active && (!news || Date.now() - news.updated > FRESH)) load();
    // Bara när fliken öppnas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const inTopic = (news?.items ?? []).filter((item) => topic === 'alla' || item.topic === topic);
  const shown = inTopic.filter((item) => tone === 'alla' || item.tone === tone);
  const count = (t: Tone) => inTopic.filter((item) => item.tone === t).length;
  const total = inTopic.length;

  return (
    <div className="news">
      <div className="view-intro news-intro">
        <div>
          <p className="eyebrow">{news ? `Uppdaterad ${clock(news.updated)}, SVT` : 'SVT'}</p>
          <h2>Nyheter</h2>
        </div>
        <button type="button" className="news-refresh" onClick={load} disabled={loading}>
          {loading ? 'Hämtar…' : 'Uppdatera'}
        </button>
      </div>

      <nav className="news-topics" aria-label="Ämnen">
        {[{ id: 'alla' as const, label: 'Alla' }, ...TOPICS].map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === topic ? 'chip active' : 'chip'}
            aria-pressed={t.id === topic}
            onClick={() => setTopic(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {failed && news && (
        <p className="news-notice" role="status">
          Kunde inte hämta nya nyheter. Visar de från {clock(news.updated)}.
        </p>
      )}
      {failed && !news && (
        <div className="empty" role="alert">
          <p>Nyheterna gick inte att hämta. Kontrollera uppkopplingen.</p>
          <button type="button" className="primary" onClick={load} disabled={loading}>
            Försök igen
          </button>
        </div>
      )}
      {news && news.missing.length > 0 && (
        <p className="news-notice">{news.missing.map(topicLabel).join(', ')} gick inte att hämta just nu.</p>
      )}

      {total > 0 && (
        <div className="card news-mood">
          <div className="segmented-row news-tone" role="group" aria-label="Visa">
            {(
              [
                ['alla', `Alla ${total}`, 1],
                ['positiv', `Positiva ${count('positiv')}`, count('positiv') / total],
                ['negativ', `Negativa ${count('negativ')}`, count('negativ') / total],
              ] as [ToneFilter, string, number][]
            ).map(([id, label, share]) => (
              <button
                key={id}
                type="button"
                className={tone === id ? `seg ${id} active` : `seg ${id}`}
                style={{ '--share': share } as CSSProperties}
                aria-pressed={tone === id}
                onClick={() => setTone(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!news && !failed && (
        <div className="group news-list" aria-busy="true" aria-label="Laddar">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      )}

      {news && shown.length === 0 && !loading && (
        <div className="empty">
          <p>
            {tone === 'alla'
              ? `Inga nyheter om ${topic === 'alla' ? 'de här ämnena' : topicLabel(topic).toLowerCase()} just nu.`
              : `Inga ${tone === 'positiv' ? 'positiva' : 'negativa'} nyheter${topic === 'alla' ? '' : ` om ${topicLabel(topic).toLowerCase()}`} just nu.`}
          </p>
          {(topic !== 'alla' || tone !== 'alla') && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setTopic('alla');
                setTone('alla');
              }}
            >
              Visa alla nyheter
            </button>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <div className="group news-list">
          {shown.map((item) => (
            <article key={item.id} className={`news-item ${item.tone}`}>
              <p className="news-meta">{newsMeta(item, { withTopic: topic === 'alla' })}</p>
              <h3 className="news-title">
                <a href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h3>
              {item.summary && <p className="news-summary">{item.summary}</p>}
              <p className="news-tone-row">
                <span className={`news-badge ${item.tone}`}>{TONE_LABEL[item.tone]}</span>
                {item.because.length > 0 && <span className="news-because">{item.because.join(', ')}</span>}
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="news-foot">
        Rubrikerna kommer från SVT:s öppna RSS-flöden. Tonen bedöms automatiskt med svenska ordlistor, inte AI, och kan ha fel.
        Orden som avgjorde står bredvid.
      </p>
    </div>
  );
}
