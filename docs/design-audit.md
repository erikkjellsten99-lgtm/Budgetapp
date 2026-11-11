# Designgranskning av Groundwork

2026-11-11. Granskad version: `main` vid b450ba3 (efter Två rum #107, Kvar att betala #108, Hälsa #109 och
Investeringar #110). Ingen kod är ändrad. Det här dokumentet och bilderna i `docs/design-audit/` är det enda nya.

## Så gjordes granskningen

- Appen kördes med `vite` lokalt på en egen adress med tom databas. Påhittad testdata lades in lokalt med appens
  egna funktioner: åtta vanor, sex att göra, fjorton dagar hälsa, fem innehav med kurser, konton och önskningar.
  Budgeten är appens standardbudget. Databasen raderades efteråt.
- Alla anrop till `supabase.co` var spärrade. Ingen inloggning, ingen synk, inga riktiga data.
- Mobil: 390 × 844 px, ljust och mörkt läge sida vid sida. Skrivbord: 1280 × 800 px.
- Mått (typstorlekar, vikter, hörn, knapphöjder, kontrast) är utlästa ur webbläsaren, inte uppskattade.

Det som inte är kontrollerat: riktig iPhone, Safari, 375 px bredd, inloggat läge med synk, rymdbasen i galaxen,
Jarvis röstläge i helskärm och hur riktiga SVT-nyheter ser ut. Nyhetsvyn visas med fem påhittade testrubriker.

## Bilder

Mobilbilderna visar ljust läge till vänster och mörkt till höger.

| Del | Mobil | Skrivbord |
|---|---|---|
| Idag | [med data](design-audit/m-idag-1.jpg), [tom](design-audit/m-idag-tom.jpg) | [d-idag](design-audit/d-idag.jpg) |
| Ekonomi, Översikt | [1](design-audit/m-oversikt-1.jpg), [2](design-audit/m-oversikt-2.jpg) | [d-oversikt](design-audit/d-oversikt.jpg) |
| Ekonomi, Budget | [lista](design-audit/m-budget-2.jpg), [summering](design-audit/m-budget-3.jpg), [redigera](design-audit/m-budget-redigera.jpg) | [d-budget](design-audit/d-budget.jpg) |
| Ekonomi, Prognos | [topp](design-audit/m-prognos-1.jpg), [tabell](design-audit/m-prognos-tabell.jpg), [sparmål](design-audit/m-sparmal-1.jpg), [inställningar](design-audit/m-sparmal-installningar.jpg) | [d-prognos](design-audit/d-prognos.jpg), [graf](design-audit/d-prognos-graf-mork.jpg) |
| Konton | [lista](design-audit/m-konton.jpg), [formulär](design-audit/m-konton-form.jpg) | |
| Investeringar | [1](design-audit/m-invest-1.jpg), [2](design-audit/m-invest-2.jpg), [tom](design-audit/m-investeringar-tom.jpg), [innehav 1](design-audit/m-innehav-1.jpg), [innehav 2](design-audit/m-innehav-2.jpg), [ändra](design-audit/m-andra-innehav.jpg), [köp med fel](design-audit/m-kop-form-fel.jpg) | [d-investeringar](design-audit/d-investeringar.jpg) |
| Önskelista | [lista](design-audit/m-onskelista-2.jpg) | |
| Vanor | [topp](design-audit/m-vanor-1.jpg), [hälsa](design-audit/m-vanor-2-halsa.jpg), [prioritera](design-audit/m-vanor-4.jpg), [lista](design-audit/m-vanor-5.jpg), [klart](design-audit/m-vanor-6.jpg), [månad](design-audit/m-vanor-manad.jpg), [tom](design-audit/m-vanor-tom.jpg) | [d-vanor](design-audit/d-vanor.jpg) |
| Jarvis | [start](design-audit/m-jarvis.jpg), [svar](design-audit/m-jarvis-svar.jpg), [röst](design-audit/m-jarvis-rost.jpg) | [d-jarvis](design-audit/d-jarvis.jpg) |
| Galax | [Jorden](design-audit/m-galax-jorden.jpg), [Hälsa](design-audit/m-galax-halsa.jpg), [solsystem](design-audit/m-galax-solsystem.jpg), [Ekonomi](design-audit/m-galax-ekonomi.jpg), [guide](design-audit/m-galax-guide-2.jpg) | |
| Nyheter | [lista](design-audit/m-nyheter-1.jpg), [fel](design-audit/m-nyheter-fel.jpg) | [d-nyheter](design-audit/d-nyheter.jpg) |
| Konto | [m-konto](design-audit/m-konto.jpg) | |

## De tio största problemen

Rangordnade efter hur mycket de stör en vanlig dag: hur ofta man möter dem, och hur mycket de kostar varje gång.

### 1. Det tar fyra skärmar att nå första bocken i Vanor

Att bocka vanor är en av tre saker appen öppnas för varje dag. Första bockknappen ligger 2 444 px ner på sidan.
Skärmen visar ungefär 750 px ovanför bottenmenyn. Ovanför listan ligger rubrik, citat, veckokort (580 px) och hela
Hälsa idag (1 630 px med sömn, aktivitet, hjärta och kropp). Sidan är 4 309 px lång.

Veckokortet upprepar dessutom dagens lista som åtta rader fet löptext ("Idag: Betala fakturan för bilservice, Boka
tvättstugan, …"). Samma saker står i listan längre ner och på Idag.

Bilder: [topp](design-audit/m-vanor-1.jpg), [hälsa](design-audit/m-vanor-2-halsa.jpg), [första bocken](design-audit/m-vanor-4.jpg).

Riktning: listan "Prioritera idag" först. Hälsa och veckokortet hopfällda under den, eller som egna rader som öppnas.

### 2. Idag säger samma sak tre gånger och väger allt lika

Med testdatan står "Börja med Betala fakturan för bilservice" i Jarvis rad, i raden Vanor och i raden Att göra.
"3 av 9" står två gånger. Raden heter Vanor men räknar även att göra-saker och föreslår en att göra-sak.

Gruppen Idag blir sex till nio rader som alla ser likadana ut. Varje hälsovärde är en egen rad med undertexten
"Hälsa idag". Sparande hamnar under vecket. Huvudsiffran är tydlig, men under den finns ingen ordning som säger vad
som är viktigast just nu.

Bild: [Idag](design-audit/m-idag-1.jpg).

Riktning: en rad per sak. Jarvis rad säger det som inte står någon annanstans. Hälsan som en rad med tre värden.

### 3. Prognos är fem skärmar lång och gömmer Sparmål längst ner

Fliken Prognos är 4 236 px på mobil. Den innehåller nyckeltal, två segmentväljare, graf, billån, CSN-plan, en tabell
med 25 månader och sist Sparmål, som börjar 3 300 px ner. Raden Sparmål på Idag och i Översikt öppnar Prognos
överst, så man får rulla förbi allt annat för att se det man tryckte på.

Bilder: [topp](design-audit/m-prognos-1.jpg), [tabell](design-audit/m-prognos-tabell.jpg), [sparmål](design-audit/m-sparmal-1.jpg).

Riktning: Sparmål som egen vy som raden öppnar direkt. Tabellen hopfälld efter sex månader.

### 4. Rubrikerna heter inte som det man tryckte på

| Man trycker på | Sidan heter |
|---|---|
| Konton | Tillgångar (knappen: "+ Ny tillgång") |
| Budget | Inkomster & utgifter, och längre ner Kategorier |
| Prognos | Prognos, och längst ner Sparmål |
| Nettovärde (Översikt) | I galaxen heter samma sak Netto och räknas med lånet avdraget |

På undersidorna Konton, Investeringar och Önskelista visas dessutom segmentväljaren med "Översikt" vald, samtidigt
som tillbakalänken direkt under heter "‹ Översikt". Två saker med samma ord, varav den ena säger att man redan är
där. I formulären för köp och sälj hoppar tillbakalänken "‹ Investeringar" två nivåer, medan Avbryt hoppar en.

Bilder: [konton](design-audit/m-konton.jpg), [köp](design-audit/m-kop-form-fel.jpg).

Riktning: ett namn per sak. Göm segmentväljaren på undersidor, eller låt ingen flik vara vald där.

### 5. Samma betydelse har olika färg, och plus saknar färg

Specen säger: tallgrönt är klart och plus, kobolt är det man trycker på, lingon är minus.

- Betalt-bocken i Budget och Önskelista är **kobolt** när den är ikryssad. Vanors bock är **tallgrön**.
- "Kan sparas per månad 23 868 kr" i Budget är kobolt på koboltton. Samma slags siffra är tallgrön på Idag och i
  Översikt.
- I Investeringar är en negativ utveckling lingon ("−2,9 %"), men en positiv är dämpad grå ("+14,8 %") och
  "Utveckling +17 320,31 kr" är svart.
- Streaken "▲ 12 dagar i rad" i Vanor är orange i ljust läge och tallgrön i mörkt.
- Jarvis-pricken på Idag lyser ljusblått. Enligt specen ska bara orben lysa.

Bilder: [budget](design-audit/m-budget-2.jpg), [summering](design-audit/m-budget-3.jpg), [investeringar](design-audit/m-invest-2.jpg), [vanor](design-audit/m-vanor-5.jpg).

### 6. Vanor ser fortfarande ut som en annan app

| | Ekonomi och Idag | Vanor |
|---|---|---|
| Typstorlekar på en skärm | 5 till 6 | 21 (från 9 px till 42 px) |
| Vikter | 400, 600, 720 | 400 till 900 |
| Sidrubrik | 25 px, vikt 720 | 32 px, vikt 800 |
| Kort | ingen ram, hörn 14 px | synlig ram, hörn 18 px |
| Sektionsrubrik | 15 px dämpad, utanför kortet | 20 px fet |
| Minsta knapp | 36 px | 32 px (specen säger 44) |

Hälsa idag har dessutom en egen färgskala (himmelsblå, orange, rosa, mint, lila), kort i kort och siffror i 34 px.
Veckobilden är en mörk rymdbild med versaler ("VECKA 46") även i ljust läge, alltså specialrummets stil mitt i
vardagsrummet.

Bilder: [vanor](design-audit/m-vanor-5.jpg), [hälsa](design-audit/m-vanor-2-halsa.jpg), jämför med [översikt](design-audit/m-oversikt-2.jpg).

### 7. Formulären ser ut på fyra sätt

- **Var de ligger.** Kategori, inkomst, konto och lån redigeras inuti sitt kort. Nytt innehav, köp och sälj är egna
  sidor utan kort, indragna 20 px mer än allt annat, med fält i samma färg som bakgrunden i ljust läge.
- **Lägg till.** Fyra utseenden: stor mjuk knapp ("+ Ny tillgång", "+ Nytt innehav"), fet länk i kortets botten
  ("+ Ny kategori i fasta utgifter"), liten länk ("+ Lägg till rad", "+ Att göra") och fylld knapp ("+ Köp").
- **Kryssrutor.** Tre sorter: rund betalt-bock, Vanors stora runda bock och webbläsarens fyrkantiga (Sparmål,
  konto-formuläret, Jarvis röst).
- **Fel.** Ett fel i taget, längst ner under alla fält. Med "abc" i Antal och "−5" i Kurs nämns bara Antal.
- **Text som bryts.** "Kortnamn: NORD-A.ST" bryts mitt i, och knappen "Ta bort kortnamn" hamnar på två rader.
  I Önskelistan är namnfältet 145 px brett, så "Hörlurar med brusreducering" blir "Hörlurar me".
- **Redigeringsläge.** Budget döljer plus och handtag bakom Redigera. Önskelistan visar kryss och handtag alltid.
  Budgetens hjälptext beskriver plus och handtag som inte syns förrän man tryckt Redigera.

Bilder: [nytt innehav](design-audit/m-andra-innehav.jpg), [köp](design-audit/m-kop-form-fel.jpg), [konto](design-audit/m-konton-form.jpg), [önskelista](design-audit/m-onskelista-2.jpg), [redigera](design-audit/m-budget-redigera.jpg).

### 8. Text som inte går att läsa, och etiketter som krockar i galaxen

- Knappen **Förstått** i galaxens guide: ljusblå text på gul botten, kontrast 1,33:1. Kravet är 4,5:1.
- Raderna om kometer och satelliter i Vanor → Månad: ljusblå text på vit botten i ljust läge, kontrast 1,77:1.
- I Hälsogalaxen ligger etiketterna Sömn, Träning, Kropp och vård och Puls ovanpå varandra. Ett tryck på Sömn
  öppnade Projekt. I solsystemet ligger "JORDEN 40 av 100" ovanpå vanans etikett.
- Galaxen har tre sätt att gå tillbaka: "‹ Tillbaka" (stänger), "‹ Jorden" (en nivå upp) och husikonen (hem), plus
  "Tillbaka" i panelerna.
- Raden med nyckeltal längst ner klipps vid kanten ("Önskn") utan tecken på att den går att dra. Samma sak gäller
  exempelfrågorna i Jarvis och ämnena i Nyheter.

Bilder: [guide](design-audit/m-galax-guide-2.jpg), [månad](design-audit/m-vanor-manad.jpg), [hälsogalaxen](design-audit/m-galax-halsa.jpg), [solsystem](design-audit/m-galax-solsystem.jpg).

### 9. Belopp och datum skrivs på flera sätt

- **Belopp.** Budgeten skriver hela kronor ("13 868 kr"). Konton och Investeringar skriver ören när de finns
  ("206 419,53 kr", "61 200,50 kr") men inte annars ("42 500 kr"), så kolumnen blir ojämn. Samma summa står som
  "206 420 kr" i Prognos och "206 419,53 kr" i Översikt. På Idag står "102 719,03 kr av 300 000 kr".
- **Datum.** Minst sju former: "1 nov. 2026", "3 sep. 2026", "11 nov", "10 nov", "nov 2026", "november 2026",
  "2026-11-11", "Onsdag 11 november", "mån 16 nov". Reglerna säger 2026-10-20.
- **Grafens axel.** Kursgrafen för ett år visar "11 nov" i båda ändar, utan år.
- **Skiljetecken.** Nyheter fick komma i Två rum. Mittpunkter finns kvar i Budget ("Betalt 5 824 kr · kvar
  15 326 kr"), Konton, Sparmål, Önskelista, Hälsa och galaxen.
- **Tilltal och språk.** "Ny köp av Nordbanken A" ska vara "Nytt köp". "Skriv in kursen själva" och "Bocka i det ni
  köper" står mot "du" i resten av appen. "Gamla kurser" står ensamt under nyckeltalen utan förklaring.

Bilder: [konton](design-audit/m-konton.jpg), [innehav](design-audit/m-innehav-1.jpg), [investeringar](design-audit/m-invest-1.jpg).

### 10. Skrivbordet använder inte ytan, och graferna blir jättelika

- Graferna är ritade för 340 px och skalas med bredden. Vid 1280 px blir grafen 907 px bred, axeltexten cirka
  27 px ("1 mkr", "150 tkr") och linjerna grova. Det gäller Prognos, Investeringar och varje innehav.
- Idag, Ekonomi och Nyheter är 928 px breda och vänsterställda. Vanor är 640 px och mittställd, så innehållet
  hoppar i sidled när man byter flik.
- I Ekonomi står namnet längst till vänster och beloppet drygt 800 px bort, vilket gör raderna svåra att följa.
- På Idag är vänstra halvan nästan tom under huvudsiffran.
- Sidomenyns poster börjar cirka 75 px till höger om logotypen, orben och kontoknappen, som delar vänsterkant.
- Prognos är 4 555 px lång även på skrivbord.

Bilder: [graf](design-audit/d-prognos-graf-mork.jpg), [idag](design-audit/d-idag.jpg), [översikt](design-audit/d-oversikt.jpg), [vanor](design-audit/d-vanor.jpg).

## Alla inkonsekvenser, per område

### Färg

| Fynd | Var |
|---|---|
| Ikryssad bock är kobolt i Ekonomi, tallgrön i Vanor | Budget, Önskelista, Vanor |
| "Kan sparas per månad" i kobolt, huvudsiffran i tallgrönt | Budget mot Idag och Översikt |
| Positiv utveckling grå eller svart, negativ lingon | Investeringar, innehav |
| Streak orange i ljust läge, tallgrön i mörkt | Vanor |
| Jarvis-pricken lyser | Idag |
| Hälsans egen färgskala med fem färger utanför paletten | Vanor |
| Kometer och satelliter 1,77:1 | Vanor → Månad, ljust läge |
| Förstått-knappen 1,33:1 | Galaxens guide |
| Mörk rymdbild i ljust läge | Vanors vecko- och månadskort |
| Köp-pricken tallgrön och sälj-rutan lingon i kursgrafen, alltså plus- och minusfärg för något som inte är vinst eller förlust | Innehav |

### Typografi

| Fynd | Var |
|---|---|
| 21 typstorlekar på en skärm, ned till 9 px | Vanor |
| 17 typstorlekar, ned till 9,5 px | Prognos |
| Sju vikter (400 till 900) mot tre i Översikt | Vanor |
| Sidrubrik 32 px mot 25 px | Vanor mot övriga |
| Två sidrubriker på samma sida | Budget (Inkomster & utgifter, Kategorier), Prognos (Prognos, Sparmål) |
| Versaler med spärrning i vardagsrummet | "VECKA 46", "NOVEMBER" i Vanor |
| Röstpanelens rubrik i systemtypsnitt, resten i rummets typsnitt | Jarvis |
| Galaxens paneler i Inter, som inte laddas | Galax |
| Belopp i tabellen sticker ut när de får sex siffror | Prognos, Månad för månad |

### Avstånd och layout

| Fynd | Var |
|---|---|
| Tre vänsterkanter: rubrik 16 px, radtext 32 px, formulär på egen sida 36 px | Hela Ekonomi |
| Budgetraden börjar vid 64 px (efter bocken), gruppraden vid 32 px | Budget mot Översikt |
| Den streckade tomrutan sitter ihop med gruppen ovanför | Idag utan vanor |
| Tomt gap mellan rubrik och text | Kortet CSN framåt |
| Segmentväljaren ibland i eget kort, ibland utan | Prognos: Utan/Med avkastning mot 1/2/5 år |
| Rubriken "Första köpet" indragen mer än fälten | Nytt innehav |
| Fälten i Sparmål har olika bredd utan skäl | Avkastning/år och Mål |

### Komponenter

| Fynd | Var |
|---|---|
| Två kortmönster blandas på samma skärm: grupp med rubrik utanför, kort med rubrik inuti | Investeringar, Prognos, Konton |
| Åtta segmentväljare med fyra utseenden | Ekonomiflikar, Prognos, Fördelning, Period, Tema, Vecka/Månad, Ton |
| Fyra sorters lägg till-knapp | Se problem 7 |
| Tre sorters kryssruta | Se problem 7 |
| Pil som ikon i gruppraderna, som tecknet › i "Från önskelistan 2 990 kr ›" | Budget |
| Webbläsarens trianglar för att fälla ut | Sparmål |
| Investeringar saknar huvudsiffra | Investeringar |
| Tomläget följer inte mönstret (streckad ram, mening, knapp) | Investeringar, Önskelista, Konton |
| "Sjuk eller skadad? Pausa dagen" ser ut som text men är en knapp | Vanor |
| Ta bort bekräftas med webbläsarens dialogruta | Konton, innehav, affärer, kategorier |
| Knappar under 44 px: Redigera 36 px, flera i Vanor 32 px | Budget, Vanor |

### Navigation

| Fynd | Var |
|---|---|
| Rubriker som inte matchar länken | Se problem 4 |
| "Översikt" både vald flik och tillbakalänk | Konton, Investeringar, Önskelista |
| Tillbakalänken hoppar två nivåer, Avbryt en | Köp, sälj, ändra innehav |
| Sparmål-raden öppnar Prognos överst | Idag, Översikt |
| Galaxen nås bara via Vanor → Månad → knapp i bilden | Vanor |
| Fyra sätt att gå tillbaka i galaxen | Galax |
| Rader som går att dra i sidled utan ledtråd | Nyheter, Jarvis, galaxen |
| Konto och utseende nås bara via en ikon utan text | Sidhuvudet |
| Jarvis samtal försvinner när rummet stängs | Jarvis |
| Två notiser och ett tonkort före första nyheten | Nyheter |

### Mellan delarna

| | Idag | Ekonomi | Vanor | Nyheter | Jarvis och galax |
|---|---|---|---|---|---|
| Kort | grupp | grupp och kort | kort med ram | grupp | paneler med linje |
| Klart-färg | | kobolt | tallgrön | | |
| Sektionsrubrik | 15 px dämpad | 15 px dämpad, 25 px fet | 20 px fet | | versaler |
| Lägg till | knapp i tomruta | fyra sorter | länk, ikon | | |
| Datum | Onsdag 11 november | 1 nov. 2026, nov 2026 | mån 16 nov | 10 nov | ONSDAG 11 NOV |
| Tomläge | streckad ruta | text och knapp | streckad ruta | streckad ruta | |

## Det som fungerar

- Huvudsiffran på Idag och i Översikt: tydlig, rätt färg, klarar stora tal.
- Gruppraderna med namn, undertext, värde och pil. De är appens bästa mönster och borde användas överallt.
- Ljust och mörkt läge håller ihop i vardagsrummet. Inga kontrastfel hittades där utom de som står ovan.
- Jarvis-rummet är konsekvent i sig och fungerar lika bra på skrivbord.
- Nyheter efter Två rum: lugn lista, tydliga tonmärken, bra felläge.
- Tomlägena på Idag, i Vanor och i Nyheter följer samma mönster.

## Förslag på ordning

1. Vanor: listan först (problem 1). Störst effekt per dag.
2. Idag: en rad per sak (problem 2).
3. Namn och tillbakalänkar (problem 4) och färgerna (problem 5). Små ändringar, syns överallt.
4. Sparmål som egen vy och kortare Prognos (problem 3).
5. Kontrastfelen och galaxens etiketter (problem 8).
6. Ett formulärmönster (problem 7) och ett sätt att skriva belopp och datum (problem 9).
7. Vanor i samma stil som resten (problem 6) och skrivbordet (problem 10).

Hur belopp ska avrundas i problem 9 är en fråga om ekonomins siffror och ska bestämmas av Erik, inte av designen.
