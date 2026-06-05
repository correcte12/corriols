import { useNavigate } from 'react-router-dom'
import { useGpxSession } from '../../hooks/useGpxSession.jsx'

function downloadGpx(route) {
  const blob = new Blob([route.rawXml], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = route.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export default function GpxComparePanel() {
  const { routes, selectedId, setSelectedId, toggleVisibility, removeRoute } = useGpxSession()
  const navigate = useNavigate()

  if (!routes.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {routes.map((route) => (
        <div
          key={route.id}
          onClick={() => setSelectedId(route.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 6,
            border: `1.5px solid ${selectedId === route.id ? route.color : '#e0e0e0'}`,
            background: selectedId === route.id ? `${route.color}12` : '#fff',
            cursor: 'pointer',
            opacity: route.visible ? 1 : 0.45,
            transition: 'all 0.15s',
          }}
        >
          {/* Color dot */}
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: route.color, flexShrink: 0,
          }} />

          {/* Name */}
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {route.name}
          </span>

          {/* Distance */}
          <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>
            {route.stats.distanceKm} km
          </span>

          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/gpx/editar/${route.id}`) }}
            title="Editar ruta"
            style={btnStyle}
          >
            ✏️
          </button>

          {/* Toggle visibility */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleVisibility(route.id) }}
            title={route.visible ? 'Amaga' : 'Mostra'}
            style={btnStyle}
          >
            {route.visible ? '👁' : '🚫'}
          </button>

          {/* Download */}
          <button
            onClick={(e) => { e.stopPropagation(); downloadGpx(route) }}
            title="Descarregar GPX"
            style={btnStyle}
          >
            ⬇
          </button>

          {/* Remove */}
          <button
            onClick={(e) => { e.stopPropagation(); removeRoute(route.id) }}
            title="Eliminar de la sessió"
            style={{ ...btnStyle, color: '#e53935' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

const btnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 3px',
  lineHeight: 1,
  flexShrink: 0,
}
