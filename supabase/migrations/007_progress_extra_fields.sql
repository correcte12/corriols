-- ============================================================
-- Corriols — Afegir camps addicionals a user_progress
-- ============================================================

ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS wikiloc_url    text,
  ADD COLUMN IF NOT EXISTS distance_km   numeric(6,2),
  ADD COLUMN IF NOT EXISTS elevation_gain integer;
