import { describe, expect, it } from 'vitest';
import { amountToSave, isInvalidAmount } from './useAmountInput';

describe('amountToSave', () => {
  it('ett tömt fält sparas inte (blir inte 0 kr)', () => {
    expect(amountToSave('', 1701)).toBeNull();
    expect(amountToSave('   ', 1701)).toBeNull();
  });

  it('0 sparas när du skriver 0', () => {
    expect(amountToSave('0', 1701)).toBe(0);
  });

  it('svenska belopp med mellanslag och decimalkomma', () => {
    expect(amountToSave('1 234,50', 0)).toBe(1234.5);
    expect(amountToSave('1 234', 0)).toBe(1234);
    expect(amountToSave('49,9', 0)).toBe(49.9);
  });

  it('stora tal', () => {
    expect(amountToSave('12 345 678', 0)).toBe(12345678);
  });

  it('ogiltigt eller negativt sparas inte', () => {
    expect(amountToSave('abc', 500)).toBeNull();
    expect(amountToSave('-5', 500)).toBeNull();
    expect(amountToSave('1,2,3', 500)).toBeNull();
  });

  it('samma belopp som förut sparas inte igen', () => {
    expect(amountToSave('1 701', 1701)).toBeNull();
  });

  it('respekterar max (t.ex. avkastning högst 30 %)', () => {
    expect(amountToSave('31', 7, 30)).toBeNull();
    expect(amountToSave('7,5', 7, 30)).toBe(7.5);
  });
});

describe('isInvalidAmount', () => {
  it('tomt är inte fel, bokstäver är fel', () => {
    expect(isInvalidAmount('')).toBe(false);
    expect(isInvalidAmount('12a')).toBe(true);
    expect(isInvalidAmount('40', 30)).toBe(true);
  });
});
