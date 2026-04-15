import { useEffect, useState, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './ProfilePage.css'

const AllTracesMap = lazy(() => import('../components/AllTracesMap'))

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [gpxUrls, setGpxUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    if (!user) return

    async function fetchProfile() {
      const [profileRes, enrollRes, progressRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_challenges')
          .select('challenge_id, enrolled_at, challenges(id, name, type)')
          .eq('user_id', user.id),
        supabase.from('user_progress')
          .select('gpx_url')
          .eq('user_id', user.id)
          .not('gpx_url', 'is', null),
      ])

      if (profileRes.data) {
        setProfile(profileRes.data)
        setDisplayName(profileRes.data.display_name || '')
        setBio(profileRes.data.bio || '')
      }
      if (enrollRes.data) setChallenges(enrollRes.data)
      if (progressRes.data) {
        setGpxUrls(progressRes.data.map(r => r.gpx_url).filter(Boolean))
      }
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: displayName, bio })
      .eq('id', user.id)
    setSaving(false)
  }

  if (!user) return <p>Necessites <Link to="/login">entrar</Link> per veure el teu perfil.</p>
  if (loading) return <p className="loading">Carregant perfil...</p>

  return (
    <div className="profile-page">
      <h1>El meu perfil</h1>

      <form className="profile-form" onSubmit={handleSave}>
        <div className="form-group">
          <label>Nom visible</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Com vols que et vegin els altres?"
          />
        </div>
        <div className="form-group">
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            placeholder="Explica't en unes paraules..."
          />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Desant...' : 'Desar canvis'}
        </button>
      </form>

      {/* Mapa de traçes */}
      {gpxUrls.length > 0 && (
        <div className="profile-traces-section">
          <div className="profile-traces-header">
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Les meves traçes</h2>
              <p className="profile-traces-count">{gpxUrls.length} ruta{gpxUrls.length !== 1 ? 's' : ''} amb GPX</p>
            </div>
            <button
              className="btn-map-toggle-profile"
              onClick={() => setShowMap(v => !v)}
            >
              {showMap ? 'Amagar mapa' : 'Veure mapa'}
            </button>
          </div>
          {showMap && (
            <Suspense fallback={<div className="map-placeholder">Carregant mapa...</div>}>
              <AllTracesMap gpxUrls={gpxUrls} />
            </Suspense>
          )}
        </div>
      )}

      <h2 className="section-title">Els meus reptes</h2>

      {challenges.length === 0 && (
        <p className="empty">Encara no estàs inscrit/a en cap repte. <Link to="/">Explora els reptes</Link>.</p>
      )}

      <ul className="profile-challenges">
        {challenges.map(row => (
          <li key={row.challenge_id}>
            <Link to={`/reto/${row.challenge_id}`} className="profile-challenge-link">
              <span className="challenge-type">{row.challenges?.type}</span>
              <strong>{row.challenges?.name}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
