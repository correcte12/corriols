-- ============================================================
-- Corriols — Afegir email a profiles + actualitzar trigger
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Actualitzar trigger per guardar email en registre
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$;

-- Backfill: omplir email dels usuaris existents des de auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
