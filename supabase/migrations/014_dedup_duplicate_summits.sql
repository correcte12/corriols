-- ============================================================
-- Corriols + mis-montanas — Deduplicación de cimas repetidas
-- Detectado 2026-06-11: 5 cimas existen DOS veces (mismo name)
-- tanto en summits como en challenge_items:
--   Taga, Castell de Sant Miquel, Puig dels Bufadors,
--   Puig dels Pruners, Puig Falcó.
-- Esto duplica filas de progreso en user_progress y hace ambiguo
-- el cruce por nombre del trigger de sincronización (013).
--
-- Estrategia por cada nombre duplicado:
--   1. Conservar la fila con más progreso de usuarios asociado
--      (desempate: created_at más antiguo).
--   2. Fusionar en la conservada los campos que le falten.
--   3. Reapuntar el progreso de usuario a la fila conservada
--      (si un usuario tenía progreso en ambas, se fusiona y se
--      queda una sola fila).
--   4. Eliminar la fila duplicada.
--   5. Índices únicos para que no vuelva a ocurrir.
--
-- Todo dentro de un único bloque DO: el SQL Editor de Supabase
-- ejecuta cada sentencia en su propia transacción, así que las
-- tablas temporales no sobreviven entre sentencias sueltas.
--
-- Ejecutar a: Supabase SQL Editor (después de 013 y ANTES de 015)
-- ============================================================

