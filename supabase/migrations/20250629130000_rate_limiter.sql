-- Manoel Island Sandbox — Phase 2.2
-- Rate limiter: max 3 prop placements per user per 5 minutes (r/place style)

create or replace function public.enforce_placed_prop_rate_limit ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to place props.';
  end if;

  -- Admins bypass rate limits (Phase 3 admin tooling)
  if exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    return new;
  end if;

  select count(*)
  into recent_count
  from public.user_interventions
  where user_id = auth.uid()
    and created_at > now() - interval '5 minutes';

  if recent_count >= 3 then
    raise exception 'Rate limit reached. Please wait before changing Manoel Island again.';
  end if;

  insert into public.user_interventions (user_id, action_type)
  values (auth.uid(), 'place_prop');

  return new;
end;
$$;

comment on function public.enforce_placed_prop_rate_limit is
  'BEFORE INSERT trigger: allows up to 3 prop placements per 5 minutes per user.';

drop trigger if exists placed_props_rate_limit on public.placed_props;

create trigger placed_props_rate_limit
before insert on public.placed_props
for each row
execute function public.enforce_placed_prop_rate_limit ();

-- Helper for frontend cooldown timer (Phase 2.3)
create or replace function public.get_rate_limit_cooldown_seconds ()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  oldest_recent timestamptz;
  seconds_remaining integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select min(created_at)
  into oldest_recent
  from public.user_interventions
  where user_id = auth.uid()
    and created_at > now() - interval '5 minutes';

  if oldest_recent is null then
    return 0;
  end if;

  seconds_remaining := ceil(
    extract(epoch from (oldest_recent + interval '5 minutes' - now()))
  );

  return greatest(0, seconds_remaining);
end;
$$;

grant execute on function public.get_rate_limit_cooldown_seconds () to authenticated;
