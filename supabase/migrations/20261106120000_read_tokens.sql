-- Läsnycklar för Jarvis och "Fråga Groundwork". En per person, separat från inbox_tokens
-- (som bara har en nyckel per person och kan lägga in saker). Bara en hash av nyckeln sparas.
-- Radsäkerhet utan regler: bara servern (edge function med service role) kommer åt tabellen.
create table if not exists public.read_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.read_tokens enable row level security;
