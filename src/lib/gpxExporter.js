/**
 * Genera un fitxer GPX vàlid a partir d'un array de punts i metadades,
 * i el descarrega directament al navegador.
 */

const escapeXml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const buildGpxXml = (name, points, description = '', date = null) => {
  const meta = date ? `<time>${new Date(date).toISOString()}</time>` : ''
  const desc = description ? `<desc>${escapeXml(description)}</desc>` : ''

  const trkpts = points.map((p) => {
    const ele = p.ele != null ? `<ele>${p.ele}</ele>` : ''
    const time = p.time ? `<time>${new Date(p.time).toISOString()}</time>` : ''
    return `    <trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}</trkpt>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Corriols GPX Editor"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    ${meta}
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    ${desc}
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

export const downloadGpx = (name, points, description = '', date = null) => {
  const xml = buildGpxXml(name, points, description, date)
  const blob = new Blob([xml], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^a-z0-9àáèéíïòóúüç\s-]/gi, '_')}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}
