import { useGpxSession } from '../../hooks/useGpxSession.jsx'

export default function GpxMergePanel({ currentId, onMerge }) {
  const { routes } = useGpxSession()
  const others = routes.filter((r) => r.id !== currentId)

  if (!others.length) {
    return (
      <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
        Carrega una altra ruta a /gpx per poder unir-les.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px' }}>
        Selecciona la ruta que s'afegirà al final:
      </p>
      {others.map((r) => (
        <button
          key={r.id}
          onClick={() => onMerge(r)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 6,
            border: '1px solid #e0e0e0', background: '#fafafa',
            cursor: 'pointer', textAlign: 'left', fontSize: 13,
          }}
        >
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: r.color, flexShrink: 0,
          }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name}
          </span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.stats.distanceKm} km</span>
        </button>
      ))}
    </div>
  )
}
