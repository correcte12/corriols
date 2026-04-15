-- ============================================================
-- Corriols — Afegir gpx_url a user_progress
-- ============================================================

ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS gpx_url text;

-- Política per actualitzar el progrés propi (per pujar el GPX)
DROP POLICY IF EXISTS "user_progress: actualització pròpia" ON public.user_progress;
CREATE POLICY "user_progress: actualització pròpia"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);
