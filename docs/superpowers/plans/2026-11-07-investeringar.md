# Investeringar – implementationsplan

> **För agenter:** OBLIGATORISK UNDERSKILL: använd superpowers:subagent-driven-development (rekommenderas) eller
> superpowers:executing-plans för att genomföra planen uppgift för uppgift. Stegen är checkrutor (`- [ ]`).

**Mål:** En underflik Investeringar i Ekonomi där hushållet lägger in innehav och affärer och ser värde, GAV,
vinst/förlust, kursgraf, portföljens värde över tid och fördelning. Kurserna hämtas automatiskt.

**Arkitektur:** Innehav och affärer är hushållsdata i två nya IndexedDB-lager (`holdings`, `trades`) och synkas via
`records` som allt annat. Kurser är marknadsdata: inbox-funktionen hämtar dem från Yahoo Finance till en egen tabell
`prices` i Supabase, och appen läser därifrån. Alla uträkningar ligger i delade `supabase/functions/inbox/portfolio.ts`,
som används av appen, sammanfattningen och Jarvis.

**Teknik:** React 19 + Vite, TypeScript, IndexedDB (fake-indexeddb i tester), Vitest, Supabase (Postgres + Deno edge
function `inbox`). Inga nya npm-beroenden. Graferna är handskriven SVG, som i `Forecast.tsx`.

**Spec:** `/Users/erikkjellsten/Documents/claude/Budgetapp/Ekonomi/designspec-investeringar.md`

**Repo:** `~/Documents/groundwork`. Arbeta på en ny gren `investeringar` från `main` (inte från `obetalt-denna-manad`).

## Globala regler

- Siffrorna är Eriks och Cassandras riktiga. Inga befintliga poster i IndexedDB eller Supabase ändras, avrundas eller
  tas bort. Ingen befintlig uträkning ändras.
- `DB_VERSION` 12 → 13 med ett nytt `if (event.oldVersion < 13)`-steg. Äldre steg rörs inte.
- Uträkningar bara i `supabase/functions/inbox/portfolio.ts`. Komponenter räknar inte själva.
- Belopp visas med `formatKr` från `money.ts`, och avrundning sker bara vid visning.
- Testdata bara i en tom lokal databas, aldrig i Supabase.
- `budgetMerge.ts` ändras inte. Dess tester ska fortfarande gå igenom.
- Kurs äldre än 4 vardagar markeras som gammal. Utan kurs visas "värde saknas", aldrig 0 kr.
- Inget som kostar: Yahoo Finance utan nyckel, ingen betald tjänst.
- Texter i appen på svenska, utan mittpunkter i metarader (regel från "Två rum").
- Ekonomin är hushållets, så inga investeringsdata hamnar i vanor- eller hälsotabeller.

## Granskningsfokus

1. **Fondandelar med decimaler och svenskt kommatecken** ("12,3456" andelar, "187,45" kr) ska tolkas rätt och inte
   avrundas till heltal (test i uppgift 1 och 8).
2. **Köp på helgdag eller före första kursen hos Yahoo**: kursen på eller närmast före datumet används. Finns ingen
   alls före datumet blir månadens värde `null`, inte 0 (test i uppgift 2).
3. **En ändrad eller borttagen affär gör att en senare försäljning överstiger innehavet**: `validateTrades` ska
   underkänna det, och formuläret får inte spara (test i uppgift 1 och 8).
4. **Båda telefonerna begär kurser samtidigt**: upsert på `(ticker, date)` ger inga dubbletter och inget fel (test i
   uppgift 4).
5. **Värdepapper i annan valuta** (t.ex. USD): räknas om med valutakursen för samma dag. Saknas den dagens valutakurs
   ska kursen hoppas över, inte sparas oomräknad (test i uppgift 4).

---

### Uppgift 0: Gren och spec

- [ ] **Steg 1:** `cd ~/Documents/groundwork && git fetch && git switch -c investeringar origin/main`
- [ ] **Steg 2:** Kopiera specen till `docs/superpowers/specs/2026-11-07-investeringar-design.md` och planen till
  `docs/superpowers/plans/2026-11-07-investeringar.md`.
