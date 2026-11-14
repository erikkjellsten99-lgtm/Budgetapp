# STATUS – Groundwork (2026-11-13)

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
5. ~~Öppna källänkarna i Lär~~ Klart 2026-11-13: alla länkar i `src/lar/people.ts` är öppnade, sammanfattningarna är
   granskade mot sidorna av en andra granskare och rättade, och sammanfattningssidorna är utbytta. Kvar: PubMed- och PMC-sidorna lästes via NCBI:s egna gränssnitt på samma värd
   (sidorna visar en webbläsarkontroll för skript), och böckerna är sammanfattade bara från förlagets eller
   bokhandelns text. Öppna gärna några PubMed-länkar i en vanlig webbläsare.

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
- Nytt 2026-11-13: Jarvis i appen frågar Claude via edge function `jarvis` (verktyg, RLS, 50 frågor per dag). Hälsar
  med förnamnet (Konto → Förnamn) och börjar lyssna när rummet öppnas. Håll in eller tryck för att prata. Adressen
  `?jarvis=1&listen=1` öppnar Jarvis direkt. Tal och uppläsning ligger bakom `voice.ts`.
- Nytt 2026-11-14: verktyget `hamta_vanor`, så att Jarvis i appen kan svara om vanor och Att göra (måsten idag,
  kan vänta, bockat, veckans läge). Hälsodata läses inte.
- Nytt 2026-11-14: Jarvis pratar mer som en människa (ny systemprompt, förnamn, följdfrågor med de senaste fyra
  utbytena) och får röst från ElevenLabs (funktionen `jarvis-rost`, hemligheten `ELEVENLABS_API_KEY`).
- **Utlagt 2026-11-14:** migrationen `jarvis_speech` är körd, `jarvis` version 3 (tre verktyg, `history`, ny prompt)
  och `jarvis-rost` version 2 ligger ute, båda med verify_jwt på. Båda startar och nekar den som inte är inloggad.
  Inte prövat: ett riktigt svar från nya `jarvis`, rösten mot ElevenLabs (nyckeln saknas tills Erik lagt in den),
  och uppspelningen på iPhone. Appens del går ut först när PR 115 är sammanfogad.
- MCP-verktyget gör om `\u00A0` i källan till ett vanligt tecken vid utläggning. Skriv `\s` i reguljära uttryck i
  funktioner i stället för att räkna upp mellanslagstecken (`jarvis-rost/text.ts`).
- `ANTHROPIC_API_KEY` lades in som hemlighet 2026-11-14. Första riktiga svaret från Claude samma dag.
- **Utlagt 2026-11-13:** migrationen `jarvis_usage` är körd och `jarvis` version 1 ligger ute (verify_jwt på).
  Räknaren är prövad i en tillbakarullad transaktion: fråga 1–50 går igenom, 51 nekas, räknaren står kvar på 50.
  Funktionen startar och nekar den som inte är inloggad.
- Så lades den ut: källfilerna (117 kB med `inbox`-filerna) är för stora för MCP-verktyget, så de slogs ihop till en
  fil på 27 kB med esbuild (`--bundle --minify --line-limit=160 --external:npm:*`) och lades ut som `index.ts`.
  Jämförd tecken för tecken mot bygget: ett tecken skiljer, U+00A0 i `formatHealth` blev ett vanligt mellanslag
  (verktyget tappar osynliga tecken). Raden körs inte av `jarvis`, som inte läser hälsodata.
- Inte prövat: ett riktigt svar från Claude (kräver en inloggad användare, alltså att PR #114 är mergad och appen
  publicerad, och att `ANTHROPIC_API_KEY` verkligen finns som hemlighet), och på iPhone om hälsningen och lyssnandet
  startar utan en tryckning när appen öppnas från en genväg.
- Beslut: Claude API är tillåtet för Jarvis i appen (kostar per fråga). Siri-genvägarna, Idag och visningsläget
  använder fortfarande den enkla Jarvis utan AI (`ask.ts`).
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

## Lär (ny flik)
- Fungerar: bibliotek med nio personer (Wim Hof, Susanna Søberg, Jari Laukkanen, Andrew Huberman, Rhonda Patrick,
  Jon Kabat-Zinn, Sam Harris, James Clear, Chris Williamson), filter på område, sida per person med metod, påståenden märkta
  Väl belagt / Svagt stöd / Egen åsikt, källänkar och varningsrad. Fast innehåll i `src/lar/people.ts`, ingen
  databas, ingen server.
