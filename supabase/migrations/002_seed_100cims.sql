-- ============================================================
-- Corriols — Migració: 100 Cims → primer repte
-- Llegeix de la taula existent `summits` (mis-montanas)
-- i crea el repte + els seus items en una sola transacció.
-- Executar a: Supabase SQL Editor
-- ============================================================

WITH new_challenge AS (
  INSERT INTO public.challenges (name, description, type, is_active)
  VALUES (
    '100 Cims de l''Alt Empordà',
    'Repte de completar els 100 cims emblemàtics de la comarca de l''Alt Empordà i comarques veïnes.',
    'senderisme',
    true
  )
  RETURNING id
)
INSERT INTO public.challenge_items (challenge_id, name, description, item_order)
SELECT
  new_challenge.id,
  s.name,
  s.description,
  ROW_NUMBER() OVER (ORDER BY s.height DESC)::integer AS item_order
FROM public.summits s, new_challenge;
