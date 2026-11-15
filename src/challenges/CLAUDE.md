# Challenges – regler för den här delen

- Utmaningar man bockar av varje dag. **Personliga**, som Vanor: egen IndexedDB (`store.ts`, databasen
  `challenges`, DB_VERSION 1) och egna tabeller i Supabase (`challenges`, `challenge_tasks`, `challenge_checkins`,
  `challenge_attempts`, migrationen `20261116120000_challenges.sql`) med radsäkerhet per ägare. Bilder i den
  privata bucketen `challenge-photos`, i mappen som heter som användarens id. Rör aldrig ekonomin.
- **Reglerna ligger i `logic.ts`**, utan sidoeffekter och med tester (`logic.test.ts`). En dag är missad om inte
  allt är klart vid midnatt; missar räknas per kalendervecka; `on_fail` tillämpas av `evaluate()`. Vyn sparar bara
  det `evaluate()` lämnar tillbaka. Ändra regler där, inte i vyerna.
- `evaluate()` körs först efter `syncNow()`, så att en telefon med gamla data inte startar om en utmaning som är
  bockad på en annan telefon.
- Omstart: `restart_challenge` sparar försöket i `challenge_attempts` och sätter nytt startdatum till dagen då
  appen upptäcker missen. `restart_week` och paus lägger dagar i `settings.voided` (räknas inte, slutdatumet flyttas).
  Bockar tas aldrig bort, `best_streak` sänks aldrig.
- Det generiska: uppgiftstyperna `check`, `counter`, `reading`, `workout`, `photo`. En ny mall är ett objekt i
  `templates.ts`. Krav på passen tillsammans (utomhus, morgonlöpning) står i `rules.workout_requires`.
- Bockar och försök har lokalt id `uppgift|datum` respektive `utmaning|försök` och skickas upp med upsert på de
  unika kolumnerna, så två telefoner kan inte skapa dubbletter.
- Notiser: tiderna i `settings.reminders` skickas av servern (`supabase/functions/reminders`, `challengeReminders`
  i `plan.ts`). Ingen väckning i appen.
- Stilen: vyn ligger i `.vanor.challenges` och ärver Vanors ark, fält och knappar. Egna regler i `challenges.css`,
  alla börjar med `.challenges`. Grön = klar, gul = delvis, röd = missad.
