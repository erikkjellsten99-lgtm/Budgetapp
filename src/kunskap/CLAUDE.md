# Kunskap – regler för den här delen

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
