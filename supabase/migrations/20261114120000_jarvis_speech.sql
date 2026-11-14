-- Jarvis röst (ElevenLabs): räknar uppläsningar per användare och dag, i samma tabell som frågorna.
-- Högst 150 per dag. Egen räknare, så att uppläsningar inte äter av dagens 50 frågor.

alter table public.jarvis_usage add column if not exists spoken integer not null default 0 check (spoken >= 0);

create or replace function public.jarvis_count_speech()
returns table (allowed boolean, used integer)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Stockholm')::date;
  n integer;
begin
  if uid is null then raise exception 'Inte inloggad'; end if;
  insert into public.jarvis_usage as u (user_id, day, calls, spoken) values (uid, today, 0, 1)
  on conflict (user_id, day) do update set spoken = u.spoken + 1, updated_at = now() where u.spoken < 150
  returning u.spoken into n;
  if n is null then
    select u.spoken into n from public.jarvis_usage u where u.user_id = uid and u.day = today;
    return query select false, n;
  else
    return query select true, n;
  end if;
end;
$$;

revoke all on function public.jarvis_count_speech() from public, anon;
grant execute on function public.jarvis_count_speech() to authenticated;
