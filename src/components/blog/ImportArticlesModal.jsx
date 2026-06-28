import { useEffect, useState } from 'react'
import { listMovetheraArticles, importExternalArticle } from '../../lib/blogStorage'
import './ImportArticlesModal.css'

const SOURCES = [
  { id: 'movethera', name: 'Movethera', fetcher: listMovetheraArticles },
]

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ca-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

export default function ImportArticlesModal({ onClose, onImported, userId }) {
  const [source, setSource] = useState('movethera')
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const loadArticles = async (sourceId) => {
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const sourceDef = SOURCES.find(s => s.id === sourceId)
      if (!sourceDef) throw new Error('Font no suportada')
      const data = await sourceDef.fetcher()
      setArticles(data)
    } catch (err) {
      setError(err.message)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArticles(source)
  }, [source])

  const toggleSelected = (id) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const toggleAll = () => {
    if (selected.size === articles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(articles.map(a => a.id)))
    }
  }

  const handleImport = async () => {
    if (selected.size === 0) {
      setError('Selecciona almenys un article.')
      return
    }

    setImporting(true)
    setError('')

    const selectedArticles = articles.filter(a => selected.has(a.id))
    let imported = 0
    let failed = 0

    for (const article of selectedArticles) {
      try {
        await importExternalArticle(article, userId)
        imported++
      } catch (err) {
        console.error(`Error importing ${article.title}:`, err)
        failed++
      }
    }

    setImporting(false)

    if (failed === 0) {
      setError('')
      onImported()
      onClose()
    } else {
      setError(`${imported} importats, ${failed} errors.`)
    }
  }

  return (
    <div className="import-modal-overlay">
      <div className="import-modal">
        <div className="import-modal-header">
          <h2>Importar artícles externs</h2>
          <button onClick={onClose} className="import-modal-close">×</button>
        </div>

        <div className="import-modal-source">
          <label>Font:</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {error && <div className="import-modal-error">{error}</div>}

        <div className="import-modal-articles">
          {loading ? (
            <p className="import-modal-muted">Carregant articles de {SOURCES.find(s => s.id === source)?.name}...</p>
          ) : articles.length === 0 ? (
            <p className="import-modal-muted">No s'han trobat articles.</p>
          ) : (
            <>
              <div className="import-modal-toolbar">
                <label className="import-modal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selected.size === articles.length}
                    onChange={toggleAll}
                    disabled={importing}
                  />
                  Seleccionar tots ({articles.length})
                </label>
              </div>

              <div className="import-modal-list">
                {articles.map(a => (
                  <div key={a.id} className="import-modal-item">
                    <label className="import-modal-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelected(a.id)}
                        disabled={importing}
                      />
                    </label>
                    <div className="import-modal-item-content">
                      <h3>{a.title}</h3>
                      {a.excerpt && <p>{a.excerpt}</p>}
                      <div className="import-modal-item-meta">
                        <span>{a.original_author}</span>
                        <span>{formatDate(a.published_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="import-modal-footer">
          <button
            onClick={onClose}
            disabled={importing}
            className="import-modal-btn import-modal-btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selected.size === 0}
            className="import-modal-btn import-modal-btn-primary"
          >
            {importing ? `Important (${selected.size})...` : `Importar (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
