// Ekonomin i galaxen: skulderna blir ett svart hål i kärnan, sparmålet en planet som föds, budgeten ett
// månsystem, önskelistan kometer och tillgångarna galaxens sken.
// Läser hushållets data (samma som Budget, Prognos och Konton) men ändrar ingenting i den.

import { currentMonth, getAssets, getBudget, getGoals, getIncome, getLoans, getWishes, shiftMonth } from '../db'
import type { Category, CategoryType, Wish } from '../types'
import { forecast, type MonthInput } from '../forecast'
import { goalCurrent, monthLabel, project } from '../Goal'

export interface Economy {
  /**
   * Skulder: lånet som Prognos räknar med, med kvar att betala i kronor. Den gamla listan med skulder
   * till personer (tabellen debts) används inte längre någonstans i appen och räknas därför inte.
   */
  debts: { name: string; amount: number }[]
  /** Summan kvar att betala. */
  debtLeft: number
  /** Det högsta skuldbeloppet appen har sett på den här telefonen (för "avbetalt"). */
  debtMax: number
  /** Månaden lånet är betalt enligt prognosen, t.ex. "mars 2027", eller null. */
  loanPaidIn: string | null
  /** Sparmålet, eller null om inget mål finns. */
  savings: { name: string; current: number; target: number; reachedIn: string | null } | null
  /** Månadens budget: en måne per kategori. */
  budget: { month: string; moons: BudgetMoon[]; total: number; paid: number }
  /** Önskningar som inte är köpta, och hur många månaders överskott var och en motsvarar. */
  wishes: WishComet[]
  /** Det som blir över varje månad efter utgifter och planerat sparande (samma som Budget visar). */
  extraPerMonth: number
  /** Tillgångar (konton som inte är för vardagen), lånet och nettot. */
  worth: { assets: { name: string; amount: number }[]; loan: number; net: number }
}

export interface BudgetMoon {
  name: string
  type: CategoryType
  budget: number
  /** Hur mycket av kategorin som är markerad som betald den här månaden. */
  paid: number
}

export interface WishComet {
  name: string
  amount: number
  list: Wish['list']
  /** Pris delat med månadens överskott. 1 eller mindre = ryms i det som blir över denna månad. Null = inget blir över. */
  months: number | null
}

/** Betalt den här månaden för en kategori: markerade rader, eller hela kategorin om den saknar rader. */
export function paidThisMonth(category: Category, month: string): number {
  if (category.items?.length) return category.items.filter((i) => i.paidMonth === month).reduce((s, i) => s + i.amount, 0)
  return category.paidMonth === month ? category.monthlyBudget : 0
}

/** Hur många månaders överskott en önskan kostar (samma uträkning som Budgets "över att spara extra"). */
export function wishMonths(amount: number, extraPerMonth: number): number | null {
  return extraPerMonth > 0 ? amount / extraPerMonth : null
}

// v2: den första versionen räknade med den gamla skuldlistan, så det sparade maxbeloppet var för högt.
const MAX_KEY = 'vanor-galax-skuldmax-v2'
const SHORT = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const monthText = (month: string) => `${SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

/**
 * Hur mycket som har betalats av: det högsta skuldbeloppet vi har sett minus det som är kvar.
 * Sparas på telefonen, så att hålet kan krympa från där det var när du först öppnade galaxen.
 */
export function rememberDebtMax(debtLeft: number): number {
  let max = debtLeft
  try {
    localStorage.removeItem('vanor-galax-skuldmax') // den gamla, för höga
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
  const month = currentMonth()
  const [loans, assets, goals, wishes, budget, income] = await Promise.all([
    getLoans(),
    getAssets(),
    getGoals(),
    getWishes(),
    getBudget(month),
    getIncome(month),
  ])
  const loan = loans[0] ?? null
  const list = loan && loan.balance > 0 ? [{ name: loan.name, amount: loan.balance }] : []
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

  // Budgeten den här månaden, som i fliken Budget: inkomster minus utgifter (önskningar köpta i månaden räknas
  // som rörliga utgifter) minus planerat sparande blir det som är över att spara extra.
  const categories = budget.categories.filter((c) => c.monthlyBudget > 0)
  const sum = (type: CategoryType) => categories.filter((c) => c.type === type).reduce((s, c) => s + c.monthlyBudget, 0)
  const boughtThisMonth = wishes.filter((w) => w.paidMonth === month).reduce((s, w) => s + w.amount, 0)
  const extraPerMonth = income.csn + income.other - sum('fixed') - sum('variable') - boughtThisMonth - sum('savings')
  const moons = categories
    .map((c) => ({ name: c.name, type: c.type, budget: c.monthlyBudget, paid: Math.min(c.monthlyBudget, paidThisMonth(c, month)) }))
    .sort((a, b) => b.budget - a.budget)

  const ownAssets = assets.filter((a) => !a.spending && a.amount !== 0).map((a) => ({ name: a.name, amount: a.amount }))
  const assetSum = ownAssets.reduce((s, a) => s + a.amount, 0)

  return {
    debts: list,
    debtLeft,
    debtMax: rememberDebtMax(debtLeft),
    loanPaidIn,
    savings,
    budget: { month, moons, total: moons.reduce((s, m) => s + m.budget, 0), paid: moons.reduce((s, m) => s + m.paid, 0) },
    wishes: wishes
      .filter((w) => !w.paidMonth && w.amount > 0)
      .map((w) => ({ name: w.name, amount: w.amount, list: w.list, months: wishMonths(w.amount, extraPerMonth) }))
      .sort((a, b) => a.amount - b.amount),
    extraPerMonth,
    worth: { assets: ownAssets, loan: debtLeft, net: assetSum - debtLeft },
  }
}
