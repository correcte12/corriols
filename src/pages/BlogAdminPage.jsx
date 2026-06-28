import { useEffect, useState, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ArticleEditor from '../components/blog/ArticleEditor'
import ImportArticlesModal from '../components/blog/ImportArticlesModal'
import {
  listArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  setArticlePublished,
  uploadBlogImage,
  slugify,
} from '../lib/blogStorage'
import './BlogAdminPage.css'

const todayStr = () => new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  cover_url: '',
  original_author: '',
  source_url: '',
  published: false,
  published_at: '',
}

export default function BlogAdminPage() {
  const { user, loading: authLoading } = useAuth()

  const [articles, setArticles] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const coverInputRef = useRef(null)

  const loadArticles = async () => {
    setLoadingList(true)
    try {
      const data = await listArticles({ publishedOnly: false })
      setArticles(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (user) loadArticles()
  }, [user])

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />

  const flashSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const startNew = () => {
    setForm({ ...EMPTY_FORM, published_at: todayStr() })
    setEditing(true)
    setError('')
  }

  const startEdit = async (article) => {
    setError('')
    try {
      const full = await getArticleById(article.id)
      setForm({
        id: full.id,
        title: full.title || '',
        slug: full.slug || '',
        excerpt: full.excerpt || '',
        body: full.body || '',
        cover_url: full.cover_url || '',
        original_author: full.original_author || '',
        source_url: full.source_url || '',
        published: full.published || false,
        published_at: (full.published_at || full.created_at || '').slice(0, 10),
      })
      setEditing(true)
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm(EMPTY_FORM)
  }

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleCoverFile = async (file) => {
    if (!file) return
    setUploadingCover(true)
    setError('')
    try {
      const { url } = await uploadBlogImage(file)
      updateField('cover_url', url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSave = async (publishOverride) => {
    if (!form.title.trim()) {
      setError('El títol és obligatori.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      published: publishOverride ?? form.published,
    }
    try {
      if (form.id) {
        await updateArticle(form.id, payload)
        flashSuccess('Article desat.')
      } else {
        const created = await createArticle(payload, user.id)
        setForm((prev) => ({ ...prev, id: created.id, slug: created.slug }))
        flashSuccess('Article creat.')
      }
      if (publishOverride !== undefined) updateField('published', publishOverride)
      await loadArticles()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = async (article) => {
    setError('')
    try {
      await setArticlePublished(article.id, !article.published)
      await loadArticles()
      if (form.id === article.id) updateField('published', !article.published)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (article) => {
    if (!window.confirm(`Eliminar l'article "${article.title}"?`)) return
    setError('')
    try {
      await deleteArticle(article.id)
      if (form.id === article.id) cancelEdit()
      await loadArticles()
      flashSuccess('Article eliminat.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`badmin-page${editing ? ' badmin-page--editing' : ''}`}>
      <div className="badmin-header">
        <Link to="/blog" className="badmin-back-link">← Blog</Link>
        <p className="badmin-section-label">Administració</p>
        <h1 className="badmin-title">Gestionar blog</h1>
        <p className="badmin-user">{user?.email}</p>
      </div>

      {error && (
        <div className="badmin-alert badmin-alert-error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="badmin-alert-close">×</button>
        </div>
      )}
      {success && <div className="badmin-alert badmin-alert-success">{success}</div>}

      {!editing ? (
        /* ---------- Vista llista ---------- */
        <div className="badmin-list-view">
          <div className="badmin-list-toolbar">
            <h2 className="badmin-card-title">Articles ({articles.length})</h2>
            <div className="badmin-toolbar-actions">
              <button onClick={() => setShowImportModal(true)} className="badmin-btn badmin-btn-secondary">
                📥 Importar
              </button>
              <button onClick={startNew} className="badmin-btn badmin-btn-primary">
                + Nou article
              </button>
            </div>
          </div>
          <div className="badmin-card">
            {loadingList ? (
              <p className="badmin-muted">Carregant...</p>
            ) : articles.length === 0 ? (
              <p className="badmin-muted">Encara no hi ha articles. Crea'n el primer.</p>
            ) : (
              <ul className="badmin-list">
                {articles.map((a) => (
                  <li key={a.id} className="badmin-list-item">
                    <div className="badmin-list-main" onClick={() => startEdit(a)}>
                      <p className="badmin-list-title">{a.title}</p>
                      <span className={`badmin-badge${a.published ? ' badmin-badge--pub' : ''}`}>
                        {a.published ? 'Publicat' : 'Esborrany'}
                      </span>
                    </div>
                    <div className="badmin-list-actions">
                      <button
                        onClick={() => startEdit(a)}
                        className="badmin-btn-icon"
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleTogglePublish(a)}
                        className="badmin-btn-icon"
                        title={a.published ? 'Despublicar' : 'Publicar'}
                      >
                        {a.published ? '⏸' : '▲'}
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="badmin-btn-icon badmin-btn-danger"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        /* ---------- Vista editor (amplada completa) ---------- */
        <div className="badmin-editor-view">
          <div className="badmin-editor-bar">
            <button onClick={cancelEdit} className="badmin-btn badmin-btn-muted">
              ← Tornar a la llista
            </button>
            <div className="badmin-editor-bar-actions">
              <span className={`badmin-badge${form.published ? ' badmin-badge--pub' : ''}`}>
                {form.published ? 'Publicat' : 'Esborrany'}
              </span>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="badmin-btn badmin-btn-secondary"
              >
                {saving ? 'Desant...' : 'Desar esborrany'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="badmin-btn badmin-btn-primary"
              >
                {saving ? 'Desant...' : form.published ? 'Desar i publicar' : 'Publicar'}
              </button>
            </div>
          </div>

          <div className="badmin-editor-grid">
            {/* Columna principal: títol + contingut */}
            <div className="badmin-editor-main">
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Títol de l'article"
                className="badmin-title-input"
              />
              {form.title && !form.id && (
                <p className="badmin-slug-preview">
                  Slug: <code>{slugify(form.slug || form.title)}</code>
                </p>
              )}
              <ArticleEditor
                value={form.body}
                onChange={(html) => updateField('body', html)}
                onError={setError}
              />
            </div>

            {/* Columna lateral: ajustos */}
            <aside className="badmin-editor-side">
              <div className="badmin-card">
                <h3 className="badmin-card-title">Resum</h3>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => updateField('excerpt', e.target.value)}
                  placeholder="Breu descripció que apareix a la llista del blog"
                  className="badmin-input"
                  rows={3}
                />
              </div>

              <div className="badmin-card">
                <h3 className="badmin-card-title">Data de publicació</h3>
                <input
                  type="date"
                  value={form.published_at}
                  onChange={(e) => updateField('published_at', e.target.value)}
                  className="badmin-input"
                />
              </div>

              <div className="badmin-card">
                <h3 className="badmin-card-title">Portada</h3>
                {form.cover_url ? (
                  <div className="badmin-cover-preview">
                    <img src={form.cover_url} alt="Portada" />
                    <button
                      onClick={() => updateField('cover_url', '')}
                      className="badmin-btn-icon badmin-btn-danger"
                      title="Treure portada"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="badmin-btn badmin-btn-secondary badmin-btn-full"
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? 'Pujant...' : 'Pujar portada'}
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handleCoverFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>

              <div className="badmin-card">
                <h3 className="badmin-card-title">Crèdit de l'autor (Facebook)</h3>
                <div className="badmin-field">
                  <label>Autor original</label>
                  <input
                    type="text"
                    value={form.original_author}
                    onChange={(e) => updateField('original_author', e.target.value)}
                    placeholder="Nom de l'autor"
                    className="badmin-input"
                  />
                </div>
                <div className="badmin-field">
                  <label>Enllaç a la publicació</label>
                  <input
                    type="url"
                    value={form.source_url}
                    onChange={(e) => updateField('source_url', e.target.value)}
                    placeholder="https://www.facebook.com/..."
                    className="badmin-input"
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportArticlesModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            loadArticles()
            flashSuccess('Articles importats com a esborranys.')
          }}
          userId={user.id}
        />
      )}
    </div>
  )
}
