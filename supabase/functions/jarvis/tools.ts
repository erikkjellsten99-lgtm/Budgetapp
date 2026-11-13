// Jarvis verktyg: det modellen får fråga om i hushållets ekonomi, och systemprompten.
// Rena funktioner utan Deno och utan nätverk, så att de kan testas (tools.test.ts). Siffrorna räknas med
// samma delade kod som appen (../inbox), så att Jarvis aldrig räknar på ett eget sätt. Läser bara.

import { monthName, monthPlans } from '../inbox/months.ts'
import { MAX_MONTHS } from '../inbox/goalPlan.ts'
import { overviewNumbers, summaryFacts } from '../inbox/summary.ts'
import { prioritizeToday } from '../inbox/priority.ts'
import { sumLeftToBuy } from '../inbox/wishes.ts'
import type { Loan } from '../inbox/forecast.ts'
import type { Asset, Category, Debt, Holding, MonthBudget, MonthlyIncome, PricePoint, SavingsGoal, Trade, Wish } from '../inbox/types.ts'

export const MODEL = 'claude-sonnet-5-5'
/** Högst så här många frågor per användare och dag (kontrolleras i databasen, jarvis_count_call). */
export const DAILY_LIMIT = 50
export const MAX_QUESTION = 300

/** Hushållets ekonomi som den ligger i tabellen records, läst med användarens egen inloggning. */
export interface Economy {
  /** Dagens datum i Sverige, som "2026-11-13". */
  today: string
  budgets: MonthBudget[]
  incomes: MonthlyIncome[]
  /** Den gamla kategorilistan, för månader före den första sparade budgeten. */
  categories: Category[]
  assets: Asset[]
  holdings: Holding[]
  trades: Trade[]
  prices: Record<string, PricePoint[]>
  goal: SavingsGoal | null
  loan: Loan | null
  wishes: Wish[]
  debts: Debt[]
}

/** Raderna från records till Economy. Okända `store` hoppas över. */
export function toEconomy(rows: { store: string; data: unknown }[], prices: Record<string, PricePoint[]>, today: string): Economy {
  const pick = <T>(store: string) => rows.filter((r) => r.store === store && r.data).map((r) => r.data as T)
  const byMonth = <T extends { month: string }>(list: T[]) => [...list].sort((a, b) => a.month.localeCompare(b.month))
  return {
    today,
    budgets: byMonth(pick<MonthBudget>('budgets')),
    incomes: byMonth(pick<MonthlyIncome>('income')),
    categories: pick<Category>('categories'),
    assets: pick<Asset>('assets'),
    holdings: pick<Holding>('holdings'),
    trades: pick<Trade>('trades'),
    prices,
    goal: pick<SavingsGoal>('goals')[0] ?? null,
    loan: pick<Loan>('loans')[0] ?? null,
    wishes: pick<Wish>('wishes'),
    debts: pick<Debt>('debts'),
  }
}

/** Verktygen som modellen får använda. Formen är Claude API:s (name, description, input_schema). */
export const TOOLS = [
  {
    name: 'hamta_manad',
    description:
      'Hämtar budgeten och inkomsterna för en månad: varje kategori med belopp (fasta utgifter, rörliga utgifter, sparande), ' +
      'summorna inkomster, kostnader och planerat sparande, och vad som blir över. Använd den för frågor om en viss månad, ' +
      'en viss kategori eller en jämförelse mellan månader (anropa en gång per månad). Belopp är i kronor per månad. ' +
      'Det finns inga enskilda köp eller transaktioner, bara budget per kategori.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { manad: { type: 'string', description: 'Månaden som ÅÅÅÅ-MM, till exempel 2026-12.' } },
      required: ['manad'],
      additionalProperties: false,
    },
  },
  {
    name: 'hamta_lage',
    description:
      'Hämtar läget just nu: konton med saldo, nettovärde, sparmålet (sparat, mål, procent, när det nås), billånet ' +
      '(kvar och nästa betalning), investeringarna, önskelistan, skulder och vad som är obetalt av månadens budget. ' +
      'Använd den för frågor som inte gäller en viss månads budget.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
] as const

