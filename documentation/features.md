# Funcionalitats implementades

---

## 1. Autenticació
- Login/logout via Supabase Auth (`/login`)
- `AuthContext.jsx` exposa `user`, `signOut`
- `ensureProfile`: upsert automàtic de `profiles` en cada login per evitar errors de FK

---

## 2. Pàgina d'inici (`/`)
- Hero de 72vh amb imatge de muntanya (Unsplash)
- Navbar transparent sobre el hero, verda i fixa en scroll
- Grid de cards de reptes amb:
  - Progrés de l'usuari (barra + X/N ítems)
  - Badge "Inscrit" si l'usuari participa

---

## 3. Detall del repte (`/reto/:id`)

### Hero
280px d'alçada amb gradient i botons d'acció (inscriure's / ranquing).

### Mapa de cims
Toggle de mapa interactiu (react-leaflet, lazy load).
- Marcadors circulars: **verd** = completat, **marró** = essencial pendent, **blau** = pendent
- Centre: [42.25, 3.0], zoom 9

### Filtres
- Cerca per nom
- Alçada: Tots / 0-500m / 500-1000m / 1000-2000m / 2000m+
- Toggle "Només essencials"
- Toggle "Fets" (només mostra els cims completats per l'usuari; visible si inscrit)

### Grid de cims
Cards amb imatge lazy-load, badge "Essencial", alçada, estat (fet/pendent) i badge "GPX" si té traça pujada.

### Modal de progrés (700px ample, layout 2 columnes)
En clicar un cim: modal amb camps:
- **Comentaris** (amplada completa)
- **URL Wikiloc** + **Traça GPX** (fila de 2 columnes)
- **Documentació PDF** (amplada completa)
- **Distància (km)** + **Desnivell (m)** (fila de 2 columnes, s'omplen automàticament en seleccionar GPX)
- Botó "Desmarcar" (perill) i "Marcar / Actualitzar" (verd)

**Auto-càlcul des del GPX**: en seleccionar un fitxer `.gpx`, el parser extreu els `trkpt` i calcula:
- Distància acumulada (Haversine entre punts consecutius)
- Desnivell positiu acumulat (suma de `<ele>` creixents)

**Veure traça**: si ja hi ha un GPX pujat, apareix el botó "Veure traça" que mostra un mapa Leaflet inline.

---

## 4. Classificació (`/ranking/:id`)

- Cards d'estadístiques: usuaris inscrits, usuaris actius, total cims pujats
- Ordenació per: Cims / Distància / Desnivell
- Taula amb medalles (or/plata/bronze) per als top 3
- Indicador "(tu)" per a l'usuari actual
- **Nota:** Supabase retorna `numeric` com a string → cal `parseFloat` / `parseInt`

---

## 5. Navbar i Layout
- Navbar fixa (`position: fixed`, z-index 100, alçada 56px)
- En ruta `/`: variant transparent (`navbar-transparent`) amb gradient fosc
- Logo + text "Corriols de l'Empordà"
- Links: Reptes, Galeria, El meu perfil (si autenticat), Admin (si autenticat), icones Wikiloc + Instagram
- `main-content`: `padding-top: calc(56px + 2rem)`, max-width 900px
- En ruta `/`: `full-width` (sense padding, sense max-width) per al hero

---

## 6. Footer
Peu de pàgina en gradient verd fosc (#2f5d50 → #1e3d34), 3 columnes:
- **Marca**: logo + tagline
- **Comunitat**: Reptes actius, Galeria, El meu progrés (links reals)
- **Suport**: Ajuda, Privacitat, Contacte (placeholder)
- Barra inferior: copyright + links Wikiloc i Instagram amb icones

---

## 7. Galeria de fotos

### Galeria pública (`/galeria` i `/galeria/:albumSlug`)
- Grid d'àlbums amb portada, títol i nombre de fotos
- Vista de fotos en disposició masonry (1-3 columnes responsive)
- Fotos obertes en pestanya nova (URL original)
- Botó "Gestionar galeria" per a usuaris autenticats

### Administració galeria (`/admin/galeria`)
- **Crear àlbum**: formulari amb preview del slug
- **Llistat d'àlbums**: selecció, comptador de fotos, botó eliminar
- **Zona de pujada drag & drop**: arrossegar fitxers o clicar per seleccionar
  - Validació de mida (màx. 12 MB per defecte via `VITE_GALLERY_MAX_FILE_MB`)
  - Cua de pujada amb preview, estat i mida optimitzada
  - Optimització automàtica a WebP (via `imageOptimizer.js`)
- **Grid de fotos existents**: hover per veure accions (marcar portada ★, eliminar ×)

### Infraestructura
- Bucket Supabase Storage: `galeriamont`
- `src/lib/galleryStorage.js`: getGalleryAlbums, getAlbumPhotos, createAlbum, uploadPhoto, deletePhoto, deleteAlbum, setAlbumCover, getAlbumPhotosList, normalizeAlbumSlug, **uploadPdf**, **deletePdf**
- `src/lib/imageOptimizer.js`: optimitza imatges a WebP (màx. 1600×1200, qualitat 0.82)
- Portades: fitxer `.cover.json` dins cada carpeta de l'àlbum
- URLs signades (24h) amb fallback a URL pública

---

## 8. Traçes GPX

### Pujada
- Al modal de progrés, camp "Traça GPX" per seleccionar un fitxer `.gpx`
- En seleccionar-lo, es parseja al moment i s'omplen automàticament els camps de distància i desnivell
- En desar, es puja a `galeriamont/gpx/{userId}/{itemId}.gpx` i es guarda la URL a `user_progress.gpx_url`

### Visualització individual (`GpxTraceMap`)
- Botó "Veure traça" al modal quan hi ha un GPX existent
- Mapa Leaflet lazy amb `Polyline` verda, ajust automàtic de bounds (`fitBounds`)
- Component: `src/components/GpxTraceMap.jsx`

### Mapa agregat al perfil (`AllTracesMap`)
- A `/perfil`, secció "Les meves traçes" amb botó per mostrar el mapa
- Carrega tots els GPX de l'usuari en paral·lel (`Promise.all`)
- Cada traça amb un color diferent (paleta de 8 colors)
- Component: `src/components/AllTracesMap.jsx`

### Parser GPX (`src/lib/gpxParser.js`)
- `parseGpxStats(gpxText)` → `{ latLngs, distanceKm, elevationGain }`
- Distància: fórmula Haversine entre `trkpt` consecutius
- Desnivell: suma de diferències positives d'elevació (`<ele>`)
- `loadGpxFromUrl(url)` → carrega i parseja des d'una URL

### Badge a les cards
- Les cards de cims completats amb GPX mostren el badge verd "GPX"

---

## 9. Documentació PDF de rutes

- Al modal de progrés, camp "Documentació PDF" per seleccionar un fitxer `.pdf`
- En desar, es puja a `galeriamont/pdf/{userId}/{itemId}.pdf` i es guarda la URL a `user_progress.pdf_url`
- Si ja hi ha un PDF pujat, apareix el botó "Obrir PDF" que l'obre en una pestanya nova
- Un nou PDF substitueix l'anterior (upsert a Storage)
