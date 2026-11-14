-- Kunskap: schemat som kör genereringen en gång per dygn (04:10 UTC). Funktionen kunskap-generera avgör själv
-- vilka som står på tur (Varje dag eller Varje vecka i appens inställningar). Utan inställning genereras ingenting.
--
-- Hemligheten som skiljer schemats anrop från andras skapas här, slumpad, och finns bara i Vault. Schemat läser den
-- direkt, och edge-funktionen frågar efter den med kunskap_cron_secret() (bara service role får anropa den).
-- Körs bara efter att Erik skrivit "Lägg ut".

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'kunskap_cron_secret') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'kunskap_cron_secret');
  end if;
end $$;

create or replace function public.kunskap_cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kunskap_cron_secret';
$$;

revoke all on function public.kunskap_cron_secret() from public, anon, authenticated;
grant execute on function public.kunskap_cron_secret() to service_role;

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
