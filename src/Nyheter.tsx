import { useCallback, useEffect, useState } from 'react';
import { blindspotLine, cachedNews, countLine, fetchNews, readySections, SECTIONS, SIDES, usd, weekCost, weekLine, type SectionId, type Story } from './news';

const FRESH = 30 * 60 * 1000;

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="news-item">
      {story.positive && <p className="news-badge positiv">Positiv</p>}
      <h3 className="news-title">{story.title}</h3>
      <p className="news-summary">{story.summary}</p>

      {story.angles.length > 0 && (
        <dl className="news-angles">
          {SIDES.map((side) => {
            const angle = story.angles.find((a) => a.side === side.id);
            return (
              <div key={side.id} className={angle ? `news-angle ${side.id}` : `news-angle ${side.id} missing`}>
                <dt>{side.label}</dt>
                <dd>
                  {angle ? (
                    <>
                      {angle.text}{' '}
                      <a href={angle.url} target="_blank" rel="noopener noreferrer">
                        {angle.outlet}
                      </a>
                    </>
                  ) : (
                    'Ingen artikel hittad.'
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {story.blindspot && <p className="news-blindspot">{blindspotLine(story.blindspot)}</p>}

      <p className="news-sources">
        Källor:{' '}
        {story.sources.map((source, i) => (
          <span key={source.url}>
            {i > 0 && ', '}
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          </span>
        ))}
      </p>
    </article>
  );
}

/** Veckans nyheter i sex sektioner, med vinklar från vänster, mitten och höger. */
export default function Nyheter({ active }: { active: boolean }) {
  const [news, setNews] = useState(cachedNews);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<SectionId>('varlden');

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
    if (active && (!news || Date.now() - news.fetched > FRESH)) load();
    // Bara när fliken öppnas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const week = news?.week ?? null;
  const ready = readySections(week).map((s) => s.id);
  const stories = week?.sections[section]?.status === 'klar' ? week.sections[section]!.stories : [];
  const label = SECTIONS.find((s) => s.id === section)?.label ?? '';

  return (
    <div className="news">
      <div className="view-intro news-intro">
        <div>
          <p className="eyebrow">{week ? weekLine(week) : 'Veckans nyheter'}</p>
          <h2>News</h2>
        </div>
        <button type="button" className="news-refresh" onClick={load} disabled={loading}>
          {loading ? 'Hämtar…' : 'Uppdatera'}
        </button>
      </div>

      {failed && news && (
        <p className="news-notice" role="status">
          Kunde inte hämta nyheterna just nu. Visar de som är sparade på telefonen.
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

      {!news && !failed && (
        <div className="group news-list" aria-busy="true" aria-label="Laddar">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      )}

      {news && !week && (
        <div className="empty">
          <p>Inga veckonyheter än. Den första sammanställningen skrivs natten mot måndag.</p>
        </div>
      )}

      {week && (
        <>
          <nav className="news-topics" aria-label="Sektioner">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === section ? 'chip active' : 'chip'}
                aria-pressed={s.id === section}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {stories.length > 0 ? (
            <>
              <p className="news-count">{countLine(stories)}</p>
              <div className="news-list">
                {stories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <p>
                {week.sections[section]?.status === 'vantar'
                  ? `${label} skrivs just nu. Titta in igen om en stund.`
                  : `${label} blev inte klar den här veckan.`}
              </p>
              {ready.length > 0 && (
                <button type="button" className="primary" onClick={() => setSection(ready[0])}>
                  Visa {SECTIONS.find((s) => s.id === ready[0])?.label}
                </button>
              )}
            </div>
          )}

          <p className="news-foot">
            Skrivet av Claude med webbsökning en gång i veckan, inte granskat av någon människa. Varje källa är en sida som
            sökningen hittade. Vänster, mitten och höger är en grov indelning: svenska tidningar efter ledarsidans beteckning,
            utländska efter gängse bedömningar. Veckan kostade {usd(weekCost(week))} USD.
          </p>
        </>
      )}
    </div>
  );
}