- Sammanfattningar (2026-11-13): varje påstående har 2 till 4 stycken skrivna från den öppnade källan, och varje
  Börja här har 3 till 5 huvudpunkter. Allt syns på personsidan utan klick.
- Citat (2026-11-13, Eriks beslut): varje person har 2 till 4 citat i sektionen Citat, på engelska med svensk
  översättning och källänk. Alla 27 är kontrollerade ordagrant mot texten på den öppnade sidan med ett skript, och
  sidan tillskriver personen orden. Ingen person har färre än 2. Wim Hofs två citat kommer från förlaget Sounds
  Trues sida om boken (citat där), eftersom wimhofmethod.com bara har företagets text och deltagarnas berättelser.
  Talspråk ur utskrifter: Laukkanens två citat (FoundMyFitness intervju), Patricks citat om stress (utskriften av
  hennes egen video på FoundMyFitness) och Søbergs tredje citat (Huberman Labs utskrift av avsnittet).
- Verifierat 2026-11-13: alla 56 unika länkar i `people.ts` är öppnade (den 56:e, Mindfuls intervju med Kabat-Zinn, lades till med citaten). Sammanfattningarna för alla nio personer är
  granskade mot sidorna av en andra granskare, och rättelserna från den granskningen är gjorda. Texterna `about`, `method` och `teaser` är kontrollerade
  mot öppnade sidor; detaljer som ingen sida stöder (årtal, titlar, Love Island) är borttagna. Rosetta, Podscripts, Global Player,
  Goodreads, QxMD, Stanford-PDF:en, EurekAlert, ScienceDaily och The Psychologist är borttagna eller utbytta mot
  PubMed, PMC, tidskriften, personens egen sajt eller tinyhabits.com. Påståendet om 66 dagar (James Clear) togs bort
  (ingen öppnad källa utanför hans sajt). Williamsons tre påståenden skrevs om efter hans egna nyhetsbrev.
- Sam Harris (tillagd 2026-11-13, område Meditation): fem påståenden, fyra Egen åsikt och ett Väl belagt. Alla
  hans sidor är öppnade (samharris.org: om honom, How to Meditate, essän om ett medvetande utan jag, bokens sida;
  wakingup.com: startsidan, om appen, sidan om mindfulness, introduktionen, stipendier), och Goyal 2014 lästes
  via NCBI:s gränssnitt. Ej verifierat: boken Waking Up är inte läst, bara författarens sida om boken; de fem studier från 2010
  och 2011 som han hänvisar till är bara kontrollerade till titel. Sidan om mindfulness är skriven av Waking Up
  och tillskrivs appen, inte honom. Börja här är boken och hans gratis essä om hur man mediterar; appen är
  betald och nämns bara neutralt i `about` och `method`, inte i Börja här. Podden Making Sense är inte med i
  Börja här, eftersom sidan bara listar avsnitt och de flesta inte handlar om meditation.
- Ej verifierat: PubMed- och PMC-sidorna visar en webbläsarkontroll för skript, så posterna lästes via NCBI:s
  exportgränssnitt (MEDLINE) och PMC:s OAI-gränssnitt på samma värd, inte som sidor. Booktopia och Publishers
  Weekly är kvar för böckerna eftersom förlagens sidor inte gick att nå; böckerna själva är inte lästa.
  Idéer som Williamson lånar (Rich Roll, Montesquieu via Tim Urban, Charlie Munger) länkas inte till ursprunget,
  eftersom de sidorna låg utanför de värdar som gick att nå. Samma gäller Oliver Burkemans mening om osäkra
  överpresterare, som bara finns återgiven i Williamsons nyhetsbrev.
- Inte med (beslut): loggning av egna pass, flöde med nya avsnitt, Jarvis och Idag läser inte biblioteket, egna
  anteckningar.
- Design och plan: `docs/superpowers/specs/2026-11-13-lar-design.md`, `docs/superpowers/plans/2026-11-13-lar.md`.

## Design
- Designspecen "Två rum" valdes 2026-11-07: lugnt vardagsrum (Idag, Ekonomi, Vanor, Nyheter) och mörkt specialrum
  (Jarvis, galaxen). Spec och genomförandeplan i `docs/design/`.
- Äldre: HUD-skisser A och B finns som artifact (Design-canvas) i Eriks claude.ai; B med Jarvis-knapp valdes.
