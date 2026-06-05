import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { useAuth } from '../context/AuthContext'
import { useGpxSession } from '../hooks/useGpxSession.jsx'
import GpxEditToolbar from '../components/edit/GpxEditToolbar.jsx'
import GpxTrimTool from '../components/edit/GpxTrimTool.jsx'
import GpxSplitTool from '../components/edit/GpxSplitTool.jsx'
import GpxSimplifyTool, { GpxSimplifyPanel } from '../components/edit/GpxSimplifyTool.jsx'
import GpxMergePanel from '../components/edit/GpxMergePanel.jsx'
import GpxMetadataEditor from '../components/edit/GpxMetadataEditor.jsx'
import GpxElevationCorrector from '../components/edit/GpxElevationCorrector.jsx'
import { trimTrack, splitTrack, simplifyTrack, reverseTrack, mergeRoutes, cleanAnomalies } from '../lib/gpxEditor'
import { downloadGpx } from '../lib/gpxExporter'
import { getBoundsFromLatLngs, calcStatsFromPoints } from '../lib/gpxParser'

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
  }, [bounds, map])
  return null
}

function EditMap({ route, activeTool, trimState, onTrimChange, splitIdx, onSplitChange, epsilon }) {
  const latLngs = route.points.map((p) => [p.lat, p.lon])
  const bounds = getBoundsFromLatLngs(latLngs)
  const isSimplify = activeTool === 'simplify'
  const isSplit = activeTool === 'split'

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [24, 24] }}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds bounds={bounds} />
      <Polyline
        positions={latLngs}
        pathOptions={{ color: route.color, weight: 3, opacity: (isSplit || isSimplify) ? 0.2 : 0.6 }}
      />
      {activeTool === 'trim' && (
        <GpxTrimTool
          points={route.points}
          trimState={trimState}
          onTrimChange={onTrimChange}
        />
      )}
      {isSplit && (
        <GpxSplitTool
          points={route.points}
          splitIdx={splitIdx}
          onSplitChange={onSplitChange}
        />
      )}
      {isSimplify && (
        <GpxSimplifyTool
          points={route.points}
          epsilon={epsilon}
          color={route.color}
        />
      )}
    </MapContainer>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#666',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function ActionBtn({ onClick, disabled, children, variant = 'primary' }) {
  const bg = variant === 'primary' ? '#1a5c38' : '#f5f5f5'
  const color = variant === 'primary' ? '#fff' : '#333'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px', borderRadius: 6, border: 'none',
        background: disabled ? '#e0e0e0' : bg, color: disabled ? '#aaa' : color,
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13,
        fontWeight: 600, width: '100%', transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function GpxEditPage() {
  const { user, loading: authLoading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const { routes, updateRoute } = useGpxSession()

  const originalRoute = useMemo(() => routes.find((r) => r.id === id) ?? null, [routes, id])

  // Estat local de l'edició (no muta el context fins que es confirma)
  const [workingPoints, setWorkingPoints] = useState(() => originalRoute?.points ?? [])
  const [metadata, setMetadata] = useState(() => ({
    name: originalRoute?.name ?? '',
    description: originalRoute?.description ?? '',
    date: originalRoute?.date ?? null,
  }))
  const [activeTool, setActiveTool] = useState(null)
  const [trimState, setTrimState] = useState({ startIdx: null, endIdx: null })
  const [splitIdx, setSplitIdx] = useState(null)
  const [epsilon, setEpsilon] = useState(5)
  const [history, setHistory] = useState([])
  const [message, setMessage] = useState(null)

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!originalRoute) return <Navigate to="/gpx" replace />

  const workingRoute = { ...originalRoute, points: workingPoints, ...metadata }

  function pushHistory(points) {
    setHistory((h) => [...h, workingPoints])
    setWorkingPoints(points)
  }

  function undo() {
    if (!history.length) return
    setWorkingPoints(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
  }

  function showMessage(text, isError = false) {
    setMessage({ text, isError })
    setTimeout(() => setMessage(null), 3000)
  }

  function handleApplyTrim() {
    const { startIdx, endIdx } = trimState
    if (startIdx === null || endIdx === null) return
    const trimmed = trimTrack(workingPoints, startIdx, endIdx)
    pushHistory(trimmed)
    setTrimState({ startIdx: null, endIdx: null })
    setActiveTool(null)
    showMessage(`Tram retallat: ${trimmed.length} punts`)
  }

  function handleReverse() {
    pushHistory(reverseTrack(workingPoints))
    showMessage('Ruta invertida')
  }

  function handleClean() {
    const cleaned = cleanAnomalies(workingPoints)
    const removed = workingPoints.length - cleaned.length
    pushHistory(cleaned)
    showMessage(`${removed} punts anòmals eliminats`)
  }

  function handleApplySplit() {
    if (splitIdx === null) return
    const [part1, part2] = splitTrack(workingPoints, splitIdx)
    downloadGpx(`${metadata.name} - part 1`, part1, metadata.description, metadata.date)
    downloadGpx(`${metadata.name} - part 2`, part2, metadata.description, metadata.date)
    setSplitIdx(null)
    setActiveTool(null)
    showMessage('Dues parts descarregades')
  }

  function handleMerge(otherRoute) {
    const merged = mergeRoutes(workingPoints, otherRoute.points)
    pushHistory(merged)
    setActiveTool(null)
    showMessage(`Unida amb "${otherRoute.name}"`)
  }

  function saveToSession(pts = workingPoints) {
    const latLngs = pts.map((p) => [p.lat, p.lon])
    const bounds = getBoundsFromLatLngs(latLngs)
    const stats = calcStatsFromPoints(pts)
    updateRoute(id, { points: pts, latLngs, bounds, stats, ...metadata })
  }

  function handleSave() {
    saveToSession()
    showMessage('Canvis desats a la sessió')
  }

  function handleDownload() {
    downloadGpx(metadata.name, workingPoints, metadata.description, metadata.date)
  }

  const trimReady = trimState.startIdx !== null && trimState.endIdx !== null

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Mapa */}
      <div style={{ flex: '1 1 70%', minWidth: 0, height: 'calc(100vh - 56px)' }}>
        <EditMap
          route={workingRoute}
          activeTool={activeTool}
          trimState={trimState}
          onTrimChange={setTrimState}
          splitIdx={splitIdx}
          onSplitChange={setSplitIdx}
          epsilon={epsilon}
        />
      </div>

      {/* Panel lateral */}
      <div style={{
        flex: '0 0 300px', width: 300,
        height: 'calc(100vh - 56px)',
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid #e0e0e0',
        background: '#fff', overflowY: 'auto',
      }}>
        {/* Capçalera */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0' }}>
          <button
            onClick={() => navigate('/gpx')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', padding: 0, marginBottom: 6 }}
          >
            ← Tornar
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a5c38', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {metadata.name}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {workingPoints.length} punts
            {history.length > 0 && <span style={{ color: '#FF9800', marginLeft: 6 }}>● canvis pendents</span>}
          </div>
        </div>

        {/* Missatge feedback */}
        {message && (
          <div style={{
            margin: '8px 14px 0',
            padding: '6px 10px',
            borderRadius: 6,
            background: message.isError ? '#ffebee' : '#e8f5e9',
            color: message.isError ? '#c62828' : '#2e7d32',
            fontSize: 12,
          }}>
            {message.text}
          </div>
        )}

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {/* Eines */}
          <div>
            <SectionTitle>Eines d'edició</SectionTitle>
            <GpxEditToolbar activeTool={activeTool} onSelectTool={(tool) => {
              setActiveTool(tool)
              setSplitIdx(null)
              setTrimState({ startIdx: null, endIdx: null })
            }} />
          </div>

          {/* Panell actiu per eina */}
          {activeTool === 'trim' && (
            <div style={{ background: '#fff8e1', borderRadius: 6, padding: 10, fontSize: 13 }}>
              {trimState.startIdx === null && <p style={{ margin: 0, color: '#666' }}>Fes clic al mapa per marcar l'inici del tram.</p>}
              {trimState.startIdx !== null && trimState.endIdx === null && <p style={{ margin: 0, color: '#666' }}>Ara fes clic per marcar el final del tram.</p>}
              {trimReady && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#555' }}>
                    Punts seleccionats: <strong>{Math.abs(trimState.endIdx - trimState.startIdx) + 1}</strong>
                  </div>
                  <ActionBtn onClick={handleApplyTrim}>Aplicar retall</ActionBtn>
                  <ActionBtn variant="secondary" onClick={() => setTrimState({ startIdx: null, endIdx: null })}>
                    Reiniciar selecció
                  </ActionBtn>
                </div>
              )}
            </div>
          )}

          {activeTool === 'split' && (
            <div style={{ background: '#e3f2fd', borderRadius: 6, padding: 10, fontSize: 13 }}>
              {splitIdx === null
                ? <p style={{ margin: 0, color: '#666' }}>Fes clic al mapa per marcar el punt de divisió.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, color: '#555' }}>
                      Part 1: <strong>{splitIdx + 1}</strong> punts &nbsp;·&nbsp;
                      Part 2: <strong>{workingPoints.length - splitIdx}</strong> punts
                    </div>
                    <ActionBtn onClick={handleApplySplit}>Descarregar les dues parts</ActionBtn>
                    <ActionBtn variant="secondary" onClick={() => setSplitIdx(null)}>
                      Reiniciar
                    </ActionBtn>
                  </div>
                )
              }
            </div>
          )}

          {activeTool === 'simplify' && (
            <GpxSimplifyPanel
              points={workingPoints}
              epsilon={epsilon}
              onEpsilonChange={setEpsilon}
              onApply={(simplified) => {
                pushHistory(simplified)
                setActiveTool(null)
                showMessage(`Track simplificat: ${simplified.length} punts`)
              }}
            />
          )}

          {activeTool === 'reverse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Inverteix el sentit del track.</p>
              <ActionBtn onClick={handleReverse}>Invertir ara</ActionBtn>
            </div>
          )}

          {activeTool === 'clean' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Elimina punts GPS anòmals que es desvien estadísticament del track.</p>
              <ActionBtn onClick={handleClean}>Netejar anomalies</ActionBtn>
            </div>
          )}

          {activeTool === 'merge' && (
            <GpxMergePanel currentId={id} onMerge={handleMerge} />
          )}

          {activeTool === 'elevation' && (
            <GpxElevationCorrector
              points={workingPoints}
              onApply={(corrected) => {
                pushHistory(corrected)
                saveToSession(corrected)
                setActiveTool(null)
                showMessage('Elevacions corregides i desades')
              }}
            />
          )}

          {activeTool === 'metadata' && (
            <GpxMetadataEditor
              name={metadata.name}
              description={metadata.description}
              date={metadata.date}
              onChange={(changes) => setMetadata((m) => ({ ...m, ...changes }))}
            />
          )}

          {/* Desfer */}
          {history.length > 0 && (
            <div>
              <ActionBtn variant="secondary" onClick={undo}>
                ↩ Desfer última acció
              </ActionBtn>
            </div>
          )}
        </div>

        {/* Accions globals */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionBtn onClick={handleSave} disabled={!history.length && metadata.name === originalRoute.name}>
            💾 Desar a la sessió
          </ActionBtn>
          <ActionBtn onClick={handleDownload}>
            ⬇ Descarregar GPX
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}
