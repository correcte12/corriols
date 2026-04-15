/**
 * Parseig lleuger de fitxers GPX sense dependències externes.
 * Extreu els punts de la traça (trkpt) i retorna un array de [lat, lng].
 */

export const parseGpxToLatLngs = (gpxText) => {
  const { latLngs } = parseGpxStats(gpxText)
  return latLngs
}

/**
 * Distància entre dos punts en km (fórmula Haversine).
 */
const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Parseja un GPX i retorna latLngs, distànciaKm i desnivell positiu acumulat.
 */
export const parseGpxStats = (gpxText) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(gpxText, 'text/xml')

  const parseError = xml.querySelector('parsererror')
  if (parseError) throw new Error('Format GPX no vàlid')

  const trkpts = xml.querySelectorAll('trkpt')
  if (trkpts.length === 0) throw new Error('El fitxer GPX no conté punts de traça (trkpt)')

  const points = Array.from(trkpts).map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lon = parseFloat(pt.getAttribute('lon'))
    const eleEl = pt.querySelector('ele')
    const ele = eleEl ? parseFloat(eleEl.textContent) : null
    return { lat, lon, ele }
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lon))

  const latLngs = points.map(p => [p.lat, p.lon])

  let distanceKm = 0
  let elevationGain = 0
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversine([points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon])
    if (points[i].ele !== null && points[i - 1].ele !== null) {
      const diff = points[i].ele - points[i - 1].ele
      if (diff > 0) elevationGain += diff
    }
  }

  return {
    latLngs,
    distanceKm: Math.round(distanceKm * 10) / 10,   // 1 decimal
    elevationGain: Math.round(elevationGain),          // metres enters
  }
}

/**
 * Calcula els límits (bounds) d'un array de [lat, lng].
 * Retorna [[minLat, minLng], [maxLat, maxLng]] per a fitBounds de Leaflet.
 */
export const getBoundsFromLatLngs = (latLngs) => {
  if (!latLngs.length) return null
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  for (const [lat, lng] of latLngs) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return [[minLat, minLng], [maxLat, maxLng]]
}

/**
 * Carrega el contingut d'un fitxer GPX des d'una URL i el parseja.
 */
export const loadGpxFromUrl = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No s'ha pogut carregar el GPX (${res.status})`)
  const text = await res.text()
  return parseGpxToLatLngs(text)
}
