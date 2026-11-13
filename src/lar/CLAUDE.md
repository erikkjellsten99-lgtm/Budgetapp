# Lär – regler för den här delen

- Innehållet är fast och bor i `people.ts`: personer, metoder, påståenden och källor. Ingen databas, ingen synk,
  ingen server. Delen läser inget från ekonomin och skriver ingenting någonstans.
- Sammanfattningar skrivs med egna ord och innehåller aldrig citat. Inga `"`, `”` eller tankstreck (`–`, `—`) i
  texten, utom i `quotes[].text`.
- Citat (beslut av Erik 2026-11-13) finns bara i `quotes` på personen, 2 till 4 per person, aldrig utfyllda. Varje
  citat står ordagrant på en sida som faktiskt öppnats, är personens egna ord (egen text eller direkt citat som sidan
  tillskriver personen, inte en journalists omskrivning, förlagets text eller företagets marknadsföring), högst
  40 ord, en eller två hela meningar, inga hopfogade stycken och inga utelämningar. `text` på originalspråket utan
  omgivande citattecken, `sv` en trogen svensk översättning, `source` den öppnade sidan. Inga citat som lovar en
  hälsoeffekt, anger dos, tid, temperatur eller frekvens, eller uppmanar till något riskabelt.
- Kontroll före commit: spara sidans text (hämta med curl, ta bort taggar) och kör ett skript som kontrollerar att
  varje `text` finns ordagrant i den sparade sidtexten. Bara blanksteg, hårt mellanslag, typografiska citattecken
  och tankstreck får normaliseras. Kontrollera också med ögonen att sidan tillskriver personen orden.
- Varje påstående har märkning `belagt` (Väl belagt), `svagt` (Svagt stöd) eller `asikt` (Egen åsikt) och minst en
  https-källa som kontrollerats på nätet: sidan finns och stöder just det påståendet. Går en länk inte att bekräfta
  tas påståendet bort. Skriv aldrig en länk ur minnet.
- Varje påstående har `summary`: 2 till 4 korta stycken, 60 till 140 ord, skrivna med egna ord från den källa som
  faktiskt öppnats. Studie: vilka och hur många, vad de gjorde, vad som mättes och hittades (källans egna siffror),
  vad den inte visar. Idé eller råd: vad idén är, hur personen säger att den används, var den kommer ifrån. Upprepa
  inte `text` eller `note` ordagrant. Står det inte på sidan skrivs det inte.
- Varje källa i `startHere` har `summary` med 3 till 5 huvudpunkter, en mening var, så att Erik vet vad boken,
  artikeln eller avsnittet innehåller utan att öppna länken. För böcker: bara det som står i förlagets text
  (på förlagets, författarens eller bokhandelns sida).
- `belagt` kräver publicerad studie med människor som stöder påståendet. Säg i `note` om studien bara visar samband.
  `svagt` (små studier, djurstudier, motstridiga resultat) har alltid en `note` som säger varför.
- Inga medicinska råd: beskriv vad studierna fann. Personer inom `andning` eller `kallbad` har en `warning`.
- Idéer som kommer från någon annan länkas till ursprunget (gäller särskilt poddare och författare).
- Nya personer läggs till i `PEOPLE` i `people.ts`, och `npx vitest run src/lar/people.test.ts` ska vara grönt.
