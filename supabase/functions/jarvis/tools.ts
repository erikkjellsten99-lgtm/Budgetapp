// Jarvis verktyg: det modellen får fråga om i hushållets ekonomi och i dina egna vanor, och systemprompten.
// Rena funktioner utan Deno och utan nätverk, så att de kan testas (tools.test.ts). Siffrorna räknas med
// samma delade kod som appen (../inbox), så att Jarvis aldrig räknar på ett eget sätt. Läser bara.

import { monthName, monthPlans } from '../inbox/months.ts'
import { MAX_MONTHS } from '../inbox/goalPlan.ts'
import { overviewNumbers, summaryFacts } from '../inbox/summary.ts'
import { firstThing, prioritizeToday, type PriorityRow } from '../inbox/priority.ts'
import { daySummary, rampToday, type Habit, type Log } from '../inbox/habits.ts'
import { doneToday, whenText, type Task } from '../inbox/tasks.ts'
import { weekday } from '../inbox/dates.ts'
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
  /** Dina egna vanor och Att göra. Saknas om de inte gick att läsa. */
  day?: Day | null
}

/** Vanor, bockningar, pausdagar och Att göra som de ligger i personal_records. Privata: bara dina egna. */
export interface Day {
  /** I listans ordning. */
  habits: Habit[]
  /** Datum → id:n för vanorna som är bockade den dagen. */
  log: Log
  paused: Set<string>
  tasks: Task[]
}