const TYPE_LABEL: Record<Category['type'], string> = { fixed: 'fast utgift', variable: 'rörlig utgift', savings: 'sparande' }

/** Budget och inkomst för en månad, med samma uträkning som Översikt (overviewNumbers). */
export function monthTool(e: Economy, month: string) {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) return { fel: 'Månaden ska skrivas som ÅÅÅÅ-MM, till exempel 2026-12.' }
  const first = [e.budgets[0]?.month, e.incomes[0]?.month].filter(Boolean).sort()[0]
  if (!first && e.categories.length === 0) return { fel: 'Det finns ingen budget sparad i Groundwork.' }
  if (first && month < first && e.categories.length === 0) return { fel: `Det finns ingen budget för ${monthName(month)}. Den första sparade månaden är ${monthName(first)}.` }
  const lastAllowed = `${Number(e.today.slice(0, 4)) + MAX_MONTHS / 12}-${e.today.slice(5, 7)}`
  if (month > lastAllowed) return { fel: 'Så långt fram finns ingen budget.' }
  const [plan] = monthPlans(e.budgets, e.incomes, e.categories, month, 1)
  const o = overviewNumbers(plan, e.wishes, e.assets)
  return {
    manad: monthName(month),
    ar_innevarande_manad: month === e.today.slice(0, 7),
    inkomster: { csn: plan.income.csn, ovrigt: plan.income.other, summa: o.income },
    kategorier: plan.categories
      .filter((c) => c.monthlyBudget !== 0 || (c.items?.length ?? 0) > 0)
      .map((c) => ({
        namn: c.name,
        typ: TYPE_LABEL[c.type],
        belopp: c.monthlyBudget,
        ...(c.items?.length ? { rader: c.items.map((i) => ({ namn: i.name, belopp: i.amount })) } : {}),
      })),
    kostnader: o.costs,
    planerat_sparande: o.plannedSavings,
    blir_over: o.left,
    forklaring: 'blir_over = inkomster minus kostnader minus planerat sparande. Kostnader innehåller också saker från önskelistan som köptes den månaden.',
  }
}

/** Läget just nu, med texterna från sammanfattningen (summaryFacts), så att beloppen är de appen visar. */
export function stateTool(e: Economy) {
  const month = e.today.slice(0, 7)
  if (e.budgets.length === 0 && e.categories.length === 0 && e.assets.length === 0) return { fel: 'Det finns ingen ekonomi sparad i Groundwork än.' }
  const f = summaryFacts({
    today: e.today,
    plans: monthPlans(e.budgets, e.incomes, e.categories, month, MAX_MONTHS + 1),
    assets: e.assets,
    holdings: e.holdings,
    trades: e.trades,
    prices: e.prices,
    goal: e.goal,
    loan: e.loan,
    wishes: e.wishes,
    // Vanor, Att göra och hälsa hör inte till ekonomin och läses inte av Jarvis.
    priority: prioritizeToday([], {}, new Set(), [], e.today),
    tasks: [],
    health: [],
  })
  return {
    datum: e.today,
    nettovarde: f.netWorth,
    pengar_att_anvanda: f.spending,
    konton: e.assets.map((a) => ({
      namn: a.name,
      ...(a.fromHoldings ? { saldo: 'värderas från innehaven, se investeringar' } : { saldo_kr: a.amount, uppdaterat: a.updated || null }),
      ...(a.spending ? { raknas_inte_i_nettovardet: true } : {}),
    })),
    sparmal: f.goal ? { namn: f.goal.name, sparat: f.goal.current, mal: f.goal.target, procent: f.goal.percent, prognos: f.goal.status } : null,
    billan: f.loan ? { namn: f.loan.name, kvar: f.loan.left, nasta_betalning: f.loan.payment, manad: f.loan.nextMonth, extra_pa_lanet: f.loan.extra } : null,
    investeringar: f.investments
      ? { varde: f.investments.value, investerat: f.investments.invested, utveckling: f.investments.change, kursdatum: f.investments.date, innehav_utan_kurs: f.investments.missing }
      : null,
    onskelista: {
      summa: f.wishes.total,
      kvar_att_kopa: f.wishes.leftToBuy,
      kvar_att_kopa_kr: sumLeftToBuy(e.wishes),
      saker: e.wishes.map((w) => ({ namn: w.name, pris_kr: w.amount, ...(w.paidMonth ? { kopt: monthName(w.paidMonth) } : {}) })),
    },
    skulder: e.debts.filter((d) => d.amount > 0).map((d) => ({ till: d.name, kvar_kr: d.amount })),
    obetalt_denna_manad: f.unpaid,
    denna_manad: { manad: f.month, blir_over: f.left, inkomster: f.income, kostnader: f.costs, planerat_sparande: f.plannedSavings },
  }
}

