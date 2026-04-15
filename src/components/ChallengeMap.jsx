import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Centre aproximat de l'Alt Empordà
const DEFAULT_CENTER = [42.25, 3.0]
const DEFAULT_ZOOM = 9

export default function ChallengeMap({ items, completedIds }) {
  const validItems = items.filter(i => i.latitude && i.longitude)

  return (
    <div className="challenge-map">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validItems.map(item => {
          const done = completedIds.has(item.id)
          const color = done ? '#1a5c38' : item.is_essential ? '#92400e' : '#3b82f6'
          return (
            <CircleMarker
              key={item.id}
              center={[Number(item.latitude), Number(item.longitude)]}
              radius={done ? 7 : item.is_essential ? 6 : 5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: done ? 1 : 0.6,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{item.name}</strong>
                {item.height_meters && <><br />{item.height_meters.toLocaleString()} m</>}
                {item.is_essential && <><br /><em>Essencial</em></>}
                {done && <><br />✓ Completat</>}
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
