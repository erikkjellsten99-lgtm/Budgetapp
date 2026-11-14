# Kunskap – regler för den här delen

- Tre lägen i samma flik: **Flöde** (korten, den här mappen), **Bibliotek** (Lär, `../lar/`, fast och granskat
  innehåll) och **Upptäck** (förslag på personer att följa, se nedan). Namnet på ett kort är en knapp till personsidan när personen finns i `PEOPLE`; Tillbaka går då till
  flödet på samma ställe. Personer utan sida i biblioteket får ingen, och sådana sidor genereras aldrig av Claude.

- **Upptäck** (`discover.ts`, Eriks önskan 2026-11-15): en fast katalog med genrer och personer att följa, sökbar,
  med genrerna som passar smaken (`weights`) först och personer man valt mindre av dolda. Inget hämtas och inget
  kostar. Katalogen är förslag skrivna ur minnet, inte granskat innehåll: bara vem personen är och vad hen är känd
  för, högst 90 tecken, inga påståenden om vad som fungerar, inga siffror, inga citat, inga länkar (låst i
  `discover.test.tsx`). Är du osäker på en uppgift, ta inte med personen. Följ lägger till personen som egen person.

- **Fråga Claude efter fler** (Eriks beslut 2026-11-15): i Upptäck kan Erik be Claude söka på nätet efter personer
  i en genre han skriver (`searchPeople` → edge function `kunskap-upptack`). Högst 6 personer per sökning, var och en
  med en källa som finns bland webbsökningens resultat (`toFound`), annars kastas den. Träffarna sparas i posten
  `found` i `kunskap_settings` (högst 40) och visas under "Hittade av Claude" med källänk, märkta som inte granskade.
  Bara på en tryckning, högst 5 sökningar per dygn, och kostnaden loggas som en batch med `trigger: 'profil'` och
  `search: true`. Egen funktion, så att knappen aldrig kan starta en batch med kort.

- **Egna personer i biblioteket:** de Erik följer som inte finns i `PEOPLE` visas i samma lista som bibliotekets
  personer (Eriks val 2026-11-15: en lista, ingen egen rubrik), efter de fasta och bara under Alla, och har en egen
  sida (`OwnPersonPage`). Sidan är inte granskad och säger det: den visar bara ämnena
  och korten om personen, med källa. Inga texter om personen, inga påståenden och inga märkningar av belägg
  skrivs där, varken för hand eller av Claude. Att lägga till i biblioteket är samma sak som att följa.

- **Presentation av en egen person** (beslut av Erik 2026-11-15): på en egen persons sida kan Erik be Claude skriva
  en kort text om vem personen är (`writeProfile` → edge function `kunskap-presentation` med `{ person: id }`; egen funktion så att knappen aldrig
  kan starta en batch med kort). Högst 120 ord, minst en
  källa som finns bland webbsökningens resultat (`toProfile`), annars sparas ingenting. Texten sparas som `profile` på
  personens post i `kunskap_people` och visas märkt "Skriven av Claude … Inte granskad". Sedan 2026-11-15 (Eriks
  önskan) skrivs den av sig själv för varje egen person som saknar en, när Mindhub är öppen och man är inloggad:
  en i taget (`nextToPresent`), ett försök per person och gång, och inga fler försök efter ett fel. Knappen finns
  kvar för att skriva om. Högst 5 per dygn (serverns gräns), och kostnaden loggas som en batch med `trigger: 'profil'`. Fortfarande inga
  påståenden om belägg, ingen metod och inga märkningar på egna sidor, och bibliotekets nio sidor genereras aldrig.

- Alla personer i biblioteket följs från början (`followLibrary` i `kunskapStore.ts`), så att de finns i flödet och
  får nya kort. Vilka som lagts till står i posten `library` i `kunskap_settings`: den Erik tar bort kommer inte
  tillbaka, en ny person i `PEOPLE` läggs till en gång. Id:t är `lib-<person-id>`, lika på alla telefoner. Inloggad
  görs det först när kontots poster hämtats en gång, och bara en körning i taget.

- Ett flöde av kort i textform ("reels i text"): `citat`, `insikt` eller `protokoll`. Varje kort har person, ämne,
  typ och källa med https-länk, och högst 80 ord (`MAX_WORDS`, låst i `kunskap.test.tsx`).
