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

## Bra att veta

- Datan finns bara i den webbläsare och på den enhet där du använder appen. Den synkas inte mellan enheter.
- Rensar du webbplatsdata för appen, eller avinstallerar den, försvinner datan.
