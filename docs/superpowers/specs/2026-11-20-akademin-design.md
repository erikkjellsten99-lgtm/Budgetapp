# Designspec – Akademin, första versionen (2026-11-20)

Status: utkast för Eriks godkännande. Ingen kod är skriven.

## Varför

Erik äger några aktier och vill bli skicklig: förstå hur marknaden fungerar, kunna läsa en kvartalsrapport och se vad
som är bra och dåligt, och fatta genomtänkta beslut om köp och sälj. Han vill att all lärdom ska finnas i Groundwork,
upplagd som lektioner, ungefär som att läsa finans på universitetet, med Claude som lärare som skriver innehållet.
Han lägger en kvart om dagen.

Det appen kan ge som en bok inte kan är att han övar på sina egna bolag. Därför är lektionerna korta och leder till
uppgifter i ett bibliotek med bolag han själv valt (ungefär fyra, både nylistade och stora).

## Mål för version 1

1. **Akademin** som fjärde läge i Kunskap (Mindhub), bredvid Flöde, Bibliotek och Upptäck.
2. **Lektioner** med quiz, framsteg och daglig repetition.
3. **Kurs 1, Grunderna**, färdigskriven (7 lektioner), så att Erik kan prova formatet i en vecka.
4. **Bolagsbiblioteket**: ett kort per bolag, med rapportmall där Erik för in nyckeltalen själv.
5. **Beslutsdagboken**: varför han köpte, sålde eller avstod, och en uppföljning senare.
6. **Vanan** "Studera aktier", som bockas av när dagens lektion är klar.

**Klart när:** Erik kan läsa kurs 1 på mobilen en lektion om dagen utan nät, se sina framsteg, lägga in sina bolag
och en kvartalsrapport på ett av dem, skriva ett dagboksinlägg, och allt finns kvar på en andra telefon efter synk.
Alla belopp i Ekonomi är identiska med `main`.

## Inte i version 1 (bestämt med Erik 2026-11-20)

- **Rapportagenten** (Claude läser rapporten och föreslår siffrorna, betald med Eriks API-krediter). Väntar tills
  Erik har fört in några rapporter själv. Att föra in dem är en del av inlärningen.
- **"Fråga läraren"** (chatt med Claude om en lektion).
- **Kurs 2 till 10.** Kurs 2 (Företagets ekonomi) och 3 (Kvartalsrapporten) skrivs medan Erik läser kurs 1, som egna
  PR:er med bara innehåll. Hela planen står sist i dokumentet.
- Jarvis-frågor om Akademin, rad på Idag om kommande rapport, jämförelse mellan bolag, koppling till Nyheter.

## Det här får aldrig hända

- Appen ger aldrig köp- eller säljsignaler och aldrig råd om vad Erik ska göra med sina pengar. Den hjälper honom
  att skriva ner sina egna skäl och följa upp dem. Lektionerna är allmän utbildning.
- Akademin skriver aldrig något i ekonomidatan (`holdings`, `trades`, `assets` med flera). Den läser bara namn och id
  på innehav och affärer för att kunna länka.
- Inget påhittat i lektionerna: ingen siffra, regel eller länk ur minnet. Se Innehållsregler.
- Inget i version 1 kostar pengar eller anropar Claude.

## Vägar som övervägdes

| Väg | För | Emot |
|---|---|---|
| **A. Lektionerna som filer i appens kod** (vald av Erik) | Fungerar utan nät, kostar inget, inga ändringar på servern, varje lektion granskas i en PR | Ny lektion kräver PR och publicering (sker av sig själv vid merge) |
| B. Lektionerna i Supabase | Nya lektioner utan publicering | Kräver nät, "Lägg ut" varje gång, svårare att granska ändringar |
| C. Lektionerna utanför appen (Notion) | Snabbast att skriva | Erik vill ha allt i Groundwork |

Storleken övervägdes också. Första planen var kurs 1 till 3, bibliotek och rapportagent på en gång. Erik valde den
mindre versionen ovan efter Claudes invändning: innehållet är det stora jobbet, formatet bör prövas på en kurs först,
och agenten är den sköraste delen med minst nytta för inlärningen.

## Hur det hänger ihop

### Plats i appen

Nytt läge `akademin` i `src/kunskap/Kunskap.tsx` (`Mode`), med etiketten **Akademin**. Koden bor i en egen mapp,
`src/akademin/`, med egen `CLAUDE.md` (innehållsreglerna nedan), på samma sätt som Lär bor i `src/lar/`.
Stil: vardagsrummet, bara tokens, egen `akademin.css`.

Akademins startsida, uppifrån och ner:

