import { describe, expect, it } from 'vitest'
import { answer, dayBrief, EXAMPLES, HIDDEN_MONEY, normalize } from './ask.ts'
import { summaryFacts, summaryLines, type SummaryInput } from './summary.ts'
import { prioritizeToday } from './priority.ts'
import type { Loan } from './forecast.ts'

const today = '2026-11-06'
const habits = [
  { id: 'm', name: 'Meditation', goal: 7, order: 0, created: '2026-10-01', after: [], archived: false },
  { id: 'g', name: 'Gym', goal: 3, order: 1, created: '2026-10-01', after: [], archived: false },
]
const tasks = [{ id: 't', title: 'Ringa tandläkaren', date: today, time: '14:00', created: 1 }]
const loan: Loan = {
  id: 'billan', name: 'Billån', balance: 95927, annualRate: 8.45, monthlyPayment: 1586, amortization: 0, fees: 143,
  categoryName: 'Billån', startMonth: '2026-11', payExtra: false,
}
const budget = [
  { id: 'hem', name: 'Hem & hushåll', type: 'fixed' as const, monthlyBudget: 27269 },
  { id: 'gem', name: 'Gemensamt sparande', type: 'savings' as const, monthlyBudget: 0 },
]
const plans = Array.from({ length: 13 }, (_, i) => {
  const month = `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, '0')}`
  return { month, categories: budget, income: { month, csn: 18280, other: 32000 } }
})

const input: SummaryInput = {
  today,
  plans,
  assets: [{ id: 'a', name: 'Avanza (gemensamt)', amount: 69940, updated: today }],
  goal: { id: 'g', name: 'Gemensamt sparmål', target: 1000000, monthlyDeposit: 0, annualReturn: 7, assetIds: ['a'] },
  loan,
  wishes: [{ id: 'w', list: 'erik', name: 'Cykel', amount: 5095, paidMonth: '2026-10' }],
  priority: prioritizeToday(habits, {}, new Set(), tasks, today),
  tasks,
  health: [{ date: today, updated: 1, values: { sleepH: 8.7, steps: 41 } }],
}
const facts = summaryFacts(input)
const lines = summaryLines(input).join('\n')
const ask = (q: string) => answer(q, facts)

