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
3. ~~Lägg ut veckonyheterna~~ Klart 2026-11-15, se Nyheter nedan. Kvar: merga grenen så att appen visar dem.
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

## Challenges
- Nytt 2026-11-15 (PR 133): fliken Challenges med lista (dag X/Y, ring, streak, försök), dagvy, alla dagar som
  rutor, skapa från mall (75 Hard) eller egen, regler med automatisk omstart, progressbilder.
- **Utlagt 2026-11-15:** migrationen `challenges` är körd (fyra tabeller med radsäkerhet, bucketen
  `challenge-photos` med policyer per ägare) och `reminders` version 9 ligger ute (verify_jwt av, som förut).
  Version 9 är en enda fil byggd med esbuild (`--bundle --minify --format=esm --external:npm:*`, 12,6 kB) plus
  `note.ts` sist. Kontrollerat: `?action=key` svarar 200, och säkerhetsrådgivaren har inga nya anmärkningar.
- Inte prövat: synk från appen mot tabellerna, bilduppladdning, en riktig notis 19:45/20:30, två telefoner.
  Appens del går ut först när PR 133 är mergad.
- Nytt 2026-11-16 (PR, bara appen, inget på servern): Dagsform överst i utmaningar med träningspass. Räknar ur
  sömn, pulsvariabilitet, vilopuls, andning och handledstemperatur mot personens egen normalnivå och säger Kör som
  vanligt, Ta det lite lugnare eller Ta det lugnt. Eriks genväg skickar i dag sömn, steg, syresättning, VO2 max och
  sömnpoäng men inte `vilopuls`, `hrv`, `andning` eller `handled`; tills de läggs till i genvägen bygger
  bedömningen bara på sömnen. Prövat med testdata i webbläsare, inte med riktiga värden.
- Kända begränsningar: tidigare dagar går inte att ändra, uppgifter går inte att ändra efter start, reglerna körs
  bara när fliken öppnas, Idag och Jarvis känner inte till utmaningarna.

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
  och uppspelningen på iPhone. Appens del går ut först när PR:en med samtalston och röst är sammanfogad (PR 115 hann bara få med `hamta_vanor`).
- Nytt 2026-11-14 (PR, inte utlagt): rösten byter från ElevenLabs till Azure Speech. ElevenLabs gratisnivå svarade
  401 "detected_unusual_activity" när anropet kom från Supabase. OpenAI valdes bort: `gpt-4o-mini-tts` stängs
  2027-01-06. Nya hemligheter: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, valfritt `AZURE_SPEECH_VOICE`.
  `ELEVENLABS_API_KEY` används inte längre och kan tas bort. Inte prövat mot Azure.
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

## Nyheter (veckonyheter, gjorda om 2026-11-15)
- **Utlagt 2026-11-15:** edge function `nyheter` version 2 (verify_jwt av, hopslagen till en fil med esbuild
  `--bundle --minify --charset=utf8 --format=esm --external:npm:*`), migrationen `nyheter` (tabellen `news_weeks`,
  schemat `nyheter` måndagar 02:00–07:50 UTC var tionde minut). Appens nya flik ligger på grenen, inte mergad.
- Provkört 2026-11-15 för vecka 46: alla sex sektioner klara på första försöket med Fable 5.2, 26 nyheter, 14
  positiva, inga kastade. Uppmätt kostnad 4,08 USD för veckan (0,41–0,94 per sektion), alla 10 sökningar använda
  i varje sektion.
- Svagt: vinklarna. 11 vinklar på 26 nyheter, mest bara "mitten", ingen i Karlstad och ingen blind fläck. Taket på
  10 sökningar räcker inte till att både hitta nyheterna och leta upp tre sidors bevakning. Inget ändrat än.
- Version 1 avvisades av Claude för alla sektioner (0 USD). Feltexten sparades inte då; version 2 sparar den i
  sektionens `error`. Troligen `null` i en enum i det strikta schemat, som är borttaget.
- SVT-flödet och `?action=nyheter` är borttagna ur repot. Den utlagda inbox har åtgärden kvar, vilket inte skadar.
- Beslut: lutningen för kända medier är fast i koden (`LEANING`), övriga får modellens bedömning.

- Egna personer i biblioteket (2026-11-15): den som läggs till själv visas i samma lista som bibliotekets nio
  (sammanslaget samma dag på Eriks önskan, ingen egen rubrik) och har en sida med sina kort. Bibliotekets filter
  har fått fler genrer, så att egna personer går att filtrera fram (Framgång, Pengar, Idrott med flera, och Övrigt). Sidan är märkt som inte granskad. Beslut: inga genererade personsidor (text om personen,
  påståenden, märkning av belägg), bara korten med källa.