```
AKADEMIN
┌───────────────────────────────────┐
│ Dagens lektion                    │
│ Kurs 1 · 3 av 7                   │
│ Index och vad "marknaden" är      │
│                        [ Börja ]  │
└───────────────────────────────────┘
Repetition · 3 frågor              ›
Kurser
  1 Grunderna            ███░░░ 2/7
  2 Företagets ekonomi   kommer
Mina bolag                         ›
  Bolag A · rapport 2027-02-04
  Bolag B · äger
Beslutsdagbok                      ›
```

### Lektioner

- En fil per lektion i `src/akademin/kurser/kurs-1/`. Filformatet (markdown med ett litet huvud, eller data i
  TypeScript som `lar/people.ts`) väljer byggaren. Inget nytt beroende utan att fråga Erik.
- En lektion har: titel, kurs och nummer, text på 600 till 900 ord i korta stycken för mobil, ett exempel från ett
  riktigt svenskt bolag, tre rader "Det viktigaste", nya ord (till ordlistan), källor, 4 quizfrågor med fyra svar
  var och en förklaring till rätt svar, och ibland en uppgift i biblioteket ("labb").
- Lektionen räknas som klar när alla quizfrågor är rätt. Fel svar visar förklaringen och frågan kommer igen sist.
- Kurserna visas i ordning. Nästa lektion föreslås, men Erik kan öppna vilken lektion som helst.
- **Repetition:** startsidan erbjuder upp till 3 gamla frågor per dag. En fråga som besvarats fel kommer tillbaka
  tidigare än en som besvarats rätt. Den exakta regeln väljer byggaren, och den ska ha tester.
- **Ordlista:** alla nya ord från lästa lektioner på en sida, sökbar, med länk till lektionen.

### Kurs 1 – Grunderna

1. Vad en aktie är
2. Hur börsen fungerar och hur kursen sätts
3. Index och vad "marknaden" är
4. Aktie, fond eller ETF
5. ISK, kapitalförsäkring och aktie- och fondkonto
6. Avkastning, risk och ränta på ränta
7. Så tittar du på ett bolag första gången (labb: lägg in ditt första bolag i biblioteket)

Claude skriver lektionerna i PR:en. Marknaden är den svenska.

### Bolagsbiblioteket

Ett kort per bolag:

- namn, kortnamn (valfritt), lista (till exempel Large Cap, First North), status: bevakar, äger eller sålt
- koppling till ett innehav i Investeringar (valfri, bara id; namnet läses därifrån)
- fritext: vad bolaget gör, hur det tjänar pengar, konkurrenter, risker
- **Min tes:** varför bolaget är intressant och vad som ska hända för att jag köper
- **Mina säljregler:** vad som skulle få mig att sälja
- för nylistade (valfritt): noteringsdatum, teckningskurs, vad prospektet lovade
- nästa rapportdatum (Erik skriver in det), länk till bolagets sida för investerare

**Rapportmallen**, en per bolag och period. Perioden är ett räkenskapsår (fritt skrivet, till exempel 2026 eller
2025/26) och en typ: Q1, Q2, Q3, Q4, halvår eller helår. Siffrorna gäller perioden ensam, inte ackumulerat (Claudes
val; mallen säger det vid fälten).

| Fält | Kommentar |
|---|---|
| Period, rapportdatum och enhet | till exempel 2026 Q3, MSEK |
| Omsättning | i den enhet rapporten använder (MSEK med flera) |
| Rörelseresultat | |
| Resultat per aktie | |
| Kassaflöde från den löpande verksamheten | |
| Likvida medel och nettoskuld | viktigt för bolag som inte går med vinst |
| Ledningens utsikter | fritext |
| Vad var bra, vad var dåligt | fritext, Eriks egna ord |
| Håller min tes? | ja, nej eller osäker, med en rad varför |
| Kursreaktion dagen efter | procent, Erik skriver in |
| Länk till rapporten | |

Alla siffror är valfria, så att mallen fungerar för små och nylistade bolag. Appen räknar två saker själv och visar
hur: rörelsemarginal, och omsättningstillväxt mot samma periodtyp året före. Tillväxten visas bara när den perioden
finns inlagd med samma enhet, annars står det vad som saknas. Varje fält har en
kort förklaring av vad det betyder, och länk till lektionen om den finns. Kortet visar rapporterna i tidsordning.

### Beslutsdagboken

- Ett inlägg har datum, bolag (ur biblioteket), typ (köpte, sålde, avstod eller annat), "Varför?" och "Vad skulle få
  mig att ändra mig?". Det kan länkas till en affär i Investeringar (bara id).
- Efter 90 dagar ber appen om en uppföljning på inlägget: "Hade du rätt, och av rätt skäl?" Fritext.
- Dagboken finns från första dagen, inte först i en senare kurs.

### Vanan

Första gången Akademin öppnas erbjuder den att skapa vanan "Studera aktier" (varje dag). Säger man nej skapas ingen
vana, och frågan kommer inte igen. Erbjudandet väntar tills kontots poster har hämtats en gång (som `followLibrary`),
så att två telefoner inte skapar var sin vana.

