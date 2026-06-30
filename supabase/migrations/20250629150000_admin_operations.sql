-- Manoel Island Sandbox — Phase 3.2
-- Admin map operations + elevated RLS for admin callers

create or replace function public.is_admin_caller ()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_rate_limit_exempt(auth.uid());
$$;

grant execute on function public.is_admin_caller () to authenticated;

-- Admin callers may update/delete any prop (including locked rows)
create policy "placed_props_admin_update"
  on public.placed_props
  for update
  to authenticated
  using (public.is_admin_caller())
  with check (public.is_admin_caller());

create policy "placed_props_admin_delete"
  on public.placed_props
  for delete
  to authenticated
  using (public.is_admin_caller());

-- Wipe props placed by non-admin users
create or replace function public.wipe_map_clutter ()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null or not public.is_admin_caller() then
    raise exception 'Unauthorized';
  end if;

  with deleted as (
    delete from public.placed_props p
    where not exists (
      select 1
      from public.profiles pr
      where pr.id = p.user_id
        and pr.role = 'admin'
    )
    returning 1
  )
  select count(*)
  into deleted_count
  from deleted;

  return deleted_count;
end;
$$;

comment on function public.wipe_map_clutter is
  'Admin-only: deletes all placed_props owned by non-admin users.';

-- Lock or unlock the entire layout
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

  update public.placed_props
  set is_locked = p_locked;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.set_layout_locked is
  'Admin-only: sets is_locked on all placed_props.';

grant execute on function public.wipe_map_clutter () to authenticated;
grant execute on function public.set_layout_locked (boolean) to authenticated;

-- Admin profile lookup for Phase 3.1 login guard
create or replace function public.get_my_profile ()
returns table (
  id uuid,
  username text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select p.id, p.username, p.role
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

grant execute on function public.get_my_profile () to authenticated;