describe('Fråga Groundwork', () => {
  it('ekonomi: samma belopp som sammanfattningen', () => {
    expect(ask('Vad blir över den här månaden?')).toBe(`I november 2026 blir det ${facts.left} över efter utgifter och planerat sparande.`)
    expect(lines).toContain(facts.left)
    expect(ask('Hur mycket är inkomsterna?')).toContain(facts.income)
    expect(ask('vad kostar allt i månaden')).toContain(facts.costs)
    expect(ask('Hur mycket har vi på sparkontona')).toBe(`Nettovärdet på sparkontona är ${facts.netWorth}.`)
  })

  it('sparmål, billån och önskelista', () => {
    expect(ask('När nås sparmålet?')).toBe(`Gemensamt sparmål: ${facts.goal!.current} av ${facts.goal!.target}, 7 procent. ${facts.goal!.status}`)
    expect(ask('Hur mycket är kvar på billånet?')).toBe(`Billån: ${facts.loan!.left} kvar. Nästa betalning är ${facts.loan!.payment} i december 2026.`)
    expect(ask('Vad är kvar att köpa på önskelistan?')).toContain(`kvar att köpa är ${facts.wishes.leftToBuy}`)
  })

  it('dagen: Att göra, måsten och klart', () => {
    expect(ask('Vad har jag att göra idag?')).toBe('Att göra idag: Ringa tandläkaren 14:00.')
    expect(ask('Vad måste jag göra idag?')).toBe('Måste göras idag: Meditation och Gym. Börja med Ringa tandläkaren.')
    expect(ask('Hur mycket är klart?')).toBe(`Klart idag: ${facts.done} av ${facts.total}.`)
  })

  it('hälsa, och flera frågor på en gång', () => {
    expect(ask('Hur sov jag i natt?')).toBe('Du sov 8 h 42 min enligt Hälsa (idag).')
    expect(ask('hur många steg har jag gått')).toBe('Du har gått 41 steg enligt Hälsa (idag).')
    expect(ask('Hur sov jag och hur många steg?')).toBe('Du sov 8 h 42 min enligt Hälsa (idag). Du har gått 41 steg enligt Hälsa (idag).')
    expect(ask('Vilopuls?')).toBe('Det finns ingen vilopuls från Hälsa för idag än.')
  })

  it('"kvar" och "spara" i andra frågor ger inte också "blir över"', () => {
    expect(ask('Hur mycket är kvar på lånet?')).not.toContain('blir det')
    expect(ask('Hur mycket har vi sparat till målet?')).not.toContain('blir det')
    expect(ask('Hur mycket har vi kvar?')).toContain('blir det')
  })

  it('förstår inte: svarar ändå med dagens läge', () => {
    const reply = ask('Vad blir det för väder?')
    expect(reply).toMatch(/^Det har jag inget exakt svar på, men så här är läget: /)
    expect(reply).toContain(facts.left)
    expect(reply).toContain(`Klart idag: ${facts.done} av ${facts.total}.`)
    expect(ask('')).toMatch(/^Fråga till exempel: /)
    for (const example of EXAMPLES) expect(ask('')).toContain(example)
  })

  it('allmänna frågor får ett samlat svar', () => {
    expect(ask('Hur går det?')).toBe(dayBrief(facts))
    expect(ask('Hur ser ekonomin ut?')).toContain(`Inkomster ${facts.income}, kostnader ${facts.costs}`)
    expect(ask('Hur mår jag?')).toContain('sömn 8 h 42 min')
  })

  it('tål felstavning och å/ä/ö skrivna som a/o', () => {
    expect(ask('hur mycket ar inkomsterna')).toContain(facts.income)
    expect(ask('nar nas sparmalet')).toContain(facts.goal!.target)
    expect(ask('hur somnade jag')).toContain('Du sov')
    expect(ask('inkomser')).toContain(facts.income)
    expect(ask('Hur mycket kostar allt?')).toContain(facts.costs)
  })

  it('normalize: gemener, å/ä/ö kvar, skiljetecken bort', () => {
    expect(normalize('  Hur SOV jag?? ')).toBe(' hur sov jag ')
    expect(normalize('Önskelistan!')).toBe(' önskelistan ')
  })
})

describe('vad ska jag göra', () => {
  it('ger vanorna och vad som ska göras först', () => {
    expect(answer('Vad ska jag göra idag?', facts)).toBe('Måste göras idag: Meditation och Gym. Börja med Ringa tandläkaren.')
  })
})

describe('småprat och visningsläge', () => {
  it('hälsningar och vad Jarvis kan, utan belopp', () => {
    expect(ask('Hej Jarvis')).toMatch(/^Hej! Jag är Jarvis/)
    expect(ask('Vad kan du?')).toMatch(/^Jag är Jarvis i Groundwork/)
    expect(ask('Tack!')).toBe('Varsågod!')
    // En fråga efter hälsningen vinner
    expect(ask('Hej, hur sov jag?')).toBe('Du sov 8 h 42 min enligt Hälsa (idag).')
  })

  it('visningsläge: inga belopp, men vanor och hälsa svarar som vanligt', () => {
    const hidden = (q: string) => answer(q, facts, { hideMoney: true })
    for (const q of ['Vad blir över?', 'Hur mycket är kvar på billånet?', 'När nås sparmålet?', 'Hur ser ekonomin ut?', 'Inkomster?', 'Önskelistan']) {
      expect(hidden(q)).toBe(HIDDEN_MONEY)
    }
    for (const q of ['Hur går det?', 'Vad blir det för väder?']) {
      const reply = hidden(q)
      expect(reply).not.toMatch(/kr\b/)
      expect(reply).not.toContain(facts.left)
      expect(reply).toContain(`Klart idag: ${facts.done} av ${facts.total}.`)
    }
    expect(hidden('Hur sov jag?')).toBe('Du sov 8 h 42 min enligt Hälsa (idag).')
    expect(hidden('Vad ska jag göra idag?')).toBe('Måste göras idag: Meditation och Gym. Börja med Ringa tandläkaren.')
  })
})
