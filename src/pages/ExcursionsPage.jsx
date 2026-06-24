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

async function saveExcursion(excursion, allExcursionsForContext = []) {
  // Usar contexto de todas las excursiones para calcular asistencias/ratios
  const allExc = [...allExcursionsForContext, excursion].sort((a, b) => new Date(a.data) - new Date(b.data))
  const subtotales = calcularSubtotalesParaExcursion(excursion, allExc)

  const excursionConSubtotales = {
    ...excursion,
    ...subtotales
  }

  const { error } = await supabase.from('grup_excursions').insert(excursionConSubtotales)
  if (error) throw error
}

async function deleteExcursion(id) {
  const { error } = await supabase.from('grup_excursions').delete().eq('id', id)
  if (error) throw error
}

async function updateExcursion(id, fields, allExcursionsForContext = []) {
  // Calcular subtotales con la excursión actualizada
  const allExc = allExcursionsForContext
    .map(e => e.id === id ? { ...e, ...fields } : e)
    .sort((a, b) => new Date(a.data) - new Date(b.data))

  const excursionActualizada = allExc.find(e => e.id === id)
  const subtotales = calcularSubtotalesParaExcursion(excursionActualizada, allExc)

  const fieldsConSubtotales = {
    ...fields,
    ...subtotales
  }

  const { error } = await supabase.from('grup_excursions').update(fieldsConSubtotales).eq('id', id)
  if (error) throw error
}

// ─── Lògica de saldos (3 variantes) ───────────────────────────────────────────

// VARIANTE 1: Deuta de Quilòmetres (actual)
// - Conductor: -(km × nº_passatgers)
// - Passatger: +km
function calcularSaldos_V1(excursions) {
  const saldos = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  for (const exc of excursions) {
    const conductors = exc.conductors ?? []
    const passatgers = exc.passatgers ?? []
    const km         = parseFloat(exc.km) || 0
    let nPasajeros  = passatgers.length

    if (conductors.length === 0) continue

    // Si hay conductor esporádico, restar del total de pasajeros
    if (exc.hayOtroConductor && exc.pasajerosPorOtroConductor) {
      nPasajeros -= parseInt(exc.pasajerosPorOtroConductor)
    }

    // Conductors resten: -(km × nº_passatgers)
    for (const cid of conductors) {
      if (saldos[cid] !== undefined) saldos[cid] -= km * nPasajeros
    }

    // Passatgers sumen: +km
    for (const uid of passatgers) {
      if (saldos[uid] !== undefined) saldos[uid] += km
    }
  }

  return saldos
}

// VARIANTE 2: Consumo de Plazas
// - Conductor: -(km × (nº_passatgers - pasajeros_conductor_esporádico))
// - Passatger: +km
function calcularSaldos_V2(excursions) {
  const saldos = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  for (const exc of excursions) {
    const conductors = exc.conductors ?? []
    const passatgers = exc.passatgers ?? []
    const km         = parseFloat(exc.km) || 0
    let nPasajeros  = passatgers.length

    if (conductors.length === 0) continue

    // Si hay conductor esporádico, restar del total de pasajeros
    if (exc.hayOtroConductor && exc.pasajerosPorOtroConductor) {
      nPasajeros -= parseInt(exc.pasajerosPorOtroConductor)
    }

    // Conductors resten: -(km × nº_passatgers_netos)
    for (const cid of conductors) {
      if (saldos[cid] !== undefined) saldos[cid] -= km * nPasajeros
    }

    // Passatgers sumen: +km
    for (const uid of passatgers) {
      if (saldos[uid] !== undefined) saldos[uid] += km
    }
  }

  return saldos
}

