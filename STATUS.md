# STATUS – Groundwork (2026-11-06)

Öppna PR:er att merga i ordning: [#101](https://github.com/erikkjellsten99-lgtm/groundwork/pull/101)
(uppgraderingen, innehåller även #100). Stäng #100 utan att merga.

## Gör först i nästa session
1. **Lägg ut inbox version 18** (repot ligger före servern v17): `ask.ts` (månadsfrågor), `summary.ts`
   (`MonthFacts`), `health.ts` med `\u`-koder och `types.ts`. Servern kan missa hälsosiffror skrivna med smalt
   mellanslag (U+202F). Går inte via MCP-verktyget från sandboxen (för stort anrop, se `inbox/CLAUDE.md`):
   antingen Supabase CLI från en dator, eller spara en Supabase-nyckel för `api.supabase.com` i molnmiljön
   "Budgetapp" så att nästa molnsession kan lägga ut med CLI. Kontrollera efteråt fil för fil.
2. **GitHub-repot är omdöpt till `groundwork`.** Remote i klonen är uppdaterad, men push dit misslyckades (403):
   Claude-appen på GitHub har bara tillgång till det gamla namnet. Ge appen tillgång till `groundwork`
   (github.com/apps/claude/installations) och testa push. Pages-adressen blir
   `erikkjellsten99-lgtm.github.io/groundwork/`; den installerade appen på telefonen pekar på den gamla adressen
   och måste installeras om. `README.md` nämner fortfarande Budgetapp-adressen.
3. Öppna fliken Nyheter en gång och kontrollera i serverloggarna att alla fyra SVT-flöden kom fram.
4. ~~Lägg ut `reminders` med inbox-filerna~~ Klart: version 6 utlagd 2026-11-06, bootar och svarar 200 var 5:e minut.
   `inbox/health.ts` tappades av verktyget (sista filen, bara typer) och saknas på servern; följer med nästa gång.

## Ekonomi
- Fungerar: Översikt, Budget (månad för månad), Prognos med billån och extra på lånet, Sparmål (en uträkning i
  hela appen, `goalPlan.ts`), Konton, Önskelista, synk mellan två telefoner med ihopslagning av budget.
- Halvfärdigt: inget.
- Kända buggar: inga kända. (Abonnemang-radbrytningen åtgärdades i #104.)
- Beslut: "Blir över" är ordet för kvar efter utgifter och sparande. Sparmålet matas av valda sparkategorier plus
  det som blir över. Skulderna är betalda och visas inte.

## Vanor
- Fungerar: vanor med veckomål, planerade dagar, gradvis ökning, Att göra, pausdag, hälsa från Apple Hälsa
  (genväg), automatisk bockning via regler, påminnelser, morgonbesked till klockan (genväg kl. 07).
- Halvfärdigt: inget känt.
- Kända buggar: se inbox v17 ovan (hälsosiffror med smalt mellanslag).

## Jarvis
- Fungerar: specialrum bakom orben i sidhuvudet (sedan "Två rum"), med röst (telefonens taligenkänning och
  uppläsning), helskärm när du pratar, skriva,
  visningsläge som döljer belopp, röstval med ton och tempo (PR #101), svar på vaga frågor och stavfel
  (`ask.ts`), "Jarvis säger" på Idag, Siri-genvägarna "Fråga Groundwork" och "Jarvis" (Mac, Apple Intelligence).
- Begränsning (beslut): ingen AI och inget som kostar. Jarvis förstår nyckelord, inte fria samtal.
- Ej verifierat på riktig iPhone: att vald röst faktiskt används och hur Safari hanterar mikrofon-tillstånd.
- Kända buggar: inga rapporterade.

## Galax
- Fungerar: 3D-universum (Jorden, rymdbas, hälsogalax, ekonomigalax) i `CosmosView.tsx`, laddas lazy.
  Gränssnittet ovanpå scenen är i HUD-stil (`room.css`), med Tillbaka uppe till vänster. 3D-scenen själv är oförändrad.
- Halvfärdigt: inget påbörjat. Erik vill "uppgradera" även själva 3D-scenen; inget bestämt vad.
- Kända buggar: i Playwright utan grafikkort syns inte alla etiketter (Ekonomi) efter att man flugit till
  Hälsa; inte reproducerat på riktig enhet.
- Att veta: renderas med swiftshader i sandboxen, en skärmbild tar 2–4 minuter.

## Nyheter (ny flik, #99)
- Fungerar i appen med testdata. Servern v16 har `?action=nyheter`. Riktiga SVT-flöden ej verifierade.
- Beslut: ton positiv/negativ/neutral via ordlistor, orden som avgjorde visas. Neutral finns för att inte tvinga
  en ton.

## Design
- Designspecen "Två rum" valdes 2026-11-07: lugnt vardagsrum (Idag, Ekonomi, Vanor, Nyheter) och mörkt specialrum
  (Jarvis, galaxen). Spec och genomförandeplan i `docs/design/`.
- Äldre: HUD-skisser A och B finns som artifact (Design-canvas) i Eriks claude.ai; B med Jarvis-knapp valdes.