- Exempelkorten (`cards.ts`) byggs av det granskade innehållet i Lär (`../lar/people.ts`). Skriv inga egna kort
  för hand här, och aldrig en länk eller ett citat ur minnet. Reglerna i `../lar/CLAUDE.md` gäller innehållet.
- **Genereringen** körs på servern, aldrig i appen: edge function `kunskap-generera` (pg_cron en gång per dygn, eller
  "Generera nu" med användarens JWT). Den frågar Claude (`claude-sonnet-5-5`) med webbsökning och sparar korten i
  `kunskap_cards` och kostnaden i `kunskap_batches` (båda i `personal_records`, så appen får dem via vanlig synk).
  Delad logik som appen importerar: `kunskap-generera/shared.ts` (korttyp, ordräkning, inställningar, kostnad).
- Kontrollerna i `kunskap-generera/generate.ts` är kravet, inte prompten: ett kort vars källa inte finns bland
  webbsökningens resultat kastas, och ett citat som servern inte hittar ordagrant i källsidans text görs om till en
  insikt med egna ord (eller kastas). Bara blanksteg, typografiska citattecken och tankstreck får skilja. Lätta aldrig
  på de kontrollerna för att få fler kort.
- **Personligt:** rösterna viktas per person, ämne och korttyp i `weights()` (`shared.ts`): (gilla − ogilla) /
  (gilla + ogilla + 2). Det användaren själv ställt in i vyn "Vad Claude tror du gillar" (Mer, Mindre) går före
  rösterna och sparas som posten `prefs` i `kunskap_settings` (samma store som inställningen `settings`, olika id, så
  ingen ny databasversion). Appen och servern räknar med samma funktion; viktningen skickas som text i prompten
  (`taste()`).
- **Upptäckt:** ungefär vart femte kort (`discoveryCount`, 5 kort ger 1) får handla om en person som inte följs eller
  ett nytt ämne. Servern släpper bara in en icke följd person på ett kort som är märkt `discovery`, och aldrig fler än
  batchens andel. Källkravet och citatkontrollen gäller dem också. I flödet visas de med märket Upptäckt och en
  Följ-knapp.
- Skriv inga `\u`-koder eller osynliga tecken i `kunskap-generera`: bygg mönstren med `ch()` (`shared.ts`).
  Schemats hemlighet finns bara i Vault och läses med `kunskap_cron_secret()`.
- **Nya kort när man bläddrar** (Eriks önskan 2026-11-15): platsen `MoreCards` ligger efter de genererade korten.
  När den kommer i bild och `settings.auto` är på startar appen en vanlig omgång (`generateNow`). Kort som kommer
  under tiden läggs efter de förra (`sessionOrder`), inte överst. Spärrar som inte får tas bort: av tills man slår
  på det (alla inloggade följer biblioteket, så annars skulle vem som helst starta omgångar som kostar), en omgång
  åt gången, ingen ny omgång förrän platsen lämnat bilden och kommit tillbaka, inget nytt försök efter ett fel
  utan en tryckning, och serverns gräns på 3 omgångar per dygn.
- Kostnadsskydd: utan sparad inställning (`kunskap_settings`) genereras ingenting, högst 3 batchar per person och
  dygn, högst 10 kort per batch, tak på antal sökningar. Varje batch loggas med token, sökningar och USD, även när
  den misslyckas. Priserna står i `PRICE` i `shared.ts` och ska ändras där om Anthropic ändrar dem.
- Personer att följa (`kunskap_people`) och gilla/ogilla (`kunskap_votes`, ett per kort, med person, ämne och typ
  så att rösterna går att lära av) är personliga. De bor i vanor-databasen (`../vanor/store.ts`) och synkas via
  `personal_records` med samma outbox som vanorna. Ny lagring = nytt versionssteg där, aldrig ändra ett gammalt.
- Kort-id:n bygger på textens hash. Ändras en text i Lär får kortet nytt id och tappar sin röst.
- Gå djupare: `chatApi.ts` frågar edge function `kunskap` (`supabase/functions/kunskap/`), som frågar Claude med
  bara kortet och samtalet. Inga verktyg, ingen ekonomi, inga vanor. Räknas av `jarvis_count_call()` tillsammans med
  Jarvis (50 per dag). Samtalet glöms när arket stängs. Läggs bara ut efter "Lägg ut".
- Delen läser inget från ekonomin och skriver inget dit.
- Stil: vardagsrummet, bara tokens (`kunskap.css`). Inga medicinska råd; protokoll inom andning och kyla visar
  personens varning.
