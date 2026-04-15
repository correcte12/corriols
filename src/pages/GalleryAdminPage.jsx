import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getGalleryAlbums,
  getAlbumPhotosList,
  createAlbum,
  uploadPhoto,
  deletePhoto,
  deleteAlbum,
  setAlbumCover,
  normalizeAlbumSlug,
} from '../lib/galleryStorage'
import './GalleryAdminPage.css'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic'
const MAX_FILE_SIZE_MB = Number(import.meta.env.VITE_GALLERY_MAX_FILE_MB || 12)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function GalleryAdminPage() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState([])
  const [loadingAlbums, setLoadingAlbums] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [queue, setQueue] = useState([])
  const [dragging, setDragging] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [globalSuccess, setGlobalSuccess] = useState('')
  const fileInputRef = useRef(null)

  const upsertAlbum = useCallback((album) => {
    setAlbums((prev) => {
      const exists = prev.some((item) => item.slug === album.slug)
      const next = exists
        ? prev.map((item) => (item.slug === album.slug ? { ...item, ...album } : item))
        : [...prev, album]
      return next.sort((a, b) => a.title.localeCompare(b.title, 'ca'))
    })
  }, [])

  const loadAlbums = async () => {
    setLoadingAlbums(true)
    try {
      const result = await getGalleryAlbums({ includeEmpty: true })
      setAlbums(result)
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setLoadingAlbums(false)
    }
  }

  useEffect(() => { loadAlbums() }, [])

  useEffect(() => {
    if (!loadingAlbums && albums.length > 0 && !selectedAlbum) {
      selectAlbum(albums[0])
    }
  }, [albums, loadingAlbums]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectAlbum = async (album) => {
    setLoadingPhotos(true)
    setSelectedAlbum({ ...album, photos: [] })
    setQueue([])
    setGlobalError('')
    try {
      const photos = await getAlbumPhotosList(album.slug)
      setSelectedAlbum({ ...album, photos })
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setLoadingPhotos(false)
    }
  }

  const handleCreateAlbum = async (e) => {
    e.preventDefault()
    if (!newAlbumName.trim()) return
    setCreatingAlbum(true)
    setGlobalError('')
    try {
      const created = await createAlbum(newAlbumName)
      const createdAlbum = { ...created, count: 0, coverUrl: null, photos: [] }
      setNewAlbumName('')
      upsertAlbum(createdAlbum)
      setSelectedAlbum(createdAlbum)
      setQueue([])
      setGlobalSuccess(`Àlbum "${created.title}" creat.`)
      setTimeout(() => setGlobalSuccess(''), 3000)
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setCreatingAlbum(false)
    }
  }

  const handleDeleteAlbum = async (album, e) => {
    e.stopPropagation()
    if (!window.confirm(`Eliminar l'àlbum "${album.title}" i totes les seves fotos?`)) return
    setGlobalError('')
    try {
      await deleteAlbum(album.slug)
      if (selectedAlbum?.slug === album.slug) setSelectedAlbum(null)
      await loadAlbums()
      setGlobalSuccess(`Àlbum "${album.title}" eliminat.`)
      setTimeout(() => setGlobalSuccess(''), 3000)
    } catch (err) {
      setGlobalError(err.message)
    }
  }

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(`Eliminar la foto "${photo.name}"?`)) return
    setGlobalError('')
    try {
      await deletePhoto(photo.path)
      setSelectedAlbum((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.path !== photo.path),
      }))
      setAlbums((prev) =>
        prev.map((a) =>
          a.slug === selectedAlbum.slug ? { ...a, count: Math.max(0, a.count - 1) } : a,
        ),
      )
      setGlobalSuccess('Foto eliminada.')
      setTimeout(() => setGlobalSuccess(''), 3000)
    } catch (err) {
      setGlobalError(err.message)
    }
  }

  const handleSetCover = async (photo) => {
    if (!selectedAlbum) return
    setGlobalError('')
    try {
      await setAlbumCover(selectedAlbum.slug, photo.name)
      setSelectedAlbum((prev) => ({ ...prev, coverName: photo.name }))
      setAlbums((prev) =>
        prev.map((album) =>
          album.slug === selectedAlbum.slug
            ? { ...album, coverName: photo.name, coverUrl: photo.url }
            : album,
        ),
      )
      setGlobalSuccess(`Portada actualitzada: ${photo.name}`)
      setTimeout(() => setGlobalSuccess(''), 3000)
    } catch (err) {
      setGlobalError(err.message)
    }
  }

  const addFilesToQueue = useCallback((files) => {
    const sourceFiles = Array.from(files || [])
    if (!sourceFiles.length) return

    const imageFiles = sourceFiles.filter((f) => f.type.startsWith('image/'))
    const oversizedFiles = imageFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES)
    const acceptedFiles = imageFiles.filter((f) => f.size <= MAX_FILE_SIZE_BYTES)

    if (oversizedFiles.length) {
      setGlobalError(`${oversizedFiles.length} fitxer(s) supera(en) el màxim de ${MAX_FILE_SIZE_MB} MB.`)
    }

    if (!acceptedFiles.length) return

    const newItems = acceptedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      originalSize: file.size,
      optimizedSize: null,
      error: null,
    }))
    setQueue((prev) => [...prev, ...newItems])
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFilesToQueue(e.dataTransfer.files)
  }

  const removeFromQueue = (id) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((i) => i.id !== id)
    })
  }

  const uploadQueue = async () => {
    if (!selectedAlbum) return
    const pending = queue.filter((i) => i.status === 'pending')
    if (!pending.length) return
    setGlobalError('')

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' } : i)),
      )
      try {
        const result = await uploadPhoto(selectedAlbum.slug, item.file)
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'done', optimizedSize: result.optimizedSize } : i,
          ),
        )
        setSelectedAlbum((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), { name: result.name, path: result.path, url: result.url }],
        }))
        setAlbums((prev) =>
          prev.map((a) =>
            a.slug === selectedAlbum.slug ? { ...a, count: a.count + 1 } : a,
          ),
        )
      } catch (err) {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'error', error: err.message } : i,
          ),
        )
        setGlobalError(err.message)
      }
    }

    setGlobalSuccess('Pujada completada.')
    setTimeout(() => setGlobalSuccess(''), 4000)
  }

  const pendingCount = queue.filter((i) => i.status === 'pending').length

  return (
    <div className="gadmin-page">
      <div className="gadmin-header">
        <Link to="/galeria" className="gadmin-back-link">← Galeria</Link>
        <p className="gadmin-section-label">Administració</p>
        <h1 className="gadmin-title">Gestionar galeria</h1>
        <p className="gadmin-user">{user?.email}</p>
      </div>

      {globalError && (
        <div className="gadmin-alert gadmin-alert-error">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError('')} className="gadmin-alert-close">×</button>
        </div>
      )}
      {globalSuccess && (
        <div className="gadmin-alert gadmin-alert-success">
          <span>{globalSuccess}</span>
        </div>
      )}

      <div className="gadmin-layout">
        {/* Left: album list */}
        <div className="gadmin-sidebar">
          <div className="gadmin-card">
            <h2 className="gadmin-card-title">Nou àlbum</h2>
            <form onSubmit={handleCreateAlbum} className="gadmin-form">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Nom de l'àlbum"
                className="gadmin-input"
              />
              {newAlbumName.trim() && (
                <p className="gadmin-slug-preview">
                  Slug: <code>{normalizeAlbumSlug(newAlbumName)}</code>
                </p>
              )}
              <button
                type="submit"
                disabled={creatingAlbum || !newAlbumName.trim()}
                className="gadmin-btn gadmin-btn-primary"
              >
                {creatingAlbum ? 'Creant...' : 'Crear àlbum'}
              </button>
            </form>
          </div>

          <div className="gadmin-card">
            <h2 className="gadmin-card-title">Àlbums ({albums.length})</h2>
            {loadingAlbums ? (
              <p className="gadmin-muted">Carregant...</p>
            ) : albums.length === 0 ? (
              <p className="gadmin-muted">No hi ha àlbums.</p>
            ) : (
              <ul className="gadmin-album-list">
                {albums.map((album) => (
                  <li key={album.slug}>
                    <div
                      onClick={() => selectAlbum(album)}
                      className={`gadmin-album-item${selectedAlbum?.slug === album.slug ? ' gadmin-album-item--active' : ''}`}
                    >
                      <div className="gadmin-album-item-info">
                        <p className="gadmin-album-item-title">{album.title}</p>
                        <p className="gadmin-album-item-count">
                          {album.count} foto{album.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteAlbum(album, e)}
                        className="gadmin-btn-icon gadmin-btn-danger"
                        title="Eliminar àlbum"
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

        {/* Right: photos panel */}
        <div className="gadmin-main">
          {!selectedAlbum ? (
            <div className="gadmin-empty-panel">Selecciona un àlbum per gestionar les seves fotos.</div>
          ) : (
            <>
              <div className="gadmin-album-header">
                <h2 className="gadmin-album-name">{selectedAlbum.title}</h2>
                <button
                  onClick={() => { setSelectedAlbum(null); setQueue([]) }}
                  className="gadmin-btn-icon"
                >
                  ×
                </button>
              </div>

              {/* Upload zone */}
              <div className="gadmin-card">
                <h3 className="gadmin-card-title">Pujar fotos</h3>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`gadmin-dropzone${dragging ? ' gadmin-dropzone--active' : ''}`}
                >
                  <div className="gadmin-dropzone-icon">↑</div>
                  <p>Arrossega fotos aquí o <span className="gadmin-link">fes clic per seleccionar</span></p>
                  <p className="gadmin-dropzone-hint">JPG, PNG, WebP, AVIF, HEIC — s'optimitzen automàticament a WebP</p>
                  <p className="gadmin-dropzone-hint">Mida màxima per fitxer: {MAX_FILE_SIZE_MB} MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={IMAGE_ACCEPT}
                    onChange={(e) => addFilesToQueue(e.target.files)}
                    style={{ display: 'none' }}
                  />
                </div>

                {queue.length > 0 && (
                  <div className="gadmin-queue">
                    {queue.map((item) => (
                      <div key={item.id} className="gadmin-queue-item">
                        <img src={item.preview} alt={item.file.name} className="gadmin-queue-thumb" />
                        <div className="gadmin-queue-info">
                          <p className="gadmin-queue-name">{item.file.name}</p>
                          <p className="gadmin-queue-size">
                            {formatBytes(item.originalSize)}
                            {item.optimizedSize != null && (
                              <span className="gadmin-queue-saved">
                                {' → '}{formatBytes(item.optimizedSize)}{' '}
                                ({Math.round((1 - item.optimizedSize / item.originalSize) * 100)}% menys)
                              </span>
                            )}
                          </p>
                          {item.error && <p className="gadmin-queue-error">{item.error}</p>}
                        </div>
                        <span className={`gadmin-queue-status gadmin-queue-status--${item.status}`}>
                          {item.status === 'pending' && 'En cua'}
                          {item.status === 'uploading' && 'Pujant...'}
                          {item.status === 'done' && '✓'}
                          {item.status === 'error' && '!'}
                        </span>
                        {item.status === 'pending' && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="gadmin-btn-icon gadmin-btn-muted"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {pendingCount > 0 && (
                      <button onClick={uploadQueue} className="gadmin-btn gadmin-btn-primary gadmin-btn-full">
                        ↑ Pujar {pendingCount} foto{pendingCount !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Existing photos */}
              <div className="gadmin-card">
                <h3 className="gadmin-card-title">
                  Fotos de l'àlbum ({selectedAlbum.photos?.length ?? 0})
                </h3>
                {loadingPhotos ? (
                  <p className="gadmin-muted">Carregant fotos...</p>
                ) : !selectedAlbum.photos?.length ? (
                  <p className="gadmin-muted">No hi ha fotos en aquest àlbum.</p>
                ) : (
                  <div className="gadmin-photos-grid">
                    {selectedAlbum.photos.map((photo) => (
                      <div key={photo.path} className="gadmin-photo-item">
                        {selectedAlbum.coverName === photo.name && (
                          <span className="gadmin-cover-badge">Portada</span>
                        )}
                        <img src={photo.url} alt={photo.name} />
                        <div className="gadmin-photo-overlay">
                          <p className="gadmin-photo-name">{photo.name}</p>
                          <div className="gadmin-photo-actions">
                            <button
                              onClick={() => handleSetCover(photo)}
                              className={`gadmin-btn-icon gadmin-btn-cover${selectedAlbum.coverName === photo.name ? ' gadmin-btn-cover--active' : ''}`}
                              title="Marcar com a portada"
                            >
                              ★
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(photo)}
                              className="gadmin-btn-icon gadmin-btn-danger"
                              title="Eliminar foto"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
