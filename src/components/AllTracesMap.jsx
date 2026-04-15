import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { loadGpxFromUrl, getBoundsFromLatLngs } from '../lib/gpxParser'

// Paleta de colors per a les traçes
const TRACE_COLORS = [
  '#1a5c38', '#2980b9', '#8e44ad', '#c0392b',
  '#d35400', '#16a085', '#2c3e50', '#27ae60',
]

function FitAll({ allLatLngs }) {
  const map = useMap()
  useEffect(() => {
    const flat = allLatLngs.flat()
    if (!flat.length) return
    const bounds = getBoundsFromLatLngs(flat)
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, allLatLngs])
  return null
}

export default function AllTracesMap({ gpxUrls, height = 420 }) {
  const [traces, setTraces] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(0)

  useEffect(() => {
    if (!gpxUrls.length) { setLoading(false); return }

    let cancelled = false
    const results = new Array(gpxUrls.length).fill(null)

    const loadAll = async () => {
      await Promise.all(
        gpxUrls.map(async (url, i) => {
          try {
            const pts = await loadGpxFromUrl(url)
            if (!cancelled) {
              results[i] = pts
              setLoaded(prev => prev + 1)
            }
          } catch {
            // ignora traçes que fallen
          }
        })
      )
      if (!cancelled) {
        setTraces(results.filter(Boolean))
        setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [gpxUrls])

  const center = [42.25, 3.0]

  return (
    <div className="all-traces-map-wrap">
      {loading && (
        <div className="all-traces-loading">
          Carregant traçes... ({loaded}/{gpxUrls.length})
        </div>
      )}
      <MapContainer
        center={center}
        zoom={9}
        style={{ height, borderRadius: 10, zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {traces.map((pts, i) => (
          <Polyline
            key={i}
            positions={pts}
            color={TRACE_COLORS[i % TRACE_COLORS.length]}
            weight={2.5}
            opacity={0.8}
          />
        ))}
        {!loading && traces.length > 0 && <FitAll allLatLngs={traces} />}
      </MapContainer>
    </div>
  )
}
