-- Manoel Island Sandbox — Phase 2.1
-- Run via Supabase SQL editor or: supabase db push

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  role text not null default 'user' check (role in ('user', 'admin'))
);

comment on table public.profiles is 'Public user profile linked to Supabase Auth.';

-- Auto-create profile row on signup
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- placed_props
-- ---------------------------------------------------------------------------
create table if not exists public.placed_props (
  id uuid primary key default gen_random_uuid(),
  prop_type text not null,
  x double precision not null,
  y double precision not null,
  z double precision not null,
  rotation_x double precision not null default 0,
  rotation_y double precision not null default 0,
  rotation_z double precision not null default 0,
  scale double precision not null default 1,
  color text not null default '#ffffff',
  metadata jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists placed_props_user_id_idx on public.placed_props (user_id);
create index if not exists placed_props_prop_type_idx on public.placed_props (prop_type);
create index if not exists placed_props_created_at_idx on public.placed_props (created_at desc);

comment on table public.placed_props is 'Props placed on the Manoel Island canvas.';

-- ---------------------------------------------------------------------------
-- user_interventions (rate-limit audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.user_interventions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_interventions_user_created_idx
  on public.user_interventions (user_id, created_at desc);

comment on table public.user_interventions is 'Audit log for user actions (used by rate limiter).';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.placed_props enable row level security;
alter table public.user_interventions enable row level security;

-- profiles: public read, users update own row
create policy "profiles_select_all"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- placed_props: anyone can read map state
create policy "placed_props_select_all"
  on public.placed_props
  for select
  to anon, authenticated
  using (true);

-- placed_props: authenticated users can insert their own props
create policy "placed_props_insert_authenticated"
  on public.placed_props
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- placed_props: owners can update/delete unlocked props
create policy "placed_props_update_own_unlocked"
  on public.placed_props
  for update
  to authenticated
  using (auth.uid() = user_id and is_locked = false)
  with check (auth.uid() = user_id);

create policy "placed_props_delete_own_unlocked"
  on public.placed_props
  for delete
  to authenticated
  using (auth.uid() = user_id and is_locked = false);

-- user_interventions: users read own history; inserts via trigger/function (Phase 2.2)
create policy "user_interventions_select_own"
  on public.user_interventions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime (enable on placed_props for Phase 2.3)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.placed_props;