Vanan bockas för dagen när något av det här görs (Claudes val): en lektion blir klar (vilken som helst, även en gammal
som görs om), dagens repetition görs, en rapport sparas eller ett dagboksinlägg sparas. Så går vanan att hålla även de
dagar då det inte finns någon oläst lektion. Hur det kopplas till vanornas regler för automatisk bockning väljer
byggaren efter att ha läst `src/vanor/`.

Kortet "Dagens lektion" visar "Klar för idag" när en lektion är gjord den dagen, med en diskret länk till nästa för
den som vill läsa mer. Finns ingen oläst lektion visar kortet dagens repetition i stället.

## Data

Allt är personligt (Eriks eget, inte hushållets) och bor i vanor-databasen (`src/vanor/store.ts`) med synk via
`personal_records`, som Kunskaps personer och röster. Nytt versionssteg, 6 till 7, som bara skapar nya lager:

- `akademin_progress` – klara lektioner och svar per quizfråga (för repetitionen)
- `akademin_companies` – bolagskorten
- `akademin_reports` – rapporterna
- `akademin_journal` – dagboksinläggen
- inställningar (till exempel svaret på frågan om vanan)

Fälten och hur lagren delas upp i detalj väljer byggaren.

- **Kontrollera först** om servern godtar nya lagernamn i `personal_records` (`push_personal_records` finns inte bland
  migrationerna i repot). Krävs en ändring i Supabase gäller regeln "Lägg ut", och då kommer den först i planen.
- En telefon som kör en äldre version hoppar över poster i okända lager men flyttar ändå fram sin hämtmarkering. Vid
  uppgraderingen till version 7 görs därför en ny full hämtning en gång.
- Bevis för synken: test med två lokala databaser och låtsad server, som projektets andra synktester. Erik prövar
  själv på två telefoner. Ingen testdata skrivs till Supabase.

## Vem det är för och utan nät

- Akademin visas för alla inloggade, som resten av Mindhub (Claudes val). Allt i den är personligt, så Cassandra får
  sina egna framsteg och bolag om hon vill. Tomma lägen och frågan om vanan ska fungera för den som inte bett om den.
- Lektionerna går att läsa utan nät när Akademin har öppnats en gång med nät efter en uppdatering (Claudes val).
  Service workerns förladdning ändras inte.
- `src/kunskap/CLAUDE.md` säger att delen inte läser något från ekonomin. Lägg till att Akademin är undantaget: den
  läser namn och id på innehav och affärer, och skriver aldrig dit.

## Innehållsregler (blir `src/akademin/CLAUDE.md`)

Samma anda som `src/lar/CLAUDE.md`:

- Varje lektion har en lista med https-källor som faktiskt har öppnats. Skriv aldrig en länk ur minnet.
- Regler, skattesatser, avgifter och andra uppgifter som kan ändras har en källa och datumet då den kontrollerades,
  och datumet visas i lektionen.
- Exempel med siffror från ett riktigt bolag hämtas ur bolagets egen rapport, med länk och period.
- Texten är Claudes egna ord. Inga citat.
- Ingen lektion säger att en viss aktie är köpvärd eller säljvärd.
- Förklara ett nytt ord första gången det används och lägg det i ordlistan.

## Tester och kvalitet

- Enhetstester för quiz, repetition, uträkningarna i rapportmallen och uppföljningen efter 90 dagar.
- Ett test som låser lektionernas form: ordantal, 4 frågor, exakt ett rätt svar, minst en källa, https.
- Uppgraderingstest för vanor-databasen: steg 6 till 7 lämnar alla befintliga poster orörda.
- Före och efter: texten i varje Ekonomi-flik jämförs mot `main`, och PR:en skriver att beloppen är identiska.
- Skärmbilder i 375 px, ljust och mörkt, och skrivbord. Tomma lägen, laddning och fel är designade.
- Projektets vanliga regler gäller: egen gren mot `main`, PR på svenska med "Så testar du", `npm test` och
  `npm run build` gröna, testdata bara i tom lokal databas.

## Lämnat åt byggaren

Filformat för lektioner, komponenternas uppdelning, exakt regel för repetition, lagrens fält, hur vanan bockas, och
i vilka PR:er arbetet delas upp. Ett rimligt förslag: (1) Akademins skal, lektionsmotorn och kurs 1, (2) biblioteket
med rapportmallen, (3) dagboken och vanan.

## Hela utbildningsplanen (för senare)

1 Grunderna · 2 Företagets ekonomi · 3 Kvartalsrapporten · 4 Värdering · 5 Affärsanalys · 6 Makro och marknaden ·
7 Nylistningar och småbolag · 8 Portfölj och risk · 9 Beslut och psykologi · 10 Examensarbete (full analys av ett av
Eriks bolag). Ungefär 60 till 70 lektioner totalt.
