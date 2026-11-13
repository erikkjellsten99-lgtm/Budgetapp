// Jarvis mot servern: hur svaren tolkas, hälsningen och adressen som öppnar Jarvis. Inget nätverk.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { greeting, readReply, SIGNED_OUT, wantsJarvis } from './jarvisApi';
import { firstNameOf } from './sync';

describe('readReply', () => {
  it('ett svar från servern', () => {
    expect(readReply(200, { answer: ' Ungefär sextontusen kronor. ', used: 3, limit: 50 })).toEqual({ ok: true, answer: 'Ungefär sextontusen kronor.' });
  });

  it('den 51:a frågan: gränsen, med serverns text', () => {
    const message = 'Du har ställt 50 frågor i dag, och det är gränsen. I morgon går det igen.';
    expect(readReply(429, { error: 'grans', message, used: 50, limit: 50 })).toEqual({ ok: false, reason: 'grans', message });
  });

  it('utloggad, fel på servern och trasiga svar', () => {
    expect(readReply(401, { error: 'utloggad', message: 'x' })).toEqual({ ok: false, reason: 'utloggad', message: SIGNED_OUT });
    expect(readReply(502, { error: 'claude', message: 'Det gick inte att få ett svar just nu. Försök igen.' })).toMatchObject({ ok: false, reason: 'fel' });
    expect(readReply(500, null)).toMatchObject({ ok: false, reason: 'fel' });
    expect(readReply(200, { answer: '' })).toMatchObject({ ok: false, reason: 'fel' });
    expect(readReply(200, 'inte json')).toMatchObject({ ok: false });
  });
});

describe('hälsningen', () => {
  it('med förnamn, och utan när det inte är ifyllt', () => {
    expect(greeting('Erik')).toBe('Hej Erik, hur står det till i dag? Vad kan jag hjälpa dig med?');
    expect(greeting(null)).toBe('Hej, hur står det till i dag? Vad kan jag hjälpa dig med?');
    expect(greeting('  ')).toBe('Hej, hur står det till i dag? Vad kan jag hjälpa dig med?');
  });

  it('förnamnet läses ur kontots metadata', () => {
    expect(firstNameOf({ first_name: ' Erik ' })).toBe('Erik');
    expect(firstNameOf({ email: 'a@b.se' })).toBeNull();
    expect(firstNameOf({ first_name: 42 })).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});

describe('adressen som öppnar Jarvis', () => {
  it('?jarvis=1&listen=1 och /jarvis?listen=1', () => {
    expect(wantsJarvis({ pathname: '/Budgetapp/', search: '?jarvis=1&listen=1' })).toBe(true);
    expect(wantsJarvis({ pathname: '/Budgetapp/', search: '?jarvis=1' })).toBe(true);
    expect(wantsJarvis({ pathname: '/jarvis', search: '?listen=1' })).toBe(true);
    expect(wantsJarvis({ pathname: '/Budgetapp/jarvis/', search: '' })).toBe(true);
    expect(wantsJarvis({ pathname: '/Budgetapp/', search: '' })).toBe(false);
    expect(wantsJarvis({ pathname: '/Budgetapp/', search: '?listen=1' })).toBe(false);
  });
});
