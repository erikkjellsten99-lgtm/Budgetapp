# Designspec – Investeringar (2026-11-07)

Status: utkast för granskning. Ingen kod är skriven.

## Mål

Hushållet ska kunna lägga in vad de investerar i (aktier, fonder, ETF:er), varje köp och sälj med datum, antal och
kurs, och se hur innehaven går: investerat, värde idag, GAV, vinst/förlust, kursgraf, portföljens värde över tid och
fördelning. Kurser hämtas automatiskt, med egen kurs som reserv.

**Klart när:** Erik och Cassandra kan lägga in sina innehav på båda telefonerna, ser samma värden på båda och i Jarvis,
och alla befintliga belopp i Översikt, Budget, Prognos, Konton och Önskelista är identiska med `main`.

## Beslut (från genomgången)

| Fråga | Beslut |
|---|---|
| Kurskälla | Hämtas automatiskt av inbox-funktionen (Yahoo Finance, gratis, inofficiell). Egen kurs när den saknas. |
| Nettovärde | Ett konto kan sättas till "Värdet räknas från innehaven" + kontantsaldo. Aldrig automatiskt. |
| Vyer i v1 | Vinst/förlust per innehav, kursgraf per innehav, portföljens värde över tid, fördelning. |
| Upplägg | A: servern hämtar och sparar kurser i en egen tabell; appen och Jarvis läser samma kurser. |

## Utanför version 1

Utdelningar, andra valutor än omräkning till SEK, import från Avanza-fil, skatt och ISK-schablon.

## Data

### Hushållets data (synkas via `records`, IndexedDB i `db.ts`)

Nya lager i `DATA_STORES`:

- `holdings` – `{ id, name, type: 'stock' | 'fund' | 'etf', ticker?: string, assetId?: string, manualPrice?: number,
  manualPriceDate?: string }`
  - `ticker` är Yahoo-symbolen, t.ex. `INVE-B.ST`. Saknas den används bara `manualPrice`.
  - `assetId` pekar på kontot i `assets` där innehavet ligger (t.ex. Avanza).
- `trades` – `{ id, holdingId, date: 'YYYY-MM-DD', side: 'buy' | 'sell', quantity: number, price: number,
  fee: number }`
  - `price` och `fee` i kronor (SEK). Antal får vara decimaltal (fondandelar).

Ändring i `Asset` (valfria fält, inga befintliga värden ändras):

- `fromHoldings?: boolean` – när den är på räknas kontots värde från innehaven.
- `cash?: number` – kontantsaldo på kontot när `fromHoldings` är på.
- `amount` lämnas orört, så att man kan slå av `fromHoldings` och få tillbaka sitt inskrivna saldo.

IndexedDB: `DB_VERSION` 12 → 13. Uppgraderingssteget skapar bara `holdings` och `trades`. Ingen befintlig post läses om
eller skrivs.

### Marknadsdata (Supabase, inte i `records`)

Ny tabell `prices` (migration):

| kolumn | typ |
|---|---|
| `ticker` | text |
| `date` | date |
| `close_sek` | numeric |
| `fetched_at` | timestamptz |

Primärnyckel `(ticker, date)`. Läsbar för inloggade användare, skrivbar bara av inbox-funktionen (service role).
Kurser är allmän data och blandas aldrig med hushållets poster.

## Kurshämtning (inbox)

Ny åtgärd i `supabase/functions/inbox/index.ts`, egen modul `prices.ts`:

- `lookup(ticker)` – kontrollerar att symbolen finns och returnerar namn och valuta. Används när ett innehav läggs till.
- `refresh(tickers, from)` – hämtar dagliga stängningskurser från `from` (första köpet) till idag, räknar om till SEK
  med Yahoos valutakurs vid behov och gör upsert i `prices`. Bara saknade dagar hämtas.
- Appen anropar `refresh` när fliken öppnas, högst en gång per dag och telefon. Timeout 8 s, samma mönster som
  nyhetsflödena.

## Uträkningar (`supabase/functions/inbox/portfolio.ts`)

Delad kod som både appen och Jarvis använder. Inga uträkningar görs någon annanstans.

