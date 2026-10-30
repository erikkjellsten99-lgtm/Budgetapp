// Ekonomin i galaxen: skulderna blir ett svart hål i kärnan och sparmålet en planet som föds.
// Läser hushållets data (samma som Budget, Prognos och Konton) men ändrar ingenting i den.

import { currentMonth, getAssets, getBudget, getDebts, getGoals, getIncome, getLoans, shiftMonth } from '../db'
import { forecast, type MonthInput } from '../forecast'
import { goalCurrent, monthLabel, project } from '../Goal'

export interface Economy {
  /** Skulder: lånet (prognosens) och skulder till personer, med kvar att betala i kronor. */
  debts: { name: string; amount: number }[]
  /** Summan kvar att betala. */
  debtLeft: number
  /** Det högsta skuldbeloppet appen har sett på den här telefonen (för "avbetalt"). */
  debtMax: number
  /** Månaden lånet är betalt enligt prognosen, t.ex. "mars 2027", eller null. */
  loanPaidIn: string | null
  /** Sparmålet, eller null om inget mål finns. */
  savings: { name: string; current: number; target: number; reachedIn: string | null } | null
}

const MAX_KEY = 'vanor-galax-skuldmax'
const SHORT = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const monthText = (month: string) => `${SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

/**
 * Hur mycket som har betalats av: det högsta skuldbeloppet vi har sett minus det som är kvar.
 * Sparas på telefonen, så att hålet kan krympa från där det var när du först öppnade galaxen.
 */
export function rememberDebtMax(debtLeft: number): number {
  let max = debtLeft
  try {
    max = Math.max(debtLeft, Number(localStorage.getItem(MAX_KEY)) || 0)
    localStorage.setItem(MAX_KEY, String(Math.round(max)))
  } catch {
    // Utan lagring visar hålet bara det som är kvar.
  }
  return max
}

/** Det svarta hålets storlek (0–1) av det som är kvar. Roten gör att hålet krymper märkbart redan tidigt. */
export function holeShare(debtLeft: number, debtMax: number): number {
  if (debtLeft <= 0 || debtMax <= 0) return 0
  return Math.sqrt(Math.min(1, debtLeft / debtMax))
}

/**
 * Prognosens indata för kommande månader. Samma uträkning som fliken Prognos (Forecast.tsx),
 * upprepad här så att den fliken lämnas orörd.
 */
async function futureInputs(count: number): Promise<MonthInput[]> {
  const first = shiftMonth(currentMonth(), 1)
  const inputs: MonthInput[] = []
  for (let i = 0; i < count; i++) {
    const month = shiftMonth(first, i)
    const [{ categories }, income] = await Promise.all([getBudget(month), getIncome(month)])
    const sum = (savings: boolean) => categories.filter((c) => (c.type === 'savings') === savings).reduce((s, c) => s + c.monthlyBudget, 0)
    inputs.push({ month, income: income.csn + income.other, costs: sum(false), plannedSavings: sum(true) })
  }
  return inputs
}

export async function loadEconomy(): Promise<Economy> {
  const [debts, loans, assets, goals] = await Promise.all([getDebts(), getLoans(), getAssets(), getGoals()])
  const loan = loans[0] ?? null
  const list = [
    ...(loan && loan.balance > 0 ? [{ name: loan.name, amount: loan.balance }] : []),
    ...debts.filter((d) => d.amount > 0).map((d) => ({ name: d.name, amount: d.amount })),
  ]
  const debtLeft = list.reduce((s, d) => s + d.amount, 0)

  let loanPaidIn: string | null = null
  if (loan && loan.balance > 0) {
    const goal = goals[0]
    const startSavings = assets.filter((a) => !a.spending).reduce((s, a) => s + a.amount, 0)
    const result = forecast(await futureInputs(60), startSavings, loan, goal?.target ?? 0, goal?.annualReturn ?? 0)
    loanPaidIn = result.loanPaidIn ? monthText(result.loanPaidIn) : null
  }

  const goal = goals[0]
  let savings: Economy['savings'] = null
  if (goal && goal.target > 0) {
    const current = goalCurrent(goal, assets)
    const reachedAt = project(current, goal).reachedAt
    savings = { name: goal.name, current, target: goal.target, reachedIn: reachedAt === null ? null : reachedAt === 0 ? 'nu' : monthLabel(reachedAt) }
  }

  return { debts: list, debtLeft, debtMax: rememberDebtMax(debtLeft), loanPaidIn, savings }
}
