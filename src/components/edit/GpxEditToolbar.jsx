const TOOLS = [
  { id: 'trim', label: '✂️ Retallar tram' },
  { id: 'split', label: '🔀 Dividir en dues' },
  { id: 'simplify', label: '📉 Simplificar track' },
  { id: 'merge', label: '🔗 Unir rutes' },
  { id: 'reverse', label: '🔄 Invertir ruta' },
  { id: 'clean', label: '🧹 Netejar anomalies' },
  { id: 'elevation', label: '🏔 Corregir elevacions' },
  { id: 'metadata', label: '✏️ Metadades' },
]

export default function GpxEditToolbar({ activeTool, onSelectTool }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {TOOLS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onSelectTool(activeTool === id ? null : id)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: `1.5px solid ${activeTool === id ? '#1a5c38' : '#e0e0e0'}`,
            background: activeTool === id ? '#e8f5e9' : '#fff',
            color: activeTool === id ? '#1a5c38' : '#333',
            fontWeight: activeTool === id ? 600 : 400,
            cursor: 'pointer',
            fontSize: 13,
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
