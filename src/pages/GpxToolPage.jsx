import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGpxSession } from '../hooks/useGpxSession.jsx'
import GpxUploader from '../components/gpx/GpxUploader'
import GpxMapView from '../components/gpx/GpxMapView'
import GpxStatsPanel from '../components/gpx/GpxStatsPanel'
import GpxElevationProfile from '../components/gpx/GpxElevationProfile'
import GpxComparePanel from '../components/gpx/GpxComparePanel'

function GpxToolContent() {
  const { routes, selectedRoute, addRoutes, clearAll } = useGpxSession()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])

  const handleFiles = useCallback(async (files) => {
    setLoading(true)
    setErrors([])
    const { failed } = await addRoutes(files)
    if (failed.length) setErrors(failed.map((f) => `${f.fileName}: ${f.error}`))
    setLoading(false)
  }, [addRoutes])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Mapa */}
      <div style={{ flex: '1 1 70%', minWidth: 0, position: 'relative', height: 'calc(100vh - 56px)' }}>
        <GpxMapView routes={routes} height="calc(100vh - 56px)" />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, fontSize: 15, fontWeight: 600, color: '#555',
          }}>
            Carregant rutes...
          </div>
        )}
      </div>

      {/* Panel lateral */}
      <div style={{
        flex: '0 0 320px',
        width: 320,
        height: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderLeft: '1px solid #e0e0e0',
        background: '#fff',
        overflowY: 'auto',
      }}>
        {/* Uploader */}
        <div style={{ padding: '14px 14px 0' }}>
          <GpxUploader onFiles={handleFiles} loading={loading} />
          {errors.length > 0 && (
            <div style={{ background: '#ffebee', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
              {errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c62828' }}>{e}</div>
              ))}
            </div>
          )}
        </div>

        {/* Llista de rutes + toggle */}
        {routes.length > 0 && (
          <div style={{ padding: '0 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Rutes ({routes.length})
              </span>
              <button
                onClick={clearAll}
                style={{ fontSize: 11, color: '#e53935', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Netejar tot
              </button>
            </div>
            <GpxComparePanel />
          </div>
        )}

        {/* Separador */}
        {routes.length > 0 && <hr style={{ margin: '12px 14px', borderColor: '#f0f0f0' }} />}

        {/* Stats ruta seleccionada */}
        <div style={{ padding: '0 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Estadístiques
          </div>
          <GpxStatsPanel route={selectedRoute} />
        </div>

        {/* Perfil d'elevació */}
        {routes.length > 0 && (
          <>
            <hr style={{ margin: '12px 14px', borderColor: '#f0f0f0' }} />
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Perfil d'elevació
              </div>
              <GpxElevationProfile routes={routes} />
            </div>
          </>
        )}

        {/* Estat buit */}
        {routes.length === 0 && !loading && (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
            Carrega fitxers GPX per començar
          </div>
        )}
      </div>
    </div>
  )
}

export default function GpxToolPage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return <GpxToolContent />
}
