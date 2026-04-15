# Corriols de l'Empordà — AGENTS.md

Plataforma local de reptes i activitats esportives de l'Empordà.
Proyecto personal de aprendizaje: vibe coding + IA (Claude Code).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend / DB | Supabase (proyecto existente, compartido con mis-montanas) |
| Hosting | Netlify → dominio corriolsdelemporda.com |
| Control de versiones | GitHub (repo independiente: `corriols`) |
| Idioma UI | Bilingüe: catalán + castellano |

---

## Alcance del proyecto

Plataforma de comunidad deportiva local orientada al Empordà que permite:
- Gestionar retos de cualquier tipo de actividad (senderismo, ciclismo, trail, rutas, etc.)
- Seguir el progreso personal en cada reto
- Interactuar con otros usuarios de la comunidad
- Participar en un foro temático

No tiene publicidad. Es un proyecto local y de aprendizaje.

---

## Funcionalidades planificadas (por fases)

### Fase 1 — Sistema de retos (prioridad)
- [ ] Modelo de datos genérico: `challenges`, `challenge_items`, `user_challenges`, `user_progress`
- [ ] Perfil de usuario básico (`profiles`)
- [ ] Listado de retos disponibles
- [ ] Detalle de reto con sus elementos
- [ ] Inscripción de usuario en un reto
- [ ] Registro de progreso por elemento
- [ ] Ranking por reto
- [ ] Admin: crear reto, añadir items, gestionar inscripciones
- [ ] Migración de datos actuales (100 cims → primer reto)

### Fase 2 — Perfiles de usuario
- [ ] Perfil completo: foto, nombre, bio
- [ ] Vista pública del perfil de un usuario
- [ ] En el perfil: lista de retos en los que está inscrito y su progreso

### Fase 3 — Social / Comentarios
- [ ] Comentarios en retos (nivel reto)
- [ ] Comentarios en elementos concretos (nivel item)
- [ ] Reacciones al progreso de otros usuarios

### Fase 4 — Foro
- [ ] Categorías y temas
- [ ] Hilos y respuestas
- [ ] Moderación desde el panel de admin

### Fase 5 — Polish
- [ ] Notificaciones
- [ ] Feed de actividad
- [ ] Estadísticas avanzadas por usuario y por reto

---

## Decisiones técnicas tomadas

- **Supabase**: se reutiliza el proyecto existente de mis-montanas. Las tablas nuevas no tocan las actuales (`summits`, `user_summits`). La app mis-montanas sigue funcionando en paralelo durante el desarrollo.
- **Netlify**: mismo flujo de trabajo que mis-montanas. El dominio corriolsdelemporda.com apuntará a Netlify.
- **Retos dinámicos**: los `challenge_items` se pueden añadir en cualquier momento sin afectar el progreso ya registrado (caso de uso: Repte Dr. Soler, que añade un recorrido cada mes).
- **Visibilidad**: el progreso de cada usuario es público.
- **Admin**: solo el admin crea retos e items. Los usuarios solo se inscriben y registran progreso.
- **VPS**: si la app escala, se migrará a un VPS propio. Por ahora, Netlify.

---

## Modelo de datos (Fase 1)

```
profiles
  - id (uuid, FK auth.users)
  - display_name
  - bio
  - avatar_url
  - created_at

challenges
  - id
  - name
  - description
  - type (senderisme, ciclisme, trail...)
  - cover_image_url
  - is_active
  - created_by (admin)
  - created_at

challenge_items
  - id
  - challenge_id (FK challenges)
  - name
  - description
  - order
  - added_at

user_challenges (inscripción)
  - user_id (FK profiles)
  - challenge_id (FK challenges)
  - enrolled_at

user_progress
  - id
  - user_id
  - challenge_item_id (FK challenge_items)
  - completed_at
  - notes
```

---

## Relación con mis-montanas

La app `mis-montanas` (repo land-page, subfolder mis-montanas) sigue activa.
Los datos de las 100 cimes se migrarán como primer reto en Corriols cuando la Fase 1 esté lista.
Las tablas `summits` y `user_summits` de Supabase se mantienen hasta completar la migración.

---

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## Historial de sesiones

| Fecha | Resumen |
|---|---|
| 2026-04-15 | Definición del alcance completo, decisiones técnicas, creación del repo |
