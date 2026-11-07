import { describe, expect, it } from 'vitest';
import { signedKr } from './chartUtil';

describe('signedKr', () => {
  it('plustecken för vinst, avrundat till öre', () => {
    expect(signedKr(199.385)).toBe('+199,39 kr');
    expect(signedKr(1042.0000001)).toBe('+1 042 kr');
  });

  it('riktigt minustecken för förlust, utan flyttalsbrus', () => {
    expect(signedKr(-1042.0000001)).toBe('−1 042 kr');
    expect(signedKr(-0.5)).toBe('−0,50 kr');
  });

  it('inget tecken för 0, även när det avrundas till 0', () => {
    expect(signedKr(0)).toBe('0 kr');
    expect(signedKr(-0.001)).toBe('0 kr');
    expect(signedKr(0.001)).toBe('0 kr');
  });
});
