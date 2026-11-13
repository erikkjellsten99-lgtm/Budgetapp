import { describe, expect, it } from 'vitest'
import { monthTool, runTool, stateTool, systemPrompt, toEconomy, TOOLS } from './tools.ts'
import { overviewNumbers, summaryFacts } from '../inbox/summary.ts'
import { monthPlans } from '../inbox/months.ts'
import { MAX_MONTHS } from '../inbox/goalPlan.ts'
import { prioritizeToday } from '../inbox/priority.ts'
import { formatKr } from '../inbox/money.ts'

const today = '2026-11-13'
const november = [
  { id: 'hem', name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 27269 },
  { id: 'mat', name: 'Mat', type: 'variable', monthlyBudget: 6000, items: [{ id: 'i', name: 'Lunch', amount: 6000 }] },
  { id: 'gem', name: 'Gemensamt sparande', type: 'savings', monthlyBudget: 3000 },
  { id: 'tom', name: 'Oanvänd', type: 'variable', monthlyBudget: 0 },
]
const december = [...november.slice(0, 3), { id: 'jul', name: 'Jul', type: 'variable', monthlyBudget: 4000 }]

// Raderna som de ligger i tabellen records (store + data), i blandad ordning och med en borttagen post utan data.
const rows = [
  { store: 'budgets', data: { month: '2026-12', categories: december } },
  { store: 'budgets', data: { month: '2026-11', categories: november } },
  { store: 'income', data: { month: '2026-11', csn: 18280, other: 32000 } },
  { store: 'categories', data: november[0] },
  { store: 'assets', data: { id: 'a', name: 'Avanza (gemensamt)', amount: 69940, updated: today } },
  { store: 'assets', data: { id: 'h', name: 'Hushållskonto', amount: 4200, updated: today, spending: true } },
  { store: 'goals', data: { id: 'g', name: 'Gemensamt sparmål', target: 1000000, monthlyDeposit: 0, annualReturn: 7, assetIds: ['a'] } },
  {
    store: 'loans',
    data: { id: 'billan', name: 'Billån', balance: 95927, annualRate: 8.45, monthlyPayment: 1586, amortization: 0, fees: 143, categoryName: 'Billån', startMonth: '2026-11', payExtra: false },
  },
  { store: 'wishes', data: { id: 'w', list: 'erik', name: 'Cykel', amount: 5095, paidMonth: '2026-10' } },
  { store: 'wishes', data: { id: 'w2', list: 'erik', name: 'Hörlurar', amount: 2500 } },
  { store: 'debts', data: { id: 'd', name: 'Mamma', amount: 0 } },
  { store: 'trades', data: null },
  { store: 'något-nytt', data: { x: 1 } },
]
const economy = toEconomy(rows, {}, today)

describe('toEconomy', () => {
  it('sorterar månader och hoppar över tomma och okända poster', () => {
    expect(economy.budgets.map((b) => b.month)).toEqual(['2026-11', '2026-12'])
    expect(economy.trades).toEqual([])
    expect(economy.goal?.name).toBe('Gemensamt sparmål')
    expect(economy.loan?.name).toBe('Billån')
  })
})

