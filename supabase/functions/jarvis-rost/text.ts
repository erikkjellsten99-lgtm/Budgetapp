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