- **Antal** = summan av köp − summan av sälj.
- **GAV** räknas affär för affär i datumordning. Vid köp: ny GAV = (antal × GAV + antal köpt × kurs + courtage) / nytt
  antal. Vid sälj: antalet minskar, GAV är oförändrat (som Avanza). Säljs allt börjar nästa köp om från noll.
- **Investerat** = antal × GAV.
- **Senaste kurs** = senaste `close_sek` för tickern. Finns ingen används `manualPrice`, och källan markeras som egen.
- **Värde** = antal × senaste kurs. Utan kurs: `null`, och vyn visar "värde saknas", aldrig 0 kr.
- **Utveckling** = värde − investerat, i kr och %.
- **Realiserad vinst** = för varje sälj: (kurs − GAV vid säljet) × antal − courtage. Visas för sig.
- **Fördelning** = värde per innehav och per typ, i kr och %.
- **Värde över tid** = för varje månadsslut från första köpet: antal ägt den dagen × senaste kurs på eller före den
  dagen, och investerat den dagen.
- **Kontots värde** när `fromHoldings`: summan av värdet för innehav med samma `assetId` + `cash`. Nettovärdet räknas
  annars exakt som i dag.

Belopp skrivs med `formatKr`. Avrundning bara vid visning.

## Gränssnitt

Ny underflik **Investeringar** under Ekonomi, bredvid Konton (`Investments.tsx`).

1. **Översikt överst:** totalt investerat, värde idag, utveckling i kr och %, och datum för senaste kurs.
2. **Graf:** portföljens värde mot investerat kapital, månad för månad (samma SVG-stil som Prognos).
3. **Fördelning:** aktier/fonder/ETF och per innehav, som stapel med andelar.
4. **Lista med innehav:** namn, värde, utveckling i %. Ett tryck öppnar innehavet.
5. **Innehav:** kursgraf (1 mån / 1 år / sedan köp) med köpen markerade, nyckeltal (antal, GAV, investerat, värde,
   utveckling, realiserat) och listan med affärer. Där finns knapparna *+ Köp* och *+ Sälj* och redigering.
6. **Konton:** kontoformuläret får kryssrutan *"Värdet räknas från innehaven"* och fältet *Kontanter*.

Formulär för ett nytt innehav: namn, typ, sök på kortnamn (via `lookup`), konto, och egen kurs om kortnamnet saknas.

## Felhantering

- Okänt kortnamn: appen säger det direkt och erbjuder egen kurs.
- Hämtningen misslyckas: senaste kända kurs visas med datum, t.ex. "kurs från 5 nov".
- Kurs äldre än 4 vardagar: markeras som gammal.
- Försäljning av fler andelar än man äger: formuläret godkänns inte.
- Utan kurs alls: investerat visas, värde och utveckling visas som "saknas".

## Jarvis

`ask.ts` får frågan "hur går investeringarna/fonderna/aktierna?" och svarar med värde och utveckling från
`portfolio.ts`. Visningsläget som döljer belopp gäller även här.

## Tester

- `portfolio.test.ts`: ett köp; flera köp med olika kurser (GAV); delförsäljning (GAV oförändrat, realiserad vinst);
  courtage; försäljning av allt; saknad kurs (värde `null`); kurs saknas en enskild dag (föregående används); värde över
  tid; kontots värde med `fromHoldings` och `cash`.
- `db.upgrade.test.ts`: uppgradering 12 → 13 lämnar alla befintliga poster i alla lager oförändrade.
- `sync.merge.test.ts`: `holdings` och `trades` synkas mellan två databaser, senaste ändringen vinner.
- `budgetMerge.ts` ändras inte. Dess tester körs ändå.
- Före/efter: text i varje Ekonomi-flik jämförs mot `main` med testdata i en tom lokal databas. PR:en skriver att
  beloppen är identiska.
- Testdata bara lokalt, aldrig i Supabase. Tabellen `prices` fylls bara av riktiga hämtningar.

## Risker

- Yahoo Finance är inofficiellt och kan ändras eller spärra. Egen kurs finns alltid som reserv, och `prices.ts` hålls
  liten så att källan kan bytas.
- Vissa svenska fonder saknas hos Yahoo. De får egen kurs.
- Ny underflik i Ekonomi: kontrollera 375 px-bredden (känd radbrytningsbugg i budgetlistan finns redan).
