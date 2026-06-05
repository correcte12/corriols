import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import { simplifyTrack } from '../../lib/gpxEditor'

const PRESETS = [
  { label: '2 m', value: 2 },
  { label: '5 m', value: 5 },
  { label: '10 m', value: 10 },
  { label: '20 m', value: 20 },
]

export default function GpxSimplifyTool({ points, epsilon, onEpsilonChange, color }) {
  const simplified = useMemo(
    () => simplifyTrack(points, epsilon),
    [points, epsilon]
  )

  const simplifiedLatLngs = simplified.map((p) => [p.lat, p.lon])
  const reduction = Math.round((1 - simplified.length / points.length) * 100)

  return (
    <>
      {/* Polyline de preview sobre el mapa */}
      <Polyline
        positions={simplifiedLatLngs}
        pathOptions={{ color, weight: 4, opacity: 1 }}
      />

      {/* El panel de controls es renderitza fora del mapa, al sidebar — */}
      {/* Aquest component només s'encarrega de la capa del mapa. */}
      {/* Les dades simplificades i el recompte es passen cap amunt via onEpsilonChange. */}
    </>
  )
}

export function GpxSimplifyPanel({ points, epsilon, onEpsilonChange, onApply }) {
  const simplified = useMemo(
    () => simplifyTrack(points, epsilon),
    [points, epsilon]
  )
  const reduction = Math.round((1 - simplified.length / points.length) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
        Redueix el nombre de punts sense perdre la forma de la ruta.
      </p>

      {/* Presets */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Tolerància
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onEpsilonChange(p.value)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 5, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${epsilon === p.value ? '#1a5c38' : '#ddd'}`,
                background: epsilon === p.value ? '#e8f5e9' : '#fff',
                color: epsilon === p.value ? '#1a5c38' : '#555',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slider fi */}
      <div>
        <input
          type="range"
          min={1}
          max={50}
          value={epsilon}
          onChange={(e) => onEpsilonChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa' }}>
          <span>1 m</span>
          <span style={{ color: '#333', fontWeight: 600 }}>{epsilon} m</span>
          <span>50 m</span>
        </div>
      </div>

      {/* Preview stats */}
      <div style={{
        background: '#f5f5f5', borderRadius: 6, padding: '8px 10px',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#888' }}>Original</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{points.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888' }}>Resultat</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a5c38' }}>{simplified.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888' }}>Reducció</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E63946' }}>−{reduction}%</div>
        </div>
      </div>

      <button
        onClick={() => onApply(simplified)}
        style={{
          padding: '8px 14px', borderRadius: 6, border: 'none',
          background: '#1a5c38', color: '#fff',
          cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%',
        }}
      >
        Aplicar simplificació
      </button>
    </div>
  )
}
