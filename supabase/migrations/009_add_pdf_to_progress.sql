-- ============================================================
-- Corriols — Afegir pdf_url a user_progress
-- ============================================================

ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS pdf_url text;