do $$
begin

  -- El trigger de sincronización (013) se desactiva durante la limpieza:
  -- este bloque corrige las dos tablas de forma explícita y no queremos
  -- borrados colaterales en user_progress al reorganizar user_summits.
  alter table public.user_summits disable trigger user_summits_sync_corriols;

  -- ------------------------------------------------------------
  -- A) summits (mis-montanas) + user_summits
  -- ------------------------------------------------------------
  create temp table summit_keepers on commit drop as
  select distinct on (s.name) s.name, s.id as keep_id
  from public.summits s
  left join public.user_summits us on us.summit_id = s.id
  where s.name in (
    select name from public.summits group by name having count(*) > 1
  )
  group by s.name, s.id, s.created_at
  order by s.name, count(us.user_id) desc, s.created_at asc, s.id;

  create temp table summit_losers on commit drop as
  select s.id as lose_id, k.keep_id, s.name
  from public.summits s
  join summit_keepers k on k.name = s.name and s.id <> k.keep_id;

  -- La fila conservada hereda los campos que tenga vacíos de la duplicada
  update public.summits keep
  set description  = coalesce(nullif(keep.description, ''), lose.description),
      "imageUrl"   = coalesce(nullif(keep."imageUrl", ''), lose."imageUrl"),
      "wikilocUrl" = coalesce(nullif(keep."wikilocUrl", ''), lose."wikilocUrl"),
      esencial     = coalesce(keep.esencial, false) or coalesce(lose.esencial, false)
  from public.summits lose
  join summit_losers sl on sl.lose_id = lose.id
  where keep.id = sl.keep_id;

  -- Si un usuario tiene progreso en ambas filas, se queda el de la conservada
  delete from public.user_summits us
  using summit_losers sl
  where us.summit_id = sl.lose_id
    and exists (
      select 1 from public.user_summits k
      where k.user_id = us.user_id and k.summit_id = sl.keep_id
    );

  update public.user_summits us
  set summit_id = sl.keep_id
  from summit_losers sl
  where us.summit_id = sl.lose_id;

  delete from public.summits s
  using summit_losers sl
  where s.id = sl.lose_id;

  -- ------------------------------------------------------------
  -- B) challenge_items (corriols) + user_progress
  -- ------------------------------------------------------------
  create temp table item_keepers on commit drop as
  select distinct on (ci.challenge_id, ci.name) ci.challenge_id, ci.name, ci.id as keep_id
  from public.challenge_items ci
  left join public.user_progress up on up.challenge_item_id = ci.id
  where (ci.challenge_id, ci.name) in (
    select challenge_id, name from public.challenge_items
    group by challenge_id, name having count(*) > 1
  )
  group by ci.challenge_id, ci.name, ci.id, ci.added_at
  order by ci.challenge_id, ci.name, count(up.id) desc, ci.added_at asc, ci.id;

  create temp table item_losers on commit drop as
  select ci.id as lose_id, k.keep_id, ci.name
  from public.challenge_items ci
  join item_keepers k
    on k.challenge_id = ci.challenge_id and k.name = ci.name and ci.id <> k.keep_id;

  update public.challenge_items keep
  set description    = coalesce(nullif(keep.description, ''), lose.description),
      is_essential   = coalesce(keep.is_essential, false) or coalesce(lose.is_essential, false),
      height_meters  = coalesce(keep.height_meters, lose.height_meters),
      image_url      = coalesce(nullif(keep.image_url, ''), lose.image_url),
      latitude       = coalesce(keep.latitude, lose.latitude),
      longitude      = coalesce(keep.longitude, lose.longitude),
      wikiloc_url    = coalesce(nullif(keep.wikiloc_url, ''), lose.wikiloc_url)
  from public.challenge_items lose
  join item_losers il on il.lose_id = lose.id
  where keep.id = il.keep_id;

  -- Usuarios con progreso en ambos items: fusionar datos en el conservado...
  update public.user_progress keep
  set notes          = coalesce(keep.notes, lose.notes),
      wikiloc_url    = coalesce(keep.wikiloc_url, lose.wikiloc_url),
      gpx_url        = coalesce(keep.gpx_url, lose.gpx_url),
      pdf_url        = coalesce(keep.pdf_url, lose.pdf_url),
      distance_km    = coalesce(keep.distance_km, lose.distance_km),
      elevation_gain = coalesce(keep.elevation_gain, lose.elevation_gain),
      completed_at   = least(keep.completed_at, lose.completed_at)
  from public.user_progress lose
  join item_losers il on il.lose_id = lose.challenge_item_id
  where keep.challenge_item_id = il.keep_id
    and keep.user_id = lose.user_id;

  -- ...y eliminar el duplicado
  delete from public.user_progress up
  using item_losers il
  where up.challenge_item_id = il.lose_id
    and exists (
      select 1 from public.user_progress k
      where k.user_id = up.user_id and k.challenge_item_id = il.keep_id
    );

  update public.user_progress up
  set challenge_item_id = il.keep_id
  from item_losers il
  where up.challenge_item_id = il.lose_id;

  delete from public.challenge_items ci
  using item_losers il
  where ci.id = il.lose_id;

  -- ------------------------------------------------------------
  -- C) Garantizar que no vuelva a pasar: el cruce por nombre del
  --    trigger 013 exige nombres únicos en ambas tablas.
  --    (Dar de alta una cima con nombre repetido pasará a dar error.)
  -- ------------------------------------------------------------
  create unique index if not exists summits_name_key
    on public.summits (name);
  create unique index if not exists challenge_items_challenge_name_key
    on public.challenge_items (challenge_id, name);

  alter table public.user_summits enable trigger user_summits_sync_corriols;

end $$;

-- Red de seguridad: si una ejecución anterior dejó el trigger
-- desactivado, esto lo reactiva (es idempotente).
alter table public.user_summits enable trigger user_summits_sync_corriols;

-- ------------------------------------------------------------
-- Verificación: todas las filas deben devolver total = 0
-- ------------------------------------------------------------
select 'summits con nombre duplicado' as concepto, count(*) as total
from (select name from public.summits group by name having count(*) > 1) d
union all
select 'challenge_items con nombre duplicado', count(*)
from (select challenge_id, name from public.challenge_items
      group by challenge_id, name having count(*) > 1) d
union all
select 'user_progress duplicado por usuario+cima', count(*)
from (select up.user_id, ci.name
      from public.user_progress up
      join public.challenge_items ci on ci.id = up.challenge_item_id
      group by up.user_id, ci.name having count(*) > 1) d
union all
select 'trigger de sincronización activo (1 = sí)', count(*)
from pg_trigger
where tgname = 'user_summits_sync_corriols' and tgenabled <> 'D';
