-- ============================================================
-- Corriols — Sincronización automática desde mis-montanas
-- Trigger sobre user_summits que refleja el progreso en
-- user_progress del reto "100 Cims de l'Alt Empordà".
-- Cruce por nombre: user_summits -> summits.name -> challenge_items.name
-- (mismo patrón que 003_migrate_user_progress.sql).
-- Ejecutar a: Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. Función de sincronización
--    SECURITY DEFINER: las escrituras en las tablas de corriols
--    no dependen de las políticas RLS del usuario de mis-montanas.
--    Cualquier error de sincronización se degrada a WARNING para
--    no romper nunca la escritura original en user_summits.
-- ------------------------------------------------------------
create or replace function public.sync_user_summit_to_corriols()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_item_id      uuid;
  v_challenge_id uuid;
  v_user_id      uuid;
  v_summit_id    uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id   := old.user_id;
    v_summit_id := old.summit_id;
  else
    v_user_id   := new.user_id;
    v_summit_id := new.summit_id;
  end if;

  -- Resolver el item del reto por nombre de cima
  select ci.id, ci.challenge_id
    into v_item_id, v_challenge_id
  from public.summits s
  join public.challenge_items ci on ci.name = s.name
  join public.challenges c       on c.id = ci.challenge_id
                                and c.name = '100 Cims de l''Alt Empordà'
  where s.id = v_summit_id;

  -- Cima sin equivalente en el reto: no hay nada que sincronizar
  if v_item_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' or not new.ascended then
    -- Desmarcar en mis-montanas elimina el progreso en corriols
    delete from public.user_progress
    where user_id = v_user_id
      and challenge_item_id = v_item_id;
  else
    -- Asegurar perfil e inscripción al reto
    insert into public.profiles (id)
    values (v_user_id)
    on conflict (id) do nothing;

    insert into public.user_challenges (user_id, challenge_id)
    values (v_user_id, v_challenge_id)
    on conflict (user_id, challenge_id) do nothing;

    -- Crear o actualizar el progreso (notas y wikiloc se mantienen sincronizados)
    insert into public.user_progress (user_id, challenge_item_id, completed_at, notes, wikiloc_url)
    values (
      v_user_id,
      v_item_id,
      coalesce(new.ascended_at, new.updated_at, now()),
      nullif(new.personal_description, ''),
      nullif(new.personal_wikiloc_url, '')
    )
    on conflict (user_id, challenge_item_id) do update
      set completed_at = excluded.completed_at,
          notes        = excluded.notes,
          wikiloc_url  = excluded.wikiloc_url;
  end if;

  return coalesce(new, old);
exception
  when others then
    raise warning 'sync_user_summit_to_corriols: % (user %, summit %)', sqlerrm, v_user_id, v_summit_id;
    return coalesce(new, old);
end;
$$;

-- ------------------------------------------------------------
-- 2. Trigger sobre user_summits
-- ------------------------------------------------------------
drop trigger if exists user_summits_sync_corriols on public.user_summits;
create trigger user_summits_sync_corriols
  after insert or update or delete on public.user_summits
  for each row execute procedure public.sync_user_summit_to_corriols();

-- ------------------------------------------------------------
-- 3. Backfill: progreso creado en mis-montanas después de la
--    migración 003 y que aún no existe en corriols.
--    Idempotente (ON CONFLICT DO NOTHING); no toca el progreso
--    registrado directamente en corriols.
-- ------------------------------------------------------------
insert into public.profiles (id)
select distinct user_id
from public.user_summits
on conflict (id) do nothing;

insert into public.user_challenges (user_id, challenge_id, enrolled_at)
select distinct us.user_id, c.id, min(us.created_at)
from public.user_summits us
cross join public.challenges c
where c.name = '100 Cims de l''Alt Empordà'
group by us.user_id, c.id
on conflict (user_id, challenge_id) do nothing;

insert into public.user_progress (user_id, challenge_item_id, completed_at, notes, wikiloc_url)
select
  us.user_id,
  ci.id,
  coalesce(us.ascended_at, us.updated_at, us.created_at),
  nullif(us.personal_description, ''),
  nullif(us.personal_wikiloc_url, '')
from public.user_summits us
join public.summits s          on s.id = us.summit_id
join public.challenge_items ci on ci.name = s.name
join public.challenges c       on c.id = ci.challenge_id
                              and c.name = '100 Cims de l''Alt Empordà'
where us.ascended = true
on conflict (user_id, challenge_item_id) do nothing;
