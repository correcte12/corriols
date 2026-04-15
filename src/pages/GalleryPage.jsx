import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAlbumPhotos, getGalleryAlbums } from '../lib/galleryStorage'
import './GalleryPage.css'

export default function GalleryPage() {
  const { albumSlug } = useParams()
  const { user } = useAuth()
  const [albums, setAlbums] = useState([])
  const [photos, setPhotos] = useState([])
  const [albumTitle, setAlbumTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        if (albumSlug) {
          const result = await getAlbumPhotos(albumSlug)
          setAlbumTitle(result.album.title)
          setPhotos(result.photos)
          setAlbums([])
        } else {
          const result = await getGalleryAlbums()
          setAlbums(result)
          setPhotos([])
          setAlbumTitle('')
        }
      } catch (err) {
        setError(err.message || "No s'ha pogut carregar la galeria.")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [albumSlug])

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <p className="gallery-section-label">Galeria</p>
        <h1 className="gallery-title">
          {albumSlug ? albumTitle : 'Àlbums de fotos'}
        </h1>
        <p className="gallery-subtitle">
          {albumSlug
            ? 'Fotos de la sortida seleccionada.'
            : "Explora les sortides per àlbums."}
        </p>
        {user && !albumSlug && (
          <Link to="/admin/galeria" className="gallery-admin-btn">
            Gestionar galeria
          </Link>
        )}
      </div>

      {albumSlug && (
        <Link to="/galeria" className="gallery-back-link">
          ← Tornar als àlbums
        </Link>
      )}

      {loading && (
        <div className="gallery-status">Carregant galeria...</div>
      )}

      {!loading && error && (
        <div className="gallery-error">{error}</div>
      )}

      {!loading && !error && !albumSlug && albums.length === 0 && (
        <div className="gallery-status">No hi ha àlbums disponibles.</div>
      )}

      {!loading && !error && !albumSlug && albums.length > 0 && (
        <div className="gallery-albums-grid">
          {albums.map((album) => (
            <Link
              key={album.slug}
              to={`/galeria/${encodeURIComponent(album.slug)}`}
              className="gallery-album-card"
            >
              <div className="gallery-album-cover">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.title} />
                ) : (
                  <div className="gallery-album-no-cover">Sense portada</div>
                )}
              </div>
              <div className="gallery-album-info">
                <h2>{album.title}</h2>
                <p>{album.count} foto{album.count !== 1 ? 's' : ''}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && albumSlug && photos.length === 0 && (
        <div className="gallery-status">Aquest àlbum no té fotos.</div>
      )}

      {!loading && !error && albumSlug && photos.length > 0 && (
        <div className="gallery-photos-masonry">
          {photos.map((photo) => (
            <a
              key={photo.path}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gallery-photo-item"
            >
              <img src={photo.url} alt={photo.name} loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
