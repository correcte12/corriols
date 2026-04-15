# Corriols de l'Empordà — Visió general del projecte

Plataforma de reptes esportius de muntanya per a la comunitat de l'Empordà i els Pirineus.
Permet gestionar reptes (senderisme, ciclisme, trail), fer seguiment del progrés personal per
ítem del repte, veure la classificació de la comunitat i explorar una galeria de fotos.

---

## Stack tècnic

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 6 |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + RLS + Auth + Storage) |
| Mapes | react-leaflet 5 + Leaflet 1.9 |
| Desplegament | Netlify |

El projecte comparteix el projecte Supabase amb **mis-montanas** (reservatas.netlify.app).
Les taules de Corriols (`profiles`, `challenges`, `challenge_items`, `user_challenges`, `user_progress`)
no toquen les taules existents de mis-montanas (`summits`, `user_summits`).

---

## Variables d'entorn (`.env`)

```
VITE_SUPABASE_URL=https://aqmzjdemfgpylehszdsv.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_GALLERY_BUCKET=galeriamont
```

El bucket `galeriamont` s'utilitza per a tot el Storage: fotos de galeria, fitxers GPX i PDFs.

---

## Estructura de fitxers rellevants

```
src/
├── lib/
│   ├── supabase.js          # Client Supabase
│   ├── galleryStorage.js    # Utilitat Storage: galeria (fotos), GPX i PDF
│   ├── imageOptimizer.js    # Optimitzador d'imatges a WebP
│   └── gpxParser.js         # Parser GPX: traça + distància + desnivell
├── context/
│   └── AuthContext.jsx      # Auth provider + ensureProfile
├── components/
│   ├── Layout.jsx / .css    # Navbar fixa + Footer
│   ├── Footer.jsx / .css    # Peu de pàgina
│   ├── ChallengeMap.jsx     # Mapa Leaflet de cims (lazy)
│   ├── GpxTraceMap.jsx      # Mapa d'una traça GPX (lazy)
│   ├── AllTracesMap.jsx     # Mapa agregat de totes les traçes (lazy)
│   └── ProgressModal.jsx    # Modal de marcar cims (GPX + PDF + stats)
├── pages/
│   ├── HomePage.jsx         # Hero + grid de reptes
│   ├── ChallengeDetailPage.jsx  # Detall repte (mapa, filtres, cims)
│   ├── RankingPage.jsx      # Classificació
│   ├── GalleryPage.jsx / .css   # Galeria pública
│   ├── GalleryAdminPage.jsx / .css  # Administració galeria
│   ├── ProfilePage.jsx      # Perfil + mapa de traçes personals
│   ├── AdminPage.jsx        # Panell admin
│   └── LoginPage.jsx        # Login
└── App.jsx                  # Rutes

supabase/migrations/         # Migracions SQL (001-009)
public/
├── logo.png                 # Logo (mountain-snow-arcilla)
├── wikiloc-icon.png
└── instagram-icon.png
documentation/               # Aquesta carpeta
```

---

## Rutes de l'aplicació

| Ruta | Pàgina |
|---|---|
| `/` | HomePage — hero + cards de reptes |
| `/reto/:id` | ChallengeDetailPage — mapa, filtres, cims |
| `/ranking/:id` | RankingPage — classificació |
| `/galeria` | GalleryPage — grid d'àlbums |
| `/galeria/:albumSlug` | GalleryPage — fotos de l'àlbum |
| `/admin/galeria` | GalleryAdminPage — gestió galeria |
| `/perfil` | ProfilePage — perfil + mapa de traçes |
| `/admin` | AdminPage |
| `/login` | LoginPage |

---

## Paleta de colors

| Ús | Color |
|---|---|
| Fons principal | `#edeae3` (pedra càlida) |
| Verd principal | `#1a5c38` |
| Verd fosc (footer) | `#2f5d50` / `#1e3d34` |
| Text principal | `#1a1a1a` |
| Text secundari | `#555` / `#777` |

---

## Storage (bucket `galeriamont`)

| Prefix | Contingut |
|---|---|
| `{albumSlug}/` | Fotos de galeria per àlbum |
| `gpx/{userId}/{itemId}.gpx` | Traça GPX d'una sortida |
| `pdf/{userId}/{itemId}.pdf` | Documentació PDF d'una ruta |