// VARIANTE 3: Consumo de Plazas + Ratio de Asistencia
// - Calcula V2
// - Ajusta por ratio de asistencia: factor = (100 - porcentaje_asistencia) / 100
function calcularSaldos_V3(excursions) {
  const saldosV2 = calcularSaldos_V2(excursions)
  const asistencias = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  // Contar asistencias
  for (const exc of excursions) {
    const tots = [...(exc.conductors ?? []), ...(exc.passatgers ?? [])]
    for (const uid of tots) {
      if (asistencias[uid] !== undefined) asistencias[uid]++
    }
  }

  const totalExcursiones = excursions.length || 1

  // Aplicar factor de asistencia a los saldos de V2
  return Object.fromEntries(
    USUARIOS.map(u => {
      const n = asistencias[u.id] || 0
      const ratio = n / totalExcursiones
      const factor = (100 - (ratio * 100)) / 100
      const saldoFinal = saldosV2[u.id] * factor
      return [u.id, saldoFinal]
    })
  )
}

// Para compatibilidad, calcularSaldos() usa V1 por defecto
function calcularSaldos(excursions) {
  return calcularSaldos_V1(excursions)
}

// Calcular el delta (cambio) de una excursión específica en V1
function calcularDeltaV1(excursion) {
  const delta = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  const conductors = excursion.conductors ?? []
  const passatgers = excursion.passatgers ?? []
  const km = parseFloat(excursion.km) || 0
  let nPasajeros = passatgers.length

  if (conductors.length === 0) return delta

  if (excursion.hayOtroConductor && excursion.pasajerosPorOtroConductor) {
    nPasajeros -= parseInt(excursion.pasajerosPorOtroConductor)
  }

  for (const cid of conductors) {
    if (delta[cid] !== undefined) delta[cid] -= km * nPasajeros
  }
  for (const uid of passatgers) {
    if (delta[uid] !== undefined) delta[uid] += km
  }

  return delta
}

// Calcular el delta de una excursión específica en V2
function calcularDeltaV2(excursion) {
  const delta = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))

  const conductors = excursion.conductors ?? []
  const passatgers = excursion.passatgers ?? []
  const km = parseFloat(excursion.km) || 0
  let nPasajeros = passatgers.length

  if (conductors.length === 0) return delta

  if (excursion.hayOtroConductor && excursion.pasajerosPorOtroConductor) {
    nPasajeros -= parseInt(excursion.pasajerosPorOtroConductor)
  }

  for (const cid of conductors) {
    if (delta[cid] !== undefined) delta[cid] -= km * nPasajeros
  }
  for (const uid of passatgers) {
    if (delta[uid] !== undefined) delta[uid] += km
  }

  return delta
}

// Calcular el delta de una excursión en V3 (requiere contexto de asistencias)
function calcularDeltaV3(excursion, asistencias, totalExcursiones) {
  const deltaV2 = calcularDeltaV2(excursion)
  const totalExc = totalExcursiones || 1

  return Object.fromEntries(
    USUARIOS.map(u => {
      const n = asistencias[u.id] || 0
      const ratio = n / totalExc
      const factor = (100 - (ratio * 100)) / 100
      const deltaV3 = deltaV2[u.id] * factor
      return [u.id, deltaV3]
    })
  )
}

// Calcular los subtotales de una excursión específica dado el contexto completo
function calcularSubtotalesParaExcursion(excursion, allExcursions) {
  // Contar asistencias globales
  const asistencias = Object.fromEntries(USUARIOS.map(u => [u.id, 0]))
  for (const exc of allExcursions) {
    const tots = [...(exc.conductors ?? []), ...(exc.passatgers ?? [])]
    for (const uid of tots) {
      if (asistencias[uid] !== undefined) asistencias[uid]++
    }
  }

  return {
    subtotal_variant1: calcularDeltaV1(excursion),
    subtotal_variant2: calcularDeltaV2(excursion),
    subtotal_variant3: calcularDeltaV3(excursion, asistencias, allExcursions.length),
  }
}

// Calcular los 3 subtotales para guardar en la excursión
function calcularSubtotales(excursions) {
  return calcularSubtotalesParaExcursion(excursions[0], excursions)
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
  // Els que tienen saldo positiu más alto (més quilòmetres "regalats") han de conduir
  return USUARIOS
    .slice()
    .sort((a, b) => saldos[b.id] - saldos[a.id])
    .slice(0, numConductors)
    .map(u => u.id)
}

