# 75 Hard: Dagens form – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dagens vy i en utmaning med pass visar "Dagens form" (Pigg/Okej/Sliten) ur hälsodatan och ett förslag under Lätt pass och Tufft pass.

**Architecture:** En ren funktion i `src/challenges/readiness.ts` räknar form och förslag ur `HealthDay[]` (samma poster som Vanor läser). `ChallengeDetail.tsx` läser hälsodatan ur Vanors lokala lagring och visar ett kort och en rad per pass. Inget sparas, inga regler ändras.

**Tech Stack:** React, TypeScript, vitest. Hälsotyper från `supabase/functions/inbox/health.ts`.

**Spec:** `docs/superpowers/specs/2026-11-16-75hard-dagens-form-design.md`

## Global Constraints

- Reglerna i `logic.ts` ändras inte. Inget bockas automatiskt.
- Ingen ändring i Supabase, `inbox` eller `reminders`. Ekonomin rörs inte.
- Gränser: sömn < 6 h = 2 p, 6–7 h = 1 p; vilopuls ≥ snitt + 7 = 2 p, + 4 till + 6 = 1 p; gårdagens träning ≥ 90 min = 1 p; sömnpoäng < 60 = 1 p. 0 p = Pigg, 1–2 = Okej, ≥ 3 = Sliten.
- Snittet för vilopuls: upp till 14 senaste dagarna med värde före dagen värdet kommer från, minst 5, annars räknas vilopulsen inte.
- Utan nattens sömn (dagens post saknar `sleepH`): ingen form, texten "Ingen sömn från i natt än".
- Svenska texter, siffror i svenskt format. Stil: regler i `challenges.css` som börjar med `.challenges`, färger via tokens.

## Review Focus

- Tom hälsodata (ny användare, utloggad): kortet visar att sömnen saknas, inget kraschar.
- Vilopuls saknas idag men finns igår: gårdagens används, snittet räknas före gårdagen.
- Färre än 5 dagar vilopuls: vilopulsen ger 0 poäng och nämns inte som avvikelse.
- En tidigare dag är vald i vyn: ingen form och inga förslag visas (formen gäller bara idag).
- Egen utmaning utan pass, eller pass som inte heter Lätt/Tufft: inget kort respektive inget förslag.

---

### Task 1: Uträkningen

**Files:**
- Create: `src/challenges/readiness.ts`
- Test: `src/challenges/readiness.test.ts`

**Interfaces:**
- Produces:
  - `type Form = 'pigg' | 'okej' | 'sliten'`
  - `interface Readiness { form: Form | null; points: number; facts: string[] }` – `facts` är raderna som visas, t.ex. `"5 h 2 min sömn"`, `"vilopuls 75 (snitt 68)"`, `"135 min träning igår"`. `form: null` när nattens sömn saknas (då är `facts` tom).
  - `readiness(health: HealthDay[], today: DateKey): Readiness`
  - `FORM_LABEL: Record<Form, string>` = Pigg, Okej, Sliten
  - `suggestion(form: Form, taskTitle: string): string | null` – texten ur specens tabell för titlar som börjar med "Lätt" eller "Tufft" (skiftlägesokänsligt), annars null.

- [ ] **Step 1:** Skriv testerna: varje rad i poängtabellen (gränsvärdena 5,99/6/6,99/7 h; +3/+4/+6/+7 slag; 89/90 min; sömnpoäng 59/60), summering till form, de fem fallen i Review Focus som gäller uträkningen, och alla sex förslagstexter.
- [ ] **Step 2:** Kör `npx vitest run src/challenges/readiness.test.ts`, ska falla.
- [ ] **Step 3:** Implementera. Sömntiden formateras med `formatHealth('sleepH', …)` från `health.ts`.
- [ ] **Step 4:** Kör testerna, ska gå igenom.
- [ ] **Step 5:** Commit.

### Task 2: Dagvyn

**Files:**
- Modify: `src/challenges/ChallengeDetail.tsx` (dagsektionen och `TaskItem`)
- Modify: `src/challenges/challenges.css`
- Modify: `src/challenges/CLAUDE.md` (en rad om formen)
- Test: `src/challenges/ChallengeDetail.test.tsx` (ny, `renderToStaticMarkup` som `HealthCard.test.tsx`)

**Interfaces:**
- Consumes: `readiness`, `suggestion`, `FORM_LABEL` från Task 1; `loadHabitData`, `onHabitChange` från `../vanor/store`.
- Produces: exporterad komponent `FormCard({ readiness }: { readiness: Readiness })` i `ChallengeDetail.tsx`.

- [ ] **Step 1:** Test: `FormCard` med form "sliten" visar "Dagens form", "Sliten" och fakta; med `form: null` visar "Ingen sömn från i natt än" och hur den kommer in (kör genvägen "Hälsa Groundwork daglig").
- [ ] **Step 2:** Kör testet, ska falla.
- [ ] **Step 3:** Implementera: en hook `useHealth()` (laddar `health` och lyssnar på `onHabitChange`), kortet överst i dagsektionen när `selected === today`, utmaningen är startad och aktiv och har minst ett pass. `TaskItem` får `hint?: string` som visas som egen rad under undertexten (klass `ch-task-form`).
- [ ] **Step 4:** `npm test` grönt; `npm run build` på skiftlägeskänslig disk.
- [ ] **Step 5:** Skärmbilder 375 px ljust och mörkt, tom lokal databas, med testdata i lokal IndexedDB.
- [ ] **Step 6:** Commit, push, PR.
