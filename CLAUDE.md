# Groundwork – regler för Claude

Eriks app för ekonomi, vanor, Jarvis och galaxen. Vite + React + TypeScript, IndexedDB lokalt, Supabase för synk och
servern "inbox", publiceras på GitHub Pages från `main` (`.github/workflows/deploy.yml`). Svara på svenska, kort.
Läs `STATUS.md` först: där står vad som är klart, halvfärdigt och trasigt.

## Starta, testa, bygga
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest, alla ska vara gröna
npm run build      # tsc + vite, måste gå igenom före push
```
Skärmbilder: Playwright finns. Kör med 375 px bredd i ljust och mörkt läge och blockera `supabase.co`, så att
testerna aldrig rör riktiga data. Starta med tom lokal databas.

## Delarna och hur de hänger ihop
| Del | Kod | Egen CLAUDE.md |
|---|---|---|
| Ekonomi | `src/App.tsx` (flikarna), `Categories/Forecast/Goal/Assets/Wishlist/Income.tsx`, `db.ts`, `sync.ts` | föreslagen mapp `src/ekonomi/` (inte flyttat än) |
| Vanor | `src/vanor/` | `src/vanor/CLAUDE.md` |
| Jarvis | `src/Jarvis.tsx`, `jarvis.ts`, `speech.ts`, `Today.tsx` | föreslagen mapp `src/jarvis/` (inte flyttat än) |
| Galax | `src/vanor/CosmosView.tsx`, `Galaxy.tsx`, `*3d.ts`, `CameraRig.ts`, `cosmos*.ts`, `universe.ts` | föreslagen mapp `src/galax/` (inte flyttat än) |
| Servern | `supabase/functions/inbox/` | `supabase/functions/inbox/CLAUDE.md` |

- **Delad kod ligger i `supabase/functions/inbox/`** (ask, summary, priority, habits, health, forecast, goalPlan …).
  Appen importerar den direkt eller via shims i `src/` (`export * from '../supabase/functions/inbox/X.ts'`).
  Så räknar app, Siri och Jarvis alltid samma siffror. Ändra aldrig en siffra på bara ett ställe.
- **Navigationen** är `App.tsx` och `nav.ts`: Idag, Ekonomi (underflikar Översikt, Budget, Prognos; Konton och
  Önskelista öppnas från rader i Översikt), Vanor, Nyheter. Jarvis är ingen flik: orben i sidhuvudet öppnar
  Jarvis i specialrummet (`Room.tsx`). Galaxen öppnas inifrån Vanor → Månad och är också ett specialrum.
- **Idag** och **Jarvis** läser allt via `summaryFacts` (`summary.ts`). Jarvis svar byggs i `ask.ts`, utan AI.
- **Stilen** följer designspecen "Två rum" (`docs/design/designspec-tva-rum.md`). Vardagsrummet (Idag, Ekonomi,
  Vanor, Nyheter) ligger i `styles.css` och `vanor/vanor.css`; specialrummet (Jarvis och galaxen) i `room.css`,
  där varje regel börjar med `.room`. Färger via tokens (`--bg`, `--surface`, `--ink`, `--pine`, `--cobalt`,
  `--lingon` …), låsta i `design.test.ts`; mörkt läge i både `prefers-color-scheme` och `[data-theme='dark']`.
  Typsnitt: systemets i vardagsrummet, `ui-rounded` för belopp, Space Grotesk och JetBrains Mono bara i rummet.

## Ekonomidatan får aldrig ändras
- Alla siffror i ekonomidelen är Eriks och Cassandras riktiga. Ändra, avrunda, flytta, ta bort eller hitta aldrig på
  något: varken data (IndexedDB, Supabase) eller uträkningar (prognos, ränta, sparmål, "blir över").
- Testdata bara i tom lokal databas. Skriv aldrig testdata till Supabase.
- Verkar en uträkning fel: beskriv och fråga. Ändra inget själv.
- PR som rör ekonomin: jämför varje fliks text mot `main` före och efter (skript finns i sessionens scratchpad,
  gör ett nytt vid behov) och skriv i PR:en att beloppen är identiska.

## Jarvis
- Läser bara. Får aldrig ändra något i ekonomin, och citerar exakt de siffror som ligger i Groundwork.
- Ingen AI och inget som kostar pengar. Svaren byggs med nyckelord i `ask.ts`.
- Visningsläget (ögat) döljer alla belopp; svar märkta `money: true` i `ask.ts` ersätts med `HIDDEN_MONEY`.

## Arbetssätt
- Pusha aldrig till `main`. Egen gren mot `main` (inte staplade grenar), PR med kort svensk beskrivning och
  "Så testar du". Erik mergar själv.
- `npm test` och `npm run build` gröna före push.
- IndexedDB: höj aldrig en befintlig version i efterhand, lägg till ny version med uppgraderingssteg
  (`src/db.ts` DB_VERSION, `src/vanor/store.ts` DB_VERSION).
- Supabase (databas, edge function `inbox`) ändras bara efter att Erik skrivit "Lägg ut".
- Fråga innan ny teknik eller tjänst som kostar pengar. Erik vill inte betala något.
- Max ett förslag på förbättring per leverans. Bygg det inte utan att fråga.

## Kvalitet
- 375 px bredd, ljust och mörkt läge, skrivbord ≥ 900 px (sidomeny). Tomma lägen, laddning och fel ska vara designade.
- Kantfall: tom input, stora tal, å/ä/ö, dubbelklick, tappad uppkoppling.
- Svenska datum (2026-10-20) och belopp (1 234 kr).
- Kontrollera med skärmbilder innan något kallas klart.
