-- Jarvis (edge function jarvis): räknar frågor per användare och dag, så att ingen kan ställa fler än 50 om dagen.
-- En rad per användare och dag (svensk tid). Radsäkerhet: var och en läser bara sina egna rader. Det finns ingen
-- skrivregel: raderna ändras bara av funktionen jarvis_count_call nedan, som räknar upp för den inloggade själv.
create table if not exists public.jarvis_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.jarvis_usage enable row level security;

drop policy if exists jarvis_usage_read on public.jarvis_usage;
create policy jarvis_usage_read on public.jarvis_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Räknar en fråga för den inloggade. Svarar allowed = false när dagens 50 redan är använda (räknaren står då kvar
-- på 50). Uppräkningen och kontrollen sker i samma sats, så två samtidiga frågor kan inte båda bli nummer 50.
create or replace function public.jarvis_count_call()
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Stockholm')::date;
  n integer;
begin
  if uid is null then
    raise exception 'Inte inloggad';
  end if;
  insert into public.jarvis_usage as u (user_id, day, calls)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set calls = u.calls + 1, updated_at = now()
    where u.calls < 50
  returning u.calls into n;
  if n is null then
    select u.calls into n from public.jarvis_usage u where u.user_id = uid and u.day = today;
    return query select false, n;
  else
    return query select true, n;
  end if;
end;
$$;

revoke all on function public.jarvis_count_call() from public, anon;
grant execute on function public.jarvis_count_call() to authenticated;
