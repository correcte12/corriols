-- Agregar campos para guardar subtotales de los 3 métodos de cálculo
ALTER TABLE public.grup_excursions
  ADD COLUMN IF NOT EXISTS subtotal_variant1 jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtotal_variant2 jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtotal_variant3 jsonb DEFAULT NULL;

-- Comentario de documentación
COMMENT ON COLUMN public.grup_excursions.subtotal_variant1 IS 'Saldos acumulados (Variante 1: Deuta de Quilòmetres)';
COMMENT ON COLUMN public.grup_excursions.subtotal_variant2 IS 'Saldos acumulados (Variante 2: Consumo de Plazas)';
COMMENT ON COLUMN public.grup_excursions.subtotal_variant3 IS 'Saldos acumulados (Variante 3: Consumo + Ratio Asistencia)';
