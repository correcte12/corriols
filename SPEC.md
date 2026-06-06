# GPX Manager — Especificaciones del proyecto

## Visión general

Herramienta web personal para trabajar con rutas GPX de forma puntual: subir, visualizar, comparar y editar ficheros GPX de senderismo/trail, y descargar el resultado. Las rutas **no se persisten en servidor** — todo ocurre en memoria del navegador. Sustituto de herramientas de pago como Plotaroute.

Se integra dentro del proyecto existente **corriols** (`github.com/correcte12/corriols`).

**Stack:** Vite + React + Tailwind CSS *(sin TypeScript — el proyecto usa .jsx)*
**Mapa:** Leaflet + OpenStreetMap *(ya instalados en corriols)*
**Uso:** Personal, un solo usuario
**Persistencia:** Ninguna — los ficheros GPX se procesan en memoria y se descargan. Si se cierra el navegador, se pierde el trabajo.

---

## Estado de implementación

### ✅ Fase 1 — MVP (completada)

- Subir ficheros GPX con drag & drop (react-dropzone)
- Listar rutas cargadas con nombre, distancia y controles
- Ver ruta individual en mapa con perfil de elevación (recharts)
- Comparar rutas: superposición en mapa, cada una con color distinto
- Toggle visibilidad por ruta
- Descarga del GPX original por ruta
- Estadísticas completas: distancia, desnivel+/−, alt. máx/mín, nº puntos
- Acceso protegido por login (AuthContext de corriols)
- Enlace "Eines GPX" en navbar (solo usuarios logueados)

### ✅ Fase 3 — Nuevas herramientas de edición (completada)

- **Dividir ruta en dos**: clic en el mapa marca el punto de corte; preview azul/rojo de las dos partes; descarga directa de ambos GPX
- **Simplificar track (RDP)**: algoritmo Ramer-Douglas-Peucker sin dependencias; 4 presets (2/5/10/20m) + slider 1-50m; preview en tiempo real sobre el mapa con conteo original/resultado/reducción%; entra al historial de deshacer
- **Corregir elevaciones**: API Open-Meteo SRTM (CORS abierto, sin API key); simplificación automática a 10m antes de consultar para reducir peticiones; interpolación de elevaciones de vuelta a puntos originales; barra de progreso; tabla diff antes/después (desnivel+/−, alt máx/mín); se guarda automáticamente en sesión al aplicar

### ✅ Fase 2 — Edición de rutas (completada)

- **Recortar tramo**: 2 clics en el mapa marcan inicio (verde) y fin (rojo); el tramo seleccionado se muestra en naranja; botón "Aplicar retall" confirma
- **Unir rutas**: concatena los puntos de otra ruta cargada en sesión al final de la actual
- **Invertir ruta**: invierte el orden del track
- **Eliminar puntos anómalos**: filtrado estadístico (mean + 3σ) con umbral por distancia a vecinos
- **Editar metadatos**: nombre, descripción y fecha
- **Exportar GPX**: genera XML GPX 1.1 válido y lanza descarga en el navegador
- **Historial deshacer**: cada operación es reversible con "Desfer última acció"
- **Recálculo de stats**: al guardar, distancia/desnivel se recalculan con los puntos editados
- **Reencuadre automático**: el mapa se ajusta al nuevo track tras cada edición
- Cursor crosshair en modo recorte

### ❌ Fuera de alcance (descartado)

- **Mover puntos**: arrastrar puntos individuales del track en el mapa

---

## Lo que ya existe en corriols y se reutiliza

| Recurso | Fichero | Notas |
|---------|---------|-------|
| Parseo GPX | `src/lib/gpxParser.js` | Extendido con `parseGpxFull()` y `calcStatsFromPoints()` |
| Leaflet + react-leaflet | `package.json` | v1.9.4 / v5.0.0 |
| react-router-dom | `package.json` | v7.5.1 |
| AuthContext | `src/context/AuthContext.jsx` | Protege `/gpx` y `/gpx/editar/:id` |

**No se usa Supabase en este módulo.** Sin base de datos, sin Storage, sin autenticación propia.

---

## Dependencias añadidas

```bash
npm install recharts react-dropzone
```

| Librería | Uso |
|----------|-----|
| `recharts` | Perfil de elevación (gráfica altitud vs distancia) |
| `react-dropzone` | Subida de ficheros con drag & drop |

---

## Estructura de ficheros del módulo GPX

