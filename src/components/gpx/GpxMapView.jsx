import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import GpxTrackLayer from './GpxTrackLayer'

const DEFAULT_CENTER = [42.25, 3.0]
const DEFAULT_ZOOM = 9

function FitBounds({ routes }) {
  const map = useMap()

  useEffect(() => {
    const visible = routes.filter((r) => r.visible && r.bounds)
    if (!visible.length) return

    let minLat = Infinity, maxLat = -Infinity
    let minLng = Infinity, maxLng = -Infinity
    for (const r of visible) {
      const [[la1, lo1], [la2, lo2]] = r.bounds
      if (la1 < minLat) minLat = la1
      if (la2 > maxLat) maxLat = la2
      if (lo1 < minLng) minLng = lo1
      if (lo2 > maxLng) maxLng = lo2
    }
    map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [24, 24] })
  }, [routes, map])

  return null
}

export default function GpxMapView({ routes, height = '100%' }) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height, width: '100%', borderRadius: 8 }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {routes.map((r) => (
        <GpxTrackLayer key={r.id} route={r} />
      ))}
      <FitBounds routes={routes} />
    </MapContainer>
  )
}
