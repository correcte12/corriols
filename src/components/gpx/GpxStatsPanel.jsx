export default function GpxStatsPanel({ route }) {
  if (!route) {
    return (
      <div style={{ color: '#999', fontSize: 13, padding: '8px 0' }}>
        Selecciona una ruta per veure les estadístiques
      </div>
    )
  }

  const { stats } = route
  const items = [
    { label: 'Distància', value: stats.distanceKm ? `${stats.distanceKm} km` : '—' },
    { label: 'Desnivell +', value: stats.elevationGain != null ? `${stats.elevationGain} m` : '—' },
    { label: 'Desnivell −', value: stats.elevationLoss != null ? `${stats.elevationLoss} m` : '—' },
    { label: 'Alt. màx.', value: stats.maxElevation != null ? `${stats.maxElevation} m` : '—' },
    { label: 'Alt. mín.', value: stats.minElevation != null ? `${stats.minElevation} m` : '—' },
    { label: 'Punts GPS', value: stats.pointCount ?? '—' },
  ]

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#333' }}>
        {route.name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        {items.map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