- [ ] **Steg 3:** Kör `npm test` och spara utskriften. Alla tester ska gå igenom på `main` innan något ändras.
- [ ] **Steg 4:** Ta en baslinje för före/efter-jämförelsen. Kör `npm run dev` med en tom lokal databas (privat
  fönster), lägg in testdata (tre kategorier, inkomst, två konton varav ett med `spending`, ett sparmål, en önskan) och
  spara `innerText` för Översikt, Budget, Prognos, Konton och Önskelista i `scratch/fore/<flik>.txt` (inte
  incheckat).
- [ ] **Steg 5:** Committa: `git commit -m "Investeringar: spec och plan"`

### Uppgift 1: Typer och innehavets nyckeltal

**Filer:**
- Ändra: `supabase/functions/inbox/types.ts` (efter `Asset`)
- Skapa: `supabase/functions/inbox/portfolio.ts`
- Test: `src/portfolio.test.ts`

**Gränssnitt (produceras):**
```ts
export type HoldingType = 'stock' | 'fund' | 'etf'
export interface Holding { id: string; name: string; type: HoldingType; ticker?: string; assetId?: string; manualPrice?: number; manualPriceDate?: string }
export interface Trade { id: string; holdingId: string; date: string; side: 'buy' | 'sell'; quantity: number; price: number; fee: number }
export interface PricePoint { date: string; close: number }            // close i SEK
// I Asset (valfria, nya): fromHoldings?: boolean; cash?: number

export interface Position { quantity: number; gav: number; invested: number; realized: number }
export function position(trades: Trade[], until?: string): Position    // bara affärer med date <= until
export function validateTrades(trades: Trade[]): string | null          // felmeddelande eller null
```

- [ ] **Steg 1: Skriv testerna** i `src/portfolio.test.ts` (`describe('position')`):
  - ett köp 10 st à 100 kr, courtage 5 → `{ quantity: 10, gav: 100.5, invested: 1005, realized: 0 }`
  - köp 10 à 100 (fee 0) och köp 10 à 200 (fee 0) → `gav: 150`, `invested: 3000`
  - därefter sälj 5 à 300, fee 10 → `quantity: 15`, `gav: 150` (oförändrat), `realized: 5 * (300 - 150) - 10 = 740`
  - sälj allt, sedan köp 2 à 50 → `gav: 50`, `quantity: 2` (nollställt efter helförsäljning)
  - fondandelar: köp 12.3456 à 187.45 → `quantity` exakt `12.3456`, `invested` = `12.3456 * 187.45` (`toBeCloseTo`, 6)
  - affärer i fel ordning i listan sorteras på `date` (vid samma datum: köp före sälj)
  - `until: '2026-03-31'` räknar inte med en affär från 2026-04-02
  - `validateTrades`: sälj 11 när 10 ägs → `'Ni säljer fler andelar än ni äger den 2026-05-01.'`; giltig lista → `null`
- [ ] **Steg 2:** `npx vitest run src/portfolio.test.ts` → FAIL (modulen finns inte).
- [ ] **Steg 3:** Lägg till typerna i `types.ts` och implementera `position` och `validateTrades` i `portfolio.ts`.
  GAV räknas affär för affär: köp ger `gav = (q*gav + qty*price + fee) / (q + qty)`, sälj ger
  `realized += qty*(price - gav) - fee` och `q -= qty` med GAV oförändrat, och vid `q === 0` blir `gav = 0`. Jämför
  `q` mot `1e-9` för flyttal.
- [ ] **Steg 4:** `npx vitest run src/portfolio.test.ts` → PASS.
- [ ] **Steg 5:** Committa: `"Investeringar 1/9: typer och GAV"`

### Uppgift 2: Kurs, värde, fördelning, värde över tid och kontovärde

**Filer:** Ändra `supabase/functions/inbox/portfolio.ts`, test `src/portfolio.test.ts`

