-- ============================================================
-- Corriols — Migració: progrés usuaris de mis-montanas
-- Llegeix de user_summits i migra inscripcions + progrés
-- al repte "100 Cims de l'Alt Empordà"
-- Executar a: Supabase SQL Editor
-- ============================================================

-- 1. Crear perfils pels usuaris que no en tinguin
INSERT INTO public.profiles (id)
SELECT DISTINCT user_id
FROM public.user_summits
ON CONFLICT (id) DO NOTHING;

-- 2. Inscriure tots els usuaris que tenien activitat al repte
INSERT INTO public.user_challenges (user_id, challenge_id, enrolled_at)
SELECT DISTINCT
  us.user_id,
  c.id,
  MIN(us.created_at)
FROM public.user_summits us
CROSS JOIN public.challenges c
WHERE c.name = '100 Cims de l''Alt Empordà'
GROUP BY us.user_id, c.id
ON CONFLICT (user_id, challenge_id) DO NOTHING;

-- 3. Migrar progrés: només els cims amb ascended = true
INSERT INTO public.user_progress (user_id, challenge_item_id, completed_at, notes)
SELECT
  us.user_id,
  ci.id,
  COALESCE(us.ascended_at, us.updated_at, us.created_at),
  us.personal_description
FROM public.user_summits us
JOIN public.summits s        ON s.id = us.summit_id
JOIN public.challenge_items ci ON ci.name = s.name
JOIN public.challenges c      ON c.id = ci.challenge_id AND c.name = '100 Cims de l''Alt Empordà'
WHERE us.ascended = true
ON CONFLICT (user_id, challenge_item_id) DO NOTHING;
