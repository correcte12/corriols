/**
 * Correcció d'elevacions via Open-Meteo Elevation API (CORS obert, sense API key).
 * Dataset: SRTM — cobertura global, resolució 90m.
 * Límit: 100 coordenades per petició.
 * Docs: https://open-meteo.com/en/docs/elevation-api
 */

const API_URL = 'https://api.open-meteo.com/v1/elevation'
const BATCH_SIZE = 100
const CONCURRENCY = 1
const RETRY_DELAY_MS = 1500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchBatch(points, attempt = 0) {
  const lats = points.map((p) => p.lat).join(',')
  const lons = points.map((p) => p.lon).join(',')
  const res = await fetch(`${API_URL}?latitude=${lats}&longitude=${lons}`)

  if (res.status === 429 && attempt < 3) {
    await sleep(RETRY_DELAY_MS * (attempt + 1))
    return fetchBatch(points, attempt + 1)
  }

  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`)

  const data = await res.json()
  if (!data.elevation) throw new Error('Resposta inesperada de l\'API')
  return data.elevation
}

/**
 * Substitueix l'elevació de cada punt amb dades del DEM SRTM30m.
 * Retorna un nou array de punts amb ele actualitzat.
 * onProgress(pct: 0-100) es crida mentre avança.
 */
export const fetchElevations = async (points, onProgress) => {
  const batches = []
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    batches.push({ pts: points.slice(i, i + BATCH_SIZE), start: i })
  }

  const elevations = new Array(points.length).fill(null)
  let done = 0

  // Processa en grups de CONCURRENCY peticions en paral·lel
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY)
    const results = await Promise.all(group.map(({ pts }) => fetchBatch(pts)))

    results.forEach((eles, gi) => {
      const { start } = group[gi]
      eles.forEach((ele, j) => { elevations[start + j] = ele })
    })

    done += group.reduce((s, g) => s + g.pts.length, 0)
    if (onProgress) onProgress(Math.round((done / points.length) * 100))

    // Pausa entre grups per respectar el rate limit
    if (i + CONCURRENCY < batches.length) await sleep(RETRY_DELAY_MS)
  }

  return points.map((p, i) => ({
    ...p,
    ele: elevations[i] !== null ? elevations[i] : p.ele,
  }))
}