**Gränssnitt (produceras):**
```ts
export type PriceSource = 'market' | 'manual' | 'none'
export interface Quote { price: number | null; date: string | null; source: PriceSource; stale: boolean }
export function priceOn(points: PricePoint[], date: string): PricePoint | null   // senaste med date <= datum
export function quote(holding: Holding, points: PricePoint[], today: string): Quote
export interface HoldingSummary { holding: Holding; position: Position; quote: Quote; value: number | null; change: number | null; changePct: number | null }
export function summarize(holdings: Holding[], trades: Trade[], prices: Record<string, PricePoint[]>, today: string): HoldingSummary[]
export interface PortfolioTotals { invested: number; value: number | null; change: number | null; changePct: number | null; realized: number; missing: number; latestDate: string | null }
export function totals(rows: HoldingSummary[]): PortfolioTotals
export interface Slice { key: string; label: string; value: number; share: number }
export function allocation(rows: HoldingSummary[], by: 'holding' | 'type'): Slice[]   // bara rader med value != null
export interface SeriesPoint { date: string; invested: number; value: number | null }
export function valueOverTime(holdings: Holding[], trades: Trade[], prices: Record<string, PricePoint[]>, today: string): SeriesPoint[]
export function withHoldingValues(assets: Asset[], rows: HoldingSummary[]): Asset[]
```
`prices` nycklas på `ticker`. Typetiketter: `stock` → "Aktier", `fund` → "Fonder", `etf` → "ETF".

- [ ] **Steg 1: Skriv testerna:**
  - `priceOn` med punkter 11-03 (fre) och 11-06 (mån), datum 11-04 (lör) → punkten 11-03; datum före första → `null`
  - `quote`: med marknadskurs → `source: 'market'`. Utan ticker men med `manualPrice` → `'manual'`. Inget av dem →
    `{ price: null, source: 'none' }`. Senaste kurs 2026-10-30 (fre) med today 2026-11-05 (tor) → `stale: true`
    (5 vardagar). Med today 2026-11-04 (ons) → `stale: false` (3 vardagar).
  - `summarize`: 10 st, GAV 100, kurs 120 → `value 1200`, `change 200`, `changePct` `0.2`. Utan kurs → `value`,
    `change` och `changePct` är `null`.
  - `totals` med en rad utan kurs → `missing: 1`. `value` summerar bara rader med kurs, och `changePct` räknas bara
    på de raderna. `latestDate` = äldsta `quote.date` bland raderna med marknadskurs.
  - `allocation(rows, 'type')` med fond 3000 och aktie 1000 → andelarna `0.75` och `0.25`, sorterade störst först
  - `valueOverTime`: köp 2026-01-15, today 2026-03-10 → punkterna `2026-01-31`, `2026-02-28`, `2026-03-10`. Varje
    punkt har `invested` från `position(trades, date)` och `value` = antal × `priceOn`. Saknas kurs på eller före
    datumet blir `value: null`.
  - `withHoldingValues`: ett konto utan `fromHoldings` returneras som **samma objekt** (`toBe`). Ett konto med
    `fromHoldings: true, cash: 500` och två innehav på kontot med värdena 1000 och `null` → `amount: 1500`. Övriga
    fält är oförändrade och `fromHoldings` ligger kvar.
- [ ] **Steg 2:** Kör testerna → FAIL.
- [ ] **Steg 3:** Implementera funktionerna. Vardagar räknas utan helgdagar (mån–fre). `withHoldingValues` returnerar
  samma array-element för konton utan `fromHoldings`, så att allt som i dag läser `amount` får exakt samma tal.
- [ ] **Steg 4:** Kör testerna → PASS.
- [ ] **Steg 5:** Committa: `"Investeringar 2/9: värde, fördelning och värde över tid"`

### Uppgift 3: IndexedDB version 13 och synk

**Filer:** Ändra `src/db.ts`, test `src/db.upgrade.test.ts` och `src/sync.merge.test.ts`

**Gränssnitt (produceras), i `db.ts`:**
```ts
export function getHoldings(): Promise<Holding[]>
export function saveHolding(holding: Holding): Promise<void>
export function deleteHolding(id: string): Promise<void>     // tar också bort innehavets affärer
export function getTrades(): Promise<Trade[]>
export function saveTrade(trade: Trade): Promise<void>
export function deleteTrade(id: string): Promise<void>
```

