# Base de dades — Esquema i migracions

Totes les migracions estan a `supabase/migrations/` i s'executen manualment al SQL Editor de Supabase.

---

## Taules

### `profiles`
Estén `auth.users` amb dades públiques. Es crea automàticament via trigger quan es registra un usuari.

| Columna | Tipus | Notes |
|---|---|---|
| `id` | uuid PK | → `auth.users.id` |
| `display_name` | text | |
| `bio` | text | |
| `avatar_url` | text | |
| `created_at` | timestamptz | |

**Nota important:** `AuthContext.jsx` fa un `upsert` de `profiles` en cada login (`ensureProfile`) per evitar errors de FK quan l'usuari s'inscriu a un repte abans que el trigger hagi creat el perfil.

---

### `challenges`
Un repte (100 Cims, Pirineus, etc.)

| Columna | Tipus | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `description` | text | |
| `type` | text | senderisme, ciclisme, trail... |
| `cover_image_url` | text | |
| `is_active` | boolean | default true |
| `created_by` | uuid | → `profiles.id` |
| `created_at` | timestamptz | |

---

### `challenge_items`
Ítems individuals d'un repte (cims, trams, etc.)

| Columna | Tipus | Notes |
|---|---|---|
| `id` | uuid PK | |
| `challenge_id` | uuid | → `challenges.id` |
| `name` | text | |
| `description` | text | |
| `item_order` | integer | |
| `is_essential` | boolean | Afegit migració 004 |
| `height_meters` | integer | Afegit migració 005 |
| `image_url` | text | Afegit migració 006 |
| `latitude` | numeric | Afegit migració 006 |
| `longitude` | numeric | Afegit migració 006 |
| `wikiloc_url` | text | Afegit migració 006 |
| `added_at` | timestamptz | |

---

### `user_challenges`
Inscripció d'un usuari a un repte. PK composta `(user_id, challenge_id)`.

| Columna | Tipus | Notes |
|---|---|---|
| `user_id` | uuid | → `profiles.id` |
| `challenge_id` | uuid | → `challenges.id` |
| `enrolled_at` | timestamptz | |

---

### `user_progress`
Cada ítem completat per un usuari. Unique `(user_id, challenge_item_id)`.

| Columna | Tipus | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | → `profiles.id` |
| `challenge_item_id` | uuid | → `challenge_items.id` |
| `completed_at` | timestamptz | |
| `notes` | text | Comentari de la sortida |
| `wikiloc_url` | text | Afegit migració 007 |
| `distance_km` | numeric(6,2) | Afegit migració 007 |
| `elevation_gain` | integer | Afegit migració 007 |
| `gpx_url` | text | Afegit migració 008 — URL signada Storage |
| `pdf_url` | text | Afegit migració 009 — URL signada Storage |

---

## Migracions

### 001 — Esquema base + RLS
Crea totes les taules, índexs, trigger de profiles i polítiques RLS.

**RLS highlights:**
- `profiles`: lectura pública; insert/update solo propietari
- `challenges`: lectura pública (is_active=true); write per creador
- `challenge_items`: lectura pública; write per creador del repte
- `user_challenges`: lectura pública; insert/delete per propietari
- `user_progress`: lectura pública; insert/delete per propietari

### 002 — Seed 100 Cims
CTE que crea el repte "100 Cims" i insereix els 528 ítems des de `summits`.

### 003 — Migra progrés d'usuaris existents
Inscriu els 4 usuaris existents i migra els cims pujats des de `user_summits`.

### 004 — Camp `is_essential`
Afegeix `is_essential boolean` a `challenge_items` i el omple fent JOIN amb `summits.esencial`.
156 cims marcats com a essencials.

### 005 — Camp `height_meters`
Afegeix `height_meters integer` a `challenge_items` i el omple des de `summits.height`.

### 006 — Camps coords + imatge
Afegeix `image_url`, `latitude`, `longitude`, `wikiloc_url` a `challenge_items`
i els omple des de les columnes equivalents de `summits`.

### 007 — Camps addicionals a `user_progress`
Afegeix `wikiloc_url`, `distance_km`, `elevation_gain` per registrar dades de cada sortida.

### 008 — Camp `gpx_url` a `user_progress`
Afegeix `gpx_url text` per guardar la URL signada del fitxer GPX pujat a Storage.
Afegeix política RLS `UPDATE` a `user_progress` per al propietari.

### 009 — Camp `pdf_url` a `user_progress`
Afegeix `pdf_url text` per guardar la URL signada del PDF de documentació de la ruta.

---

## Errors resolts

**FK violation en inscriure's** (`user_challenges_user_id_fkey`):
El trigger de profiles no s'executava en alguns casos. Solució: afegir política
`INSERT` a `profiles` + `ensureProfile` upsert a `AuthContext.jsx`.

**Columnes numèriques retornen string**:
Supabase retorna `numeric` com a string. Solució: `parseFloat(r.distance_km) || 0`
i `parseInt(r.elevation_gain) || 0` al RankingPage.

**`CREATE POLICY IF NOT EXISTS` no existeix en PostgreSQL**:
Solució: `DROP POLICY IF EXISTS ... ON ...` seguit de `CREATE POLICY`.
