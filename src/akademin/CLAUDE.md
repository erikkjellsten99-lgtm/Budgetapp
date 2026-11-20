# Akademin – regler för den här delen

Akademin är ett läge i Kunskap (`../kunskap/Kunskap.tsx`): en kurs i aktier för en nybörjare som äger några
aktier och läser en kvart om dagen på mobilen. Lektionerna är fast innehåll i TypeScript under `kurser/`
(en fil per lektion, `kurser/kurs-1/01.ts` …), samlade i `kurser/index.ts`. Typerna står i `types.ts`.

## Det här får aldrig hända

- Appen ger aldrig köp- eller säljsignaler och aldrig råd om vad användaren ska göra med sina pengar. Den hjälper
  användaren att skriva ner sina egna skäl och följa upp dem. Lektionerna är allmän utbildning.
- Ingen lektion säger eller antyder att en viss aktie, fond eller ett visst konto är rätt val för läsaren, och
  ingen lektion lovar avkastning.
- Akademin skriver aldrig något i ekonomidatan (`holdings`, `trades`, `assets` med flera). Den läser bara namn och
  id på innehav och affärer för att kunna länka.
- Inget påhittat i lektionerna: ingen siffra, regel eller länk ur minnet.
- Inget i Akademin kostar pengar eller anropar Claude eller någon annan tjänst när appen körs.

## Innehållsregler

- Varje lektion har en lista med https-källor som faktiskt har öppnats. Skriv aldrig en länk ur minnet. Går en
  uppgift inte att bekräfta på en öppnad sida tas den bort ur lektionen. `checked` är dagen sidan öppnades.
- Myndigheter och börsen först: Skatteverket, Finansinspektionen, Riksbanken, Riksgälden, Nasdaq Stockholm,
  Euroclear Sweden, Konsumenternas.se och bolagens egna rapporter.
- Regler, skattesatser, schablonränta, fribelopp, avgifter, gränser och andra uppgifter som kan ändras har en
  källa och datumet då den kontrollerades, och datumet står i lektionens text. Siffror som gäller ett visst år
  nämner året.
- Exempel med siffror från ett riktigt bolag hämtas ur bolagets egen rapport, med länk och period. Ett exempel
  kan i stället vara en uträkning med en regel ur en öppnad källa.
- Texten är egna ord. Inga citat. Inga `"`, `”`, `–` eller `—` någonstans i lektionsfilerna (samma regel som Lär).
- Förklara ett nytt ord första gången det används och lägg det i `terms` (ordlistan).
- Form, som låses av `kurser/lessons.test.ts`: 600 till 900 ord i `body` (all `text` och alla `items`), korta
  stycken, exempel med källa, tre rader i `key`, minst en källa, fyra frågor med fyra olika svar var och en
  förklaring (`why`) på minst 40 tecken. Frågorna prövar förståelse, de tre felaktiga svaren är rimliga och
  platsen för rätt svar varierar.
- **Ett id ändras aldrig efter publicering.** Lektionens id (`k1-03`) och frågornas id (`k1-03-q2`) är nycklarna
  för framsteg och svar i användarens sparade data. Ändra hellre texten i en fråga än dess id, och ta aldrig ett
  gammalt id i bruk för en ny fråga.
- Nya lektioner läggs i rätt kurs i `kurser/index.ts`, och `npx vitest run src/akademin/kurser/lessons.test.ts`
  ska vara grönt.