```
src/
├── components/
│   ├── gpx/
│   │   ├── GpxMapView.jsx           # Mapa Leaflet con FitBounds reactivo
│   │   ├── GpxTrackLayer.jsx        # Polyline con color configurable + tooltip
│   │   ├── GpxElevationProfile.jsx  # Gráfica recharts, una línea por ruta visible
│   │   ├── GpxStatsPanel.jsx        # Panel de 6 métricas de la ruta seleccionada
│   │   ├── GpxUploader.jsx          # Drag & drop, solo acepta .gpx
│   │   └── GpxComparePanel.jsx      # Lista de rutas: toggle, editar, descargar, eliminar
│   └── edit/
│       ├── GpxEditToolbar.jsx       # 5 botones de herramienta con estado activo
│       ├── GpxTrimTool.jsx          # Captura clics en mapa, muestra marcadores y tramo
│       ├── GpxMergePanel.jsx        # Lista otras rutas en sesión para concatenar
│       └── GpxMetadataEditor.jsx    # Campos nombre, descripción, fecha
├── hooks/
│   ├── useGpxSession.jsx            # Context global: addRoutes, removeRoute, updateRoute,
│   │                                #   toggleVisibility, clearAll
│   └── useMapColors.js              # Paleta de 6 colores con asignación por ID
├── lib/
│   ├── gpxParser.js                 # parseGpxFull(), calcStatsFromPoints() (extensiones)
│   ├── gpxExporter.js               # buildGpxXml(), downloadGpx()
│   └── gpxEditor.js                 # trimTrack(), mergeRoutes(), reverseTrack(),
│                                    #   cleanAnomalies(), findNearestPointIndex()
└── pages/
    ├── GpxToolPage.jsx              # /gpx — layout mapa 70% + panel 30%
    └── GpxEditPage.jsx              # /gpx/editar/:id — edición con historial
```

---

## Rutas React Router

```jsx
<Route path="/gpx"              element={<GpxToolPage />} />
<Route path="/gpx/editar/:id"   element={<GpxEditPage />} />
```

Ambas rutas protegidas: redirigen a `/login` si no hay sesión activa.

El `GpxSessionProvider` vive en `App.jsx` y envuelve todo el árbol, de modo que las rutas cargadas en `/gpx` persisten al navegar a `/gpx/editar/:id` y viceversa.

---

## Estado en memoria — useGpxSession

```javascript
// Estructura de cada ruta en memoria:
{
  id: string,          // crypto.randomUUID()
  name: string,
  fileName: string,    // nombre original del fichero .gpx
  points: [{ lat, lon, ele, time }],
  latLngs: [[lat, lon], ...],
  stats: {
    distanceKm,
    elevationGain,
    elevationLoss,
    maxElevation,
    minElevation,
    pointCount,
  },
  bounds: [[minLat, minLng], [maxLat, maxLng]],
  rawXml: string,      // XML original para descarga
  color: string,       // color asignado de la paleta
  visible: boolean,
  // campos opcionales tras editar metadatos:
  description: string,
  date: Date | null,
}
```

---

## Paleta de colores

```javascript
const COLORS = [
  '#E63946',  // rojo
  '#2196F3',  // azul
  '#4CAF50',  // verde
  '#FF9800',  // naranja
  '#9C27B0',  // morado
  '#00BCD4',  // cian
]
```

---

## Mòdul Dijous d'Excursió (`/excursions`)

Seguiment de rotació de vehicles per al grup d'excursionisme. Persistència a Supabase (taula `grup_excursions`). Accés protegit per contrasenya local (no usa AuthContext de corriols).

### Usuaris

IDs: `carlosm`, `carlosj`, `antonio`, `diego`, `luisp`, `juanitog`

### Model de saldos (km·passatger)

- Cada **conductor** suma `km × nº passatgers que porta al cotxe`
- Cada **assistent** (conductor o passatger) resta `km`
- El resultat net: passatgers acumulen saldo negatiu, conductors acumulen saldo positiu proporcional a quant han conduit

### Designació de conductors

Els conductors suggerits per a la propera sortida s'escullen per **ràtio normalitzat** = `saldo_brut / nº_sortides`, no per saldo brut. Evita penalitzar els qui vénen menys sovint.

### Estructura de cada registre a Supabase

```json
{
  "data": "2025-03-06",
  "destino": "Pic de Canigó",
  "km": 180,
  "conductors": ["carlosm", "carlosj"],
  "passatgers": ["antonio", "diego"],
  "notes": "Bon temps"
}
```

### Importació de dades

