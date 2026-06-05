import { useEffect } from 'react'
import { useMap, useMapEvents, CircleMarker, Polyline } from 'react-leaflet'
import { findNearestPointIndex } from '../../lib/gpxEditor'

function SplitClickHandler({ points, splitIdx, onSplitChange }) {
  const map = useMap()

  useEffect(() => {
    map.getContainer().style.cursor = 'crosshair'
    return () => { map.getContainer().style.cursor = '' }
  }, [map])

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      const idx = findNearestPointIndex(points, lat, lng)
      onSplitChange(idx)
    },
  })
  return null
}

export default function GpxSplitTool({ points, splitIdx, onSplitChange }) {
  const splitPoint = splitIdx !== null ? points[splitIdx] : null

  const part1LatLngs = splitIdx !== null ? points.slice(0, splitIdx + 1).map((p) => [p.lat, p.lon]) : []
  const part2LatLngs = splitIdx !== null ? points.slice(splitIdx).map((p) => [p.lat, p.lon]) : []

  return (
    <>
      <SplitClickHandler points={points} splitIdx={splitIdx} onSplitChange={onSplitChange} />

      {part1LatLngs.length > 1 && (
        <Polyline
          positions={part1LatLngs}
          pathOptions={{ color: '#2196F3', weight: 5, opacity: 0.9 }}
        />
      )}
      {part2LatLngs.length > 1 && (
        <Polyline
          positions={part2LatLngs}
          pathOptions={{ color: '#E63946', weight: 5, opacity: 0.9 }}
        />
      )}

      {splitPoint && (
        <CircleMarker
          center={[splitPoint.lat, splitPoint.lon]}
          radius={8}
          pathOptions={{ color: '#fff', fillColor: '#333', fillOpacity: 1, weight: 2 }}
        />
      )}
    </>
  )
}
