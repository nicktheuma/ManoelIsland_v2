-- Global layout lock: blocks new prop placements for non-admins

alter table public.sandbox_settings
  add column if not exists layout_locked boolean not null default false;

create or replace function public.is_layout_locked ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select layout_locked from public.sandbox_settings where id = 1),
    false
  );
$$;

grant execute on function public.is_layout_locked () to anon, authenticated;

-- Lock/unlock: global flag + per-prop is_locked
create or replace function public.set_layout_locked (p_locked boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null or not public.is_admin_caller() then
    raise exception 'Unauthorized';
  end if;

  update public.sandbox_settings
  set
    layout_locked = p_locked,
    updated_at = now()
  where id = 1;

  update public.placed_props
  set is_locked = p_locked;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.set_layout_locked is
  'Admin-only: sets global layout_locked and is_locked on all placed_props.';

-- Block new placements while layout is locked (non-admins)
create or replace function public.enforce_layout_unlocked_on_insert ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_layout_locked() and not public.is_admin_caller() then
    raise exception 'Layout is locked. New placements are disabled.';
  end if;

  return new;
end;
$$;

drop trigger if exists placed_props_layout_lock on public.placed_props;

create trigger placed_props_layout_lock
before insert on public.placed_props
for each row
execute function public.enforce_layout_unlocked_on_insert ();

drop policy if exists "placed_props_insert_authenticated" on public.placed_props;

create policy "placed_props_insert_authenticated"
  on public.placed_props
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      public.is_admin_caller()
      or not public.is_layout_locked()
    )
  );

-- Realtime sync for layout lock state across clients
alter publication supabase_realtime add table public.sandbox_settings;
