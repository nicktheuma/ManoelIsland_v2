-- Manoel Island Sandbox — configurable rate limits + admin session bypass

-- ---------------------------------------------------------------------------
-- Global rate limit settings (singleton)
-- ---------------------------------------------------------------------------
create table if not exists public.sandbox_settings (
  id int primary key default 1 check (id = 1),
  rate_limit_enabled boolean not null default true,
  max_placements integer not null default 3 check (max_placements >= 1),
  window_minutes numeric not null default 5 check (window_minutes > 0),
  per_prop_limits jsonb not null default '{}'::jsonb,
  admin_password text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.sandbox_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.sandbox_settings is
  'Singleton sandbox configuration including rate limits and admin API password.';

-- ---------------------------------------------------------------------------
-- Admin sessions (local admin password → server bypass for auth.uid())
-- ---------------------------------------------------------------------------
create table if not exists public.admin_sessions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);

alter table public.sandbox_settings enable row level security;
alter table public.admin_sessions enable row level security;

create policy "sandbox_settings_select_all"
  on public.sandbox_settings
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Per-prop intervention tracking
-- ---------------------------------------------------------------------------
alter table public.user_interventions
  add column if not exists prop_type text;

create index if not exists user_interventions_user_prop_created_idx
  on public.user_interventions (user_id, prop_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_rate_limit_exempt (p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.admin_sessions
    where user_id = p_user_id
      and expires_at > now()
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.resolve_prop_rate_limit (p_prop_type text)
returns table (
  limit_enabled boolean,
  max_placements integer,
  window_minutes numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  settings record;
  per_prop jsonb;
begin
  select *
  into settings
  from public.sandbox_settings
  where id = 1;

  if not settings.rate_limit_enabled then
    return query
    select false, settings.max_placements, settings.window_minutes;
    return;
  end if;

  per_prop := settings.per_prop_limits -> p_prop_type;

  if per_prop is not null and coalesce((per_prop ->> 'enabled')::boolean, true) = false then
    return query
    select false, settings.max_placements, settings.window_minutes;
    return;
  end if;

  if per_prop is not null and per_prop ? 'maxPlacements' then
    return query
    select
      true,
      greatest(1, (per_prop ->> 'maxPlacements')::integer),
      greatest(0.1, coalesce((per_prop ->> 'windowMinutes')::numeric, settings.window_minutes));
    return;
  end if;

  return query
  select true, settings.max_placements, settings.window_minutes;
end;
$$;

create or replace function public.register_admin_session (p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_password text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select admin_password
  into stored_password
  from public.sandbox_settings
  where id = 1;

  if stored_password is null or stored_password = '' then
    update public.sandbox_settings
    set admin_password = p_password,
        updated_at = now()
    where id = 1;
  elsif p_password is distinct from stored_password then
    return false;
  end if;

  insert into public.admin_sessions (user_id, expires_at)
  values (auth.uid(), now() + interval '24 hours')
  on conflict (user_id) do update
  set expires_at = excluded.expires_at;

  return true;
end;
$$;

create or replace function public.clear_admin_session ()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  delete from public.admin_sessions
  where user_id = auth.uid();
end;
$$;

create or replace function public.update_sandbox_rate_limits (
  p_admin_password text,
  p_rate_limit_enabled boolean,
  p_max_placements integer,
  p_window_minutes numeric,
  p_per_prop_limits jsonb,
  p_sync_admin_password boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_password text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select admin_password
  into stored_password
  from public.sandbox_settings
  where id = 1;

  if stored_password is not null
    and stored_password <> ''
    and p_admin_password is distinct from stored_password
    and not public.is_rate_limit_exempt(auth.uid())
  then
    return false;
  end if;

  update public.sandbox_settings
  set
    rate_limit_enabled = p_rate_limit_enabled,
    max_placements = greatest(1, p_max_placements),
    window_minutes = greatest(0.1, p_window_minutes),
    per_prop_limits = coalesce(p_per_prop_limits, '{}'::jsonb),
    admin_password = case
      when p_sync_admin_password then coalesce(nullif(p_admin_password, ''), admin_password)
      else admin_password
    end,
    updated_at = now()
  where id = 1;

  insert into public.admin_sessions (user_id, expires_at)
  values (auth.uid(), now() + interval '24 hours')
  on conflict (user_id) do update
  set expires_at = excluded.expires_at;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limit trigger (uses sandbox_settings + per-prop limits)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_placed_prop_rate_limit ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  limits record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to place props.';
  end if;

  if public.is_rate_limit_exempt(auth.uid()) then
    return new;
  end if;

  select *
  into limits
  from public.resolve_prop_rate_limit(new.prop_type);

  if not limits.limit_enabled then
    return new;
  end if;

  select count(*)
  into recent_count
  from public.user_interventions
  where user_id = auth.uid()
    and prop_type = new.prop_type
    and created_at > now() - (limits.window_minutes || ' minutes')::interval;

  if recent_count >= limits.max_placements then
    raise exception 'Rate limit reached. Please wait before changing Manoel Island again.';
  end if;

  insert into public.user_interventions (user_id, action_type, prop_type)
  values (auth.uid(), 'place_prop', new.prop_type);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cooldown helper (optional prop_type for per-prop countdown)
-- ---------------------------------------------------------------------------
create or replace function public.get_rate_limit_cooldown_seconds (p_prop_type text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  oldest_recent timestamptz;
  seconds_remaining integer;
  limits record;
begin
  if auth.uid() is null then
    return 0;
  end if;

  if public.is_rate_limit_exempt(auth.uid()) then
    return 0;
  end if;

  if p_prop_type is null or p_prop_type = '' then
    return 0;
  end if;

  select *
  into limits
  from public.resolve_prop_rate_limit(p_prop_type);

  if not limits.limit_enabled then
    return 0;
  end if;

  select min(created_at)
  into oldest_recent
  from public.user_interventions
  where user_id = auth.uid()
    and prop_type = p_prop_type
    and created_at > now() - (limits.window_minutes || ' minutes')::interval;

  if oldest_recent is null then
    return 0;
  end if;

  seconds_remaining := ceil(
    extract(epoch from (oldest_recent + (limits.window_minutes || ' minutes')::interval - now()))
  );

  return greatest(0, seconds_remaining);
end;
$$;

grant execute on function public.register_admin_session (text) to authenticated;
grant execute on function public.clear_admin_session () to authenticated;
grant execute on function public.update_sandbox_rate_limits (text, boolean, integer, numeric, jsonb, boolean) to authenticated;
grant execute on function public.get_rate_limit_cooldown_seconds (text) to authenticated;
