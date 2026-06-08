import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './ExcursionsPage.css'

// ─── Usuaris ──────────────────────────────────────────────────────────────────
const USUARIOS = [
  { id: 'carlosm',  nombre: 'Carlos M.',  asientos: 4 },
  { id: 'carlosj',  nombre: 'Carlos J.',  asientos: 4 },
  { id: 'antonio',  nombre: 'Antonio',    asientos: 4 },
  { id: 'diego',    nombre: 'Diego',      asientos: 4 },
  { id: 'luisp',    nombre: 'Luis P.',    asientos: 3 },
  { id: 'juanitog', nombre: 'Juanito G.', asientos: 4 },
]
const PASSWORD = 'jueves25'
const USER_MAP = Object.fromEntries(USUARIOS.map(u => [u.id, u]))

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function fetchExcursions() {
  const { data, error } = await supabase
    .from('grup_excursions')
    .select('*')
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function saveExcursion(excursion) {
  const { error } = await supabase.from('grup_excursions').insert(excursion)
  if (error) throw error
}

async function deleteExcursion(id) {
  const { error } = await supabase.from('grup_excursions').delete().eq('id', id)
  if (error) throw error
}

async function updateExcursion(id, fields) {
  const { error } = await supabase.from('grup_excursions').update(fields).eq('id', id)
  if (error) throw error
}

// ─── Lògica de saldos ─────────────────────────────────────────────────────────
function calcularSaldos(excursions) {
  const saldos = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  for (const exc of excursions) {
    const conductors = exc.conductors ?? []
    const passatgers = exc.passatgers ?? []
    const km         = parseFloat(exc.km) || 0

    if (conductors.length === 0) continue

    // Conductors sumen +km (independentment del nombre de passatgers)
    for (const cid of conductors) {
      if (saldos[cid] !== undefined) saldos[cid] += km
    }

    // Passatgers resten -km
    for (const uid of passatgers) {
      if (saldos[uid] !== undefined) saldos[uid] -= km
    }
  }

  return saldos
}

function calcularAsistencies(excursions) {
  const asistencies = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))
  for (const exc of excursions) {
    const tots = [...(exc.conductors ?? []), ...(exc.passatgers ?? [])]
    for (const uid of tots) {
      if (asistencies[uid] !== undefined) asistencies[uid]++
    }
  }
  return asistencies
}

function calcularRatios(saldos, asistencies) {
  return Object.fromEntries(
    USUARIOS.map(u => {
      const n = asistencies[u.id] || 0
      return [u.id, n > 0 ? saldos[u.id] / n : 0]
    })
  )
}

function designarConductors(saldos, asistencies, numConductors = 2) {
  return USUARIOS
    .slice()
    .sort((a, b) => {
      const rA = asistencies[a.id] > 0 ? saldos[a.id] / asistencies[a.id] : 0
      const rB = asistencies[b.id] > 0 ? saldos[b.id] / asistencies[b.id] : 0
      return rA - rB
    })
    .slice(0, numConductors)
    .map(u => u.id)
}

