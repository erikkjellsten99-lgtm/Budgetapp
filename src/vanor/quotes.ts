// Dagens citat i Vanor. Samma citat hela dagen, nytt vid midnatt.
// Översatta till svenska. Bara citat där källan är känd (verk och kapitel inom parentes),
// plus några egna rader utan namn. Vanliga felattribueringar är medvetet utelämnade.

import type { DateKey } from './dates';

export interface Quote {
  text: string;
  /** Vem som sa det. Saknas = egen rad för appen. */
  by?: string;
}

export const QUOTES: Quote[] = [
  { text: 'Vi är det vi upprepade gånger gör. Förträfflighet är alltså inte en handling, utan en vana.', by: 'Will Durant, om Aristoteles' },
  { text: 'Vi blir rättvisa genom att handla rättvist, och modiga genom att handla modigt.', by: 'Aristoteles (Nikomachiska etiken II.1)' },
  { text: 'En svala gör ingen sommar, och inte heller en enda dag.', by: 'Aristoteles (Nikomachiska etiken I.7)' },
  { text: 'Det är inte för att saker är svåra som vi inte vågar. Det är för att vi inte vågar som de är svåra.', by: 'Seneca (Brev 104)' },
  { text: 'Vi lider oftare i inbillningen än i verkligheten.', by: 'Seneca (Brev 13)' },
  { text: 'Medan vi skjuter upp livet, rusar det förbi.', by: 'Seneca (Brev 1)' },
  { text: 'Ingen vind är gynnsam för den som inte vet vilken hamn den styr mot.', by: 'Seneca (Brev 71)' },
  { text: 'Det är inte så att vi har kort tid, utan att vi slösar bort mycket av den.', by: 'Seneca (Om livets korthet)' },
  { text: 'Så länge du lever, fortsätt att lära dig hur man lever.', by: 'Seneca (Brev 76)' },
  { text: 'Det som står i vägen för handling blir handlingen. Det som står i vägen blir vägen.', by: 'Marcus Aurelius (Självbetraktelser 5.20)' },
  { text: 'Slösa inte mer tid på att diskutera hur en god människa ska vara. Var en.', by: 'Marcus Aurelius (Självbetraktelser 10.16)' },
  { text: 'Mycket lite behövs för ett lyckligt liv. Allt finns inom dig, i ditt sätt att tänka.', by: 'Marcus Aurelius (Självbetraktelser 7.67)' },
  { text: 'Det är inte händelserna som oroar oss, utan våra föreställningar om dem.', by: 'Epiktetos (Handbok 5)' },
  { text: 'Ingenting stort blir till på en gång.', by: 'Epiktetos (Samtal 1.15)' },
  { text: 'Säg först till dig själv vad du vill vara. Gör sedan det du måste göra.', by: 'Epiktetos (Samtal 3.23)' },
  { text: 'En resa på tusen mil börjar med ett första steg.', by: 'Laozi (Tao te ching 64)' },
  { text: 'Ta itu med det svåra medan det ännu är lätt.', by: 'Laozi (Tao te ching 63)' },
  { text: 'Den som besegrar andra är stark. Den som besegrar sig själv är mäktig.', by: 'Laozi (Tao te ching 33)' },
  { text: 'Droppen urholkar stenen.', by: 'Ovidius' },
  { text: 'Ett uns förebyggande är värt ett pund bot.', by: 'Benjamin Franklin' },
  { text: 'Ingen kliver ner i samma flod två gånger.', by: 'Herakleitos' },
  { text: 'Minimiversionen räknas. Två minuter idag slår noll minuter.' },
  { text: 'Du behöver ingen perfekt dag. Bara en dag till.' },
  { text: 'Missa aldrig två gånger i rad. En gång är en olycka, två gånger är början på en ny vana.' },
  { text: 'Motivation kommer efter att du börjat, inte före.' },
  { text: 'Små steg varje dag blir långa sträckor på ett år.' },
  { text: 'Det du gör de flesta dagar betyder mer än det du gör ibland.' },
  { text: 'Vila är också en del av planen.' },
  { text: 'Var snäll mot dig själv en dålig dag, och ärlig mot dig själv en bra.' },
  { text: 'Gör det lätt att börja. Resten följer med.' },
];

/** Antal dagar sedan 1970-01-01 för ett datum (UTC, så sommartid inte flyttar något). */
function dayNumber(date: DateKey): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Dagens citat. Går igenom alla citat innan något upprepas, i en blandad ordning
 * (steget 7 är relativt primt med antalet, så varje citat kommer en gång per varv).
 * `offset` bläddrar vidare när man trycker på citatet.
 */
export function dayQuote(date: DateKey, offset = 0, list: Quote[] = QUOTES): Quote {
  const n = list.length;
  const step = stepFor(n);
  const index = (((dayNumber(date) + offset) * step) % n + n) % n;
  return list[index];
}

function stepFor(n: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (let s = 7; s < n + 7; s++) if (gcd(s, n) === 1) return s % n || 1;
  return 1;
}