- Presentation av egna personer (2026-11-15): knappen "Skriv en presentation" på en egen persons sida ber
  funktionen `kunskap-presentation` skriva en kort text med källor. Delad serverkod ligger i
  `kunskap-generera/server.ts`.
- **Utlagt 2026-11-15 (andra omgången):** `kunskap-presentation` version 1 (verify_jwt på) och `kunskap-generera`
  version 2 (verify_jwt av), båda hopslagna till en fil med esbuild. Prövat från databasen (pg_net): alla tre
  Kunskap-funktionerna startar och svarar 401 utan inloggad användare, och fel hemlighet nekas. Schemats riktiga
  anrop prövades inte den här gången, eftersom Erik har valt Varje vecka och det hade startat en riktig batch.
  Inte prövat: en riktig batch, en riktig presentation och en riktig chatt (kräver Eriks inloggning).
- Sett 2026-11-15: på kontot fanns inställningen sparad men inga personer (`kunskap_people`). Schemat hoppar över
  den som inte följer någon. Personerna kommer upp när appen med automatisk följning är öppnad inloggad.
- Nya kort när man bläddrar (2026-11-15): i flödet, efter de genererade korten, finns en plats som hämtar en ny
  omgång när man bläddrat dit. Av tills man trycker Slå på (eller kryssar i det under inställningarna). Högst 3
  omgångar per dygn, samma gräns som förut. Prövat i webbläsare med låtsad server; inte prövat mot riktig server.
  Ingen ändring på servern behövdes.
- Upptäck (2026-11-15): tredje läget i Mindhub. Sök på genre eller person och följ med ett tryck. Elva genrer och
  ett fyrtiotal personer i en fast katalog (`discover.ts`), sorterade efter smaken. Beskrivningarna är skrivna ur
  minnet och inte kontrollerade mot källor; vyn säger att de inte är granskade.
- Fråga Claude efter fler (2026-11-15): knappen "Sök med Claude" i Upptäck anropar funktionen `kunskap-upptack`.
- **Utlagt 2026-11-15 (tredje omgången):** `kunskap-upptack` version 1 och `kunskap-presentation` version 2 (båda
  verify_jwt på, hopslagna med esbuild). Sökningar räknas nu för sig och tar inte av dygnets presentationer.
  Prövat från databasen (pg_net): båda startar och svarar 401 utan inloggad användare.
  Inte prövat: en riktig sökning och en riktig presentation (kräver Eriks inloggning).
- **Första riktiga batchen (2026-11-14 21:47 UTC, manuell, Eriks konto):** klar, 5 kort av 5 begärda, 0 kastade.
  1 citat bekräftat ordagrant mot källsidan, 0 omskrivna, 1 upptäcktskort. 7 sökningar, 36 939 token in, 1 838 ut,
  0,16 USD. Det bekräftar att webbsökningen (`web_search_20260209`), kostnadsloggen och citatkontrollen fungerar
  mot riktig server, och att en batch hinner klart inom tidsgränsen. En batch är för lite för att säga något om
  hur ofta citat går att bekräfta.
- Presentationer skrivs av sig själva (2026-11-15): varje egen person utan presentation får en när Mindhub är
  öppen och man är inloggad, en i taget, högst 20 per dygn (höjt från 5 den 2026-11-15). `kunskap-presentation`
  version 3 med den gränsen är utlagd och svarar 401 utan inloggad användare. Ingen riktig presentation har
  skrivits än: på Eriks konto fanns 15 personer och ingen med presentation när version 3 lades ut. Tre omgångar
  kort har körts (0,16, 0,16 och 0,21 USD för 5 kort var).
  Prövat i webbläsare med låtsad server (två personer gav två anrop efter varandra, utloggad gav inga). Ingen
  ändring på servern.
- Bibliotekets personer följs automatiskt sedan 2026-11-15 (Eriks önskan: alla i biblioteket ska finnas i flödet).
  De går att ta bort under Följer och kommer då inte tillbaka. Inte prövat inloggad mot riktig synk på två telefoner.

## Lär (biblioteket i Kunskap, ingen egen flik sedan 2026-11-15)
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

## Kunskap (ny flik, 2026-11-14; heter Mindhub i menyn sedan 2026-11-15)
- Flikarna heter Today, Finance, Habits, News och Mindhub sedan 2026-11-15. Resten av appen är på svenska, även
  underflikarna i Ekonomi, lägena Flöde och Bibliotek, och Jarvis svar (som nämner flikarna med svenska namn).
- Sammanslaget med Lär 2026-11-15 (Eriks beslut): fem flikar i menyn, och Kunskap har lägena Flöde och Bibliotek.
  Biblioteket är Lär oförändrat. Namnet på ett kort öppnar personsidan, och Tillbaka går till samma ställe i flödet.
  En sparad Lär-flik öppnar Kunskap.