// ─── Vistes ───────────────────────────────────────────────────────────────────
function Dashboard({ excursions, saldos, asistencies, ratios, currentUser }) {
  const suggested = designarConductors(saldos, asistencies, 2)

  return (
    <div className="exc-dashboard">
      <div className="exc-section-title">Saldos actuals</div>
      <div className="exc-saldo-grid">
        {USUARIOS.map(u => {
          const s = saldos[u.id]
          const r = ratios[u.id]
          const n = asistencies[u.id]
          return (
            <div key={u.id} className={`exc-saldo-card ${u.id === currentUser ? 'exc-saldo-me' : ''}`}>
              <span className="exc-saldo-name">{u.nombre}</span>
              <span className={`exc-saldo-val ${s < 0 ? 'neg' : s > 0 ? 'pos' : ''}`}>
                {s > 0 ? '+' : ''}{s.toFixed(0)} km·p
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--exc-muted)', marginTop: 2 }}>
                {n} sortides · ràtio {r > 0 ? '+' : ''}{r.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="exc-section-title" style={{ marginTop: '2rem' }}>Conductors suggerits pròxima sortida</div>
      <div className="exc-suggested">
        {suggested.map(uid => (
          <span key={uid} className="exc-suggested-badge">{USER_MAP[uid]?.nombre}</span>
        ))}
        <span className="exc-suggested-hint">(ràtio km·p / sortides més baix)</span>
      </div>

      <div className="exc-section-title" style={{ marginTop: '2rem' }}>
        Últimes sortides ({excursions.length} total)
      </div>
      {excursions.slice(0, 5).map(e => (
        <div key={e.id} className="exc-hist-row">
          <span className="exc-hist-date">{e.data}</span>
          <span className="exc-hist-dest">{e.destino}</span>
          <span className="exc-hist-km">{parseFloat(e.km).toFixed(0)} km</span>
        </div>
      ))}
    </div>
  )
}

function NouaExcursio({ onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    data: today,
    destino: '',
    km: '',
    conductors: [],
    passatgers: [],
    notes: '',
    hayOtroConductor: false,
    pasajerosPorOtroConductor: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function toggleArray(field, uid) {
    setForm(f => {
      const arr = f[field]
      const other = field === 'conductors' ? 'passatgers' : 'conductors'
      return {
        ...f,
        [field]: arr.includes(uid) ? arr.filter(x => x !== uid) : [...arr, uid],
        [other]: f[other].filter(x => x !== uid),
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const teConductor = form.conductors.length > 0 || form.hayOtroConductor
    if (!form.destino || !form.km || !teConductor) {
      setError('Cal omplir destí, km i seleccionar almenys un conductor (o marcar conductor esporádic).')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveExcursion({
        data:      form.data,
        destino:   form.destino,
        km:        parseFloat(form.km),
        conductors: form.conductors,
        passatgers: form.passatgers,
        notes:     form.notes || null,
        hayOtroConductor: form.hayOtroConductor,
        pasajerosPorOtroConductor: form.pasajerosPorOtroConductor ? parseInt(form.pasajerosPorOtroConductor) : null,
      })
      setForm({ data: today, destino: '', km: '', conductors: [], passatgers: [], notes: '', hayOtroConductor: false, pasajerosPorOtroConductor: '' })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalPersones = form.conductors.length + form.passatgers.length

  return (
    <form className="exc-form" onSubmit={handleSubmit}>
      <div className="exc-section-title">Nova sortida</div>

      <div className="exc-form-row">
        <label>
          Data
          <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
        </label>
        <label>
          Destí
          <input type="text" placeholder="p.ex. Pic de Canigó" value={form.destino}
            onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} />
        </label>
        <label>
          km (anada+tornada)
          <input type="number" min="0" step="0.1" placeholder="0" value={form.km}
            onChange={e => setForm(f => ({ ...f, km: e.target.value }))} />
        </label>
      </div>

      <div className="exc-section-title" style={{ marginTop: '1.25rem' }}>Participants</div>
      <div className="exc-participants">
        {USUARIOS.map(u => {
          const isCond = form.conductors.includes(u.id)
          const isPax  = form.passatgers.includes(u.id)
          return (
            <div key={u.id} className={`exc-participant-card ${isCond ? 'cond' : isPax ? 'pax' : ''}`}>
              <div className="exc-p-name">{u.nombre}</div>
              <div className="exc-p-seats">{u.asientos} places</div>
              <div className="exc-p-btns">
                <button type="button" className={`exc-p-btn ${isCond ? 'active' : ''}`}
                  onClick={() => toggleArray('conductors', u.id)}>
                  Condueix
                </button>
                <button type="button" className={`exc-p-btn ${isPax ? 'active' : ''}`}
                  onClick={() => toggleArray('passatgers', u.id)}>
                  Passatger
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="exc-section-title" style={{ marginTop: '1.25rem' }}>Conductor esporádic (opcional)</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <input type="checkbox" checked={form.hayOtroConductor}
          onChange={e => setForm(f => ({ ...f, hayOtroConductor: e.target.checked }))} />
        <span>Hi ha un conductor addicional no registrat</span>
      </label>
      {form.hayOtroConductor && (
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          ¿Quants passatgers portava?
          <input type="number" min="0" max={form.passatgers.length} value={form.pasajerosPorOtroConductor}
            onChange={e => setForm(f => ({ ...f, pasajerosPorOtroConductor: e.target.value }))}
            placeholder="0" style={{ marginTop: '0.35rem', width: '80px' }} />
        </label>
      )}

      {totalPersones > 0 && (
        <div className="exc-preview">
          <strong>Resum:</strong> {form.conductors.map(id => USER_MAP[id]?.nombre).join(', ')} condueixen &bull;{' '}
          {form.passatgers.length > 0
            ? form.passatgers.map(id => USER_MAP[id]?.nombre).join(', ') + ' van de passatgers'
            : 'sense passatgers registrats'
          }
          {form.hayOtroConductor && ` &bull; + un altre conductor (${form.pasajerosPorOtroConductor} passatgers)`}
          {form.km && ` &bull; ${parseFloat(form.km).toFixed(0)} km`}
        </div>
      )}

      <label style={{ marginTop: '1rem', display: 'block' }}>
        Notes (opcional)
        <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Comentaris de la sortida..." />
      </label>

      {error && <p className="exc-error">{error}</p>}
      <button type="submit" className="exc-btn-primary" disabled={saving}>
        {saving ? 'Desant...' : 'Desar sortida'}
      </button>
    </form>
  )
}

function HistorialCard({ e, onDelete, onSaved, allExcursions = [] }) {
  const [editing,   setEditing]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [form, setForm] = useState({
    data:      e.data,
    destino:   e.destino,
    km:        String(parseFloat(e.km)),
    conductors: e.conductors ?? [],
    passatgers: e.passatgers ?? [],
    notes:     e.notes ?? '',
    hayOtroConductor: e.hayOtroConductor ?? false,
    pasajerosPorOtroConductor: e.pasajerosPorOtroConductor ? String(e.pasajerosPorOtroConductor) : '',
  })

  // Calcula saldos antes d'aquest viatge (només sortides anteriors en el temps)
  const saldosAntes = useMemo(() => {
    const saldos = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))
    for (const exc of allExcursions) {
      // Només computa sortides anteriors en el temps (data més antiga = anterior)
      if (exc.data >= e.data) continue
      const conductors = exc.conductors ?? []
      const passatgers = exc.passatgers ?? []
      const km = parseFloat(exc.km) || 0

      if (conductors.length === 0) continue

      // Conductors sumen +km
      for (const cid of conductors) {
        if (saldos[cid] !== undefined) saldos[cid] += km
      }

      // Passatgers resten -km
      for (const uid of passatgers) {
        if (saldos[uid] !== undefined) saldos[uid] -= km
      }
    }
    return saldos
  }, [allExcursions, e.id, e.data])

  // Calcula l'impacte d'aquest viatge específic
  const impactViatge = useMemo(() => {
    const impact = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))
    const conductors = form.conductors
    const passatgers = form.passatgers
    const km = parseFloat(form.km) || 0

    if (km === 0) return impact

    // Conductors sumen +km
    for (const cid of conductors) {
      if (impact[cid] !== undefined) impact[cid] += km
    }

    // Passatgers resten -km
    for (const uid of passatgers) {
      if (impact[uid] !== undefined) impact[uid] -= km
    }

    return impact
  }, [form.conductors, form.passatgers, form.km])

  function toggleArray(field, uid) {
    setForm(f => {
      const other = field === 'conductors' ? 'passatgers' : 'conductors'
      return {
        ...f,
        [field]: f[field].includes(uid) ? f[field].filter(x => x !== uid) : [...f[field], uid],
        [other]: f[other].filter(x => x !== uid),
      }
    })
  }

  async function handleSave() {
    const teConductor = form.conductors.length > 0 || form.hayOtroConductor
    if (!form.destino || !form.km || !teConductor) {
      setError('Cal omplir destí, km i almenys un conductor (o marcar conductor esporádic).')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateExcursion(e.id, {
        data:      form.data,
        destino:   form.destino,
        km:        parseFloat(form.km),
        conductors: form.conductors,
        passatgers: form.passatgers,
        notes:     form.notes || null,
        hayOtroConductor: form.hayOtroConductor,
        pasajerosPorOtroConductor: form.pasajerosPorOtroConductor ? parseInt(form.pasajerosPorOtroConductor) : null,
      })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await onDelete(e.id)
  }

  if (editing) {
    return (
      <div className="exc-hist-card exc-hist-card--editing">
        <div className="exc-form-row" style={{ marginBottom: '1rem' }}>
          <label>
            Data
            <input type="date" value={form.data}
              onChange={ev => setForm(f => ({ ...f, data: ev.target.value }))} />
          </label>
          <label>
            Destí
            <input type="text" value={form.destino}
              onChange={ev => setForm(f => ({ ...f, destino: ev.target.value }))} />
          </label>
          <label>
            km
            <input type="number" min="0" step="0.1" value={form.km}
              onChange={ev => setForm(f => ({ ...f, km: ev.target.value }))} />
          </label>
        </div>

        <div className="exc-section-title">Participants</div>
        <div className="exc-participants" style={{ marginBottom: '0.75rem' }}>
          {USUARIOS.map(u => {
            const isCond = form.conductors.includes(u.id)
            const isPax  = form.passatgers.includes(u.id)
            const saldoActual = saldosAntes[u.id] || 0
            const impacte = impactViatge[u.id] || 0
            const saldoFinal = saldoActual + impacte
            return (
              <div key={u.id} className={`exc-participant-card ${isCond ? 'cond' : isPax ? 'pax' : ''}`}>
                <div className="exc-p-name">{u.nombre}</div>
                <div className="exc-p-seats">{u.asientos} places</div>
                <div className="exc-p-saldos">
                  <div className="exc-p-saldo-line">Saldo: <strong>{saldoActual > 0 ? '+' : ''}{saldoActual.toFixed(0)}</strong> km·pas</div>
                  <div className="exc-p-saldo-line">Impacte: <strong>{impacte > 0 ? '+' : ''}{impacte.toFixed(0)}</strong> km·pas</div>
                  <div className="exc-p-saldo-line">Final: <strong>{saldoFinal > 0 ? '+' : ''}{saldoFinal.toFixed(0)}</strong> km·pas</div>
                </div>
                <div className="exc-p-calc-help">
                  <div className="exc-p-calc-title">Fórmula:</div>
                  {isCond && (
                    <div className="exc-p-calc-line">Conductor: <strong>+km</strong></div>
                  )}
                  {isPax && (
                    <div className="exc-p-calc-line">Passatger: <strong>−km</strong></div>
                  )}
                  {!isCond && !isPax && (
                    <div className="exc-p-calc-line" style={{ color: 'var(--exc-muted)' }}>No participant</div>
                  )}
                </div>
                <div className="exc-p-btns">
                  <button type="button" className={`exc-p-btn ${isCond ? 'active' : ''}`}
                    onClick={() => toggleArray('conductors', u.id)}>Condueix</button>
                  <button type="button" className={`exc-p-btn ${isPax ? 'active' : ''}`}
                    onClick={() => toggleArray('passatgers', u.id)}>Passatger</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="exc-section-title" style={{ marginTop: '1rem' }}>Conductor esporádic (opcional)</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={form.hayOtroConductor}
            onChange={ev => setForm(f => ({ ...f, hayOtroConductor: ev.target.checked }))} />
          <span>Hi ha un conductor addicional no registrat</span>
        </label>
        {form.hayOtroConductor && (
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            ¿Quants passatgers portava?
            <input type="number" min="0" max={form.passatgers.length} value={form.pasajerosPorOtroConductor}
              onChange={ev => setForm(f => ({ ...f, pasajerosPorOtroConductor: ev.target.value }))}
              placeholder="0" style={{ marginTop: '0.35rem', width: '80px' }} />
          </label>
        )}

        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--exc-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Notes
          <textarea rows={2} value={form.notes}
            onChange={ev => setForm(f => ({ ...f, notes: ev.target.value }))}
            placeholder="Comentaris..." style={{ marginTop: '0.35rem', width: '100%', background: 'var(--exc-bg)', border: '1px solid var(--exc-border)', borderRadius: '6px', color: 'var(--exc-text)', fontFamily: 'inherit', fontSize: '0.875rem', padding: '0.6rem 0.75rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </label>

        {error && <p className="exc-error">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSave} className="exc-btn-primary" disabled={saving} style={{ marginTop: 0 }}>
            {saving ? 'Desant...' : 'Desar canvis'}
          </button>
          <button onClick={() => { setEditing(false); setError('') }} className="exc-btn-cancel" style={{ alignSelf: 'center' }}>
            Cancel·lar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="exc-hist-card">
      <div className="exc-hist-card-top">
        <span className="exc-hist-date">{e.data}</span>
        <span className="exc-hist-dest">{e.destino}</span>
        <span className="exc-hist-km">{parseFloat(e.km).toFixed(0)} km</span>
        <div className="exc-hist-actions">
          <button onClick={() => setEditing(true)} className="exc-btn-edit" title="Editar">✎</button>
          {confirmDel
            ? <>
                <button onClick={handleDelete} className="exc-btn-danger">Eliminar</button>
                <button onClick={() => setConfirmDel(false)} className="exc-btn-cancel">Cancel·lar</button>
              </>
            : <button onClick={() => setConfirmDel(true)} className="exc-btn-delete">×</button>
          }
        </div>
      </div>
      <div className="exc-hist-detail">
        <span>Conductors: {(e.conductors ?? []).map(id => USER_MAP[id]?.nombre ?? id).join(', ') || '—'}
          {e.hayOtroConductor && ` + 1 altre${e.pasajerosPorOtroConductor ? ` (${e.pasajerosPorOtroConductor} pax)` : ''}`}
        </span>
        {(e.passatgers ?? []).length > 0 &&
          <span>Passatgers: {e.passatgers.map(id => USER_MAP[id]?.nombre ?? id).join(', ')}</span>
        }
        {e.notes && <span className="exc-hist-notes">{e.notes}</span>}
      </div>
    </div>
  )
}

function Historial({ excursions, onDelete, onSaved }) {
  return (
    <div>
      <div className="exc-section-title">Historial complet ({excursions.length} sortides)</div>
      {excursions.length === 0 && <p className="exc-empty">Encara no hi ha sortides registrades.</p>}
      {excursions.map(e => (
        <HistorialCard key={e.id} e={e} onDelete={onDelete} onSaved={onSaved} allExcursions={excursions} />
      ))}
    </div>
  )
}

// ─── Pàgina principal ─────────────────────────────────────────────────────────
const VIEWS = ['Resum', 'Nova sortida', 'Historial']

export default function ExcursionsPage() {
  const [loggedUser, setLoggedUser] = useState(() => sessionStorage.getItem('exc_user') || null)
  const [loginId,    setLoginId]    = useState(USUARIOS[0].id)
  const [loginPass,  setLoginPass]  = useState('')
  const [loginError, setLoginError] = useState('')

  const [excursions, setExcursions] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [view,       setView]       = useState('Dashboard')

  const saldos     = useMemo(() => calcularSaldos(excursions),                [excursions])
  const asistencies = useMemo(() => calcularAsistencies(excursions),           [excursions])
  const ratios      = useMemo(() => calcularRatios(saldos, asistencies),       [saldos, asistencies])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchExcursions()
      setExcursions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loggedUser) loadData()
  }, [loggedUser, loadData])

  function handleLogin(e) {
    e.preventDefault()
    if (loginPass !== PASSWORD) { setLoginError('Contrasenya incorrecta.'); return }
    sessionStorage.setItem('exc_user', loginId)
    setLoggedUser(loginId)
    setLoginError('')
  }

  function handleLogout() {
    sessionStorage.removeItem('exc_user')
    setLoggedUser(null)
    setExcursions([])
    setView('Dashboard')
  }

  async function handleDelete(id) {
    await deleteExcursion(id)
    await loadData()
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!loggedUser) {
    return (
      <div className="exc-login-wrap">
        <div className="exc-login-box">
          <h1 className="exc-login-title">Dijous d'Excursió</h1>
          <p className="exc-login-sub">Seguiment de rotació de vehicles</p>
          <form onSubmit={handleLogin}>
            <label className="exc-label">
              Usuari
              <select value={loginId} onChange={e => setLoginId(e.target.value)} className="exc-select">
                {USUARIOS.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </label>
            <label className="exc-label">
              Contrasenya
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                className="exc-input" placeholder="••••••••" />
            </label>
            {loginError && <p className="exc-error">{loginError}</p>}
            <button type="submit" className="exc-btn-primary" style={{ width: '100%' }}>Entrar</button>
          </form>
        </div>
      </div>
    )
  }

  // ── App ────────────────────────────────────────────────────────────────────
  return (
    <div className="exc-app">
      <div className="exc-header">
        <div>
          <h1 className="exc-title">Dijous d'Excursió</h1>
          <p className="exc-sub">Hola, {USER_MAP[loggedUser]?.nombre}</p>
        </div>
        <button onClick={handleLogout} className="exc-btn-logout">Sortir</button>
      </div>

      <div className="exc-tabs">
        {VIEWS.map(v => (
          <button key={v} className={`exc-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      <div className="exc-content">
        {loading && <p className="exc-loading">Carregant...</p>}
        {!loading && view === 'Resum'    && <Dashboard excursions={excursions} saldos={saldos} asistencies={asistencies} ratios={ratios} currentUser={loggedUser} />}
        {!loading && view === 'Nova sortida' && <NouaExcursio onSaved={loadData} />}
        {!loading && view === 'Historial'    && <Historial excursions={excursions} onDelete={handleDelete} onSaved={loadData} />}
      </div>
    </div>
  )
}
