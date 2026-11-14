-- Kunskap: schemat som kör genereringen en gång per dygn (04:10 UTC). Funktionen kunskap-generera avgör själv
-- vilka som står på tur (Varje dag eller Varje vecka i appens inställningar). Utan inställning genereras ingenting.
--
-- Före migrationen: lägg samma slumpade hemlighet på två ställen.
--   1. Edge function-hemligheten KUNSKAP_CRON_SECRET.
--   2. Vault: select vault.create_secret('<hemligheten>', 'kunskap_cron_secret');
-- Körs bara efter att Erik skrivit "Lägg ut".

select cron.schedule(
  'kunskap-generera',
  '10 4 * * *',
  $$
  select net.http_post(
    url := 'https://gnmbtioxwgzdooswpwxy.supabase.co/functions/v1/kunskap-generera',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kunskap_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
