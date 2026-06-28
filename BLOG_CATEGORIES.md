# Sistema de Categorías del Blog

## Descripción General
Sistema flexible para organizar artículos en categorías, permitiendo filtrar el blog por temática.

## Características

### 1. Gestión de Categorías
En la página de administración del blog (`/admin/blog`):
- **Crear categoría**: Botón "+ Nova categoria"
- **Editar categoría**: Icono de lápiz
- **Eliminar categoría**: Icono de cruz
- **Campos**:
  - Nom (obligatorio)
  - Descripció (opcional)
  - Color (selector de color, por defecto azul #3b82f6)

### 2. Asignar Categoría a Artículos
En el editor de artículos:
- Selector desplegable "Categoria"
- Opción "— Sense categoria —" para artículos sin categoría
- Se guarda en campo `category_id` de la tabla `articles`

### 3. Filtrar Artículos por Categoría
En la página pública del blog (`/blog`):
- Tabs/botones para cada categoría
- Botón "Tots" para ver todos los artículos
- Los botones llevan color de la categoría
- Al seleccionar una categoría, se recarga la lista de artículos

## Estructura en BD

### Tabla `blog_categories`
```sql
id (uuid, PK)
name (text) — nombre de la categoría
slug (text, unique) — versión URL-friendly
description (text, nullable) — descripción opcional
color (text) — código hexadecimal del color
created_at, updated_at
```

### Cambio en tabla `articles`
```sql
category_id (uuid, nullable, FK) — referencia a blog_categories
```

## Funciones en `blogStorage.js`

### `listCategories()`
```javascript
const categories = await listCategories()
// Retorna array de todas las categorías, ordenadas por nombre
```

### `createCategory(payload)`
```javascript
const category = await createCategory({
  name: 'Salud',
  description: 'Tips de salud y bienestar',
  color: '#10b981'
})
```

### `updateCategory(id, payload)`
```javascript
const updated = await updateCategory(categoryId, {
  name: 'Nuevonombre',
  description: '...',
  color: '#...'
})
```

### `deleteCategory(id)`
```javascript
await deleteCategory(categoryId)
// Los artículos quedan sin categoría (category_id = null)
```

### `listArticles({ publishedOnly, categoryId })`
```javascript
// Obtener artículos de una categoría
const articles = await listArticles({
  publishedOnly: true,
  categoryId: 'uuid-aqui'
})

// Obtener todos los artículos publicados (sin filtro)
const all = await listArticles({ publishedOnly: true })
```

## Flujo de Uso

### Para administradores:
1. Ir a `/admin/blog`
2. Crear categorías en sección "Categories"
3. Al editar/crear artículos, asignar categoría en selector

### Para visitantes:
1. Ir a `/blog`
2. Ver botones de categorías debajo del header
3. Click en categoría para filtrar artículos
4. Click en "Tots" para ver todos

## Notas Importantes

- **Compatible hacia atrás**: Artículos sin categoría siguen siendo visibles
- **Color personalizado**: Cada categoría tiene su color para diferenciarse
- **Slug único**: El sistema genera slugs únicos automáticamente
- **Eliminación segura**: Al eliminar una categoría, los artículos quedan sin categoría (no se eliminan)
- **Públicamente visible**: Las categorías solo se muestran si hay artículos publicados

## Extensiones Futuras

- [ ] Multi-categoría (un artículo en varias categorías)
- [ ] Categorías en el blog public (sidebar, navegación)
- [ ] Cloud de categorías
- [ ] Icono personalizado por categoría
- [ ] Subcategorías (jerarquía)

## Rollback (si es necesario)

Si necesitas deshacer:
```bash
git revert c356eba  # Revert del commit de categorías
supabase db reset   # Resetear BD a estado anterior
```

Pero recomendamos mantener la funcionalidad, ya que es no-destructiva.