- [ ] **Steg 1: Skriv testerna:**
  - `db.upgrade.test.ts`, `describe('uppgradering till version 13')`: skapa en v12-databas med samma lager som i dag
    och en post i vart och ett av `categories`, `budgets`, `transactions`, `income`, `debts`, `assets`, `goals`,
    `wishes`, `loans`, `outbox` och `meta`. Öppna med `db.ts`. Varje post ska vara `toEqual` originalet,
    `getHoldings()` och `getTrades()` ska ge `[]`, och outboxen ska inte ha fått några nya poster.
  - `sync.merge.test.ts`: telefon A sparar ett innehav och ett köp, synken körs och telefon B har båda posterna. B
    ändrar köpets antal senare och A får B:s version. `deleteHolding` på A tar bort innehavet och dess affärer även
    på B.
- [ ] **Steg 2:** Kör testerna → FAIL.
- [ ] **Steg 3:** Lägg till `'holdings', 'trades'` sist i `DATA_STORES`, sätt `DB_VERSION = 13` och lägg till steget
  `if (event.oldVersion < 13) { createObjectStore('holdings', { keyPath: 'id' }); createObjectStore('trades', { keyPath: 'id' }) }`.
  Funktionerna följer mönstret för `getAssets`/`saveAsset`/`deleteAsset` (`putRecord`/`removeRecord`).
- [ ] **Steg 4:** `npm test` → allt PASS, även `budgetMerge.test.ts` och de gamla uppgraderingstesterna.
- [ ] **Steg 5:** Committa: `"Investeringar 3/9: lagren holdings och trades (IndexedDB 13)"`

### Uppgift 4: Kurstabell och hämtning i inbox

**Filer:**
- Skapa: `supabase/migrations/20261107120000_prices.sql`
- Skapa: `supabase/functions/inbox/prices.ts`
- Ändra: `supabase/functions/inbox/index.ts` (kommentaren överst, routningen kring rad 397–406)
- Test: `supabase/functions/inbox/prices.test.ts` (körs av vitest som övriga `*.test.ts` där)

**Migration:** tabellen `public.prices (ticker text, date date, close_sek numeric not null, fetched_at timestamptz
not null default now(), primary key (ticker, date))`, med `enable row level security` och policyn
`select to authenticated using (true)`. Ingen insert-policy: bara service role skriver.