describe('hamta_manad', () => {
  it('ger samma siffror som Översikt (overviewNumbers) för månaden', () => {
    const [plan] = monthPlans(economy.budgets, economy.incomes, economy.categories, '2026-12', 1)
    const o = overviewNumbers(plan, economy.wishes, economy.assets)
    const m = monthTool(economy, '2026-12')
    expect(m).toMatchObject({ manad: 'december 2026', ar_innevarande_manad: false, kostnader: o.costs, planerat_sparande: o.plannedSavings, blir_over: o.left })
    expect(m).toMatchObject({ inkomster: { csn: 18280, ovrigt: 32000, summa: 50280 }, blir_over: 50280 - 27269 - 6000 - 4000 - 3000 })
  })

  it('listar kategorier med belopp och rader, utan tomma kategorier', () => {
    const m = monthTool(economy, '2026-11') as { kategorier: { namn: string; typ: string; belopp: number; rader?: unknown }[]; ar_innevarande_manad: boolean }
    expect(m.ar_innevarande_manad).toBe(true)
    expect(m.kategorier.map((c) => c.namn)).toEqual(['Hem & hushåll', 'Mat', 'Gemensamt sparande'])
    expect(m.kategorier[1]).toEqual({ namn: 'Mat', typ: 'rörlig utgift', belopp: 6000, rader: [{ namn: 'Lunch', belopp: 6000 }] })
    expect(m.kategorier[2].typ).toBe('sparande')
  })

  it('en månad utan egen budget utgår från närmaste tidigare, som i appen', () => {
    expect(monthTool(economy, '2027-03')).toMatchObject({ manad: 'mars 2027', kostnader: 27269 + 6000 + 4000 })
  })

  it('fel form på månaden eller för långt fram ger ett felsvar, inget påhittat', () => {
    expect(monthTool(economy, 'december')).toHaveProperty('fel')
    expect(monthTool(economy, '2026-13')).toHaveProperty('fel')
    expect(monthTool(economy, '2099-01')).toHaveProperty('fel')
    expect(monthTool(toEconomy([], {}, today), '2026-11')).toHaveProperty('fel')
  })
})

describe('hamta_lage', () => {
  it('citerar sammanfattningens texter, så att beloppen är de appen visar', () => {
    const f = summaryFacts({
      today,
      plans: monthPlans(economy.budgets, economy.incomes, economy.categories, '2026-11', MAX_MONTHS + 1),
      assets: economy.assets,
      holdings: [],
      trades: [],
      prices: {},
      goal: economy.goal,
      loan: economy.loan,
      wishes: economy.wishes,
      priority: prioritizeToday([], {}, new Set(), [], today),
      tasks: [],
      health: [],
    })
    const s = stateTool(economy)
    expect(s).toMatchObject({
      nettovarde: f.netWorth,
      pengar_att_anvanda: formatKr(4200),
      sparmal: { sparat: f.goal!.current, mal: f.goal!.target, procent: f.goal!.percent, prognos: f.goal!.status },
      billan: { kvar: f.loan!.left, nasta_betalning: f.loan!.payment, manad: 'december 2026' },
      investeringar: null,
      denna_manad: { manad: 'november 2026', blir_over: f.left },
      skulder: [],
    })
    expect(s).toMatchObject({ onskelista: { kvar_att_kopa_kr: 2500, saker: [{ namn: 'Cykel', pris_kr: 5095, kopt: 'oktober 2026' }, { namn: 'Hörlurar', pris_kr: 2500 }] } })
    expect(s).toMatchObject({ konton: [{ namn: 'Avanza (gemensamt)', saldo_kr: 69940 }, { namn: 'Hushållskonto', saldo_kr: 4200, raknas_inte_i_nettovardet: true }] })
  })

  it('tom ekonomi ger ett felsvar', () => {
    expect(stateTool(toEconomy([], {}, today))).toHaveProperty('fel')
  })
})

describe('runTool', () => {
  it('svarar med JSON och märker fel', () => {
    const ok = runTool('hamta_manad', { manad: ' 2026-11 ' }, economy)
    expect(ok.isError).toBe(false)
    expect(JSON.parse(ok.content).manad).toBe('november 2026')
    expect(runTool('hamta_lage', {}, economy).isError).toBe(false)
    for (const bad of [runTool('hamta_manad', {}, economy), runTool('hamta_manad', null, economy), runTool('radera_allt', {}, economy)]) {
      expect(bad.isError).toBe(true)
      expect(JSON.parse(bad.content)).toHaveProperty('fel')
    }
  })

  it('verktygen kan bara läsa: två verktyg, inget som ändrar', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['hamta_manad', 'hamta_lage'])
    for (const tool of TOOLS) expect(tool.input_schema.additionalProperties).toBe(false)
  })
})

describe('systemPrompt', () => {
  it('säger att svaren läses upp, och bär dagens datum', () => {
    const prompt = systemPrompt(today)
    expect(prompt).toContain('läses upp')
    expect(prompt).toContain('Inga listor')
    expect(prompt).toContain('Avrunda')
    expect(prompt).toContain('2026-11-13')
    expect(prompt).toContain('november 2026')
  })
})
