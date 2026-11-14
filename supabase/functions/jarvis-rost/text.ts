// Texten som skickas till talsyntesen. Rena funktioner utan Deno och nätverk, tester i text.test.ts.

/** Längsta text som läses upp i ett anrop. */
export const MAX_SPEECH = 800
/** Högst så här många uppläsningar per användare och dag (kontrolleras i databasen, jarvis_count_speech). */
export const SPEECH_LIMIT = 150

/**
 * Gör en text lätt att läsa upp: "69 940 kr" blir "69940 kronor" (så att talet läses som ett tal och inte
 * som två), procenttecken och minustecken skrivs ut, och formatering tas bort. Kortas till MAX_SPEECH.
 */
export function speakable(text: string): string {
  return text
    .replace(/[*_#`]/g, '')
    .replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1')
    .replace(/(^|[^\d])[−-](?=\d)/g, '$1minus ')
    .replace(/(\d)\s*kr\b\.?/g, '$1 kronor')
    .replace(/(\d)\s*%/g, '$1 procent')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEECH)
}

const XML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const xml = (text: string) => text.replace(/[&<>"']/g, (c) => XML[c])

/** Texten som SSML för Azure Speech, med rösten `voice` (t.ex. sv-SE-MattiasNeural). Tecken som betyder något i XML skrivs om. */
export function ssml(text: string, voice: string): string {
  const lang = /^[a-z]{2,3}-[A-Z]{2}/.exec(voice)?.[0] ?? 'sv-SE'
  return `<speak version='1.0' xml:lang='${lang}'><voice name='${xml(voice)}'>${xml(text)}</voice></speak>`
}