/** Kör ett verktyg. Svaret är JSON som text, som modellen läser. Okänt verktyg eller fel indata ger ett felsvar. */
export function runTool(name: string, input: unknown, e: Economy): { content: string; isError: boolean } {
  const done = (result: object) => ({ content: JSON.stringify(result), isError: 'fel' in result })
  try {
    if (name === 'hamta_manad') {
      const month = (input as { manad?: unknown } | null)?.manad
      return done(monthTool(e, typeof month === 'string' ? month.trim() : ''))
    }
    if (name === 'hamta_lage') return done(stateTool(e))
    return done({ fel: `Okänt verktyg: ${name}` })
  } catch {
    return done({ fel: 'Det gick inte att räkna fram siffrorna.' })
  }
}

/** Systemprompten. Svaren läses upp, så de ska låta som tal. */
export function systemPrompt(today: string): string {
  return [
    'Du är Jarvis, rösten i appen Groundwork, där ett hushåll i Sverige håller ordning på sin ekonomi.',
    'Den du pratar med äger siffrorna och frågar om dem, oftast med rösten.',
    '',
    `Dagens datum är ${today}. "Den här månaden" är ${monthName(today.slice(0, 7))}.`,
    '',
    'Dina svar läses upp av en talsyntes. Det styr hur du svarar:',
    '- Svara på svenska, kort, som man pratar. En till tre meningar räcker nästan alltid. Börja med svaret.',
    '- Skriv löpande text. Inga listor, rubriker, tabeller, stjärnor eller annan formatering, och inga parenteser: allt blir uppläst.',
    '- Avrunda belopp till något som är lätt att höra och skriv dem som man säger dem: "ungefär sextontusen niohundra kronor" eller "runt 96 000 kronor", inte "16 858 kr". Säg "kronor", inte "kr". Avrunda inte så hårt att svaret blir fel: en skillnad på några hundralappar ska höras om det är den frågan gäller.',
    '- Månader skrivs med namn, "i december", inte som 2026-12. Procent skrivs "sju procent".',
    '',
    'Siffrorna:',
    '- Hämta alltid siffrorna med verktygen innan du svarar på en fråga om ekonomin. Gissa aldrig ett belopp och räkna inte ur minnet.',
    '- Du kan bara läsa. Du kan inte ändra, lägga till eller ta bort något. Vill någon ändra något säger du att det görs i appen.',
    '- Groundwork innehåller budget per månad och kategori, inkomster, konton, sparmål, billån, investeringar och önskelista. Det finns inga enskilda köp eller kontoutdrag. Gäller frågan något som inte finns, säg det med en mening och berätta vad du kan svara på i stället.',
    '- "Blir över" är det som är kvar av månadens inkomster efter kostnader och planerat sparande.',
    '- Ge inga råd om vad pengarna bör placeras i. Du berättar vad siffrorna säger.',
    '',
    'Är frågan inte om ekonomin, till exempel en hälsning, svara kort och vänligt och säg vad du kan hjälpa till med.',
  ].join('\n')
}
