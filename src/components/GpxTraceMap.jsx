import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { loadGpxFromUrl, getBoundsFromLatLngs } from '../lib/gpxParser'

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] })
  }, [map, bounds])
  return null
}

export default function GpxTraceMap({ gpxUrl, height = 220, color = '#1a5c38' }) {
  const [latLngs, setLatLngs] = useState([])
  const [bounds, setBounds] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!gpxUrl) return
    setLoading(true)
    setError('')
    loadGpxFromUrl(gpxUrl)
      .then((pts) => {
        setLatLngs(pts)
        setBounds(getBoundsFromLatLngs(pts))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [gpxUrl])

  if (loading) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0ec', borderRadius: 8, fontSize: '0.85rem', color: '#888' }}>
      Carregant traça...
    </div>
  )

  if (error) return (
    <div style={{ height: 'auto', padding: '0.75rem', background: '#fef2f2', borderRadius: 8, fontSize: '0.82rem', color: '#b91c1c' }}>
      {error}
    </div>
  )

  if (!latLngs.length) return null

  const center = latLngs[Math.floor(latLngs.length / 2)]

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height, borderRadius: 8, zIndex: 0 }}
      zoomControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <Polyline positions={latLngs} color={color} weight={3} opacity={0.85} />
      {bounds && <FitBounds bounds={bounds} />}
    </MapContainer>
  )
}
