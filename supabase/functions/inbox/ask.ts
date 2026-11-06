// "Fråga Groundwork": svar på vanliga frågor utan AI, för Siri på iPhone och Apple Watch.
// Frågan tolkas med enkla svenska nyckelord, och svaret byggs av sammanfattningens siffror
// (summary.ts), så att beloppen alltid är exakt de som appen visar. Förstår den inte frågan
// säger den det och ger tre exempel. Läser bara. Rena funktioner, tester i ask.test.ts.

import { list } from './morning.ts'
import type { SummaryFacts } from './summary.ts'

/** Gemener, utan skiljetecken och med enkla mellanslag, så att "Hur sov jag?" och "hur sov jag" blir samma. */
export function normalize(question: string): string {
  return ` ${question.toLocaleLowerCase('sv-SE').replace(/[^\p{L}\d]+/gu, ' ').trim()} `
}

interface Intent {
  /** Ord eller ordbörjan som känns igen (med mellanslag före, så att "lån" inte träffar "planerat"). */
  words: string[]
  answer: (f: SummaryFacts) => string
  /** Bara om inget annat passade (för breda ord som "kvar" och "spara"). */
  fallback?: true
}

const healthValue = (f: SummaryFacts, label: string) => f.health?.values.find((v) => v.label === label) ?? null
const healthWhen = (f: SummaryFacts) => (f.health?.when === 'igår' ? 'igår' : 'idag')

// Ordningen spelar roll: det mest specifika först. Flera träffar i samma fråga ger flera svar.
const INTENTS: Intent[] = [
  {
    words: [' sov', ' sömn', ' somn', ' natt'],
    answer: (f) => {
      const v = healthValue(f, 'Sömn')
      return v ? `Du sov ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns ingen sömn från Hälsa för i natt än.'
    },
  },
  {
    words: [' steg', ' gått', ' gick'],
    answer: (f) => {
      const v = healthValue(f, 'Steg')
      return v ? `Du har gått ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns inga steg från Hälsa för idag än.'
    },
  },
  {
    words: [' puls', ' vilopuls'],
    answer: (f) => {
      const v = healthValue(f, 'Vilopuls')
      return v ? `Din vilopuls är ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns ingen vilopuls från Hälsa för idag än.'
    },
  },
  {
    words: [' billån', ' lån', ' bil'],
    answer: (f) =>
      f.loan
        ? `${f.loan.name}: ${f.loan.left} kvar. Nästa betalning är ${f.loan.payment} i ${f.loan.nextMonth}` +
          (f.loan.extra ? `, och extra på lånet ${f.loan.extra} enligt Prognos.` : '.')
        : 'Det finns inget lån kvar att betala i Groundwork.',
  },
  {
    words: [' sparmål', ' målet', ' mål', ' miljon'],
    answer: (f) =>
      f.goal
        ? `${f.goal.name}: ${f.goal.current} av ${f.goal.target}, ${f.goal.percent} procent. ${f.goal.status}`
        : 'Det finns inget sparmål i Groundwork.',
  },
  {
    words: [' önsk', ' köpa', ' köpt'],
    answer: (f) => `Önskelistan är ${f.wishes.total} totalt, och kvar att köpa är ${f.wishes.leftToBuy}.`,
  },
  {
    words: [' att göra', ' uppgift', ' påminn'],
    answer: (f) => (f.tasks.length ? `Att göra idag: ${list(f.tasks)}.` : 'Inget att göra idag.'),
  },
  {
    words: [' måste', ' vanor', ' vana', ' prioritera', ' först', ' ska jag göra', ' börja'],
    answer: (f) => {
      if (f.paused) return 'Du har pausat idag, så inga vanor måste göras.'
      const must = f.must.length ? `Måste göras idag: ${list(f.must)}.` : 'Inget måste göras idag.'
      return f.first ? `${must} Börja med ${f.first}.` : must
    },
  },
  {
    words: [' klart', ' klar', ' gjort'],
    answer: (f) => `Klart idag: ${f.done} av ${f.total}.`,
  },
  {
    words: [' inkomst', ' tjän', ' lön', ' csn'],
    answer: (f) => `Inkomsterna i ${f.month} är ${f.income}.`,
  },
  {
    words: [' kostnad', ' utgift', ' kostar'],
    answer: (f) => `Kostnaderna i ${f.month} är ${f.costs}.`,
  },
  {
    words: [' nettovärde', ' sparkonto', ' konton', ' sparat'],
    answer: (f) => `Nettovärdet på sparkontona är ${f.netWorth}.`,
  },
  {
    words: [' över', ' budget', ' kvar', ' spara'],
    answer: (f) => `I ${f.month} blir det ${f.left} över efter utgifter och planerat sparande.`,
    fallback: true,
  },
]

export const EXAMPLES = ['Vad blir över den här månaden?', 'När nås sparmålet?', 'Hur sov jag i natt?']

/** Högst så här många svar på en gång, så att Siri inte läser upp allt. */
const MAX_ANSWERS = 3

/** Svaret på en fråga, med exakta siffror. Förstår den inte: det och tre exempel. */
export function answer(question: string, facts: SummaryFacts): string {
  const q = normalize(question)
  const matches = INTENTS.filter((intent) => intent.words.some((w) => q.includes(w)))
  const specific = matches.filter((intent) => !intent.fallback)
  const hits = (specific.length ? specific : matches).slice(0, MAX_ANSWERS)
  if (!hits.length || q.trim() === '') {
    return `Det förstår jag inte än. Prova: "${EXAMPLES[0]}", "${EXAMPLES[1]}" eller "${EXAMPLES[2]}"`
  }
  return hits.map((intent) => intent.answer(facts)).join(' ')
}
