import { useState } from 'react'
import { fetchElevations } from '../../lib/elevationApi'
import { simplifyTrack } from '../../lib/gpxEditor'
import { calcStatsFromPoints } from '../../lib/gpxParser'

const MAX_POINTS_DIRECT = 100  // sense simplificació
const MAX_POINTS_API = 500     // màxim raonable per temps d'espera

export default function GpxElevationCorrector({ points, onApply }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [progress, setProgress] = useState(0)
  const [diff, setDiff] = useState(null)
  const [correctedPoints, setCorrectedPoints] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const originalStats = calcStatsFromPoints(points)

  // Si hi ha massa punts, simplifica primer per reduir peticions
  const workingPoints = points.length > MAX_POINTS_DIRECT
    ? simplifyTrack(points, 10)
    : points
  const willSimplify = points.length > MAX_POINTS_DIRECT
  const estimatedBatches = Math.ceil(workingPoints.length / 100)
  const estimatedSeconds = Math.round(estimatedBatches * 1.5)

  async function handleFetch() {
    setStatus('loading')
    setProgress(0)
    setDiff(null)
    setErrorMsg(null)

    try {
      // Consulta elevacions sobre els punts (simplificats si calia)
      const corrected = await fetchElevations(workingPoints, setProgress)

      // Si hem simplificat, interpola les elevacions de tornada als punts originals
      const result = willSimplify
        ? interpolateElevations(points, corrected)
        : corrected

      const newStats = calcStatsFromPoints(result)
      setCorrectedPoints(result)
      setDiff({ original: originalStats, corrected: newStats })
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  // Interpola elevacions dels punts simplificats als punts originals per distància
  function interpolateElevations(origPts, simplifiedPts) {
    return origPts.map((p) => {
      let minDist = Infinity
      let nearest = simplifiedPts[0]
      for (const sp of simplifiedPts) {
        const d = Math.hypot(sp.lat - p.lat, sp.lon - p.lon)
        if (d < minDist) { minDist = d; nearest = sp }
      }
      return { ...p, ele: nearest.ele }
    })
  }

  function handleApply() {
    if (correctedPoints) onApply(correctedPoints)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
        Substitueix les elevacions GPS (sorolloses) amb dades del model d'elevació SRTM via Open-Meteo.
      </p>

      <div style={{ fontSize: 12, color: '#666', background: '#f9f9f9', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
        {willSimplify
          ? <>
              <strong>{points.length} punts</strong> → simplificats a <strong>{workingPoints.length}</strong> per consultar
              · ~{estimatedBatches} peticions · ~{estimatedSeconds}s
            </>
          : <>{points.length} punts · {estimatedBatches} peticions a Open-Meteo</>
        }
      </div>

      {status === 'idle' && (
        <button onClick={handleFetch} style={btnStyle('#1a5c38', '#fff')}>
          Obtenir elevacions DEM
        </button>
      )}

      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>
            Consultant Open-Topo-Data… {progress}%
          </div>
          <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: '#1a5c38',
              width: `${progress}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ background: '#ffebee', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#c62828' }}>
            Error: {errorMsg}
          </div>
          <button onClick={handleFetch} style={btnStyle('#555', '#fff')}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'done' && diff && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Diff table */}
          <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #e0e0e0', fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#f5f5f5', padding: '5px 8px', fontWeight: 700, color: '#555' }}>
              <span></span><span style={{ textAlign: 'center' }}>Abans</span><span style={{ textAlign: 'center' }}>Després</span>
            </div>
            {[
              { label: 'Desnivell +', before: diff.original.elevationGain, after: diff.corrected.elevationGain, unit: 'm' },
              { label: 'Desnivell −', before: diff.original.elevationLoss, after: diff.corrected.elevationLoss, unit: 'm' },
              { label: 'Alt. màx.', before: diff.original.maxElevation, after: diff.corrected.maxElevation, unit: 'm' },
              { label: 'Alt. mín.', before: diff.original.minElevation, after: diff.corrected.minElevation, unit: 'm' },
            ].map(({ label, before, after, unit }) => (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '5px 8px', borderTop: '1px solid #f0f0f0',
              }}>
                <span style={{ color: '#666' }}>{label}</span>
                <span style={{ textAlign: 'center', color: '#999' }}>{before ?? '—'} {unit}</span>
                <span style={{ textAlign: 'center', fontWeight: 600, color: '#1a5c38' }}>{after ?? '—'} {unit}</span>
              </div>
            ))}
          </div>

          <button onClick={handleApply} style={btnStyle('#1a5c38', '#fff')}>
            Aplicar correccions
          </button>
          <button onClick={() => setStatus('idle')} style={btnStyle('#f5f5f5', '#333')}>
            Cancel·lar
          </button>
        </div>
      )}
    </div>
  )
}

const btnStyle = (bg, color) => ({
  padding: '8px 14px', borderRadius: 6, border: 'none',
  background: bg, color, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, width: '100%',
})
