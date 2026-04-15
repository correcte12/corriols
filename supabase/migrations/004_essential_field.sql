-- ============================================================
-- Corriols — Afegir camp is_essential a challenge_items
-- i omplir-lo des de summits.esencial
-- ============================================================

-- 1. Afegir la columna
ALTER TABLE public.challenge_items
ADD COLUMN IF NOT EXISTS is_essential boolean NOT NULL DEFAULT false;

-- 2. Omplir el valor des de summits (join per nom)
UPDATE public.challenge_items ci
SET is_essential = s.esencial
FROM public.summits s
WHERE ci.name = s.name
  AND s.esencial IS NOT NULL;
