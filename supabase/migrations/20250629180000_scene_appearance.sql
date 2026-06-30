-- Manoel Island Sandbox — shared scene appearance (HDRI, colors)

alter table public.sandbox_settings
  add column if not exists scene_appearance jsonb not null default jsonb_build_object(
    'hdriPreset', 'none',
    'backgroundColor', '#0c1222',
    'terrainFillColor', '#0f172a',
    'terrainGridColor', '#38bdf8'
  );

comment on column public.sandbox_settings.scene_appearance is
  'Shared scene appearance: HDRI preset id, canvas background, terrain fill and grid colors.';

create or replace function public.update_scene_appearance (
  p_admin_password text,
  p_scene_appearance jsonb
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
    scene_appearance = coalesce(p_scene_appearance, '{}'::jsonb),
    updated_at = now()
  where id = 1;

  insert into public.admin_sessions (user_id, expires_at)
  values (auth.uid(), now() + interval '24 hours')
  on conflict (user_id) do update
  set expires_at = excluded.expires_at;

  return true;
end;
$$;

grant execute on function public.update_scene_appearance (text, jsonb) to authenticated;
