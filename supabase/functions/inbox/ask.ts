// "Fråga Groundwork" / Jarvis: svar på frågor utan AI, för appen, Siri på iPhone och Apple Watch.
// Frågan tolkas med svenska nyckelord, och svaret byggs av sammanfattningens siffror (summary.ts),
// så att beloppen alltid är exakt de som appen visar. Nyckelorden tål felstavning (ett fel per ord)
// och å/ä/ö skrivna som a/o. Allmänna frågor ("hur går det?") ger ett samlat svar, och förstår den
// inte frågan alls svarar den ändå med dagens läge. Läser bara. Rena funktioner, tester i ask.test.ts.

import { list } from './morning.ts'
import type { SummaryFacts } from './summary.ts'

/** Gemener, utan skiljetecken och med enkla mellanslag, så att "Hur sov jag?" och "hur sov jag" blir samma. */
export function normalize(question: string): string {
  return ` ${question.toLocaleLowerCase('sv-SE').replace(/[^\p{L}\d]+/gu, ' ').trim()} `
}

/** Utan prickar och ringar: "sömn" → "somn", så att frågor skrivna utan å/ä/ö också förstås. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '')

/** Antal ändringar (byt, lägg till, ta bort) mellan två ord. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

/**
 * Om frågan innehåller ordet eller ordbörjan (med mellanslag före, så att "lån" inte träffar "planerat").
 * Ord på minst fem bokstäver får ett stavfel: "sparmåll", "inkomser".
 */
function has(q: string, words: string[]): boolean {
  const folded = fold(q)
  const tokens = folded.trim().split(' ')
  return words.some((word) => {
    if (q.includes(word) || folded.includes(fold(word))) return true
    const stem = fold(word.trim())
    if (stem.includes(' ') || stem.length < 5) return false
    return tokens.some((t) => t.length >= stem.length - 1 && distance(t.slice(0, stem.length), stem) <= 1)
  })
}

/** Hur säker träffen är: exakta ämnen först, sedan allmänna, sist de bredaste orden. */
type Level = 'specific' | 'broad' | 'fallback'

interface Intent {
  words: string[]
  answer: (f: SummaryFacts) => string
  level?: Level
  /** Svaret visar ekonomin (döljs i visningsläge). */
  money?: true
}

export interface AskOptions {
  /** Visningsläge: inga belopp i svaren, så att Jarvis kan visas för andra. */
  hideMoney?: boolean
}

export const HIDDEN_MONEY = 'Ekonomin är dold i visningsläget. Stäng av det i Jarvis för att se beloppen.'

const healthValue = (f: SummaryFacts, label: string) => f.health?.values.find((v) => v.label === label) ?? null
const healthWhen = (f: SummaryFacts) => (f.health?.when === 'igår' ? 'igår' : 'idag')

const leftText = (f: SummaryFacts) => `I ${f.month} blir det ${f.left} över efter utgifter och planerat sparande.`
const mustText = (f: SummaryFacts) => {
  if (f.paused) return 'Du har pausat idag, så inga vanor måste göras.'
  const must = f.must.length ? `Måste göras idag: ${list(f.must)}.` : 'Inget måste göras idag.'
  return f.first ? `${must} Börja med ${f.first}.` : must
}
/** Dagens läge i några meningar. Svaret när frågan är allmän eller inte går att tolka. */
export function dayBrief(f: SummaryFacts, options: AskOptions = {}): string {
  const parts = options.hideMoney ? [] : [leftText(f)]
  parts.push(`Klart idag: ${f.done} av ${f.total}.`)
  if (!f.paused && f.first) parts.push(`Börja med ${f.first}.`)
  const sleep = healthValue(f, 'Sömn')
  if (sleep) parts.push(`Du sov ${sleep.text}.`)
  if (f.goal && !options.hideMoney) parts.push(`${f.goal.name}: ${f.goal.percent} procent.`)
  return parts.join(' ')
}

const dayBriefAnswer = (f: SummaryFacts) => dayBrief(f)

