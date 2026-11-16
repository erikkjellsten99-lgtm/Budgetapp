import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FormCard } from './ChallengeDetail';

describe('Dagens form', () => {
  it('visar formen och siffrorna som avgjorde', () => {
    const html = renderToStaticMarkup(<FormCard readiness={{ form: 'sliten', points: 3, facts: ['5 h 2 min sömn', '135 min träning igår'] }} />);
    expect(html).toContain('Dagens form');
    expect(html).toContain('Sliten');
    expect(html).toContain('is-sliten');
    expect(html).toContain('5 h 2 min sömn · 135 min träning igår');
  });

  it('säger vad som saknas när nattens sömn inte har kommit in', () => {
    const html = renderToStaticMarkup(<FormCard readiness={{ form: null, points: 0, facts: [] }} />);
    expect(html).toContain('Ingen sömn från i natt än');
    expect(html).toContain('Hälsa Groundwork daglig');
    expect(html).not.toContain('is-');
  });
});
