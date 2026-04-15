import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProgressModal from '../components/ProgressModal'
import './ChallengeDetailPage.css'

const ChallengeMap = lazy(() => import('../components/ChallengeMap'))

const HEIGHT_FILTERS = [
  { id: 'all',       label: 'Tots' },
  { id: '0-500',     label: '0–500m' },
  { id: '500-1000',  label: '500–1000m' },
  { id: '1000-2000', label: '1000–2000m' },
  { id: '2000+',     label: '2000m+' },
]

function applyHeightFilter(items, filter) {
  if (filter === 'all') return items
  if (filter === '0-500')     return items.filter(i => (i.height_meters ?? 0) < 500)
  if (filter === '500-1000')  return items.filter(i => i.height_meters >= 500 && i.height_meters < 1000)
  if (filter === '1000-2000') return items.filter(i => i.height_meters >= 1000 && i.height_meters < 2000)
  if (filter === '2000+')     return items.filter(i => i.height_meters >= 2000)
  return items
}

export default function ChallengeDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [challenge, setChallenge] = useState(null)
  const [items, setItems] = useState([])
  const [enrolled, setEnrolled] = useState(false)
  // Map: challenge_item_id → progress row (id, notes, wikiloc_url, distance_km, elevation_gain)
  const [progressMap, setProgressMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [modalItem, setModalItem] = useState(null)

  // Filtres
  const [search, setSearch] = useState('')
  const [heightFilter, setHeightFilter] = useState('all')
  const [onlyEssential, setOnlyEssential] = useState(false)
  const [onlyDone, setOnlyDone] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [challengeRes, itemsRes] = await Promise.all([
        supabase.from('challenges').select('*').eq('id', id).single(),
        supabase.from('challenge_items')
          .select('id, name, description, item_order, is_essential, height_meters, image_url, latitude, longitude, wikiloc_url')
          .eq('challenge_id', id)
          .order('item_order', { ascending: true }),
      ])

      if (challengeRes.data) setChallenge(challengeRes.data)
      if (itemsRes.data) setItems(itemsRes.data)

      if (user) {
        const [enrollRes, progressRes] = await Promise.all([
          supabase.from('user_challenges')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('challenge_id', id)
            .maybeSingle(),
          supabase.from('user_progress')
            .select('id, challenge_item_id, notes, wikiloc_url, distance_km, elevation_gain, gpx_url, pdf_url')
            .eq('user_id', user.id),
        ])
        setEnrolled(!!enrollRes.data)
        if (progressRes.data) {
          const map = new Map()
          progressRes.data.forEach(r => map.set(r.challenge_item_id, r))
          setProgressMap(map)
        }
      }

      setLoading(false)
    }
    fetchData()
  }, [id, user])

  const filteredItems = useMemo(() => {
    let result = items
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(term))
    }
    if (onlyEssential) result = result.filter(i => i.is_essential)
    if (onlyDone) result = result.filter(i => progressMap.has(i.id))
    result = applyHeightFilter(result, heightFilter)
    return result
  }, [items, search, heightFilter, onlyEssential, onlyDone, progressMap])

  async function handleEnroll() {
    setEnrolling(true)
    setEnrollError(null)
    const { error } = await supabase
      .from('user_challenges')
      .insert({ user_id: user.id, challenge_id: id })
    if (error) { setEnrollError(error.message) } else { setEnrolled(true) }
    setEnrolling(false)
  }

  async function handleProgressSave(itemId, fields) {
    const existing = progressMap.get(itemId)
    if (existing) {
      const { data } = await supabase.from('user_progress')
        .update(fields).eq('id', existing.id).select().single()
      if (data) setProgressMap(prev => new Map(prev).set(itemId, data))
    } else {
      const { data } = await supabase.from('user_progress')
        .insert({ user_id: user.id, challenge_item_id: itemId, ...fields })
        .select().single()
      if (data) setProgressMap(prev => new Map(prev).set(itemId, data))
    }
    setModalItem(null)
  }

  async function handleProgressDelete(itemId) {
    const existing = progressMap.get(itemId)
    if (!existing) return
    await supabase.from('user_progress').delete().eq('id', existing.id)
    setProgressMap(prev => { const m = new Map(prev); m.delete(itemId); return m })
    setModalItem(null)
  }

  if (loading) return <p className="loading">Carregant...</p>
  if (!challenge) return <p>Repte no trobat.</p>

  const completedIds = new Set(progressMap.keys())
  const pct = items.length > 0 ? Math.round((completedIds.size / items.length) * 100) : 0

  return (
    <div className="challenge-detail">

      {/* Hero */}
      <div className="detail-hero" style={challenge.cover_image_url ? { backgroundImage: `url(${challenge.cover_image_url})` } : {}}>
        <div className="detail-hero-overlay">
          <span className="challenge-type">{challenge.type}</span>
          <h1>{challenge.name}</h1>
          {challenge.description && <p className="detail-desc">{challenge.description}</p>}
          <div className="detail-actions">
            <Link to={`/ranking/${id}`} className="btn-secondary">Rànquing</Link>
            {user && !enrolled && (
              <button className="btn-primary" onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? 'Inscrivint...' : "Inscriure'm"}
              </button>
            )}
            {enrolled && <span className="enrolled-badge">Inscrit/a ✓</span>}
          </div>
          {enrollError && <p className="enroll-error">{enrollError}</p>}
        </div>
      </div>

      {/* Barra de progrés */}
      {enrolled && items.length > 0 && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-label">{completedIds.size} / {items.length} cims ({pct}%)</span>
        </div>
      )}

      {/* Mapa */}
      <div className="map-toggle-row">
        <button className={`btn-map-toggle ${showMap ? 'active' : ''}`} onClick={() => setShowMap(v => !v)}>
          {showMap ? 'Amagar mapa' : 'Veure mapa'}
        </button>
      </div>

      {showMap && (
        <Suspense fallback={<div className="map-loading">Carregant mapa...</div>}>
          <ChallengeMap items={filteredItems} completedIds={completedIds} />
        </Suspense>
      )}

      {/* Filtres */}
      <div className="filters-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Cerca per nom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-buttons">
          {HEIGHT_FILTERS.map(f => (
            <button
              key={f.id}
              className={`filter-btn ${heightFilter === f.id ? 'active' : ''}`}
              onClick={() => setHeightFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            className={`filter-btn essential-btn ${onlyEssential ? 'active' : ''}`}
            onClick={() => setOnlyEssential(v => !v)}
          >
            Essencials
          </button>
          {enrolled && (
            <button
              className={`filter-btn ${onlyDone ? 'active' : ''}`}
              onClick={() => setOnlyDone(v => !v)}
            >
              Fets
            </button>
          )}
        </div>
        <p className="filter-count">{filteredItems.length} de {items.length} cims</p>
      </div>

      {/* Grid de cards */}
      <div className="items-grid">
        {filteredItems.map(item => {
          const done = completedIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`summit-card ${done ? 'done' : ''}`}
            >
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="summit-card-img" loading="lazy" />
                : <div className="summit-card-img placeholder-img" />
              }
              {done && <div className="card-done-overlay">✓</div>}
              <div className="summit-card-info">
                <div className="summit-card-header">
                  <strong>{item.name}</strong>
                  {item.is_essential && <span className="badge-essential">Essencial</span>}
                </div>
                {item.height_meters && (
                  <span className="item-height">{item.height_meters.toLocaleString()} m</span>
                )}
                {enrolled && (
                  <button
                    className={`btn-check-card ${done ? 'checked' : ''}`}
                    onClick={() => setModalItem(item)}
                  >
                    {done ? '✓ Fet' : 'Marcar'}
                  </button>
                )}
                {done && progressMap.get(item.id)?.gpx_url && (
                  <span className="gpx-indicator">GPX</span>
                )}
              </div>
            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <p className="no-results">Cap cim coincideix amb els filtres.</p>
        )}
      </div>

      {!user && (
        <p className="login-prompt">
          <Link to="/login">Entra</Link> per inscriure't i registrar el teu progrés.
        </p>
      )}

      {modalItem && (
        <ProgressModal
          item={modalItem}
          existing={progressMap.get(modalItem.id) || null}
          user={user}
          onSave={fields => handleProgressSave(modalItem.id, fields)}
          onDelete={() => handleProgressDelete(modalItem.id)}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  )
}
