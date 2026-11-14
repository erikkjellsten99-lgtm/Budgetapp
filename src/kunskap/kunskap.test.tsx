import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PEOPLE } from '../lar/people';
import { getOutbox } from '../vanor/store';
import { systemPrompt, toCard, toMessages } from '../../supabase/functions/kunskap/prompt.ts';
import { cardWords, EXAMPLE_CARDS, MAX_WORDS, SUGGESTED, TYPE_LABEL } from './cards';
import { cardPayload, NOT_DEPLOYED, readChatReply, SIGNED_OUT } from './chatApi';
import Kunskap, { CardView } from './Kunskap';
import { cleanName, feed, isFollowed, nextVote, parseTopics, personKey, voteMap, waiting, type FollowedPerson } from './kunskapState';
import { follow, loadKunskap, unfollow, vote } from './kunskapStore';

const person = (name: string, topics: string[] = []): FollowedPerson => ({ id: name, name, topics, created: 0 });

describe('exempelkorten', () => {
  it('varje kort har person, ämne, typ, text och https-källa, och högst 80 ord', () => {
    expect(EXAMPLE_CARDS.length).toBeGreaterThan(20);
    for (const c of EXAMPLE_CARDS) {
      expect(c.person.length, c.id).toBeGreaterThan(0);
      expect(c.topic.length, c.id).toBeGreaterThan(0);
      expect(Object.keys(TYPE_LABEL), c.id).toContain(c.type);
      expect(c.source.url, c.id).toMatch(/^https:\/\//);
      expect(c.source.title.length, c.id).toBeGreaterThan(0);
      expect(cardWords(c), c.id).toBeGreaterThan(0);
      expect(cardWords(c), c.id).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it('unika id:n, alla tre typerna och alla personer i Lär finns med', () => {
    expect(new Set(EXAMPLE_CARDS.map((c) => c.id)).size).toBe(EXAMPLE_CARDS.length);
    for (const t of ['citat', 'insikt', 'protokoll']) expect(EXAMPLE_CARDS.some((c) => c.type === t), t).toBe(true);
    for (const p of PEOPLE) expect(EXAMPLE_CARDS.some((c) => c.person === p.name), p.name).toBe(true);
  });

  it('citaten har översättning, protokollen steg, och flödet börjar blandat', () => {
    for (const c of EXAMPLE_CARDS) {
      if (c.type === 'citat') expect(c.sv?.length ?? 0, c.id).toBeGreaterThan(0);
      if (c.type === 'protokoll') expect(c.steps?.length ?? 0, c.id).toBeGreaterThan(1);
    }
    expect(new Set(EXAMPLE_CARDS.slice(0, 6).map((c) => c.person)).size).toBe(6);
    expect(new Set(EXAMPLE_CARDS.slice(0, 6).map((c) => c.type)).size).toBe(3);
  });
});

describe('personer och ämnen', () => {
  it('ämnen delas på komma, utan tomma och dubbletter', () => {
    expect(parseTopics('bastu, kallbad')).toEqual(['bastu', 'kallbad']);
    expect(parseTopics(' Bastu ,, bastu;  sömn \n')).toEqual(['Bastu', 'sömn']);
    expect(parseTopics('')).toEqual([]);
    expect(parseTopics('a,b,c,d,e,f,g,h')).toHaveLength(6);
    expect(parseTopics('x'.repeat(100))[0]).toHaveLength(30);
  });

  it('namn städas, och jämförs utan accenter och stora bokstäver', () => {
    expect(cleanName('  Susanna   Søberg ')).toBe('Susanna Søberg');
    expect(cleanName('   ')).toBe('');
    expect(cleanName('å'.repeat(200))).toHaveLength(60);
    expect(personKey('Susanna Soberg')).toBe(personKey('susanna SØBERG'));
    expect(isFollowed([person('Susanna Søberg')], 'susanna soberg')).toBe(true);
    expect(isFollowed([person('Wim Hof')], 'Susanna Søberg')).toBe(false);
  });

  it('förslagen är personerna i Lär, med ämnen', () => {
    expect(SUGGESTED.map((s) => s.name)).toEqual(PEOPLE.map((p) => p.name));
    expect(SUGGESTED.find((s) => s.name === 'Susanna Søberg')?.topics).toEqual(['kallbad', 'bastu']);
  });
});

describe('flödet', () => {
  const none = new Map<string, 1 | -1>();

  it('utan följda personer visas alla kort, annars bara de följdas', () => {
    expect(feed(EXAMPLE_CARDS, [], none, 'alla')).toHaveLength(EXAMPLE_CARDS.length);
    const mine = feed(EXAMPLE_CARDS, [person('susanna soberg')], none, 'alla');
    expect(mine.length).toBeGreaterThan(0);
    expect(new Set(mine.map((c) => c.person))).toEqual(new Set(['Susanna Søberg']));
  });

  it('filter på typ och på gillade', () => {
    expect(feed(EXAMPLE_CARDS, [], none, 'citat').every((c) => c.type === 'citat')).toBe(true);
    const liked = EXAMPLE_CARDS[3];
    const votes = voteMap([
      { cardId: liked.id, value: 1, ts: 1, person: liked.person, topic: liked.topic, type: liked.type },
      { cardId: EXAMPLE_CARDS[4].id, value: -1, ts: 1, person: 'x', topic: 'y', type: 'citat' },
    ]);
    expect(feed(EXAMPLE_CARDS, [person('Någon Annan')], votes, 'gillade')).toEqual([liked]);
  });

  it('en följd person utan kort väntar på genereringen', () => {
    const people = [person('Wim Hof'), person('Naval Ravikant')];
    expect(waiting(EXAMPLE_CARDS, people).map((p) => p.name)).toEqual(['Naval Ravikant']);
    expect(feed(EXAMPLE_CARDS, [person('Naval Ravikant')], none, 'alla')).toEqual([]);
  });

  it('samma knapp en gång till tar bort rösten', () => {
    expect(nextVote(undefined, 1)).toBe(1);
    expect(nextVote(1, 1)).toBeNull();
    expect(nextVote(1, -1)).toBe(-1);
    expect(nextVote(-1, -1)).toBeNull();
  });
});

describe('lagringen', () => {
  it('följa, rösta och ta bort sparas i telefonen och köas för synk', async () => {
    expect(await follow('  Susanna   Søberg ', 'bastu, kallbad')).toBe(true);
    expect(await follow('susanna soberg', '')).toBe(false);
    expect(await follow('   ', 'x')).toBe(false);
    let data = await loadKunskap();
    expect(data.people.map((p) => [p.name, p.topics])).toEqual([['Susanna Søberg', ['bastu', 'kallbad']]]);

    const card = EXAMPLE_CARDS[0];
    await vote(card, 1);
    data = await loadKunskap();
    expect(data.votes).toMatchObject([{ cardId: card.id, value: 1, person: card.person, type: card.type }]);
    await vote(card, -1);
    expect((await loadKunskap()).votes).toMatchObject([{ cardId: card.id, value: -1 }]);

    const outbox = await getOutbox();
    expect(outbox.map((e) => e.key).sort()).toEqual([`kunskap_people:${data.people[0].id}`, `kunskap_votes:${card.id}`].sort());

    // Dubbelklick: två tryckningar direkt efter varandra tar ut varandra.
    await Promise.all([vote(card, 1), vote(card, 1)]);
    expect((await loadKunskap()).votes).toEqual([]);
    await unfollow(data.people[0].id);
    expect(await loadKunskap()).toMatchObject({ people: [], votes: [], cards: [], batches: [], settings: { frequency: 'av', count: 5 } });
    expect((await getOutbox()).every((e) => e.deleted)).toBe(true);
  });
});

describe('vyn', () => {
  it('visar rubrik, filter och laddning innan datan lästs', () => {
    const html = renderToStaticMarkup(<Kunskap />);
    expect(html).toContain('>Kunskap</h2>');
    for (const label of ['Alla', 'Citat', 'Insikter', 'Protokoll', 'Gillade']) expect(html).toContain(`>${label}</button>`);
    expect(html).toContain('aria-busy="true"');
  });

  it('kortet visar person, ämne, typ, källa med säker länk och knapparna', () => {
    for (const type of ['citat', 'insikt', 'protokoll'] as const) {
      const card = EXAMPLE_CARDS.find((c) => c.type === type)!;
      const html = renderToStaticMarkup(<CardView card={card} value={1} onVote={() => {}} onDeeper={() => {}} />);
      expect(html).toContain(card.person);
      expect(html).toContain(card.topic);
      expect(html).toContain(TYPE_LABEL[type]);
      expect(html).toContain(`href="${card.source.url}"`);
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('(öppnas i ny flik)');
      expect(html).toMatch(/aria-pressed="true"[^>]*>.*Gilla/);
      expect(html).toContain('Ogilla');
      expect(html).toContain('Gå djupare');
    }
  });
});

describe('biblioteket (Lär) inuti Kunskap', () => {
  it('läget Bibliotek visar en sida per person, utan egen rubrik och utan flödets knappar', () => {
    const html = renderToStaticMarkup(<Kunskap initialMode="bibliotek" />);
    expect((html.match(/class="card lar-card"/g) ?? []).length).toBe(PEOPLE.length);
    expect(html).toContain('>Kunskap</h2>');
    expect(html).not.toContain('>Lär</h2>');
    expect(html).toContain('>Bibliotek</p>');
    expect(html).not.toContain('Inställningar för nya kort');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Bibliotek<\/button>/);
  });

  it('flödet är förvalt och biblioteket laddas inte förrän det väljs', () => {
    const html = renderToStaticMarkup(<Kunskap />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Flöde<\/button>/);
    expect(html).not.toContain('lar-card');
  });

  it('namnet på kortet är en knapp till personsidan när personen finns i biblioteket', () => {
    const card = EXAMPLE_CARDS[0];
    const linked = renderToStaticMarkup(<CardView card={card} onVote={() => {}} onDeeper={() => {}} onPerson={() => {}} />);
    expect(linked).toContain('class="kunskap-person-link"');
    expect(linked).toContain('öppna i biblioteket');
    const plain = renderToStaticMarkup(<CardView card={card} onVote={() => {}} onDeeper={() => {}} />);
    expect(plain).not.toContain('kunskap-person-link');
    expect(plain).toContain(card.person);
  });
});

describe('Gå djupare', () => {
  it('svaret från servern tolkas, även när funktionen inte är utlagd', () => {
    expect(readChatReply(200, { answer: ' Hej ' })).toEqual({ ok: true, answer: 'Hej' });
    expect(readChatReply(401, null)).toEqual({ ok: false, reason: 'utloggad', message: SIGNED_OUT });
    expect(readChatReply(404, { code: 'NOT_FOUND' })).toEqual({ ok: false, reason: 'saknas', message: NOT_DEPLOYED });
    expect(readChatReply(429, { error: 'grans', message: 'Gränsen är nådd.' })).toMatchObject({ reason: 'grans', message: 'Gränsen är nådd.' });
    expect(readChatReply(500, {})).toMatchObject({ ok: false, reason: 'fel' });
    expect(readChatReply(200, { answer: '' })).toMatchObject({ ok: false });
  });

  it('servern tar emot kortet från appen och städar det', () => {
    for (const card of EXAMPLE_CARDS.slice(0, 9)) {
      const clean = toCard(cardPayload(card));
      expect(clean, card.id).not.toBeNull();
      expect(systemPrompt(clean!)).toContain(card.person);
      expect(systemPrompt(clean!)).toContain(card.source.url);
    }
    expect(toCard(null)).toBeNull();
    expect(toCard({ person: 'A', type: 'annat', text: 'x', source: { title: 't', url: 'https://a.se' } })).toBeNull();
    expect(toCard({ person: 'A', type: 'citat', text: 'x', source: { title: 't', url: 'javascript:alert(1)' } })).toBeNull();
    expect(toCard({ person: 'A', type: 'citat', text: 'x'.repeat(9000), source: { title: 't', url: 'https://a.se' } })!.text).toHaveLength(1500);
  });

  it('samtalet kortas och trasiga utbyten hoppas över', () => {
    const history = [...Array.from({ length: 10 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })), { question: 'utan svar' }, 'skräp'];
    const messages = toMessages(history, 'Ny fråga');
    expect(messages).toHaveLength(13);
    expect(messages[0]).toEqual({ role: 'user', content: 'q4' });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Ny fråga' });
    expect(toMessages(undefined, 'x')).toEqual([{ role: 'user', content: 'x' }]);
  });
});
