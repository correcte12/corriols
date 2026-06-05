import { useEffect } from 'react'
import { useMap, useMapEvents, CircleMarker, Polyline } from 'react-leaflet'
import { findNearestPointIndex } from '../../lib/gpxEditor'

function TrimClickHandler({ points, trimState, onTrimChange }) {
  const map = useMap()

  useEffect(() => {
    map.getContainer().style.cursor = 'crosshair'
    return () => { map.getContainer().style.cursor = '' }
  }, [map])

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      const idx = findNearestPointIndex(points, lat, lng)
      if (trimState.startIdx === null) {
        onTrimChange({ startIdx: idx, endIdx: null })
      } else if (trimState.endIdx === null) {
        onTrimChange({ startIdx: trimState.startIdx, endIdx: idx })
      } else {
        // Reset i comença de nou
        onTrimChange({ startIdx: idx, endIdx: null })
      }
    },
  })
  return null
}

export default function GpxTrimTool({ points, trimState, onTrimChange }) {
  const { startIdx, endIdx } = trimState

  const startPoint = startIdx !== null ? points[startIdx] : null
  const endPoint = endIdx !== null ? points[endIdx] : null

  const a = startIdx !== null && endIdx !== null ? Math.min(startIdx, endIdx) : null
  const b = startIdx !== null && endIdx !== null ? Math.max(startIdx, endIdx) : null
  const selectedLatLngs = a !== null ? points.slice(a, b + 1).map((p) => [p.lat, p.lon]) : []

  return (
    <>
      <TrimClickHandler points={points} trimState={trimState} onTrimChange={onTrimChange} />

      {/* Segment seleccionat */}
      {selectedLatLngs.length > 1 && (
        <Polyline
          positions={selectedLatLngs}
          pathOptions={{ color: '#FF9800', weight: 5, opacity: 0.9 }}
        />
      )}

      {/* Marcador inici */}
      {startPoint && (
        <CircleMarker
          center={[startPoint.lat, startPoint.lon]}
          radius={7}
          pathOptions={{ color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 1 }}
        />
      )}

      {/* Marcador fi */}
      {endPoint && (
        <CircleMarker
          center={[endPoint.lat, endPoint.lon]}
          radius={7}
          pathOptions={{ color: '#E63946', fillColor: '#E63946', fillOpacity: 1 }}
        />
      )}
    </>
  )
}
