# Vanor – regler för den här delen

- Vanor, bockningar, pauser, Att göra och hälsa är **personliga** (tabellen `personal_records`, egen IndexedDB
  `store.ts`, DB_VERSION 4). Ekonomin är hushållets. Blanda aldrig.
- Logiken för "vad ska göras idag" ligger i delad kod: `priority.ts`, `habits.ts`, `tasks.ts`, `health.ts` i
  `supabase/functions/inbox/`. Servern (morgonbesked, Siri, Jarvis) och appen måste säga samma sak.
- Hälsodata kommer från iPhone-genvägen "Hälsa till Groundwork" och skrivs av servern. Siffror kan komma med
  hårda eller smala mellanslag ("8 432"); tolkningen i `health.ts` måste tåla det.
- "Att göra" = enstaka saker med datum. Vanor med veckomål listas under "Måste"/"Kan vänta", inte under Att göra.
- Pausad dag: inga måsten, streaks bryts inte, veckomål sänks.
- Typsnitt och färger: designspecen "Två rum". Vanor är vardagsrum: systemets typsnitt, siffror i `--font-amount`,
  klart i `--pine`, det man trycker på i `--act` (kobolt). Galaxen är specialrum och har HUD-stilen i `room.css`.
- Galaxen (`CosmosView.tsx` m.fl.) öppnas härifrån (Månad → Öppna din galax) och laddas lazy. Regler för den
  står i root-CLAUDE.md under Galax tills den fått egen mapp.
