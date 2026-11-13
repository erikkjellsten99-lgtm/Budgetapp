import { describe, expect, it } from 'vitest';
import { AREAS, EVIDENCE_LABEL, PEOPLE, peopleIn, personById } from './people';

const NAMES = [
  'Wim Hof',
  'Susanna Søberg',
  'Jari Laukkanen',
  'Andrew Huberman',
  'Rhonda Patrick',
  'Jon Kabat-Zinn',
  'Sam Harris',
  'James Clear',
  'Chris Williamson',
];

// Personernas egna webbplatser: en källa här räknas inte som ursprunglig forskning.
const OWN_HOSTS: Record<string, string[]> = {
  'James Clear': ['jamesclear.com'],
  'Chris Williamson': ['chriswillx.com', 'modernwisdom.com'],
};

const FORBIDDEN = /["”—–]/;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const words = (paras: string[]) => paras.join(' ').split(/\s+/).filter(Boolean).length;


describe('Lär: innehållet', () => {
  it('har exakt de nio personerna', () => {
    expect([...PEOPLE.map(p => p.name)].sort()).toEqual([...NAMES].sort());
  });

  it('har unika id:n i rätt format', () => {
    const ids = PEOPLE.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
    for (const p of PEOPLE) expect(personById(p.id)).toBe(p);
    expect(personById('finns-inte')).toBeUndefined();
  });

  it('har exakt de fyra områdena och minst en person i varje', () => {
    expect(AREAS.map(a => a.label)).toEqual([
      'Andning och kyla',
      'Kallbad och bastu',
      'Meditation',
      'Personlig utveckling',
    ]);
    for (const a of AREAS) expect(peopleIn(a.id).length).toBeGreaterThan(0);
    for (const a of AREAS) for (const p of peopleIn(a.id)) expect(p.areas).toContain(a.id);
  });

  it('peopleIn(alla) ger alla nio', () => {
    expect(peopleIn('alla')).toHaveLength(9);
  });

  it('varje person har tillräckligt innehåll', () => {
    for (const p of PEOPLE) {
      expect(p.claims.length, p.name).toBeGreaterThanOrEqual(3);
      expect(p.method.length, p.name).toBeGreaterThanOrEqual(2);
      expect(p.startHere.length, p.name).toBeGreaterThanOrEqual(1);
      expect(p.teaser.length, p.name).toBeLessThanOrEqual(90);
      expect(p.about.trim().length, p.name).toBeGreaterThan(0);
      for (const s of p.startHere) expect(s.url, p.name).toMatch(/^https:\/\//);
    }
  });

  it('varje påstående har märkning och https-källa', () => {
    for (const p of PEOPLE) {
      for (const c of p.claims) {
        expect(Object.keys(EVIDENCE_LABEL), c.text).toContain(c.evidence);
        expect(c.sources.length, c.text).toBeGreaterThan(0);
        for (const s of c.sources) {
          expect(s.url, c.text).toMatch(/^https:\/\//);
          expect(s.title.trim().length, c.text).toBeGreaterThan(0);
        }
      }
    }
  });

  it('inga citattecken eller tankstreck i texten', () => {
    for (const p of PEOPLE) {
      const texts = [
        p.kind,
        p.teaser,
        p.about,
        ...p.method,
        ...p.claims.flatMap(c => [c.text, c.note ?? '', ...c.summary]),
        p.warning ?? '',
        ...p.claims.flatMap(c => c.sources.map(s => s.title)),
        ...p.startHere.flatMap(s => [s.title, ...(s.summary ?? [])]),
      ];
      for (const t of texts) expect(t, `${p.name}: ${t}`).not.toMatch(FORBIDDEN);
    }
  });

  it('personer inom andning eller kallbad har en varning', () => {
    for (const p of PEOPLE) {
      if (p.areas.includes('andning') || p.areas.includes('kallbad')) {
        expect(p.warning?.trim().length ?? 0, p.name).toBeGreaterThan(0);
      }
    }
  });

  // Regeln är värdbaserad: en källa räknas som ursprunglig forskning om dess värd inte finns i OWN_HOSTS.
  it('Clear och Williamson: egna idéer är åsikt eller har källa utanför egen sajt', () => {
    for (const [name, hosts] of Object.entries(OWN_HOSTS)) {
      const p = PEOPLE.find(x => x.name === name)!;
      for (const c of p.claims) {
        if (c.evidence === 'asikt') continue;
        const outside = c.sources.some(s => !hosts.includes(hostOf(s.url)));
        expect(outside, `${name}: ${c.text}`).toBe(true);
      }
    }
  });

  it('svagt stöd förklaras i en not', () => {
    for (const p of PEOPLE) {
      for (const c of p.claims) {
        if (c.evidence === 'svagt') expect(c.note?.trim().length ?? 0, c.text).toBeGreaterThan(0);
      }
    }
  });

  it('varje påstående har en sammanfattning på 2 till 4 stycken och 60 till 140 ord', () => {
    for (const p of PEOPLE) {
      for (const c of p.claims) {
        const sum = c.summary;
        expect(sum.length, `${p.name}: ${c.text}`).toBeGreaterThanOrEqual(2);
        expect(sum.length, `${p.name}: ${c.text}`).toBeLessThanOrEqual(4);
        for (const para of sum) expect(para.trim().length, c.text).toBeGreaterThan(0);
        const n = words(sum);
        expect(n, `${p.name}: ${c.text} (${n} ord)`).toBeGreaterThanOrEqual(60);
        expect(n, `${p.name}: ${c.text} (${n} ord)`).toBeLessThanOrEqual(140);
      }
    }
  });

  it('ingen sammanfattning upprepar rubriken eller noten ordagrant', () => {
    for (const p of PEOPLE) {
      for (const c of p.claims) {
        for (const para of c.summary) {
          expect(para.trim(), c.text).not.toBe(c.text.trim());
          if (c.note) expect(para.trim(), c.text).not.toBe(c.note.trim());
        }
      }
    }
  });

  it('varje Börja här har 3 till 5 huvudpunkter på en mening var', () => {
    for (const p of PEOPLE) {
      for (const s of p.startHere) {
        const pts = s.summary ?? [];
        expect(pts.length, `${p.name}: ${s.title}`).toBeGreaterThanOrEqual(3);
        expect(pts.length, `${p.name}: ${s.title}`).toBeLessThanOrEqual(5);
        for (const pt of pts) {
          expect(pt.trim().length, s.title).toBeGreaterThan(0);
          // En mening: slutar med punkt och har ingen punkt följd av mellanslag och versal inuti.
          expect(pt, s.title).toMatch(/\.$/);
          expect(pt.slice(0, -1), s.title).not.toMatch(/\. [A-ZÅÄÖ]/);
        }
      }
    }
  });

  it('märkningarna har rätt text', () => {
    expect(EVIDENCE_LABEL).toEqual({ belagt: 'Väl belagt', svagt: 'Svagt stöd', asikt: 'Egen åsikt' });
  });
});
