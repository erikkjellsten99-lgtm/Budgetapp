# Lär – regler för den här delen

- Innehållet är fast och bor i `people.ts`: personer, metoder, påståenden och källor. Ingen databas, ingen synk,
  ingen server. Delen läser inget från ekonomin och skriver ingenting någonstans.
- Inga citat. Bara sammanfattningar med egna ord. Inga `"`, `”` eller tankstreck (`–`, `—`) i texten.
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
