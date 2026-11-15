-- Challenges: utmaningar man bockar av dagligen. Privata: bara ägaren ser sina rader (tabeller och bilder).
-- Appen sparar först i telefonen och skickar upp med upsert (src/challenges/sync.ts).
-- updated_at sätts av servern och används när telefonen hämtar det som ändrats.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  length_days integer not null check (length_days between 1 and 3650),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'paused')),
  attempt_number integer not null default 1,
  best_streak integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{"max_misses_per_week": 0, "on_fail": "restart_challenge"}'::jsonb,
  created_at timestamptz not null default now(),
  -- Borttagen i appen. Raden ligger kvar så att andra telefoner får veta.
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.challenge_tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  type text not null check (type in ('check', 'counter', 'photo', 'workout', 'reading')),
  target numeric,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.challenge_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  task_id uuid not null references public.challenge_tasks (id) on delete cascade,
  date date not null,
  done boolean not null default false,
  value numeric,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (task_id, date)
);

create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  attempt_number integer not null,
  started_at date not null,
  ended_at date not null,
  days_completed integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (challenge_id, attempt_number)
);

create index challenges_user_updated on public.challenges (user_id, updated_at);
create index challenge_tasks_challenge on public.challenge_tasks (challenge_id);
create index challenge_checkins_challenge on public.challenge_checkins (challenge_id, date);
create index challenge_attempts_challenge on public.challenge_attempts (challenge_id);

create function public.challenges_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger challenges_touch before insert or update on public.challenges
  for each row execute function public.challenges_touch();
create trigger challenge_tasks_touch before insert or update on public.challenge_tasks
  for each row execute function public.challenges_touch();
create trigger challenge_checkins_touch before insert or update on public.challenge_checkins
  for each row execute function public.challenges_touch();
create trigger challenge_attempts_touch before insert or update on public.challenge_attempts
  for each row execute function public.challenges_touch();

alter table public.challenges enable row level security;
alter table public.challenge_tasks enable row level security;
alter table public.challenge_checkins enable row level security;
alter table public.challenge_attempts enable row level security;

create policy "Ägaren ser och ändrar sina utmaningar" on public.challenges
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Ägaren ser och ändrar sina uppgifter" on public.challenge_tasks
  for all to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));

create policy "Ägaren ser och ändrar sina bockar" on public.challenge_checkins
  for all to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));

create policy "Ägaren ser och ändrar sina försök" on public.challenge_attempts
  for all to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));

-- Progressbilder: privat bucket, varje användare har en egen mapp som heter som användarens id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-photos', 'challenge-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Ägaren läser sina progressbilder" on storage.objects
  for select to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Ägaren laddar upp sina progressbilder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Ägaren byter ut sina progressbilder" on storage.objects
  for update to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Ägaren tar bort sina progressbilder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
