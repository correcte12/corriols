-- ============================================================
-- Corriols — Afegir image_url, latitude, longitude a challenge_items
-- ============================================================

ALTER TABLE public.challenge_items
  ADD COLUMN IF NOT EXISTS image_url  text,
  ADD COLUMN IF NOT EXISTS latitude   numeric,
  ADD COLUMN IF NOT EXISTS longitude  numeric,
  ADD COLUMN IF NOT EXISTS wikiloc_url text;

UPDATE public.challenge_items ci
SET
  image_url   = s."imageUrl",
  latitude    = s.latitude,
  longitude   = s.longitude,
  wikiloc_url = s."wikilocUrl"
FROM public.summits s
WHERE ci.name = s.name;
