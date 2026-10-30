import { describe, expect, it } from 'vitest'
import { holeShare, paidThisMonth, wishMonths } from './economy'
import type { Category } from '../types'

describe('ekonomin i galaxen', () => {
  it('betalt i månaden: markerade rader, eller hela kategorin utan rader', () => {
    const withItems: Category = {
      id: 'a',
      name: 'Abonnemang',
      type: 'fixed',
      monthlyBudget: 300,
      items: [
        { id: '1', name: 'Spotify', amount: 100, paidMonth: '2026-10' },
        { id: '2', name: 'Netflix', amount: 200, paidMonth: '2026-09' },
      ],
    }
    expect(paidThisMonth(withItems, '2026-10')).toBe(100)
    expect(paidThisMonth({ id: 'b', name: 'Hyra', type: 'fixed', monthlyBudget: 8000, paidMonth: '2026-10' }, '2026-10')).toBe(8000)
    expect(paidThisMonth({ id: 'b', name: 'Hyra', type: 'fixed', monthlyBudget: 8000 }, '2026-10')).toBe(0)
  })

  it('önskningar räknas i månaders överskott, null när inget blir över', () => {
    expect(wishMonths(1500, 3000)).toBe(0.5)
    expect(wishMonths(9000, 3000)).toBe(3)
    expect(wishMonths(500, 0)).toBeNull()
  })

  it('hålet krymper med det som är kvar och försvinner vid noll', () => {
    expect(holeShare(100, 100)).toBe(1)
    expect(holeShare(25, 100)).toBe(0.5)
    expect(holeShare(0, 100)).toBe(0)
  })
})