/** Raderna från personal_records till Day. `rows` är habits, pauses och tasks, `checks` är bockningarna. */
export function toDay(rows: { store: string; data: unknown }[], checks: { data: unknown }[]): Day {
  const pick = <T>(store: string) => rows.filter((r) => r.store === store && r.data).map((r) => r.data as T)
  const log: Log = {}
  for (const r of checks) {
    const c = r.data as { date?: string; habitId?: string } | null
    if (c?.date && c.habitId) (log[c.date] ??= []).push(c.habitId)
  }
  return {
    habits: pick<Habit>('habits').sort((a, b) => a.order - b.order),
    log,
    paused: new Set(pick<{ date: string }>('pauses').map((p) => p.date)),
    tasks: pick<Task>('tasks'),
  }
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
      'Använd den för frågor om ekonomin som inte gäller en viss månads budget.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'hamta_vanor',
    description:
      'Hämtar dagens vanor och Att göra för den som frågar: vilka vanor som måste göras idag, vilka som kan vänta, ' +
      'vilka som redan är bockade, hur långt varje vana har kommit mot veckans mål, och saker under Att göra som gäller ' +
      'idag eller är försenade. Använd den för frågor om vanor, vad som är kvar att bocka av, vad som ska göras idag ' +
      'och vad man bör börja med. Den innehåller ingen ekonomi och ingen hälsodata.',
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
    // Vanor och Att göra har ett eget verktyg (habitsTool). Hälsa läses inte av Jarvis.
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

const WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

/** Dagens vanor och Att göra, med samma uträkning som Prioritera idag i Vanor (prioritizeToday). */
export function habitsTool(e: Economy) {
  const d = e.day
  if (!d) return { fel: 'Det gick inte att läsa vanorna just nu.' }
  const p = prioritizeToday(d.habits, d.log, d.paused, d.tasks, e.today)
  if (p.rows.length === 0 && d.tasks.length === 0) return { fel: 'Det finns inga vanor och inget under Att göra i Groundwork än.' }
  const row = (r: PriorityRow) => {
    const length = rampToday(r.habit, d.log, e.today)
    return {
      namn: r.habit.name,
      ...(r.info.goal > 0 ? { denna_vecka: `${r.info.count} av ${r.info.goal}` } : {}),
      ...(r.info.pills.length ? { lage: r.info.pills.map((x) => x.text) } : {}),
      ...(length !== null && r.habit.ramp ? { langd_idag: `${length} ${r.habit.ramp.unit}` } : {}),
      ...(r.habit.minimum ? { minsta_version: r.habit.minimum } : {}),
    }
  }
  const summary = daySummary(p.rows.map((r) => r.info))
  const doneTasks = doneToday(d.tasks, e.today)
  return {
    datum: e.today,
    veckodag: WEEKDAYS[weekday(e.today)],
    pausad_idag: p.pausedToday,
    kvar_att_bocka_av: {
      maste_goras_idag: p.must.map(row),
      kan_vanta: p.flexible.map(row),
    },
    bockade_idag: p.rows.filter((r) => r.info.done).map(row),
    inte_aktuella_idag: p.rows.filter((r) => !r.info.done && !r.info.due).map(row),
    att_gora: {
      kvar: p.tasksDue.map((t) => ({ titel: t.title, nar: whenText(t, e.today) })),
      klart_idag: doneTasks.map((t) => t.title),
    },
    borja_med: firstThing(p),
    klart_idag: `${summary.done + doneTasks.length} av ${summary.total + p.tasksDue.length + doneTasks.length}`,
    forklaring:
      'maste_goras_idag är vanor som måste bockas idag för att hinna veckans mål. kan_vanta går att göra idag men hinns senare i veckan, ' +
      'mest bråttom först. inte_aktuella_idag ska inte göras idag (veckomålet är klart, dagen är pausad eller vanan hör ihop med ett pass ' +
      'som inte är gjort). klart_idag räknar måsten och Att göra, inte det som kan vänta.',
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
    if (name === 'hamta_vanor') return done(habitsTool(e))
    return done({ fel: `Okänt verktyg: ${name}` })
  } catch {
    return done({ fel: 'Det gick inte att räkna fram siffrorna.' })
  }
}

/** Ett tidigare utbyte i samtalet, som appen skickar med för att följdfrågor ska gå att förstå. */
export interface Turn {
  question: string
  answer: string
}

/** Högst så här många tidigare utbyten följer med, och så här långa. */
export const MAX_TURNS_BACK = 4
const MAX_ANSWER = 800

/**
 * Samtalet som meddelanden till modellen: de senaste utbytena (äldst först) och sedan den nya frågan.
 * Det som kommer från appen litar vi inte på: fel form hoppas över och långa texter kortas.
 */
export function toMessages(history: unknown, question: string): { role: 'user' | 'assistant'; content: string }[] {
  const turns: Turn[] = []
  for (const t of Array.isArray(history) ? history : []) {
    const q = typeof t?.question === 'string' ? t.question.trim().slice(0, MAX_QUESTION) : ''
    const a = typeof t?.answer === 'string' ? t.answer.trim().slice(0, MAX_ANSWER) : ''
    if (q && a) turns.push({ question: q, answer: a })
  }
  return [
    ...turns.slice(-MAX_TURNS_BACK).flatMap((t) => [
      { role: 'user' as const, content: t.question },
      { role: 'assistant' as const, content: t.answer },
    ]),
    { role: 'user' as const, content: question },
  ]
}

/** Systemprompten. Svaren läses upp, så de ska låta som en människa som pratar. */
export function systemPrompt(today: string, firstName?: string | null): string {
  const name = firstName?.trim().slice(0, 40)
  return [
    'Du är Jarvis, rösten i appen Groundwork, där ett hushåll i Sverige håller ordning på sin ekonomi och var och en på sina vanor.',
    name
      ? `Du pratar med ${name}, som äger siffrorna och vanorna och oftast frågar med rösten. Säg namnet någon gång när det faller sig naturligt, inte i varje svar.`
      : 'Den du pratar med äger siffrorna och vanorna och frågar om dem, oftast med rösten.',
    '',
    `Dagens datum är ${today}. "Den här månaden" är ${monthName(today.slice(0, 7))}.`,
    '',
    'Så låter du:',
    '- Du pratar som en klok och varm vän som har koll, inte som en maskin som läser upp en tabell. Ledigt, vardagligt, du-form.',
    '- Börja med svaret på frågan. Lägg sedan gärna till en sak som gör siffran begriplig: vad den betyder, hur den står sig mot förra månaden eller mot målet, eller vad som sticker ut. Bara om det tillför något.',
    '- Reagera som en människa när det passar: glad när något går bra, lugn och saklig när det är stramt. Överdriv inte och fjäska inte.',
    '- Variera hur du börjar och formulerar dig. Upprepa inte frågan och börja inte varje svar på samma sätt.',
    '- Det här är ett samtal. Tidigare frågor och svar finns med, så förstå följdfrågor som "och i januari då?" utifrån dem.',
    '- Ibland, inte varje gång, kan du avsluta med en kort följdfråga eller ett erbjudande om det ligger nära till hands, till exempel "Vill du höra vad som drar mest?".',
    '',
    'Dina svar läses upp av en talsyntes. Det styr formen:',
    '- Svara på svenska, kort, som man pratar. Två till fyra meningar räcker nästan alltid.',
    '- Skriv löpande text. Inga listor, rubriker, tabeller, stjärnor eller annan formatering, och inga parenteser: allt blir uppläst.',
    '- Avrunda belopp till något som är lätt att höra och skriv dem som man säger dem: "ungefär sextontusen niohundra kronor" eller "runt 96 000 kronor", inte "16 858 kr". Säg "kronor", inte "kr". Avrunda inte så hårt att svaret blir fel: en skillnad på några hundralappar ska höras om det är den frågan gäller.',
    '- Månader skrivs med namn, "i december", inte som 2026-12. Procent skrivs "sju procent".',
    '',
    'Siffrorna:',
    '- Hämta alltid siffrorna med verktygen innan du svarar på en fråga om ekonomin eller vanorna. Gissa aldrig ett belopp och räkna inte ur minnet. Behöver du jämföra, hämta båda månaderna.',
    '- Allt du säger om siffrorna ska stå i det verktygen gav. Hitta inte på orsaker eller jämförelser som inte finns där.',
    '- Du kan bara läsa. Du kan inte ändra, lägga till eller ta bort något. Vill någon ändra något säger du att det görs i appen.',
    '- Groundwork innehåller budget per månad och kategori, inkomster, konton, sparmål, billån, investeringar och önskelista. Det finns inga enskilda köp eller kontoutdrag. Gäller frågan något som inte finns, säg det med en mening och berätta vad du kan svara på i stället.',
    '- Groundwork innehåller också personens egna vanor och Att göra. Hämta dem med hamta_vanor. Säg vanornas namn som de står. Räkna upp högst fem saker i ett svar, och säg hur många som är kvar om det är fler. Frågar någon vad som är kvar att bocka av, svara med det som måste göras idag och nämn kort det som kan vänta.',
    '- Sömn, steg och annan hälsodata kan du inte läsa. Den finns under Vanor i appen.',
    '- "Blir över" är det som är kvar av månadens inkomster efter kostnader och planerat sparande.',
    '- Ge inga råd om vad pengarna bör placeras i. Du får gärna säga vad siffrorna visar och vad som går att titta närmare på.',
    '',
    'Är frågan varken om ekonomin eller vanorna, till exempel en hälsning eller småprat, svara kort, vänligt och naturligt, och säg vad du kan hjälpa till med om det passar.',
  ].join('\n')
}