// Ordningen spelar roll: det mest specifika först. Flera träffar i samma fråga ger flera svar.
const INTENTS: Intent[] = [
  {
    words: [' sov', ' sömn', ' natt', ' vila', ' utvilad', ' trött'],
    answer: (f) => {
      const v = healthValue(f, 'Sömn')
      return v ? `Du sov ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns ingen sömn från Hälsa för i natt än.'
    },
  },
  {
    words: [' steg', ' gått', ' gick', ' promenad', ' promenera', ' rört mig'],
    answer: (f) => {
      const v = healthValue(f, 'Steg')
      return v ? `Du har gått ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns inga steg från Hälsa för idag än.'
    },
  },
  {
    words: [' puls', ' vilopuls', ' hjärta', ' hjärtat'],
    answer: (f) => {
      const v = healthValue(f, 'Vilopuls')
      return v ? `Din vilopuls är ${v.text} enligt Hälsa (${healthWhen(f)}).` : 'Det finns ingen vilopuls från Hälsa för idag än.'
    },
  },
  {
    words: [' billån', ' lån', ' bil', ' skuld', ' amortering', ' amortera', ' avbetalning'],
    money: true,
    answer: (f) =>
      f.loan
        ? `${f.loan.name}: ${f.loan.left} kvar. Nästa betalning är ${f.loan.payment} i ${f.loan.nextMonth}` +
          (f.loan.extra ? `, och extra på lånet ${f.loan.extra} enligt Prognos.` : '.')
        : 'Det finns inget lån kvar att betala i Groundwork.',
  },
  {
    words: [' sparmål', ' målet', ' mål', ' miljon', ' när når', ' hur långt'],
    money: true,
    answer: (f) =>
      f.goal
        ? `${f.goal.name}: ${f.goal.current} av ${f.goal.target}, ${f.goal.percent} procent. ${f.goal.status}`
        : 'Det finns inget sparmål i Groundwork.',
  },
  {
    words: [' önsk', ' köpa', ' köpt', ' inköp', ' handla'],
    money: true,
    answer: (f) => `Önskelistan är ${f.wishes.total} totalt, och kvar att köpa är ${f.wishes.leftToBuy}.`,
  },
  {
    words: [' att göra', ' uppgift', ' påminn', ' kalender', ' schema', ' planerat idag', ' inbokat'],
    answer: (f) => (f.tasks.length ? `Att göra idag: ${list(f.tasks)}.` : 'Inget att göra idag.'),
  },
  {
    words: [' måste', ' vanor', ' vana', ' prioritera', ' först', ' ska jag göra', ' börja', ' träna', ' träning', ' gym'],
    answer: mustText,
  },
  {
    words: [' klart', ' klar', ' gjort', ' hunnit', ' avbockat'],
    answer: (f) => `Klart idag: ${f.done} av ${f.total}.`,
  },
  {
    words: [' inkomst', ' tjän', ' lön', ' csn', ' får in', ' kommer in'],
    money: true,
    answer: (f) => `Inkomsterna i ${f.month} är ${f.income}.`,
  },
  {
    words: [' kostnad', ' utgift', ' kostar', ' gör av med', ' lägger vi', ' lägger jag', ' räkning', ' spenderar'],
    money: true,
    answer: (f) => `Kostnaderna i ${f.month} är ${f.costs}.`,
  },
  {
    words: [' blir över', ' över efter', ' över i månaden', ' över den här', ' kvar att spara', ' kvar att sätta'],
    money: true,
    answer: leftText,
  },
  {
    words: [' nettovärde', ' sparkonto', ' konton', ' kontot', ' sparat', ' förmögenhet', ' tillgång', ' avanza', ' på banken'],
    money: true,
    answer: (f) => `Nettovärdet på sparkontona är ${f.netWorth}.`,
  },
  {
    words: [' idag', ' dagen', ' läget', ' hur går', ' sammanfatt', ' översikt', ' status', ' allt', ' nytt'],
    answer: dayBriefAnswer,
    level: 'broad',
  },
  // De bredaste orden, som också finns i andra frågor ("kvar på lånet", "sparat till målet").
  {
    words: [' över', ' kvar', ' spara', ' sparande'],
    money: true,
    answer: leftText,
    level: 'fallback',
  },
]

export const EXAMPLES = ['Vad blir över den här månaden?', 'När nås sparmålet?', 'Hur sov jag i natt?']

/** Högst så här många svar på en gång, så att Siri inte läser upp allt. */
const MAX_ANSWERS = 3

/** Svaret på en fråga, med exakta siffror. Förstår den inte frågan: dagens läge, och vad du kan fråga om. */
export function answer(question: string, facts: SummaryFacts, options: AskOptions = {}): string {
  const q = normalize(question)
  if (q.trim() === '') return `Fråga till exempel: "${EXAMPLES[0]}", "${EXAMPLES[1]}" eller "${EXAMPLES[2]}"`
  const matches = INTENTS.filter((intent) => has(q, intent.words))
  const say = (intent: Intent) =>
    options.hideMoney && intent.money ? HIDDEN_MONEY : intent.answer === dayBriefAnswer ? dayBrief(facts, options) : intent.answer(facts)
  for (const level of ['specific', 'broad', 'fallback'] as Level[]) {
    const hits = matches.filter((intent) => (intent.level ?? 'specific') === level)
    if (hits.length) return [...new Set(hits.slice(0, MAX_ANSWERS).map(say))].join(' ')
  }
  return `Det har jag inget exakt svar på, men så här är läget: ${dayBrief(facts, options)} Du kan också fråga om sömn, steg, lånet, sparmålet, önskelistan eller vad du ska göra idag.`
}
