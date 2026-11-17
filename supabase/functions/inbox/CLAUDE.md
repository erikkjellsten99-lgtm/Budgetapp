# inbox (Supabase edge function) – regler

Projekt `gnmbtioxwgzdooswpwxy`, funktion `inbox`, `verify_jwt: false` (funktionen kontrollerar nycklar själv).
Läggs bara ut efter att Erik skrivit "Lägg ut".

## Åtgärder (se kommentaren överst i `index.ts`)
`token`, `morgon`, `lasnyckel`, `sammanfattning`, `fraga` (POST), samt default
POST för påminnelser, Siri-uppgifter och hälsodata. Nycklar: `gw_` (skriva, `inbox_tokens`) och `gr_` (bara läsa,
`read_tokens`). Hashar sparas, aldrig nycklar.

## Delad kod
Allt här utom `index.ts`, `parse.ts`, `spoken.ts` används också av appen. Filerna importeras med
`.ts`-ändelse. Inga Deno-specifika saker i de delade filerna.

## Utläggning (så funkar det, och fällorna)
- Sandboxen når inte `supabase.co` och inte `svt.se`. Utläggning sker med MCP-verktyget
  `deploy_edge_function` med **alla** `.ts`-filer (utom tester) som platta filnamn, `entrypoint_path: index.ts`.
- Verktyget kräver hela innehållet i ett anrop (~125 kB). Det har visat sig kunna tappa den sista filen
  (`types.ts`, bara typer, ofarligt) och osynliga tecken (U+00A0, U+202F). Skriv därför sådana tecken som
  `\u`-koder i källkoden, aldrig som riktiga tecken.
- Kontrollera alltid efteråt med `get_edge_function` och jämför fil för fil mot repot (skript: läs JSON, jämför
  `content` med lokala filer).
- Verktyget tappar den **sista** filen i anropet (hände igen 2026-11-06 med `health.ts` i reminders). Lägg därför
  alltid en fil med bara typer sist (`types.ts` i inbox, `health.ts` i reminders) och kontrollera efteråt.
- Ett anrop får inte vara större än ca 70 kB: hela inbox (128 kB) går inte att skicka från sandboxen. Alternativ:
  Supabase CLI från en dator med nät, eller en sparad Supabase-nyckel (api.supabase.com) i molnmiljön "Budgetapp".
- Senaste utlagda inbox: version 21 (2026-11-17), samma som `main` efter #139 (sömn per natt, `sleepForNight`).
  `types.ts` följer inte med (bara typer), det är ofarligt.
- Enklast att lägga ut från en dator: `npx -y supabase@latest functions deploy inbox --remote=gnmbtioxwgzdooswpwxy
  --use-api --no-verify-jwt --yes` (Erik är inloggad med `supabase login` på sin Mac; `--yes` först efter "Lägg ut").
  Jämför före och efter med `functions download inbox --remote=… --use-api` och `diff` mot repot.
- Logga med `console.log`; läs med `query_logs` (source `function_edge_logs`).
- Funktionen `reminders` räknar via `../inbox/priority.ts` (se `reminders/plan.ts`). Läggs den ut måste
  `priority.ts`, `habits.ts`, `tasks.ts`, `dates.ts` och `health.ts` följa med. Utlagd som version 6 (2026-11-06)
  med filnamnen `reminders/index.ts`, `reminders/plan.ts`, `reminders/report.ts`, `inbox/priority.ts` osv. och
  `entrypoint_path: reminders/index.ts`, så att `../inbox/` i importerna stämmer. Ändra aldrig "måste"-logiken i
  reminders för sig.

## Nyheter
Flyttade 2026-11-15 till en egen funktion, `supabase/functions/nyheter/` (veckonyheter skrivna av Claude). SVT-flödena
och `?action=nyheter` är borttagna ur repot; den utlagda versionen har åtgärden kvar tills inbox läggs ut nästa gång.
