import { describe, expect, it } from 'vitest'
import { habitsTool, monthTool, runTool, stateTool, systemPrompt, toDay, toEconomy, toMessages, TOOLS } from './tools.ts'
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

// 2026-11-13 är en fredag. Raderna som de ligger i personal_records, i blandad ordning.
const habit = (id: string, name: string, goal: number, order: number, extra: object = {}) => ({
  store: 'habits',
  data: { id, name, goal, created: '2026-10-01', after: [], order, archived: false, ...extra },
})
const check = (date: string, habitId: string) => ({ data: { date, habitId } })
const personal = [
  habit('gym', 'Gym', 3, 2),
  habit('med', 'Meditation', 7, 0, { minimum: '2 min' }),
  habit('las', 'Läsa', 7, 1),
  habit('lop', 'Löpning', 1, 3),
  habit('gammal', 'Gammal vana', 7, 4, { archived: true }),
  { store: 'tasks', data: { id: 't1', title: 'Ring banken', date: '2026-11-12', created: 1 } },
  { store: 'tasks', data: { id: 't2', title: 'Tvätta', date: today, doneOn: today, created: 2 } },
  { store: 'tasks', data: { id: 't3', title: 'Boka tandläkare', date: '2026-11-20', created: 3 } },
  { store: 'pauses', data: null },
]
const checks = [check(today, 'las'), check('2026-11-12', 'las'), check('2026-11-10', 'gym'), check('2026-11-09', 'lop'), { data: null }]
const withDay = { ...economy, day: toDay(personal, checks) }

describe('hamta_vanor', () => {
  it('delar upp dagen som Prioritera idag (prioritizeToday)', () => {
    const d = withDay.day
    const p = prioritizeToday(d.habits, d.log, d.paused, d.tasks, today)
    const h = habitsTool(withDay) as {
      kvar_att_bocka_av: { maste_goras_idag: { namn: string }[]; kan_vanta: { namn: string }[] }
      bockade_idag: { namn: string }[]
      inte_aktuella_idag: { namn: string }[]
    }
    expect(h.kvar_att_bocka_av.maste_goras_idag.map((r) => r.namn)).toEqual(p.must.map((r) => r.habit.name))
    expect(h.kvar_att_bocka_av.kan_vanta.map((r) => r.namn)).toEqual(p.flexible.map((r) => r.habit.name))
    expect(h.kvar_att_bocka_av.maste_goras_idag.map((r) => r.namn)).toEqual(['Meditation'])
    expect(h.kvar_att_bocka_av.kan_vanta.map((r) => r.namn)).toEqual(['Gym'])
    expect(h.bockade_idag.map((r) => r.namn)).toEqual(['Läsa'])
    expect(h.inte_aktuella_idag.map((r) => r.namn)).toEqual(['Löpning'])
  })

  it('bär veckans läge, minsta version, Att göra och vad man börjar med', () => {
    expect(habitsTool(withDay)).toMatchObject({
      datum: today,
      veckodag: 'fredag',
      pausad_idag: false,
      kvar_att_bocka_av: {
        maste_goras_idag: [{ namn: 'Meditation', denna_vecka: '0 av 7', minsta_version: '2 min' }],
        kan_vanta: [{ namn: 'Gym', denna_vecka: '1 av 3', lage: ['2 kvar på 3 dagar, kan vänta till i morgon'] }],
      },
      bockade_idag: [{ namn: 'Läsa', denna_vecka: '2 av 7', lage: ['2 dagar i rad'] }],
      inte_aktuella_idag: [{ namn: 'Löpning', lage: ['Veckomål klart'] }],
      att_gora: { kvar: [{ titel: 'Ring banken', nar: 'Försenad sedan tors 12 nov' }], klart_idag: ['Tvätta'] },
      borja_med: 'Ring banken',
      klart_idag: '2 av 4',
    })
  })

  it('en pausad dag har inga måsten', () => {
    const paused = { ...economy, day: toDay([...personal, { store: 'pauses', data: { date: today } }], checks) }
    expect(habitsTool(paused)).toMatchObject({ pausad_idag: true, kvar_att_bocka_av: { maste_goras_idag: [], kan_vanta: [] } })
  })

  it('utan vanor, eller när de inte gick att läsa, blir det ett felsvar', () => {
    expect(habitsTool(economy)).toHaveProperty('fel')
    expect(habitsTool({ ...economy, day: null })).toHaveProperty('fel')
    expect(habitsTool({ ...economy, day: toDay([], []) })).toHaveProperty('fel')
    expect(runTool('hamta_vanor', {}, economy).isError).toBe(true)
    expect(runTool('hamta_vanor', {}, withDay).isError).toBe(false)
  })

  it('innehåller ingen ekonomi', () => {
    expect(runTool('hamta_vanor', {}, withDay).content).not.toMatch(/69940|Avanza|Billån/)
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

  it('verktygen kan bara läsa: tre verktyg, inget som ändrar', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['hamta_manad', 'hamta_lage', 'hamta_vanor'])
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
    expect(prompt).toContain('hamta_vanor')
  })

  it('ber om ett samtal, inte bara siffror, och hittar inte på', () => {
    const prompt = systemPrompt(today)
    expect(prompt).toContain('Det här är ett samtal')
    expect(prompt).toContain('Hitta inte på')
    expect(prompt).toContain('Du kan bara läsa')
  })

  it('använder förnamnet om det finns', () => {
    expect(systemPrompt(today, ' Erik ')).toContain('Du pratar med Erik,')
    expect(systemPrompt(today, '')).not.toContain('Du pratar med')
    expect(systemPrompt(today, null)).not.toContain('Du pratar med')
  })
})

describe('toMessages', () => {
  it('utan historik blir det bara frågan', () => {
    expect(toMessages(undefined, 'Vad blir över?')).toEqual([{ role: 'user', content: 'Vad blir över?' }])
    expect(toMessages('skräp', 'Vad blir över?')).toHaveLength(1)
  })

  it('lägger de senaste utbytena före frågan, äldst först', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({ question: `fråga ${i}`, answer: `svar ${i}` }))
    const m = toMessages(history, 'och i januari då?')
    expect(m).toHaveLength(9)
    expect(m[0]).toEqual({ role: 'user', content: 'fråga 2' })
    expect(m[7]).toEqual({ role: 'assistant', content: 'svar 5' })
    expect(m[8]).toEqual({ role: 'user', content: 'och i januari då?' })
    expect(m.map((x) => x.role).join(',')).toBe('user,assistant,user,assistant,user,assistant,user,assistant,user')
  })

  it('hoppar över fel form och kortar långa texter', () => {
    const m = toMessages([null, { question: 'a' }, { question: 5, answer: 'x' }, { question: ' ok ', answer: 'y'.repeat(5000) }], 'ny')
    expect(m).toHaveLength(3)
    expect(m[0].content).toBe('ok')
    expect(m[1].content).toHaveLength(800)
  })
})
