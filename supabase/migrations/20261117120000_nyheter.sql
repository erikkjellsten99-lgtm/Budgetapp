-- Veckonyheter: tabellen där edge-funktionen nyheter sparar veckans sammanställning, och schemat som kör den.
--
-- news_weeks: en rad per vecka. data är det appen får (sektioner, nyheter, kostnad), work är det bara servern
-- behöver (frågor som ligger ute hos Claude). RLS är på utan regler: bara service role (edge-funktionen) når
-- tabellen. Appen läser via funktionens GET.
--
-- Schemat går var tionde minut måndagar 02:00–07:50 UTC (03:00 svensk vintertid). Första anropet skickar frågorna,
-- de följande hämtar svaren. När veckan är klar gör anropen ingenting. Hemligheten är samma som för
-- kunskap-generera (kunskap_cron_secret i Vault, migrationen kunskap_generera_cron).
-- Körs bara efter att Erik skrivit "Lägg ut".

create table if not exists public.news_weeks (
  week text primary key,
  data jsonb not null,
  work jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.news_weeks enable row level security;
revoke all on table public.news_weeks from anon, authenticated;

select cron.schedule(
  'nyheter',
  '*/10 2-7 * * 1',
  $$
  select net.http_post(
    url := 'https://gnmbtioxwgzdooswpwxy.supabase.co/functions/v1/nyheter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kunskap_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
