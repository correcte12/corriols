import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import './AdminPage.css'

const CHALLENGE_TYPES = ['senderisme', 'ciclisme', 'trail', 'ruta', 'altres']

export default function AdminPage() {
  const { user } = useAuth()

  // Crear repte
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState(CHALLENGE_TYPES[0])
  const [coverUrl, setCoverUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Llista de reptes + afegir items
  const [challenges, setChallenges] = useState([])
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [items, setItems] = useState([])
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  useEffect(() => {
    fetchChallenges()
  }, [])

  async function fetchChallenges() {
    const { data } = await supabase
      .from('challenges')
      .select('id, name, type, is_active')
      .order('created_at', { ascending: false })
    if (data) setChallenges(data)
  }

  async function fetchItems(challengeId) {
    const { data } = await supabase
      .from('challenge_items')
      .select('id, name, item_order')
      .eq('challenge_id', challengeId)
      .order('item_order', { ascending: true })
    if (data) setItems(data)
  }

  async function handleCreateChallenge(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    const { error } = await supabase.from('challenges').insert({
      name,
      description,
      type,
      cover_image_url: coverUrl || null,
      created_by: user.id,
    })
    if (error) {
      setCreateError(error.message)
    } else {
      setName('')
      setDescription('')
      setType(CHALLENGE_TYPES[0])
      setCoverUrl('')
      await fetchChallenges()
    }
    setCreating(false)
  }

  async function handleSelectChallenge(c) {
    setSelectedChallenge(c)
    await fetchItems(c.id)
  }

  async function handleAddItem(e) {
    e.preventDefault()
    setAddingItem(true)
    const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.item_order)) + 1 : 1
    const { error } = await supabase.from('challenge_items').insert({
      challenge_id: selectedChallenge.id,
      name: itemName,
      description: itemDesc || null,
      item_order: nextOrder,
    })
    if (!error) {
      setItemName('')
      setItemDesc('')
      await fetchItems(selectedChallenge.id)
    }
    setAddingItem(false)
  }

  if (!user) return <p>Necessites <Link to="/login">entrar</Link> per accedir a l'admin.</p>

  return (
    <div className="admin-page">
      <h1>Administració</h1>

      {/* Crear repte */}
      <section className="admin-section">
        <h2>Crear repte</h2>
        <form className="admin-form" onSubmit={handleCreateChallenge}>
          <div className="form-group">
            <label>Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Descripció</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipus</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>URL imatge de portada (opcional)</label>
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} type="url" />
            </div>
          </div>
          {createError && <p className="form-error">{createError}</p>}
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creant...' : 'Crear repte'}
          </button>
        </form>
      </section>

      {/* Llista de reptes i afegir items */}
      <section className="admin-section">
        <h2>Reptes existents</h2>
        <div className="admin-challenges-layout">
          <ul className="admin-challenges-list">
            {challenges.map(c => (
              <li
                key={c.id}
                className={`admin-challenge-item ${selectedChallenge?.id === c.id ? 'active' : ''}`}
                onClick={() => handleSelectChallenge(c)}
              >
                <span className="challenge-type">{c.type}</span>
                <span>{c.name}</span>
              </li>
            ))}
          </ul>

          {selectedChallenge && (
            <div className="admin-items-panel">
              <h3>Items de «{selectedChallenge.name}»</h3>

              <ul className="admin-items-list">
                {items.map(item => (
                  <li key={item.id}>
                    <span className="item-order-badge">{item.item_order}</span>
                    {item.name}
                  </li>
                ))}
                {items.length === 0 && <li className="empty">Sense items encara.</li>}
              </ul>

              <form className="admin-item-form" onSubmit={handleAddItem}>
                <h4>Afegir item</h4>
                <div className="form-group">
                  <label>Nom</label>
                  <input value={itemName} onChange={e => setItemName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Descripció (opcional)</label>
                  <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" disabled={addingItem}>
                  {addingItem ? 'Afegint...' : 'Afegir'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
