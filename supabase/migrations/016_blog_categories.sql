-- Crear tabla de categorías del blog
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Agregar columna category_id a articles (nullable para compatibilidad hacia atrás)
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS articles_category_id_idx ON public.articles(category_id);

-- Políticas de RLS (permitir lectura pública, escritura solo para autenticados)
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_categories_read_all"
ON public.blog_categories
FOR SELECT
USING (true);

CREATE POLICY "blog_categories_insert_authenticated"
ON public.blog_categories
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "blog_categories_update_authenticated"
ON public.blog_categories
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "blog_categories_delete_authenticated"
ON public.blog_categories
FOR DELETE
USING (auth.role() = 'authenticated');
