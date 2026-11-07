-- Dagens stängningskurser i kronor för innehav (aktier, fonder, ETF:er), hämtade från Yahoo Finance av
-- edge function inbox. En rad per symbol och dag. Kurserna är öppen marknadsdata, inte hushållets egna siffror.
-- Radsäkerhet: alla inloggade får läsa. Det finns ingen skrivregel, så bara servern (service role) kan lägga in kurser.
create table if not exists public.prices (
  ticker text not null,
  date date not null,
  close_sek numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (ticker, date)
);

alter table public.prices enable row level security;

drop policy if exists prices_read on public.prices;
create policy prices_read on public.prices
  for select to authenticated
  using (true);
