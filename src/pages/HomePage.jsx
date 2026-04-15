import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './HomePage.css'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80'

export default function HomePage() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [enrolledIds, setEnrolledIds] = useState(new Set())
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('id, name, description, type, cover_image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const challenges = challengeData ?? []
      setChallenges(challenges)

      if (user && challenges.length > 0) {
        const ids = challenges.map(c => c.id)

        const [enrollRes, itemsRes] = await Promise.all([
          supabase.from('user_challenges')
            .select('challenge_id')
            .eq('user_id', user.id)
            .in('challenge_id', ids),
          supabase.from('challenge_items')
            .select('id, challenge_id')
            .in('challenge_id', ids),
        ])

        setEnrolledIds(new Set(enrollRes.data?.map(r => r.challenge_id) ?? []))

        // Per cada repte: total items i completats
        const totalByChallenge = {}
        for (const item of itemsRes.data ?? []) {
          totalByChallenge[item.challenge_id] = (totalByChallenge[item.challenge_id] ?? 0) + 1
        }

        if (enrollRes.data?.length > 0) {
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('challenge_item_id')
            .eq('user_id', user.id)

          const completedItemIds = new Set(progressData?.map(r => r.challenge_item_id) ?? [])

          const pct = {}
          for (const item of itemsRes.data ?? []) {
            if (!pct[item.challenge_id]) pct[item.challenge_id] = { done: 0, total: 0 }
            pct[item.challenge_id].total++
            if (completedItemIds.has(item.id)) pct[item.challenge_id].done++
          }
          setProgressMap(pct)
        } else {
          const pct = {}
          for (const [cid, total] of Object.entries(totalByChallenge)) {
            pct[cid] = { done: 0, total }
          }
          setProgressMap(pct)
        }
      }

      setLoading(false)
    }
    fetchData()
  }, [user])

  return (
    <div className="home">
      {/* Hero */}
      <section
        className="hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <p className="hero-eyebrow">Empordà · Pirineus · Alt Empordà</p>
            <h1 className="hero-title">Reptes esportius<br />de muntanya</h1>
            <p className="hero-subtitle">
              Completa cims, acumula quilòmetres i desnivell.<br />
              Segueix el teu progrés i compara't amb la comunitat.
            </p>
            <div className="hero-actions">
              <Link to={challenges[0] ? `/reto/${challenges[0].id}` : '#'} className="hero-btn-primary">
                Explorar reptes
              </Link>
              {!user && (
                <Link to="/login" className="hero-btn-secondary">
                  Crear compte
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Reptes */}
      <section className="challenges-section">
        <div className="section-header">
          <h2>Reptes actius</h2>
          <p>Inscriu-te i registra el teu progrés element per element.</p>
        </div>

        {loading && <p className="loading-text">Carregant...</p>}

        <div className="challenges-grid">
          {challenges.map(c => {
            const enrolled = enrolledIds.has(c.id)
            const prog = progressMap[c.id]
            const pct = prog?.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0

            return (
              <Link key={c.id} to={`/reto/${c.id}`} className="challenge-card">
                <div
                  className="card-image"
                  style={c.cover_image_url ? { backgroundImage: `url(${c.cover_image_url})` } : {}}
                >
                  <div className="card-image-overlay">
                    <span className="card-type">{c.type}</span>
                    {enrolled && (
                      <span className="card-enrolled-badge">Inscrit/a</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <h3>{c.name}</h3>
                  {c.description && <p className="card-desc">{c.description}</p>}

                  {enrolled && prog && (
                    <div className="card-progress">
                      <div className="card-progress-bar">
                        <div className="card-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="card-progress-label">{prog.done} / {prog.total} · {pct}%</span>
                    </div>
                  )}

                  <span className="card-link">Veure repte →</span>
                </div>
              </Link>
            )
          })}

          {!loading && challenges.length === 0 && (
            <p className="empty-text">Encara no hi ha reptes actius.</p>
          )}
        </div>
      </section>
    </div>
  )
}