- Fungerar: flöde med kort (citat, insikt, protokoll, högst 80 ord) med person, ämne, typ och källänk. Följ personer
  (namn och ämnen), gilla/ogilla, filter (Alla, Citat, Insikter, Protokoll, Gillade). Personer och röster sparas i
  telefonen och synkas privat via `personal_records` (nya stores `kunskap_people`, `kunskap_votes`, vanor-databasen
  version 5). Ingen ändring i Supabase behövdes för det.
- Exempelkort: byggs av det granskade innehållet i Lär (`people.ts`), inget nytt innehåll. Protokollkorten är
  personens `method` med första Börja här-länken som källa; för forskare (t.ex. Laukkanen) beskriver de
  forskningsmetoden snarare än något att göra själv.
- Halvfärdigt: **Gå djupare** (chatt med Claude om kortet). Appens del och edge function `kunskap` finns i repot, men
  funktionen är **inte utlagd**; chatten svarar då "Chatten är inte påslagen på servern än". Väntar på "Lägg ut".
  Delar räknaren med Jarvis (50 frågor per dag tillsammans). Inte prövat mot Claude.
- Generering (2026-11-14, i repot, **inte utlagd**): edge function `kunskap-generera` gör kort med Claude och
  webbsökning, på schema (pg_cron 04:10 UTC, funktionen avgör vem som står på tur) eller med "Generera nu".
  Inställningar i appen (Av, Varje dag, Varje vecka; 1 till 10 kort, standard 5; Av tills man väljer). Kort utan källa
  bland sökresultaten kastas, citat som inte står ordagrant på källsidan blir insikter. Kostnad per batch (token,
  sökningar, USD) visas under inställningarna. Vanor-databasen är version 6 (`kunskap_cards`, `kunskap_settings`,
  `kunskap_batches`).
- Personligt (2026-11-15, i repot): viktning av gilla/ogilla per person, ämne och korttyp, som skickas med i
  prompten. Vyn "Vad Claude tror du gillar" (hjärtat i Kunskaps rubrik) visar viktningen och låter Erik sätta Mer,
  Mindre eller Auto per rad och lägga till egna ämnen. Ungefär 20 % av korten per batch är upptäckt (ny person eller
  nytt ämne), märkta i flödet med Följ-knapp. Inte prövat: om modellen faktiskt följer viktningen och andelen.
- PR 119 mergades 2026-11-14 med bara flödet (vanor-databasen version 5). Genereringen (version 6) och det personliga
  ligger i en ny PR från samma gren.
- **Utlagt 2026-11-15:** `kunskap` version 1 (verify_jwt på, källfilerna som de står i repot) och
  `kunskap-generera` version 1 (verify_jwt av, hopslagen till en fil med esbuild `--bundle --minify --charset=utf8`).
  Migrationen `kunskap_generera_cron` är körd: schemat `kunskap-generera` går 04:10 UTC, och hemligheten som skiljer
  schemats anrop från andras skapades slumpad i Vault (`kunskap_cron_secret`). Funktionen läser den med
  `kunskap_cron_secret()`, som bara service role får anropa. Ingen hemlighet behöver skrivas in för hand.
  Prövat från databasen (pg_net): utan inloggning 401, fel hemlighet 401, schemats anrop 200 med tom lista (ingen
  hade sparat någon inställning än), chatten utan inloggning 401.
- Mönster med osynliga tecken (accenter, typografiska citattecken, tankstreck) byggs i `kunskap-generera` från
  kodpunkter (`ch()` i `shared.ts`), eftersom verktygen gör om `\u`-koder i källan till riktiga tecken och kan tappa
  de osynliga.
- Inte prövat: ett riktigt anrop till Claude med webbsökning (verktygsversion `web_search_20260209`, fältet
  `usage.server_tool_use.web_search_requests`, och om en batch hinner klart inom funktionens tidsgräns på 150 s),
  hur många citat som går att bekräfta mot riktiga sidor (sidor som kräver skript eller blockerar servern ger
  insikter i stället), och den verkliga kostnaden per batch.
- Inte prövat: synken mot riktig Supabase (testat lokalt med blockerat nät) och på iPhone.

## Design
- Designspecen "Två rum" valdes 2026-11-07: lugnt vardagsrum (Idag, Ekonomi, Vanor, Nyheter) och mörkt specialrum
  (Jarvis, galaxen). Spec och genomförandeplan i `docs/design/`.
- Äldre: HUD-skisser A och B finns som artifact (Design-canvas) i Eriks claude.ai; B med Jarvis-knapp valdes.
