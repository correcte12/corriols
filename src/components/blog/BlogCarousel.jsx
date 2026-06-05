import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listArticles } from '../../lib/blogStorage'
import './BlogCarousel.css'

const MAX_ARTICLES = 3

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ca-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

export default function BlogCarousel() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const trackRef = useRef(null)

  useEffect(() => {
    let active = true
    listArticles({ publishedOnly: true })
      .then((data) => {
        if (active) setArticles(data.slice(0, MAX_ARTICLES))
      })
      .catch(() => {
        if (active) setArticles([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const scrollBy = (dir) => {
    const track = trackRef.current
    if (!track) return
    const amount = track.clientWidth * 0.8
    track.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  // No mostrem la secció si no hi ha articles publicats
  if (loading || articles.length === 0) return null

  const showArrows = articles.length > 1

  return (
    <section className="blog-carousel-section">
      <div className="blog-carousel-header">
        <div>
          <h2>Últims articles del blog</h2>
          <p>Consells i recursos per a les nostres sortides.</p>
        </div>
        <Link to="/blog" className="blog-carousel-all-btn">
          Veure tot el blog →
        </Link>
      </div>

      <div className="blog-carousel">
        {showArrows && (
          <button
            type="button"
            className="blog-carousel-arrow blog-carousel-arrow--prev"
            onClick={() => scrollBy(-1)}
            aria-label="Anterior"
          >
            ‹
          </button>
        )}

        <div className="blog-carousel-track" ref={trackRef}>
          {articles.map((a) => (
            <Link key={a.id} to={`/blog/${a.slug}`} className="blog-carousel-card">
              <div className="blog-carousel-cover">
                {a.cover_url ? (
                  <img src={a.cover_url} alt={a.title} loading="lazy" />
                ) : (
                  <div className="blog-carousel-no-cover">Corriols</div>
                )}
              </div>
              <div className="blog-carousel-body">
                <h3>{a.title}</h3>
                {a.excerpt && <p className="blog-carousel-excerpt">{a.excerpt}</p>}
                <span className="blog-carousel-date">
                  {formatDate(a.published_at || a.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {showArrows && (
          <button
            type="button"
            className="blog-carousel-arrow blog-carousel-arrow--next"
            onClick={() => scrollBy(1)}
            aria-label="Següent"
          >
            ›
          </button>
        )}
      </div>

      <div className="blog-carousel-footer">
        <Link to="/blog" className="blog-carousel-footer-btn">
          Anar al blog
        </Link>
      </div>
    </section>
  )
}
