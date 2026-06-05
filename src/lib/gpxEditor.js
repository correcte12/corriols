/**
 * Operacions d'edició sobre arrays de punts GPX.
 * Totes les funcions són pures: reben punts i retornen punts nous sense mutar l'original.
 */

const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Troba l'índex del punt del track més proper a una coordenada [lat, lon].
 */
export const findNearestPointIndex = (points, lat, lon) => {
  let minDist = Infinity
  let minIdx = 0
  for (let i = 0; i < points.length; i++) {
    const d = haversine([points[i].lat, points[i].lon], [lat, lon])
    if (d < minDist) {
      minDist = d
      minIdx = i
    }
  }
  return minIdx
}

/**
 * Retalla el track entre els índexos startIdx i endIdx (inclosos).
 * Si endIdx < startIdx, els intercanvia automàticament.
 */
export const trimTrack = (points, startIdx, endIdx) => {
  const a = Math.min(startIdx, endIdx)
  const b = Math.max(startIdx, endIdx)
  return points.slice(a, b + 1)
}

/**
 * Inverteix l'ordre dels punts del track.
 */
export const reverseTrack = (points) => [...points].reverse()

/**
 * Concatena els punts de dues rutes en una sola.
 */
export const mergeRoutes = (pointsA, pointsB) => [...pointsA, ...pointsB]

/**
 * Simplifica el track amb l'algoritme Ramer-Douglas-Peucker.
 * epsilon: distància màxima en metres entre el punt i la línia simplificada.
 * Valors típics: 2m (suau), 5m, 10m, 20m (molt simplificat).
 */
export const simplifyTrack = (points, epsilon) => {
  if (points.length <= 2) return points

  const distPointToSegment = (p, a, b) => {
    const dx = b.lon - a.lon
    const dy = b.lat - a.lat
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return haversine([p.lat, p.lon], [a.lat, a.lon])
    const t = Math.max(0, Math.min(1, ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / lenSq))
    return haversine([p.lat, p.lon], [a.lat + t * dy, a.lon + t * dx]) * 1000 // km → m
  }

  const rdp = (pts, start, end) => {
    let maxDist = 0
    let maxIdx = 0
    for (let i = start + 1; i < end; i++) {
      const d = distPointToSegment(pts[i], pts[start], pts[end])
      if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxDist > epsilon) {
      const left = rdp(pts, start, maxIdx)
      const right = rdp(pts, maxIdx, end)
      return [...left.slice(0, -1), ...right]
    }
    return [pts[start], pts[end]]
  }

  return rdp(points, 0, points.length - 1)
}

/**
 * Divideix el track en dues parts a l'índex donat.
 * La part 1 inclou els punts [0, idx] i la part 2 [idx, end] (el punt de tall és compartit).
 */
export const splitTrack = (points, idx) => {
  const part1 = points.slice(0, idx + 1)
  const part2 = points.slice(idx)
  return [part1, part2]
}

/**
 * Elimina punts anòmals (pics GPS) que es desvien estadísticament del track.
 * Calcula la distància de cada punt als seus veïns i elimina els que superen
 * el llindar (mean + threshold * stddev).
 */
export const cleanAnomalies = (points, threshold = 3) => {
  if (points.length < 3) return points

  const dists = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return 0
    const dPrev = haversine([points[i - 1].lat, points[i - 1].lon], [p.lat, p.lon])
    const dNext = haversine([p.lat, p.lon], [points[i + 1].lat, points[i + 1].lon])
    return (dPrev + dNext) / 2
  })

  const mean = dists.reduce((s, d) => s + d, 0) / dists.length
  const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length
  const std = Math.sqrt(variance)
  const limit = mean + threshold * std

  return points.filter((_, i) => dists[i] <= limit)
}
