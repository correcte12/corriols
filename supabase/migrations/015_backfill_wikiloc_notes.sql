-- ============================================================
-- Corriols — Relleno único de wikiloc_url y notes en user_progress
-- desde mis-montanas (user_summits).
-- Detectado 2026-06-11: ~50 registros comunes tienen wikiloc personal
-- en mis-montanas pero NULL en corriols (y 4 casos análogos en notes),
-- porque las filas ya existían en corriols antes del backfill de 013
-- (ON CONFLICT DO NOTHING) y la migración 003 no copiaba wikiloc.
--
-- Solo rellena valores a NULL en corriols: NUNCA sobrescribe un valor
-- ya existente (las divergencias reales se conservan tal cual).
--
-- Ejecutar a: Supabase SQL Editor (DESPUÉS de 014, que deduplica
-- los nombres y deja el cruce summits.name = challenge_items.name
-- sin ambigüedad)
-- ============================================================

-- 1. wikiloc_url
update public.user_progress up
set wikiloc_url = nullif(us.personal_wikiloc_url, '')
from public.user_summits us
join public.summits s          on s.id = us.summit_id
join public.challenge_items ci on ci.name = s.name
join public.challenges c       on c.id = ci.challenge_id
                              and c.name = '100 Cims de l''Alt Empordà'
where up.challenge_item_id = ci.id
  and up.user_id = us.user_id
  and us.ascended = true
  and up.wikiloc_url is null
  and nullif(us.personal_wikiloc_url, '') is not null;

-- 2. notes
update public.user_progress up
set notes = nullif(us.personal_description, '')
from public.user_summits us
join public.summits s          on s.id = us.summit_id
join public.challenge_items ci on ci.name = s.name
join public.challenges c       on c.id = ci.challenge_id
                              and c.name = '100 Cims de l''Alt Empordà'
where up.challenge_item_id = ci.id
  and up.user_id = us.user_id
  and us.ascended = true
  and up.notes is null
  and nullif(us.personal_description, '') is not null;

-- ------------------------------------------------------------
-- Verificación: registros comunes donde mis-montanas tiene valor
-- y corriols sigue a NULL. Ambos totales deben ser 0.
-- ------------------------------------------------------------
select 'wikiloc en MM pero NULL en corriols' as concepto, count(*) as total
from public.user_progress up
join public.challenge_items ci on ci.id = up.challenge_item_id
join public.challenges c       on c.id = ci.challenge_id
                              and c.name = '100 Cims de l''Alt Empordà'
join public.summits s          on s.name = ci.name
join public.user_summits us    on us.summit_id = s.id and us.user_id = up.user_id
where us.ascended = true
  and up.wikiloc_url is null
  and nullif(us.personal_wikiloc_url, '') is not null
union all
select 'notes en MM pero NULL en corriols', count(*)
from public.user_progress up
join public.challenge_items ci on ci.id = up.challenge_item_id
join public.challenges c       on c.id = ci.challenge_id
                              and c.name = '100 Cims de l''Alt Empordà'
join public.summits s          on s.name = ci.name
join public.user_summits us    on us.summit_id = s.id and us.user_id = up.user_id
where us.ascended = true
  and up.notes is null
  and nullif(us.personal_description, '') is not null;
