-- Terrain sculpt strokes + configurable rate limits

alter table public.sandbox_settings
  add column if not exists terrain_sculpt_rate_limit_enabled boolean not null default true;

alter table public.sandbox_settings
  add column if not exists terrain_sculpt_max_strokes integer not null default 12 check (terrain_sculpt_max_strokes >= 1);

alter table public.sandbox_settings
  add column if not exists terrain_sculpt_window_minutes numeric not null default 5 check (terrain_sculpt_window_minutes > 0);

create table if not exists public.terrain_sculpt_strokes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  terrain_key text not null,
  tool text not null check (tool in ('excavate', 'fill')),
  center_x double precision not null,
  center_z double precision not null,
  radius double precision not null check (radius > 0),
  strength double precision not null check (strength > 0)
);

create index if not exists terrain_sculpt_strokes_terrain_key_created_idx
  on public.terrain_sculpt_strokes (terrain_key, created_at);

alter table public.terrain_sculpt_strokes enable row level security;

create policy "terrain_sculpt_strokes_select_all"
  on public.terrain_sculpt_strokes
  for select
  to anon, authenticated
  using (true);

create policy "terrain_sculpt_strokes_insert_authenticated"
  on public.terrain_sculpt_strokes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.resolve_terrain_sculpt_rate_limit ()
returns table (
  limit_enabled boolean,
  max_strokes integer,
  window_minutes numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  settings record;
begin
  select *
  into settings
  from public.sandbox_settings
  where id = 1;

  if not settings.rate_limit_enabled or not settings.terrain_sculpt_rate_limit_enabled then
    return query
    select false, settings.terrain_sculpt_max_strokes, settings.terrain_sculpt_window_minutes;
    return;
  end if;

  return query
  select true, settings.terrain_sculpt_max_strokes, settings.terrain_sculpt_window_minutes;
end;
$$;

create or replace function public.apply_terrain_sculpt_stroke (
  p_terrain_key text,
  p_tool text,
  p_center_x double precision,
  p_center_z double precision,
  p_radius double precision,
  p_strength double precision
)
returns public.terrain_sculpt_strokes
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  limits record;
  inserted public.terrain_sculpt_strokes;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to sculpt terrain.';
  end if;

  if p_tool not in ('excavate', 'fill') then
    raise exception 'Invalid sculpt tool.';
  end if;

  if p_radius <= 0 or p_strength <= 0 then
    raise exception 'Invalid sculpt brush parameters.';
  end if;

  if not public.is_rate_limit_exempt(auth.uid()) then
    select *
    into limits
    from public.resolve_terrain_sculpt_rate_limit();

    if limits.limit_enabled then
      select count(*)
      into recent_count
      from public.user_interventions
      where user_id = auth.uid()
        and action_type = 'terrain_sculpt'
        and created_at > now() - (limits.window_minutes || ' minutes')::interval;

      if recent_count >= limits.max_strokes then
        raise exception 'Rate limit reached. Please wait before changing Manoel Island again.';
      end if;
    end if;
  end if;

  insert into public.terrain_sculpt_strokes (
    user_id,
    terrain_key,
    tool,
    center_x,
    center_z,
    radius,
    strength
  )
  values (
    auth.uid(),
    p_terrain_key,
    p_tool,
    p_center_x,
    p_center_z,
    p_radius,
    p_strength
  )
  returning *
  into inserted;

  if not public.is_rate_limit_exempt(auth.uid()) then
    insert into public.user_interventions (user_id, action_type)
    values (auth.uid(), 'terrain_sculpt');
  end if;

  return inserted;
end;
$$;

create or replace function public.get_terrain_sculpt_cooldown_seconds ()
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

  select *
  into limits
  from public.resolve_terrain_sculpt_rate_limit();

  if not limits.limit_enabled then
    return 0;
  end if;

  select min(created_at)
  into oldest_recent
  from public.user_interventions
  where user_id = auth.uid()
    and action_type = 'terrain_sculpt'
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

create or replace function public.update_sandbox_rate_limits (
  p_admin_password text,
  p_rate_limit_enabled boolean,
  p_max_placements integer,
  p_window_minutes numeric,
  p_per_prop_limits jsonb,
  p_sync_admin_password boolean default false,
  p_terrain_sculpt_rate_limit_enabled boolean default null,
  p_terrain_sculpt_max_strokes integer default null,
  p_terrain_sculpt_window_minutes numeric default null
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
    terrain_sculpt_rate_limit_enabled = coalesce(
      p_terrain_sculpt_rate_limit_enabled,
      terrain_sculpt_rate_limit_enabled
    ),
    terrain_sculpt_max_strokes = greatest(
      1,
      coalesce(p_terrain_sculpt_max_strokes, terrain_sculpt_max_strokes)
    ),
    terrain_sculpt_window_minutes = greatest(
      0.1,
      coalesce(p_terrain_sculpt_window_minutes, terrain_sculpt_window_minutes)
    ),
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

grant execute on function public.apply_terrain_sculpt_stroke (text, text, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.get_terrain_sculpt_cooldown_seconds () to authenticated;
grant execute on function public.update_sandbox_rate_limits (text, boolean, integer, numeric, jsonb, boolean, boolean, integer, numeric) to authenticated;
