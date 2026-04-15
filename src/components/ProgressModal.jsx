import { useState, lazy, Suspense } from 'react'
import { uploadGpx, uploadPdf } from '../lib/gpxStorage'
import { parseGpxStats } from '../lib/gpxParser'
import './ProgressModal.css'

const GpxTraceMap = lazy(() => import('./GpxTraceMap'))

export default function ProgressModal({ item, existing, user, onSave, onDelete, onClose }) {
  const [notes, setNotes] = useState(existing?.notes || '')
  const [wikilocUrl, setWikilocUrl] = useState(existing?.wikiloc_url || '')
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km || '')
  const [elevationGain, setElevationGain] = useState(existing?.elevation_gain || '')
  const [gpxFile, setGpxFile] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [showTrace, setShowTrace] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gpxError, setGpxError] = useState('')
  const [pdfError, setPdfError] = useState('')

  const existingGpxUrl = existing?.gpx_url || null
  const existingPdfUrl = existing?.pdf_url || null

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setGpxError('')

    let gpxUrl = existingGpxUrl
    if (gpxFile && user) {
      try {
        const result = await uploadGpx(user.id, item.id, gpxFile)
        gpxUrl = result.url
      } catch (err) {
        setGpxError(err.message)
        setSaving(false)
        return
      }
    }

    let pdfUrl = existingPdfUrl
    if (pdfFile && user) {
      try {
        const result = await uploadPdf(user.id, item.id, pdfFile)
        pdfUrl = result.url
      } catch (err) {
        setPdfError(err.message)
        setSaving(false)
        return
      }
    }

    await onSave({
      notes:          notes || null,
      wikiloc_url:    wikilocUrl || null,
      distance_km:    distanceKm ? parseFloat(distanceKm) : null,
      elevation_gain: elevationGain ? parseInt(elevationGain) : null,
      gpx_url:        gpxUrl || null,
      pdf_url:        pdfUrl || null,
    })
    setSaving(false)
  }

  async function handleDelete() {
    setSaving(true)
    await onDelete()
    setSaving(false)
  }

  function handleGpxChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setGpxError('El fitxer ha de ser un GPX (.gpx)')
      return
    }
    setGpxError('')
    setGpxFile(file)

    // Calcula distància i desnivell automàticament
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { distanceKm, elevationGain } = parseGpxStats(ev.target.result)
        if (distanceKm > 0) setDistanceKm(String(distanceKm))
        if (elevationGain > 0) setElevationGain(String(elevationGain))
      } catch {
        // si falla el parseig no bloquejem la pujada
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>{item.name}</h2>
            {item.height_meters && (
              <span className="modal-height">{item.height_meters.toLocaleString()} m</span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} className="modal-form">

          {/* Columna esquerra: comentaris */}
          <div className="form-group form-group--full">
            <label>Comentaris</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Com ha anat? Condicions, accés..."
            />
          </div>

          {/* Fila: wikiloc + GPX (2 columnes) */}
          <div className="form-group">
            <label>URL Wikiloc</label>
            <input
              type="url"
              value={wikilocUrl}
              onChange={e => setWikilocUrl(e.target.value)}
              placeholder="https://www.wikiloc.com/..."
            />
          </div>

          <div className="form-group">
            <label>Traça GPX</label>
            <div className="gpx-upload-row">
              <label className="gpx-file-label">
                {gpxFile ? gpxFile.name : existingGpxUrl ? 'Substituir GPX...' : 'Seleccionar .gpx...'}
                <input
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  onChange={handleGpxChange}
                  style={{ display: 'none' }}
                />
              </label>
              {gpxFile && (
                <button type="button" className="gpx-clear" onClick={() => setGpxFile(null)}>×</button>
              )}
            </div>
            {existingGpxUrl && !gpxFile && (
              <div className="gpx-existing">
                <span className="gpx-badge">GPX pujat</span>
                <button type="button" className="gpx-trace-toggle" onClick={() => setShowTrace(v => !v)}>
                  {showTrace ? 'Amagar' : 'Veure traça'}
                </button>
              </div>
            )}
            {gpxError && <p className="gpx-error">{gpxError}</p>}
          </div>

          {/* PDF documentació */}
          <div className="form-group form-group--full">
            <label>Documentació PDF</label>
            <div className="gpx-upload-row">
              <label className="gpx-file-label">
                {pdfFile ? pdfFile.name : existingPdfUrl ? 'Substituir PDF...' : 'Seleccionar .pdf...'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      setPdfError('El fitxer ha de ser un PDF (.pdf)')
                      return
                    }
                    setPdfError('')
                    setPdfFile(file)
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              {pdfFile && (
                <button type="button" className="gpx-clear" onClick={() => setPdfFile(null)}>×</button>
              )}
              {existingPdfUrl && !pdfFile && (
                <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-open-link">
                  Obrir PDF
                </a>
              )}
            </div>
            {pdfError && <p className="gpx-error">{pdfError}</p>}
          </div>

          {/* Fila: distància + desnivell */}
          <div className="form-group">
            <label>Distància (km)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="Ex: 12.5"
            />
          </div>

          <div className="form-group">
            <label>Desnivell (m)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={elevationGain}
              onChange={e => setElevationGain(e.target.value)}
              placeholder="Ex: 850"
            />
          </div>

          {/* Mapa GPX (amplada completa) */}
          {showTrace && existingGpxUrl && !gpxFile && (
            <div className="gpx-map-full">
              <Suspense fallback={<div className="gpx-loading">Carregant mapa...</div>}>
                <GpxTraceMap gpxUrl={existingGpxUrl} height={200} />
              </Suspense>
            </div>
          )}

          <div className="modal-actions">
            {existing && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                Desmarcar
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Desant...' : existing ? 'Actualitzar' : 'Marcar com a feta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
