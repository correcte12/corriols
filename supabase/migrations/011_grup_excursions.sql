-- Taula per guardar les excursions del grup de dijous
CREATE TABLE IF NOT EXISTS public.grup_excursions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data        date NOT NULL,
  destino     text NOT NULL,
  km          numeric(8,2) NOT NULL DEFAULT 0,
  conductors  text[] NOT NULL DEFAULT '{}',  -- array de user ids
  passatgers  text[] NOT NULL DEFAULT '{}',  -- array de user ids
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: lectura pública (dins de l'app ja tenim auth pròpia)
ALTER TABLE public.grup_excursions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grup_excursions: lectura pública" ON public.grup_excursions;
CREATE POLICY "grup_excursions: lectura pública"
  ON public.grup_excursions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "grup_excursions: inserció autenticada" ON public.grup_excursions;
CREATE POLICY "grup_excursions: inserció autenticada"
  ON public.grup_excursions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "grup_excursions: actualització autenticada" ON public.grup_excursions;
CREATE POLICY "grup_excursions: actualització autenticada"
  ON public.grup_excursions FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "grup_excursions: eliminació autenticada" ON public.grup_excursions;
CREATE POLICY "grup_excursions: eliminació autenticada"
  ON public.grup_excursions FOR DELETE
  USING (true);
