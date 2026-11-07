import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { overviewNumbers, summaryFacts, summaryText, type SummaryInput } from './summary.ts'
import { answer, HIDDEN_MONEY } from './ask.ts'
import { prioritizeToday } from './priority.ts'
import { formatKr } from './money.ts'
import type { Asset, Holding, Trade } from './types.ts'

const today = '2026-11-06'
const habits = [{ id: 'm', name: 'Meditation', goal: 7, order: 0, created: '2026-10-01', after: [], archived: false }]
const tasks = [{ id: 't', title: 'Ringa', date: today, time: '14:00', created: 1 }]
const budget = [
  { id: 'hem', name: 'Hem', type: 'fixed' as const, monthlyBudget: 27269 },
  { id: 'gem', name: 'Spar', type: 'savings' as const, monthlyBudget: 500 },
]
const plans = Array.from({ length: 13 }, (_, i) => {
  const month = `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, '0')}`
  return { month, categories: budget, income: { month, csn: 18280, other: 32000 } }
})
const assets: Asset[] = [
  { id: 'a', name: 'Avanza', amount: 69940, updated: today },
  { id: 'b', name: 'Pengar', amount: 1234, updated: today, spending: true },
]
const wishes = [{ id: 'w', list: 'erik' as const, name: 'Cykel', amount: 5095, paidMonth: '2026-11' }]
const base: SummaryInput = {
  today,
  plans,
  assets,
  wishes,
  priority: prioritizeToday(habits, {}, new Set(), tasks, today),
  tasks,
  goal: { id: 'g', name: 'Mål', target: 1000000, monthlyDeposit: 0, annualReturn: 7, assetIds: ['a'] },
  loan: { id: 'billan', name: 'Billån', balance: 95927, annualRate: 8.45, monthlyPayment: 1586, amortization: 0, fees: 143, categoryName: 'Billån', startMonth: '2026-11', payExtra: false },
  health: [{ date: today, updated: 1, values: { sleepH: 8.7, steps: 41 } }],
  holdings: [],
  trades: [],
  prices: {},
}

describe('utan innehav är sammanfattningen oförändrad', () => {
  it('samma text, Översikt och fakta som före ändringen', () => {
    const before = JSON.parse(readFileSync(new URL('./summary.baseline.json', import.meta.url), 'utf8'))
    expect(summaryText(base)).toBe(before.text)
    expect(plans.map((p) => overviewNumbers(p, wishes, assets))).toEqual(before.ov)
    const { investments, ...rest } = summaryFacts(base)
    expect(investments).toBeNull()
    expect(JSON.parse(JSON.stringify(rest))).toEqual(before.facts)
  })
})

describe('med innehav', () => {
  const holdings: Holding[] = [{ id: 'h', assetId: 'a', name: 'Fond', type: 'fund', ticker: 'FOND' }]
  const trades: Trade[] = [{ id: 't1', holdingId: 'h', date: '2026-01-02', side: 'buy', quantity: 10, price: 100, fee: 0 }]
  const withHoldings = (prices: SummaryInput['prices'], accounts: Asset[] = assets): SummaryInput => ({
    ...base,
    assets: accounts,
    holdings,
    trades,
    prices,
  })
  const prices = { FOND: [{ date: '2026-11-05', close: 105 }] }

  it('kontot fromHoldings ger nettovärde = innehavsvärde + kontanter', () => {
    const accounts: Asset[] = [{ id: 'a', name: 'Avanza', amount: 0, cash: 500, fromHoldings: true, updated: today }, assets[1]]
    const f = summaryFacts(withHoldings(prices, accounts))
    expect(f.netWorth).toBe(formatKr(1050 + 500))
    expect(f.investments).toEqual({
      value: formatKr(1050),
      invested: formatKr(1000),
      change: formatKr(50),
      changePct: expect.closeTo(0.05, 6),
      date: '5 nov',
    })
    expect(summaryText(withHoldings(prices, accounts))).toContain(`Investeringar: ${formatKr(1050)} (+5,0\u00a0%), kurser från 5 nov`)
  })

  it('utan kurs: värde saknas', () => {
    const f = summaryFacts(withHoldings({}))
    expect(f.investments).toEqual({ value: null, invested: formatKr(1000), change: null, changePct: null, date: null })
    expect(summaryText(withHoldings({}))).toContain(`Investeringar: värde saknas (investerat ${formatKr(1000)})`)
  })

  it('Fråga Groundwork', () => {
    const f = summaryFacts(withHoldings(prices))
    expect(answer('hur går fonderna', f)).toBe(`Investeringarna är värda ${formatKr(1050)}, 5,0\u00a0% upp sedan köpen. Kurser från 5 nov.`)
    expect(answer('hur går fonderna', f, { hideMoney: true })).toBe(HIDDEN_MONEY)
    expect(answer('hur går fonderna', summaryFacts(withHoldings({})))).toBe('Det finns inga kurser för investeringarna än.')
    expect(answer('hur går aktierna', summaryFacts(base))).toBe('Det finns inga investeringar inlagda.')
    const down = summaryFacts(withHoldings({ FOND: [{ date: '2026-11-05', close: 95 }] }))
    expect(answer('hur går min portfölj', down)).toContain('5,0 % ned sedan köpen')
  })
})
