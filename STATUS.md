# STATUS – Groundwork (2026-11-06)

Öppna PR:er att merga i ordning: [#101](https://github.com/erikkjellsten99-lgtm/groundwork/pull/101)
(uppgraderingen, innehåller även #100). Stäng #100 utan att merga.

## Gör först i nästa session
1. **Lägg ut inbox version 17** (repot ligger före servern): `health.ts` med `\u`-koder och `types.ts`.
   Servern (v16) kan missa hälsosiffror skrivna med smalt mellanslag (U+202F). Kontrollera efteråt fil för fil.
2. **GitHub-repot är omdöpt till `groundwork`.** Remote i klonen är uppdaterad, men push dit misslyckades (403):
   Claude-appen på GitHub har bara tillgång till det gamla namnet. Ge appen tillgång till `groundwork`
   (github.com/apps/claude/installations) och testa push. Pages-adressen blir
   `erikkjellsten99-lgtm.github.io/groundwork/`; den installerade appen på telefonen pekar på den gamla adressen
   och måste installeras om. `README.md` nämner fortfarande Budgetapp-adressen.
3. Öppna fliken Nyheter en gång och kontrollera i serverloggarna att alla fyra SVT-flöden kom fram.

## Ekonomi
- Fungerar: Översikt, Budget (månad för månad), Prognos med billån och extra på lånet, Sparmål (en uträkning i
  hela appen, `goalPlan.ts`), Konton, Önskelista, synk mellan två telefoner med ihopslagning av budget.
- Halvfärdigt: inget.
- Kända buggar: "Abonnemang" radbryts i budgetlistan på 375 px (fanns före HUD-stilen).
- Beslut: "Blir över" är ordet för kvar efter utgifter och sparande. Sparmålet matas av valda sparkategorier plus
  det som blir över. Skulderna är betalda och visas inte.

## Vanor
- Fungerar: vanor med veckomål, planerade dagar, gradvis ökning, Att göra, pausdag, hälsa från Apple Hälsa
  (genväg), automatisk bockning via regler, påminnelser, morgonbesked till klockan (genväg kl. 07).
- Halvfärdigt: inget känt.
- Kända buggar: se inbox v17 ovan (hälsosiffror med smalt mellanslag).

## Jarvis
- Fungerar: egen flik med röst (telefonens taligenkänning och uppläsning, standardröst), helskärm när du pratar,
  skriva, visningsläge som döljer belopp, svar på vaga frågor och stavfel (`ask.ts`), "Jarvis säger" på Idag,
  Siri-genvägarna "Fråga Groundwork" och "Jarvis" (Mac, Apple Intelligence).
- Borttaget (beslut, minskad Jarvis): röstval, ton och tempo; småprat ("hej", "tack", "vem är du"); de breda
  svaren för "ekonomi" och "hälsa". Vaga frågor får fortfarande dagens läge.
- Begränsning (beslut): ingen AI och inget som kostar. Jarvis förstår nyckelord, inte fria samtal.
- Ej verifierat på riktig iPhone: att vald röst faktiskt används och hur Safari hanterar mikrofon-tillstånd.
- Kända buggar: inga rapporterade.

## Galax
- Fungerar: 3D-universum (Jorden, rymdbas, hälsogalax, ekonomigalax) i `CosmosView.tsx`, laddas lazy.
  Gränssnittet ovanpå scenen är i HUD-stil sedan #101. 3D-scenen själv är oförändrad.
- Halvfärdigt: inget påbörjat. Erik vill "uppgradera" även själva 3D-scenen; inget bestämt vad.
- Kända buggar: i Playwright utan grafikkort syns inte alla etiketter (Ekonomi) efter att man flugit till
  Hälsa; inte reproducerat på riktig enhet.
- Att veta: renderas med swiftshader i sandboxen, en skärmbild tar 2–4 minuter.

## Nyheter (ny flik, #99)
- Fungerar i appen med testdata. Servern v16 har `?action=nyheter`. Riktiga SVT-flöden ej verifierade.
- Beslut: ton positiv/negativ/neutral via ordlistor, orden som avgjorde visas. Neutral finns för att inte tvinga
  en ton.

## Designskisser
- HUD-skisser A och B finns som artifact (Design-canvas) i Eriks claude.ai; B med Jarvis-knapp valdes.