Per importar moviments existents: CSV o JSON amb els camps anteriors. Els IDs de passatgers/conductors han de coincidir exactament amb els IDs d'usuari definits.

---

## Mòdul Blog (`/blog`)

Blog **natiu** integrat a corriols (no WordPress). Pensat per publicar articles útils per al grup (sovint adaptats de publicacions de Facebook, amb permís i crèdit a l'autor original). Decisió presa amb l'usuari: blog propi sobre Supabase reaprofitant l'auth, la BD i el Storage existents, en lloc d'afegir un segon sistema (WordPress).

### Rutes

```jsx
<Route path="/blog" element={<BlogPage />} />            // llista pública (3 columnes)
<Route path="/blog/:slug" element={<ArticlePage />} />   // article públic
<Route path="/admin/blog" element={<BlogAdminPage />} /> // gestió (protegit per login)
```

`/admin/blog` redirigeix a `/login` si no hi ha sessió (mateix patró que la resta). Enllaç **"Blog"** públic a la navbar.

### Base de dades — taula `articles` (Supabase)

```sql
create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  body text not null,                 -- HTML net de l'editor
  cover_url text,
  original_author text,               -- autor original (Facebook)
  source_url text,                    -- enllaç a la publicació original
  published boolean default false,
  published_at timestamptz default now(),  -- data editable (mostrada i ordre)
  author_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table articles enable row level security;
create policy "public read published" on articles for select using (published = true);
create policy "auth manage" on articles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

**Storage:** bucket `blog` (públic) per a portades i imatges del cos. Polítiques: `insert/update/delete` per a `authenticated`, `select` per a `public`. Nom configurable amb `VITE_SUPABASE_BLOG_BUCKET` (per defecte `blog`).

### Editor (Tiptap v3)

`src/components/blog/ArticleEditor.jsx` — WYSIWYG amb StarterKit + Image. Emet HTML; es renderitza amb **DOMPurify**.

> ⚠️ Tiptap **v3**: `setContent(content, { emitUpdate: true })` (NO la signatura v2 `setContent(content, true)`).

**Netejador de pegat de Facebook** (`cleanPastedHtml`) — la part més iterada. Facebook embolcalla cada línia en **divs imbricats** (`<div><div dir="auto">…</div></div>`) i posa les icones com a **emojis-imatge** (`<img src=".../emoji.php/.../2714.png">`), sovint amb `alt` buit. Estratègia robusta:

1. **`extractLines()`** recorre qualsevol estructura HTML i n'extreu les línies de text (cada bloc i `<br>` trenca línia), convertint els emojis-imatge al seu caràcter.
2. **`emojiFromImg()`**: usa l'`alt`; si falta, reconstrueix el caràcter des del codi del nom de fitxer de FB (`2714.png` → ✔, `274c.png` → ❌, `26a1.png` → ⚡).
3. Reconstrueix `<p>` nets: línies de guions → `<hr>`; emoji en línia pròpia → es fusiona amb el text següent; línies que comencen per `✔ ❌ •…` es marquen amb `data-marker` per indentar-les com a ítems de llista mantenint el símbol.

El `data-marker` als paràgrafs sobreviu al desar/recarregar gràcies a una extensió `MarkerParagraph` (Tiptap esborra classes/atributs no declarats). Hi ha un botó manual **🧹** que aplica el netejador sobre el contingut actual (i recupera el cas d'HTML enganxat com a text literal).

*Compromís:* el netejador reconstrueix des del text, així que **es perd negreta/cursiva** del pegat (els posts de FB gairebé mai en porten); es pot reaplicar amb la barra d'eines.

### Pàgines

| Fitxer | Funció |
|--------|--------|
| `src/lib/blogStorage.js` | CRUD (`listArticles`, `getArticleBySlug/ById`, `create/update/deleteArticle`, `setArticlePublished`), slugs únics, `uploadBlogImage` |
| `src/pages/BlogPage.jsx` | Llista pública en graella de **3 columnes** (2 a ≤900px, 1 a ≤600px) |
| `src/pages/ArticlePage.jsx` | Article + crèdit a l'autor original; portada que **no s'amplia mai** (`max-height: 420px`, `width:auto`) per evitar pixelació d'imatges de baixa resolució |
| `src/pages/BlogAdminPage.jsx` | Vista llista + editor a amplada completa (estil WordPress): títol gran, contingut, i panell lateral amb resum, **data de publicació**, portada i crèdit |
| `src/components/blog/BlogCarousel.jsx` | Carrusel a la portada amb els **últims 3 articles** publicats + enllaç "Veure tot el blog"; no es mostra si no hi ha articles |

### Crèdit a l'autor

Cada article mostra al final *"Article original de **[autor]** — veure la publicació original"* (camps `original_author` + `source_url`) i una nota que el contingut es publica amb permís.

### Dependències afegides

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image dompurify
```

---

## Pendiente / Fase 3

### Bugs / mejoras conocidas de baja prioridad

1. **Cursor en modo recorte sobre el panel lateral** — el cursor crosshair se aplica al contenedor del mapa pero no desaparece si el ratón sale del mapa hacia el panel. Cosmético.

2. **`rawXml` no se actualiza tras editar** — el botón "Descargar" en `/gpx` (GpxComparePanel) descarga el XML original, no el editado. Para descargar el resultado editado hay que usar el botón de `/gpx/editar/:id`. Solución: regenerar `rawXml` con `buildGpxXml` al hacer `updateRoute`.

3. **Sin confirmación al salir con cambios pendientes** — si el usuario navega fuera de `/gpx/editar/:id` con cambios no guardados, los pierde sin aviso.

---

### Fase 4 — Nuevas herramientas de edición (ideas para el futuro)

#### 4A — Dividir ruta en dos

Inverso del merge: marcar un punto del track y partir el GPX en dos ficheros descargables de forma independiente. Útil cuando se ha grabado ida+vuelta en un solo fichero.

**UX:** mismo mecanismo que el recorte (clic en el mapa para marcar el punto de corte). Genera dos botones de descarga: "Descarregar part 1" y "Descarregar part 2". Opcionalmente añade ambas partes a la sesión como rutas separadas.

**Implementación:** nueva función `splitTrack(points, idx)` en `gpxEditor.js` que devuelve `[points.slice(0, idx+1), points.slice(idx)]`. Nueva herramienta en `GpxEditToolbar` + panel de confirmación en `GpxEditPage`.

---

#### 4B — Simplificar track (Ramer-Douglas-Peucker)

Reducir el número de puntos del track sin perder la forma de la ruta. Útil para GPX con >5000 puntos que superan límites de otras plataformas (Strava, Garmin Connect, etc.).

**UX:** slider de tolerancia (epsilon) en metros con preview en tiempo real del número de puntos resultante. Valores sugeridos: 2m / 5m / 10m / 20m. El track simplificado se muestra en el mapa superpuesto al original para comparar.

**Implementación:** algoritmo RDP puro en `gpxEditor.js` (sin dependencias externas). Solo se simplifica para la descarga, no afecta a los puntos en memoria de la sesión salvo que el usuario confirme.

```javascript
// Firma propuesta en gpxEditor.js
export const simplifyTrack = (points, epsilonMeters) => { ... }
```

---

#### 4C — Corregir elevaciones vía Open-Meteo

Reemplazar los datos de elevación GPS (ruidosos, error típico 20-30m) con datos de un DEM (modelo de elevación digital) via API gratuita. Los desniveles calculados quedan mucho más limpios y fiables.

**API:** [Open-Topo-Data](https://www.open-topo-data.com/) — gratuita, sin API key, soporta hasta 100 puntos por petición.

**UX:** botón "Corregir elevacions" en el toolbar de edición. Muestra spinner mientras se hacen las peticiones. Al terminar, el perfil de elevación se actualiza y se muestra un diff: `"Desnivell abans: 920m+ / després: 780m+"`.

**Implementación:**

- Nueva función `fetchElevations(points)` en un nuevo fichero `src/lib/elevationApi.js`
- Divide los puntos en lotes de 100, hace peticiones en paralelo con `Promise.all`
- Retorna un nuevo array de puntos con `ele` corregido
- Dataset recomendado: `srtm30m` (cobertura global, 30m resolución)

```javascript
// src/lib/elevationApi.js
const BATCH_SIZE = 100
const API_URL = 'https://api.open-topo-data.com/v1/srtm30m'

export const fetchElevations = async (points) => { ... }
```

**Consideraciones:**
- La API tiene rate limiting (~1 req/s en el plan público). Con lotes de 100 y `Promise.all` limitado a 3 concurrentes debería ser suficiente para rutas de hasta 3000 puntos en <10s.
- Si la API falla, mantener las elevaciones originales y mostrar error.

---

### Fase 5 — Waypoints con foto *(fuera de alcance por ahora)*

- Añadir waypoints (`<wpt>`) con coordenadas, nombre y foto adjunta
- Visualización en el mapa como marcadores diferenciados
- Exportación incluyendo waypoints en el GPX
