# Documentación: Importación de Artículos Externos del Blog

## Descripción General
Sistema flexible para importar artículos de fuentes externas (como WordPress REST API) sin romper la estructura actual del blog.

## Características

### 1. Obtención de Artículos Externos
- **Movethera**: Función `listMovetheraArticles()` que obtiene posts de `https://movethera.com/wp-json/wp/v2/posts`
- Normaliza estructura WordPress → estructura local
- Fácil de extender a otros blogs

### 2. Importación en Admin
- Botón **"📥 Importar"** en la vista de lista de artículos
- Modal con vista previa de artículos externos
- Seleccionar artículos individuales o todos
- Importar como **DRAFT** (sin publicar automáticamente)

### 3. Estructura de Datos
Los artículos importados se guardan en Supabase como artículos normales:
- `title`: Título del artículo
- `excerpt`: Resumen (primeros 200 caracteres del contenido)
- `body`: Contenido completo (HTML)
- `cover_url`: Imagen destacada
- `original_author`: Autor original
- `source_url`: Enlace a la publicación original
- `published`: `false` (siempre como DRAFT)
- `published_at`: `null` (se actualiza al publicar)

### 4. Flujo de Trabajo

```
1. Ir a "Gestionar blog" → pestaña artículos
2. Click en botón "📥 Importar"
3. Seleccionar fuente (Movethera, etc.)
4. Ver vista previa de artículos
5. Seleccionar cuáles importar
6. Click "Importar"
7. Artículos aparecen como DRAFT
8. Revisar, editar y publicar en el editor
```

### 5. Funciones en `blogStorage.js`

#### `listMovetheraArticles()`
```javascript
Obtiene artículos de Movethera
@returns {Array} Array de artículos normalizados
```

#### `importExternalArticle(externalArticle, authorId)`
```javascript
Importa un artículo externo como DRAFT
@param {Object} externalArticle - Artículo con estructura externa
@param {string} authorId - ID del usuario que importa
@returns {Object} Artículo creado con estructura local
```

## Componentes

### `ImportArticlesModal.jsx`
Modal interactivo para seleccionar y importar artículos:
- Selector de fuente (extensible)
- Lista con checkboxes
- Seleccionar todos / desseleccionar
- Barra de progreso durante importación
- Manejo de errores

### `ImportArticlesModal.css`
Estilos para el modal responsive

## Extensión: Agregar Nuevas Fuentes

Para agregar un nuevo blog/fuente:

1. **En `blogStorage.js`**, crear nueva función:
```javascript
export const listNewBlogArticles = async () => {
  const response = await fetch('https://example.com/api/posts')
  const posts = await response.json()
  return posts.map(post => ({
    id: `newblog-${post.id}`,
    title: post.title,
    // ... mapear resto de campos
    source_type: 'newblog',
  }))
}
```

2. **En `ImportArticlesModal.jsx`**, agregar a `SOURCES`:
```javascript
const SOURCES = [
  { id: 'movethera', name: 'Movethera', fetcher: listMovetheraArticles },
  { id: 'newblog', name: 'New Blog', fetcher: listNewBlogArticles },
]
```

## Notas Importantes

- Los artículos importados **siempre se crean como DRAFT**
- El usuario debe revisar y editar antes de publicar
- Se mantiene referencia a la fuente original en `source_url`
- Fácil deshacer: simplemente eliminar el artículo como borrador
- Compatible con la estructura actual del blog

## Estado

- [x] Función `listMovetheraArticles()`
- [x] Función `importExternalArticle()`
- [x] Componente `ImportArticlesModal`
- [x] Integración en `BlogAdminPage`
- [x] Documentación
- [ ] Agregar más fuentes (Facebook posts, Medium, etc.)
- [ ] Caché de artículos (evitar re-fetch de los mismos)
- [ ] Programar importación automática
