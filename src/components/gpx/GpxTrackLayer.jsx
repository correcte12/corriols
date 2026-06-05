import { Polyline, Tooltip } from 'react-leaflet'

export default function GpxTrackLayer({ route }) {
  if (!route.visible || !route.latLngs?.length) return null

  return (
    <Polyline
      positions={route.latLngs}
      pathOptions={{ color: route.color, weight: 3, opacity: 0.85 }}
    >
      <Tooltip sticky>{route.name}</Tooltip>
    </Polyline>
  )
}
