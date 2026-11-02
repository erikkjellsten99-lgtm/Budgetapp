# Groundwork

Budget, sparande och vanor i en app (tidigare "Budget").

En personlig budgetapp på svenska. Den körs helt i webbläsaren och kan installeras på mobilen som en app (PWA). All data sparas lokalt i webbläsarens databas (IndexedDB). Det finns ingen server, ingen inloggning och ingen bankkoppling.

## Köra appen

Du behöver [Node.js](https://nodejs.org/) 20.19+ eller 22.12+.

```sh
npm install   # första gången, och när beroendena har ändrats
npm run dev   # startar appen på http://localhost:5173
```

Sidan laddas om av sig själv när du ändrar i koden.

Vill du prova på mobilen medan du utvecklar kör du `npm run dev -- --host` och öppnar adressen under "Network" i mobilens webbläsare. Datorn och mobilen måste vara på samma wifi. Offline-stöd och installation fungerar inte på det sättet, eftersom de kräver https.

## Bygga

```sh
npm run build     # typkontrollerar och bygger till mappen dist/
npm run preview   # visar den byggda appen på http://localhost:4173
```

Offline-stödet (service workern) är bara aktivt i den byggda appen.

## Publicera och installera på mobilen

Appen publiceras automatiskt på **https://erikkjellsten99-lgtm.github.io/Budgetapp/** varje gång `main` uppdateras. Det sköts av arbetsflödet `.github/workflows/deploy.yml`, och du kan följa det under fliken Actions på GitHub.

Första gången behöver GitHub Pages slås på: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Har en publicering misslyckats för att Pages inte var påslaget kör du arbetsflödet igen under Actions → Publicera → Run workflow.

Öppna adressen på mobilen och installera appen:

- **iPhone (Safari):** Dela-knappen → Lägg till på hemskärmen.
- **Android (Chrome):** menyn ⋮ → Installera app.

## Vanor

Fliken **Vanor** är vanetrackern (tidigare en egen app). Koden ligger i `src/vanor/`:

- `dates.ts`, `habits.ts`: datum och vanelogik (veckomål, streaks, pausdagar) med tester. Kör `npm test`.
- `store.ts`: en egen databas i telefonen (`vanor`), skild från budgeten.
- `sync.ts`: synk till tabellen `personal_records` i Supabase. Radsäkerheten gör att varje konto bara ser sina egna vanor, så du och Cassandra har var sin lista.
- `transfer.ts`: flyttkod från den gamla vanetrackern (Mina vanor → Flytta från gamla vanetrackern).

### Solen och galaxen

Överst i Vanor finns ett kort med växeln **Vecka | Månad**. **Vecka** är en soluppgång sedd från rymden: solen stiger över en planets horisont mot veckans mål, och himlen går från natt med stjärnor till gryning (`SunScene` i `ProgressCard.tsx`). **Månad** är ett solsystem: varje vana är en planet (samma färg och typ som i 3D-galaxen, `planets.ts`) som växer med hur mycket av målet du klarat i månaden, och varje bock blir en stjärna. Tidigare månader sparas som små solsystem. Månadens veckor är de ISO-veckor vars torsdag ligger i månaden (`monthScore` i `progress.ts`). Bilden ritas i `Galaxy.tsx`: planeterna är belysta från solen med en skuggsida och yta (band, moln, fläckar), och solen är samma som i veckans soluppgång.

**Din galax (3D):** knappen "Öppna din galax" i månadsvyn öppnar galaxen i helskärm (`CosmosView.tsx`, three.js, laddas först när den öppnas). Allt ligger i ett enda universum som man rör sig fritt i (`CameraRig.ts`): dra för att snurra runt det du tittar på, nyp eller scrolla för att zooma mot det du pekar på, två fingrar (eller högerklick) för att flytta bilden. Tryck på något för att flyga dit; huset tar dig hem. Var saker ligger, var solen står och vilken plats kameran är vid räknas i `universe.ts` (rena funktioner med tester).

1. **Jorden** (startbilden, `earth3d.ts`): riktiga satellitbilder – dagsidan, stadsljusen på natten, molnen (som driver och kastar skuggor) och en höjdkarta som ger bergen relief i lågt solljus. Havet glittrar där solen speglas och atmosfären lyser tunt runt kanten. Dagens poäng 0–100 styr solen (`dayScore` i `cosmos.ts`, `sunDirection` i `universe.ts`): 0 = natt och du ser Europas stadsljus, i gryningen börjar kanten glöda, vid 25 går solen upp och vid 100 är hela klotet i sol. Avklarade Att göra-saker den här månaden blir satelliter. "Nästa" flyger till den vana som ska göras. Bilderna kommer från Solar System Scope (CC BY 4.0, byggda på NASA:s data) och ligger i `src/vanor/assets/`.
2. **Hälsogalaxen** (`cosmos3d.ts`): en spiralgalax av 60 000 stjärnor med kärna, blåvita armar, rosa stjärnbildningsområden och mörka stoftstråk. Ett solsystem per område (Träning, Sinne, Sömn, Kost, Kropp och vård, Projekt, Övrigt; väljs per vana under Inställningar, `areas.ts`). **Ekonomigalaxen**: skulderna (billånet) är ett svart hål i kärnan som krymper när ni betalar av, sparmålet en planet som föds ur en stoftskiva, budgeten ett månsystem (en måne per kategori, lyser när den är betald), önskelistan kometer och nettot styr hur starkt galaxen lyser. Tidsreglaget visar ekonomin enligt prognosen upp till fem år framåt. Läser samma data som Budget, Prognos och Konton men ändrar inget där (`economy.ts`).
3. **Ett solsystem**: varje stjärna är en vana, med kokande yta, solfläckar, korona och (för de hetaste) diffraktionsstrålar. Klassen visar hur stor del av målet som blev av de senaste hela veckorna (`habitStars`/`starKind` i `cosmos.ts`): protostjärna (ett stoftmoln med glödande skiva och jetstrålar) under 20 %, röd dvärg, orange dvärg, gul stjärna och blå jätte över 90 %. Tryck på en stjärna för siffrorna. Månadsknapparna visar hur det såg ut en viss månad.

Längst bak ligger Vintergatans band (bakat en gång till en bild), tusentals stjärnor med verkliga färger och ett trettiotal avlägsna galaxer. Ljusa saker glöder lite (bloom). Hinner telefonen inte med sänks upplösningen och till sist bloom, av sig själv.

**Rymdbasen** (`space.ts`, byggs i `station3d.ts`): byggd som ISS i verklig skala – fackverk, solpaneler som vrider sig mot solen, radiatorer, moduler med skyddsfiltar, luftsluss, kupol och robotarm. Den byggs ut med en modul per milstolpe (25, 100, 250, 500 och 1000 bockar, första perfekta veckan, 7 och 30 dagar i rad, tre månader, ett år), och nästa modul byggs medan du tittar (solpanelen vecklas ut, kapseln närmar sig porten …). En astronaut per vana i rymddräkt (EMU): bockad idag är den ute och bygger med livlina, den som leder står på robotarmen, annars är den inne i basen och fönstren lyser. Nyss bockade kommer ut ur luftslussen när du åker dit. "Bygget" flyger nära arbetslaget, och man kan zooma ända fram och trycka på en astronaut. Första gången galaxen öppnas visas "Så funkar din galax" (går att öppna igen med ?-knappen).

### Påminnelser

Under Mina vanor → **Påminnelser** slår du på notiser för telefonen (på iPhone måste appen ligga på hemskärmen). Varje vana kan få en tid (Ändra → Påminnelse), och det finns en kvällspåminnelse om något måste göras för att hinna veckomålet. På söndagkvällen (en timme efter kvällspåminnelsen) kommer en veckorapport, och månadens sista söndag en månadsrapport (`supabase/functions/reminders/report.ts`, testad i `report.test.ts`).

- `src/vanor/push.ts`, `PushSettings.tsx`: prenumerationen (web push) sparas i tabellen `push_subscriptions`.
- `supabase/functions/reminders`: Supabase-funktionen som skickar. Den körs var 5:e minut av pg_cron (jobbet `vanor-paminnelser`). Nyckelparet skapar den själv i tabellen `push_keys`. `push_sent` ser till att samma påminnelse bara skickas en gång per dag.
- `public/sw.js`: visar notisen och öppnar appen när du trycker på den.

### Att göra

Tryck **+ Att göra** vid Prioritera idag. En sak har titel, dag och valfri tid. Den visas i Prioritera idag på sin dag, och ligger kvar som försenad tills den är bockad. Framtida saker visas under Kommande. Med en tid kommer en notis, via samma påminnelser som vanorna. Logiken finns i `src/vanor/tasks.ts`, och sakerna sparas i databasen `vanor` (store `tasks`, version 3) och synkas privat.

## Utseende

Under Konto (personikonen) och i Mina vanor finns **Utseende: Automatiskt, Ljust, Mörkt**. Automatiskt följer telefonens inställning. Valet sparas på telefonen (`src/theme.ts`) och sätts som `data-theme` på `<html>`. Varje `@media (prefers-color-scheme: dark)` i CSS:en har en kopia för `:root[data-theme='dark']`, och gäller inte när Ljust är valt. Lägger du till mörka stilar: gör likadant.

## Bra att veta

- Datan finns bara i den webbläsare och på den enhet där du använder appen. Den synkas inte mellan enheter.
- Rensar du webbplatsdata för appen, eller avinstallerar den, försvinner datan.
