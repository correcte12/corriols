-- ============================================================
-- Corriols de l'Empordà — Fase 1: Sistema de retos
-- Ejecutar en: Supabase SQL Editor
-- ============================================================


-- ------------------------------------------------------------
-- 1. PROFILES
-- Extiende auth.users con datos públicos del usuario
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio         text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Trigger: crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- 2. CHALLENGES
-- Un reto puede ser de cualquier tipo de actividad
-- ------------------------------------------------------------
create table if not exists public.challenges (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  type            text not null,            -- senderisme, ciclisme, trail, etc.
  cover_image_url text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3. CHALLENGE_ITEMS
-- Elementos individuales dentro de un reto
-- Se pueden añadir en cualquier momento sin afectar progreso existente
-- ------------------------------------------------------------
create table if not exists public.challenge_items (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  name         text not null,
  description  text,
  item_order   integer not null default 0,  -- "order" es palabra reservada en SQL
  added_at     timestamptz not null default now()
);

create index if not exists challenge_items_challenge_id_idx
  on public.challenge_items(challenge_id);


-- ------------------------------------------------------------
-- 4. USER_CHALLENGES (inscripciones)
-- Un usuario se inscribe en un reto
-- ------------------------------------------------------------
create table if not exists public.user_challenges (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create index if not exists user_challenges_challenge_id_idx
  on public.user_challenges(challenge_id);


-- ------------------------------------------------------------
-- 5. USER_PROGRESS
-- Registro de elementos completados por un usuario
-- ------------------------------------------------------------
create table if not exists public.user_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  challenge_item_id uuid not null references public.challenge_items(id) on delete cascade,
  completed_at      timestamptz not null default now(),
  notes             text,
  unique (user_id, challenge_item_id)   -- un item solo se puede completar una vez por usuario
);

create index if not exists user_progress_user_id_idx
  on public.user_progress(user_id);
create index if not exists user_progress_item_id_idx
  on public.user_progress(challenge_item_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.challenges       enable row level security;
alter table public.challenge_items  enable row level security;
alter table public.user_challenges  enable row level security;
alter table public.user_progress    enable row level security;


-- PROFILES
-- Todos pueden ver perfiles (progreso público según AGENTS.md)
-- Solo el propio usuario puede editar el suyo
create policy "profiles: lectura pública"
  on public.profiles for select using (true);

create policy "profiles: inserción propia"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: edición propia"
  on public.profiles for update
  using (auth.uid() = id);


-- CHALLENGES
-- Todos pueden ver los retos activos
-- Solo admins crean/editan (por ahora: solo el created_by puede editar — revisar cuando haya rol admin)
create policy "challenges: lectura pública"
  on public.challenges for select using (is_active = true);

create policy "challenges: inserción autenticada"
  on public.challenges for insert
  with check (auth.uid() = created_by);

create policy "challenges: edición por creador"
  on public.challenges for update
  using (auth.uid() = created_by);


-- CHALLENGE_ITEMS
-- Visibles si el reto padre es visible
create policy "challenge_items: lectura pública"
  on public.challenge_items for select using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.is_active = true
    )
  );

create policy "challenge_items: inserción por creador del reto"
  on public.challenge_items for insert
  with check (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.created_by = auth.uid()
    )
  );


-- USER_CHALLENGES (inscripciones)
-- Cada usuario ve sus propias inscripciones; los rankings son públicos
create policy "user_challenges: lectura pública"
  on public.user_challenges for select using (true);

create policy "user_challenges: inscripción propia"
  on public.user_challenges for insert
  with check (auth.uid() = user_id);

create policy "user_challenges: baja propia"
  on public.user_challenges for delete
  using (auth.uid() = user_id);


-- USER_PROGRESS
-- El progreso es público (ranking), pero solo el propio usuario puede registrarlo
create policy "user_progress: lectura pública"
  on public.user_progress for select using (true);

create policy "user_progress: inserción propia"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "user_progress: eliminación propia"
  on public.user_progress for delete
  using (auth.uid() = user_id);
