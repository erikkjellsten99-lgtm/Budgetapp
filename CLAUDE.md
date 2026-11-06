# Groundwork – regler för Claude

Groundwork är Eriks app för budget, sparande och vanor (Vite + React + TypeScript, IndexedDB lokalt, Supabase för synk och inkorg, Vercel publicerar main).

## Ekonomidatan får aldrig ändras
- Alla siffror i ekonomidelen (Översikt, Budget, Prognos, Konton, Önskelista) är Eriks och Cassandras riktiga siffror: inkomster, utgifter, budgetkategorier, lån, skulder, sparmål, kontosaldon, önskningar och prognosen.
- Du får aldrig ändra, avrunda, flytta, ta bort, återställa eller hitta på något av det. Det gäller både datan (IndexedDB och Supabase) och uträkningarna som ger siffrorna (t.ex. prognos, ränta, sparmål, "över per månad").
- Visa exakt de siffror som redan ligger i Groundwork. En designändring får ändra hur ett belopp ser ut, aldrig vilket belopp det är.
- Behöver du testdata för skärmbilder: använd en separat testmiljö eller en tom lokal databas, aldrig Eriks riktiga data, och skriv aldrig testdata till Supabase.
- Ser du något som verkar fel i en uträkning: beskriv det och fråga. Ändra inget själv.
- Innan du lämnar en PR som rör ekonomidelen: jämför siffrorna före och efter på varje flik och skriv i PR:en att de är identiska.

## Jarvis (assistenten i appen)
- Jarvis får bara läsa ekonomidatan och svara på frågor om den. Den får aldrig ändra, lägga till eller ta bort något i ekonomidelen, och den ska citera exakt de siffror som ligger i Groundwork.
- Allt Jarvis får ändra (t.ex. bocka vanor, lägga in uppgifter) ska Erik ha godkänt först, och det gäller aldrig ekonomin.
- AI-nyckeln ligger bara i Supabase (edge function), aldrig i appen. Det ska finnas ett kostnadstak.

## Arbetssätt
- Svara på svenska, kort. Skilj på fakta och din bedömning. Ge en rekommendation när det finns alternativ.
- Säg emot direkt om något jag ber om har ett problem (teknik, tid, kostnad, användarvärde).
- Pusha aldrig till main. Jobba på en egen gren och öppna en PR med kort svensk beskrivning och "Så testar du". Erik mergar själv.
- Kör `npm test` och `npm run build` innan push. Inget får vara rött.
- Ändra aldrig en befintlig databasversion (IndexedDB) – lägg till en ny med uppgraderingssteg.
- Ändringar i Supabase (databas, edge functions som inbox) görs bara efter att Erik skrivit "Lägg ut".
- Fråga innan ny teknik eller tjänst som kostar pengar.

## Kvalitet
- Ska fungera på 375 px bredd, i ljust och mörkt läge. Tomma lägen, laddning och fel ska vara designade.
- Hantera kantfall: tom input, stora tal, å/ä/ö, dubbelklick, tappad uppkoppling.
- Svenska datum (2026-10-20) och belopp (1 234 kr).
- Kontrollera visuellt med skärmbilder (Playwright) innan du säger att något är klart.
- Föreslå max en förbättring per leverans – bygg den inte utan att fråga.
