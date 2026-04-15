import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './RankingPage.css'

const SORT_OPTIONS = [
  { id: 'count',     label: 'Cims' },
  { id: 'distance',  label: 'Distància' },
  { id: 'elevation', label: 'Desnivell' },
]

export default function RankingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [challenge, setChallenge] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('count')

  useEffect(() => {
    async function fetchRanking() {
      const [challengeRes, enrolledRes] = await Promise.all([
        supabase.from('challenges').select('id, name, type').eq('id', id).single(),
        supabase.from('user_challenges').select('user_id').eq('challenge_id', id),
      ])

      if (challengeRes.data) setChallenge(challengeRes.data)

      const userIds = enrolledRes.data?.map(r => r.user_id) ?? []
      if (userIds.length === 0) { setLoading(false); return }

      const [progressRes, profilesRes] = await Promise.all([
        supabase
          .from('user_progress')
          .select('user_id, challenge_item_id, distance_km, elevation_gain')
          .in('user_id', userIds),
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds),
      ])

      const byUser = {}
      for (const r of progressRes.data ?? []) {
        if (!byUser[r.user_id]) byUser[r.user_id] = { count: 0, distance: 0, elevation: 0 }
        byUser[r.user_id].count++
        byUser[r.user_id].distance  += parseFloat(r.distance_km)  || 0
        byUser[r.user_id].elevation += parseInt(r.elevation_gain)  || 0
      }

      const profileMap = {}
      for (const p of profilesRes.data ?? []) profileMap[p.id] = p

      const ranking = userIds.map(uid => ({
        user_id:      uid,
        display_name: profileMap[uid]?.display_name || 'Usuari/a',
        avatar_url:   profileMap[uid]?.avatar_url,
        count:        byUser[uid]?.count    ?? 0,
        distance:     byUser[uid]?.distance ?? 0,
        elevation:    byUser[uid]?.elevation ?? 0,
      }))

      setRows(ranking)
      setLoading(false)
    }
    fetchRanking()
  }, [id])

  const ranking = useMemo(() => {
    return [...rows].sort((a, b) => b[sortBy] - a[sortBy])
  }, [rows, sortBy])

  const totalCims     = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows])
  const activeUsers   = useMemo(() => rows.filter(r => r.count > 0).length, [rows])
  const leader        = ranking[0]
  const myPosition    = ranking.findIndex(r => r.user_id === user?.id) + 1

  if (loading) return <p className="loading">Carregant rànquing...</p>
  if (!challenge) return <p>Repte no trobat.</p>

  return (
    <div className="ranking-page">
      <Link to={`/reto/${id}`} className="back-link">← {challenge.name}</Link>

      <div className="ranking-title-row">
        <div>
          <p className="ranking-category">COMUNITAT</p>
          <h1>Classificació</h1>
          <p className="ranking-subtitle">Rànquing de la comunitat ordenat per {
            sortBy === 'count' ? 'nombre de cims' :
            sortBy === 'distance' ? 'distància acumulada' : 'desnivell acumulat'
          }.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="ranking-stats">
        <div className="stat-card">
          <span className="stat-label">Usuaris registrats</span>
          <span className="stat-value">{rows.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Usuaris actius</span>
          <span className="stat-value">{activeUsers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Cims totals</span>
          <span className="stat-value">{totalCims}</span>
        </div>
      </div>

      {/* Taula */}
      <div className="ranking-card">
        <div className="ranking-card-header">
          <div>
            <h2>Rànquing de cims</h2>
            {myPosition > 0 && (
              <p className="my-position">Estàs a la posició {myPosition} de {ranking.length}</p>
            )}
          </div>

          {leader && (
            <div className="leader-badge">
              <span className="leader-label">LÍDER</span>
              <span className="leader-name">{leader.display_name}</span>
              <span className="leader-count">
                {sortBy === 'count'     && `${leader.count} cims`}
                {sortBy === 'distance'  && `${leader.distance.toFixed(1)} km`}
                {sortBy === 'elevation' && `${Math.round(leader.elevation).toLocaleString()} m`}
              </span>
            </div>
          )}
        </div>

        {/* Ordenació */}
        <div className="sort-row">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`sort-btn ${sortBy === opt.id ? 'active' : ''}`}
              onClick={() => setSortBy(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ranking-table">
          <div className="ranking-thead">
            <span className="col-pos">Pos.</span>
            <span className="col-user">Usuari/a</span>
            <span className={`col-stat ${sortBy === 'count' ? 'active' : ''}`}>Cims</span>
            <span className={`col-stat ${sortBy === 'distance' ? 'active' : ''}`}>Dist. (km)</span>
            <span className={`col-stat ${sortBy === 'elevation' ? 'active' : ''}`}>Desn. (m)</span>
          </div>

          {ranking.map((row, idx) => {
            const isMe = row.user_id === user?.id
            return (
              <div key={row.user_id} className={`ranking-row ${isMe ? 'is-me' : ''} pos-${Math.min(idx + 1, 4)}`}>
                <span className="col-pos">
                  {idx < 3
                    ? <span className={`medal medal-${idx + 1}`}>{idx + 1}</span>
                    : <span className="pos-num">{idx + 1}</span>
                  }
                </span>

                <div className="col-user">
                  {row.avatar_url
                    ? <img src={row.avatar_url} alt="" className="rank-avatar" />
                    : <div className="rank-avatar placeholder">{row.display_name[0]?.toUpperCase()}</div>
                  }
                  <span className="rank-name">
                    {row.display_name}
                    {isMe && <span className="you-tag"> (tu)</span>}
                  </span>
                </div>

                <span className={`col-stat ${sortBy === 'count' ? 'active' : ''}`}>
                  {row.count}
                </span>
                <span className={`col-stat ${sortBy === 'distance' ? 'active' : ''}`}>
                  {row.distance > 0 ? row.distance.toFixed(1) : '—'}
                </span>
                <span className={`col-stat ${sortBy === 'elevation' ? 'active' : ''}`}>
                  {row.elevation > 0 ? Math.round(row.elevation).toLocaleString() : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
