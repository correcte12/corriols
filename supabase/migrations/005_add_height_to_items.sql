-- ============================================================
-- Corriols — Afegir height_meters a challenge_items
-- i omplir des de summits
-- ============================================================

ALTER TABLE public.challenge_items
ADD COLUMN IF NOT EXISTS height_meters integer;

UPDATE public.challenge_items ci
SET height_meters = s.height
FROM public.summits s
WHERE ci.name = s.name;