// ─── Vistes ───────────────────────────────────────────────────────────────────
function Dashboard({ excursions, saldos, asistencies, ratios, currentUser, variant, onVariantChange }) {
  const suggested = designarConductors(saldos, asistencies, 2)

  const variantLabels = {
    v1: 'Variante 1: Deuta de Quilòmetres',
    v2: 'Variante 2: Consumo de Plazas',
    v3: 'Variante 3: Consumo + Ratio Asistencia',
  }

  return (
    <div className="exc-dashboard">
      <div className="exc-variant-selector" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#1e293b', borderRadius: '6px', border: '1px solid var(--exc-border)' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--exc-muted)' }}>
          Mètode de càlcul
        </label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['v1', 'v2', 'v3'].map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--exc-text)' }}>
              <input type="radio" name="variant" value={v} checked={variant === v} onChange={e => onVariantChange(e.target.value)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--exc-text)' }}>{variantLabels[v]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="exc-section-title">Saldos actuals ({variantLabels[variant]})</div>
      <div className="exc-saldo-grid">
        {USUARIOS.map(u => {
          const s = saldos[u.id]
          const n = asistencies[u.id]
          return (
            <div key={u.id} className={`exc-saldo-card ${u.id === currentUser ? 'exc-saldo-me' : ''}`}>
              <span className="exc-saldo-name">{u.nombre}</span>
              <span className={`exc-saldo-val ${s < 0 ? 'neg' : s > 0 ? 'pos' : ''}`}>
                {s > 0 ? '+' : ''}{s.toFixed(0)} km
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--exc-muted)', marginTop: 2 }}>
                {n} sortides {s > 0 ? '(ha de conduir)' : s < 0 ? '(ha conduït)' : '(equilibrat)'}
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
        <span className="exc-suggested-hint">(saldo més alt = més quilòmetres "regalats")</span>
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

function NouaExcursio({ onSaved, excursions = [] }) {
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
      }, excursions)
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

      // Conductors resten: -(km × nº_passatgers)
      for (const cid of conductors) {
        if (saldos[cid] !== undefined) saldos[cid] -= km * passatgers.length
      }

      // Passatgers sumen: +km
      for (const uid of passatgers) {
        if (saldos[uid] !== undefined) saldos[uid] += km
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

    // Conductors resten: -(km × nº_passatgers)
    for (const cid of conductors) {
      if (impact[cid] !== undefined) impact[cid] -= km * passatgers.length
    }

    // Passatgers sumen: +km
    for (const uid of passatgers) {
      if (impact[uid] !== undefined) impact[uid] += km
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
      }, allExcursions)
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
                    <div className="exc-p-calc-line">Conductor: <strong>−(km × pax)</strong></div>
                  )}
                  {isPax && (
                    <div className="exc-p-calc-line">Passatger: <strong>+km</strong></div>
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

function Comparativa({ excursions }) {
  const v1Saldos = calcularSaldos_V1(excursions)
  const v2Saldos = calcularSaldos_V2(excursions)
  const v3Saldos = calcularSaldos_V3(excursions)

  return (
    <div>
      <div className="exc-section-title">Comparativa de les 3 variantes</div>
      {excursions.length === 0 && <p className="exc-empty">Encara no hi ha sortides registrades.</p>}

      <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#1e293b', borderBottom: '2px solid var(--exc-border)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--exc-text)' }}>Usuari</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--exc-text)' }}>V1: Deuta</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--exc-text)' }}>V2: Consum</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--exc-text)' }}>V3: Consum+Ratio</th>
            </tr>
          </thead>
          <tbody>
            {USUARIOS.map(u => {
              const v1 = v1Saldos[u.id]
              const v2 = v2Saldos[u.id]
              const v3 = v3Saldos[u.id]
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--exc-border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500 }}>{u.nombre}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: v1 < 0 ? '#d32f2f' : v1 > 0 ? '#388e3c' : '#666' }}>
                    {v1 > 0 ? '+' : ''}{v1.toFixed(0)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: v2 < 0 ? '#d32f2f' : v2 > 0 ? '#388e3c' : '#666' }}>
                    {v2 > 0 ? '+' : ''}{v2.toFixed(0)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: v3 < 0 ? '#d32f2f' : v3 > 0 ? '#388e3c' : '#666' }}>
                    {v3 > 0 ? '+' : ''}{v3.toFixed(0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="exc-section-title" style={{ marginTop: '2rem' }}>Evolució per sortida</div>
      {excursions.slice().reverse().map(e => (
        <div key={e.id} style={{ padding: '1rem', background: 'var(--exc-bg-secondary, #f5f5f5)', borderRadius: '6px', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--exc-accent)' }}>
            {e.data} — {e.destino} ({parseFloat(e.km).toFixed(0)} km)
          </div>
          <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: 'var(--exc-accent)' }}>V1: Deuta</div>
              {USUARIOS.map(u => (
                <div key={u.id} style={{ fontSize: '0.8rem', color: 'var(--exc-muted)' }}>
                  {u.nombre}: {e.subtotal_variant1 ? (e.subtotal_variant1[u.id] > 0 ? '+' : '') + e.subtotal_variant1[u.id].toFixed(0) : '—'}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: 'var(--exc-accent)' }}>V2: Consum</div>
              {USUARIOS.map(u => (
                <div key={u.id} style={{ fontSize: '0.8rem', color: 'var(--exc-muted)' }}>
                  {u.nombre}: {e.subtotal_variant2 ? (e.subtotal_variant2[u.id] > 0 ? '+' : '') + e.subtotal_variant2[u.id].toFixed(0) : '—'}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: 'var(--exc-accent)' }}>V3: Consum+Ratio</div>
              {USUARIOS.map(u => (
                <div key={u.id} style={{ fontSize: '0.8rem', color: 'var(--exc-muted)' }}>
                  {u.nombre}: {e.subtotal_variant3 ? (e.subtotal_variant3[u.id] > 0 ? '+' : '') + e.subtotal_variant3[u.id].toFixed(0) : '—'}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Explicacio() {
  return (
    <div>
      <div className="exc-section-title">Explicació dels 3 mètodes de càlcul</div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--exc-text)' }}>
          Variante 1: Deuta de Quilòmetres
        </h3>
        <div style={{ background: 'var(--exc-bg-secondary, #f5f5f5)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--exc-text)' }}>
            <strong>Fórmula:</strong>
          </p>
          <ul style={{ margin: '0.5rem 0 0.5rem 1.5rem', padding: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--exc-muted)' }}>
            <li><strong>Conductor:</strong> −(km × nº passatgers) = lo que "regala"</li>
            <li><strong>Passatger:</strong> +km = lo que "recibe"</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Exemple:</strong> Sortida 100 km, 4 persones (1 conductor + 3 passatgers)
          </p>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <li>Juan (conductor): −100 × 3 = <strong>−300</strong></li>
            <li>Ana, Luis, Tú (passatgers): +100 = <strong>+100</strong> cada un</li>
            <li>Total: −300 + 100 + 100 + 100 = <strong>0</strong> ✓</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Interpretació:</strong> Positiu = ha viatjat sense conduir (ha de posar coche) | Negatiu = ha conduït més (ja ha pagat)
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--exc-text)' }}>
          Variante 2: Consumo de Plazas
        </h3>
        <div style={{ background: 'var(--exc-bg-secondary, #f5f5f5)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--exc-text)' }}>
            <strong>Fórmula:</strong>
          </p>
          <ul style={{ margin: '0.5rem 0 0.5rem 1.5rem', padding: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--exc-muted)' }}>
            <li><strong>Conductor:</strong> −(km × nº passatgers nets) = lo que "aporta"</li>
            <li><strong>Passatger:</strong> +km = lo que "consume"</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Exemple:</strong> Sortida 100 km, 4 persones (1 conductor + 3 passatgers)
          </p>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <li>Juan (conductor): −100 × 3 = <strong>−300</strong></li>
            <li>Ana, Luis, Tú (passatgers): +100 = <strong>+100</strong> cada un</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Nota:</strong> En aquesta versió, les fórmules són similars a la V1. La diferència és conceptual (enfocada al "consum" vs "deuta").
          </p>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Amb conductor esporádic:</strong> Si un conductor extern porta 2 passatgers, el total nets es 3 − 2 = 1
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--exc-text)' }}>
          Variante 3: Consumo + Ratio de Asistencia
        </h3>
        <div style={{ background: 'var(--exc-bg-secondary, #f5f5f5)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--exc-text)' }}>
            <strong>Fórmula:</strong>
          </p>
          <ol style={{ margin: '0.5rem 0 0.5rem 1.5rem', padding: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--exc-muted)' }}>
            <li>Calcula V2 (Consumo de Plazas)</li>
            <li>Calcula ratio asistència: ratio = asistències / total excursions</li>
            <li>Factor multiplicador: factor = (100 − (ratio × 100)) / 100</li>
            <li>Saldo final: saldo_V2 × factor</li>
          </ol>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Exemple:</strong>
          </p>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <li>Total excursions: 20</li>
            <li>Tu has assistit: 15 (ratio = 75%)</li>
            <li>Factor: (100 − 75) / 100 = 0.25</li>
            <li>Si la V2 t'dona +200 → V3 = 200 × 0.25 = <strong>+50</strong></li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: 'var(--exc-muted)' }}>
            <strong>Interpretació:</strong> A menor asistència, major multiplicador. Penalitza (o equilibra) a qui assisteix esporàdicament, evitant saldos massa alts/baixos.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--exc-text)' }}>
          Quan usar cada una?
        </h3>
        <div style={{ background: 'var(--exc-bg-secondary, #f5f5f5)', padding: '1rem', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--exc-muted)' }}>
            <strong>V1 (Deuta):</strong> Més simple i intuitiva. Cada km pesa igual, el que "regales" es exactament lo que els altres "reben".
          </p>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--exc-muted)' }}>
            <strong>V2 (Consum):</strong> Enfocada al concepte de "consumo de recursos". Qui condueix més, més resten els seus quilòmetres.
          </p>
          <p style={{ margin: '0', fontSize: '0.95rem', color: 'var(--exc-muted)' }}>
            <strong>V3 (Consum+Ratio):</strong> Per grups on la asistencia és irregular. Evita que qui sempre va acumuli saldos massa grans.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Pàgina principal ─────────────────────────────────────────────────────────
const VIEWS = ['Resum', 'Nova sortida', 'Historial', 'Comparativa', 'Explicació']

export default function ExcursionsPage() {
  const [loggedUser, setLoggedUser] = useState(() => sessionStorage.getItem('exc_user') || null)
  const [loginId,    setLoginId]    = useState(USUARIOS[0].id)
  const [loginPass,  setLoginPass]  = useState('')
  const [loginError, setLoginError] = useState('')

  const [excursions, setExcursions] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [view,       setView]       = useState('Resum')
  const [variant,    setVariant]    = useState('v1')  // v1, v2, v3

  const saldos     = useMemo(() => {
    switch(variant) {
      case 'v2': return calcularSaldos_V2(excursions)
      case 'v3': return calcularSaldos_V3(excursions)
      default: return calcularSaldos_V1(excursions)
    }
  }, [excursions, variant])
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
    setView('Resum')
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
        {!loading && view === 'Resum'        && <Dashboard excursions={excursions} saldos={saldos} asistencies={asistencies} ratios={ratios} currentUser={loggedUser} variant={variant} onVariantChange={setVariant} />}
        {!loading && view === 'Nova sortida' && <NouaExcursio onSaved={loadData} excursions={excursions} />}
        {!loading && view === 'Historial'    && <Historial excursions={excursions} onDelete={handleDelete} onSaved={loadData} />}
        {!loading && view === 'Comparativa'  && <Comparativa excursions={excursions} />}
        {!loading && view === 'Explicació'   && <Explicacio />}
      </div>
    </div>
  )
}