**Gränssnitt (produceras), i `prices.ts`:**
```ts
export interface ChartData { currency: string; points: { date: string; close: number }[] }   // datum i Europe/Stockholm
export function parseChart(json: unknown): ChartData | null      // Yahoo v8 chart-svar
export function toSek(points: ChartData['points'], fx: ChartData['points'] | null, currency: string): PricePoint[]
export function parseSearch(json: unknown): { ticker: string; name: string; type: HoldingType }[]
export async function fetchChart(ticker: string, from: string): Promise<ChartData | null>
export async function search(query: string): Promise<{ ticker: string; name: string; type: HoldingType }[]>
```
- Chart: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=…&period2=…&interval=1d`.
  Använd `meta.currency`, `timestamp[]` och `indicators.quote[0].close[]` och hoppa över `null`. Valutapar:
  `${currency}SEK=X`. Typer från sökningen: `EQUITY` → `stock`, `MUTUALFUND` → `fund`, `ETF` → `etf`, och allt annat
  hoppas över.
- `user-agent: 'Groundwork/1.0 (kurser)'` och `AbortSignal.timeout(8000)`, som nyheterna.

**Nya åtgärder i `index.ts`** (inloggad i appen, samma kontroll som `?action=token`):
- `POST ?action=kurser` med `{ tickers: { ticker: string; from: string }[] }`. För varje ticker hämtas data från
  senaste sparade datum + 1 (eller `from`), omräknat med `toSek`, och sparas med
  `admin.from('prices').upsert(rows, { onConflict: 'ticker,date' })`. Svar: `{ updated: { [ticker]: number } , failed: string[] }`.
- `GET ?action=kurssok&q=…` → `{ results: [...] }` från `search`.

- [ ] **Steg 1: Skriv testerna** med sparade Yahoo-svar som JSON i `supabase/functions/inbox/fixtures/`, ett för
  `INVE-B.ST` (SEK) och ett för `AAPL` (USD), förkortade till 5 dagar:
  - `parseChart(fixtureSek)` ger `currency: 'SEK'` och 5 punkter, och en `null`-kurs i fixturen ger 4 punkter
  - `parseChart({})` ger `null`
  - `toSek` med USD-punkter och FX-punkter där en dag saknas ger 4 punkter (dagen utan valutakurs utelämnas), och
    `close = usd * fx`
  - `toSek` med `'SEK'` och `fx: null` returnerar punkterna oförändrade
  - `parseSearch` mappar typerna och hoppar över `INDEX`
  - En hjälpfunktion `rowsToUpsert(ticker, points)` ger unika `(ticker, date)` även när samma punkt finns två gånger
    (Granskningsfokus 4)
- [ ] **Steg 2:** Kör testerna → FAIL.
- [ ] **Steg 3:** Implementera `prices.ts`, migrationen och de två åtgärderna. Uppdatera kommentarlistan överst i
  `index.ts`.
- [ ] **Steg 4:** `npm test` → PASS. `deno check supabase/functions/inbox/index.ts` om Deno finns, annars notera det.
- [ ] **Steg 5:** Committa: `"Investeringar 4/9: kurstabell och kurshämtning i inbox"`. Migration och utläggning
  görs inte här. Det gör Erik i uppgift 9 efter granskning.

### Uppgift 5: Kurser i appen

**Filer:** Skapa `src/prices.ts` och `src/prices.test.ts`

**Gränssnitt (produceras):**
```ts
export async function loadPrices(tickers: string[]): Promise<Record<string, PricePoint[]>>   // läser public.prices
export async function refreshPrices(holdings: Holding[], trades: Trade[], now?: Date): Promise<boolean>
export async function searchTicker(q: string): Promise<{ ticker: string; name: string; type: HoldingType }[]>
```
- `loadPrices` använder Supabase-klienten från `sync.ts`, med `select('ticker,date,close_sek').in('ticker', tickers).order('date')`.
- `refreshPrices` anropar `?action=kurser` högst en gång per dygn per telefon (meta-nyckel `pricesRefreshedOn`).
  `from` för en ticker = datumet för första affären. Returnerar `false` utan att kasta fel när anropet misslyckas.

- [ ] **Steg 1: Skriv testerna** (mocka `fetch` och Supabase):
  - två anrop samma dag ger ett nätverksanrop, och nästa dag ger ett nytt
  - `fetch` som kastar ger `false`, och `pricesRefreshedOn` sparas inte
  - `from` är det tidigaste datumet bland innehavets affärer
- [ ] **Steg 2:** Kör → FAIL. **Steg 3:** Implementera. **Steg 4:** Kör → PASS.
- [ ] **Steg 5:** Committa: `"Investeringar 5/9: kurser i appen"`

### Uppgift 6: Konton räknas från innehaven

**Filer:** Ändra `src/Assets.tsx`, `src/App.tsx` (där `assets` sätts) och `src/useGoalPlan.ts` om det läser
`assets` direkt. Ny hook `src/usePortfolio.ts`.

**Gränssnitt (produceras):**
```ts
export function usePortfolio(): { holdings: Holding[]; trades: Trade[]; prices: Record<string, PricePoint[]>; rows: HoldingSummary[]; reload: () => Promise<void> }
```
Hooken läser `getHoldings`, `getTrades` och `loadPrices`, laddar om vid `onDataChange` och kör `refreshPrices` en gång
vid start.

- [ ] **Steg 1:** I `AssetForm` läggs kryssrutan *"Värdet räknas från innehaven"* till. När den är ikryssad ersätts
  fältet "Saldo idag" av fältet *Kontanter (kr)*, och det inskrivna `amount` behålls orört. I listan visas
  `withHoldingValues`-beloppet och undertexten "Från innehaven".
- [ ] **Steg 2:** `Assets` anropar `onChange(withHoldingValues(loaded, rows))`. Därmed får Översiktens nettovärde och
  sparmålets konton samma värde. Inget annat ställe räknar om.
- [ ] **Steg 3:** Före/efter-kontrollen: med samma testdata som i uppgift 0 (inget konto med `fromHoldings`) ska
  `innerText` för alla fem flikarna vara **identisk** med `scratch/fore/`. Diffa och spara resultatet.
- [ ] **Steg 4:** `npm test` och `npm run build` → PASS.
- [ ] **Steg 5:** Committa: `"Investeringar 6/9: konto kan räknas från innehaven"`

### Uppgift 7: Fliken Investeringar – översikt

**Filer:** Skapa `src/Investments.tsx`. Ändra `src/nav.ts`, `src/nav.test.ts`, `src/App.tsx` och `src/room.css`
eller `src/styles.css`.

- `EconomyView` får `'investments'`. `ECONOMY` får `{ id: 'investments', label: 'Investeringar' }` efter Konton.
  `tabOf('investments')` → `'overview'`, alltså öppnas den som Konton, från en rad i Översikt.
- Översikten, gruppen Nettovärde: raden **Investeringar** visas under Konton med `formatKr(totals.value)` och
  undertexten "Utveckling +x %", eller "Värde saknas" när `value` är `null`. Raden visas bara när det finns minst ett
  innehav. Annars visas länkraden "Lägg in investeringar" i samma grupp.
- `Investments.tsx` i ordning:
  1. `BackToOverview`
  2. Nyckeltal: Investerat, Värde idag, Utveckling (kr och %), Realiserat (bara om skilt från 0), och "Kurser från
     5 nov" eller "Gamla kurser" när någon är `stale`
  3. SVG-graf över `valueOverTime` med två linjer, värde och investerat (stil som `.forecast-chart`). Ett glapp där
     `value` är `null`.
  4. Fördelning med växeln "Per innehav" / "Per typ": staplar med etikett och andel i %
  5. Lista med innehav sorterad på värde, med namn, värde och utveckling i %, eller "egen kurs" / "värde saknas"
  6. Knappen *+ Nytt innehav* (formuläret byggs i uppgift 8)
- [ ] **Steg 1:** Uppdatera `nav.test.ts`: `tabOf('investments') === 'overview'` och `isEconomy('investments')`.
  Kör → FAIL.
- [ ] **Steg 2:** Implementera `nav.ts`, `Investments.tsx` och kopplingen i `App.tsx`. Komponenten räknar ingenting
  själv utan använder bara `summarize`, `totals`, `allocation` och `valueOverTime`.
- [ ] **Steg 3:** `npm test` och `npm run build` → PASS.
- [ ] **Steg 4:** Kontrollera i webbläsaren på 375 px: ingen vågrät rullning, och raden Investeringar radbryts inte.
- [ ] **Steg 5:** Committa: `"Investeringar 7/9: fliken med översikt, graf och fördelning"`

### Uppgift 8: Innehav och affärer

**Filer:** Skapa `src/HoldingView.tsx` och `src/tradeForm.ts`, test `src/tradeForm.test.ts`. Ändra
`src/Investments.tsx`.

**Gränssnitt (produceras):**
```ts
export function parseQuantity(text: string): number      // "12,3456" → 12.3456, "" → NaN
export function tradeError(trades: Trade[], draft: Trade): string | null   // validateTrades på listan med utkastet
```

- **Nytt innehav:** fält för namn, typ, kortnamn och konto (en lista med `assets` som inte har `spending`, eller
  inget). Kortnamnet söks med `searchTicker`, och ett tryck på en träff fyller i namn, typ och kortnamn. Ger
  sökningen inga träffar visas *"Hittade inget hos Yahoo. Skriv in kursen själva."* med fältet *Egen kurs (kr)*
  (sparas som `manualPrice` och `manualPriceDate = today()`). Innehavet sparas tillsammans med sitt första köp.
- **Innehav:** kursgraf med växeln 1 mån / 1 år / Sedan köp och köpen och försäljningarna som prickar. Sedan nyckeltal
  (Antal, GAV, Investerat, Värde, Utveckling, Realiserat), listan med affärer (datum, Köp/Sälj, antal × kurs) och
  knapparna *+ Köp*, *+ Sälj*, *Ändra innehav* och *Ta bort* (med `confirm`).
- **Affärsformulär:** datum (standard `today()`), antal, kurs (kr) och courtage (kr, standard 0). Antal tolkas med
  `parseQuantity`, och belopp med `parseKr`. Spara är avstängt så länge `tradeError` ger ett fel, och felet visas
  som `.error`.
- [ ] **Steg 1: Skriv testerna:** `parseQuantity('12,3456') === 12.3456`, `parseQuantity('1 000') === 1000`,
  `parseQuantity('abc')` är NaN. `tradeError` med ändrat köp så att en senare försäljning överstiger innehavet ger
  felmeddelandet från `validateTrades` (Granskningsfokus 3). Ett sälj med `quantity: 0` ger `'Skriv ett antal större än 0.'`.
- [ ] **Steg 2:** Kör → FAIL. **Steg 3:** Implementera. **Steg 4:** `npm test` och `npm run build` → PASS.
- [ ] **Steg 5:** Kontrollera i webbläsaren med en tom lokal databas: lägg in ett innehav med köp, gör en
  delförsäljning, ta bort innehavet. Kontrollera också 375 px.
- [ ] **Steg 6:** Committa: `"Investeringar 8/9: innehav och affärer"`

### Uppgift 9: Jarvis, sammanfattning och verifiering

**Filer:** Ändra `supabase/functions/inbox/summary.ts`, `supabase/functions/inbox/ask.ts` och `index.ts` (där
sammanfattningens poster läses in). Test i `src/summary.test.ts` och `src/jarvis.test.ts` eller
`supabase/functions/inbox/ask.test.ts`.

- Servern läser `holdings` och `trades` från `records` och `prices` för deras tickers, och skickar
  `withHoldingValues(assets, rows)` till `overviewNumbers` i stället för `assets`.
- `SummaryFacts` får `investments: { value: string | null; invested: string; change: string | null; changePct: number | null; date: string | null } | null`
  (`null` när det inte finns några innehav). Sammanfattningstexten får raden `Investeringar: 12 345 kr (+4,2 %), kurser från 5 nov`.
- `ask.ts`: frågor som innehåller `investering`, `fond`, `aktie` eller `portfölj` besvaras med
  `"Investeringarna är värda 12 345 kr, 4,2 % upp sedan köpen. Kurser från 5 nov."`, eller vid `null`:
  `"Det finns inga kurser för investeringarna än."`. Visningsläget som döljer belopp gäller.
- [ ] **Steg 1: Skriv testerna:**
  - utan innehav är `summary`-texten och `overviewNumbers` **identiska** med före ändringen (ögonblicksbild av den
    befintliga testdatan)
  - med ett konto `fromHoldings` blir `netWorth` innehavsvärdet + `cash`
  - `answer('hur går fonderna', facts)` ger meningen ovan, och med dolda belopp innehåller svaret inget "kr"
- [ ] **Steg 2:** Kör → FAIL. **Steg 3:** Implementera. **Steg 4:** `npm test` och `npm run build` → PASS.
- [ ] **Steg 5: Slutkontroll:**
  - Diffa före/efter för alla fem Ekonomi-flikarna mot `scratch/fore/` och spara resultatet: identiskt
  - 375 px i Översikt, Investeringar och ett innehav
  - Granska hela grenen med `superpowers:requesting-code-review`
- [ ] **Steg 6:** Committa: `"Investeringar 9/9: Jarvis och sammanfattning"`
- [ ] **Steg 7: Överlämning till Erik.** Detta görs inte av agenten:
  - lägga ut migrationen `prices`
  - lägga ut inbox-funktionen
  - öppna PR mot `main` med texten *"Beloppen i Översikt, Budget, Prognos, Konton och Önskelista är identiska före
    och efter (diff bifogad)."*
