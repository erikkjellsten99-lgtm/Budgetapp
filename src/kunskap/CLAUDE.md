# Kunskap – regler för den här delen

- Ett flöde av kort i textform ("reels i text"): `citat`, `insikt` eller `protokoll`. Varje kort har person, ämne,
  typ och källa med https-länk, och högst 80 ord (`MAX_WORDS`, låst i `kunskap.test.tsx`).
- Exempelkorten (`cards.ts`) byggs av det granskade innehållet i Lär (`../lar/people.ts`). Skriv inga egna kort
  för hand här, och aldrig en länk eller ett citat ur minnet. Reglerna i `../lar/CLAUDE.md` gäller innehållet.
- Genereringen är inte påkopplad. När den byggs ska korten ha samma form (`KunskapCard`) och samma krav på källa.
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
