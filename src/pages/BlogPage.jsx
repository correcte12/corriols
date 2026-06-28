import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listArticles, listCategories } from '../lib/blogStorage'
import './BlogPage.css'

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ca-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

export default function BlogPage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [articlesData, categoriesData] = await Promise.all([
          listArticles({ publishedOnly: true, categoryId: selectedCategory }),
          listCategories(),
        ])
        setArticles(articlesData)
        setCategories(categoriesData)
      } catch (err) {
        setError(err.message || "No s'ha pogut carregar el blog.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedCategory])

  return (
    <div className="blog-page">
      <div className="blog-header">
        <p className="blog-section-label">Blog</p>
        <h1 className="blog-title">Articles</h1>
        <p className="blog-subtitle">Articles i recursos útils per a les nostres sortides.</p>
        {user && (
          <Link to="/admin/blog" className="blog-admin-btn">
            Gestionar blog
          </Link>
        )}
      </div>

      {categories.length > 0 && (
        <div className="blog-categories-filter">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`blog-category-btn${selectedCategory === null ? ' active' : ''}`}
          >
            Tots
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`blog-category-btn${selectedCategory === c.id ? ' active' : ''}`}
              style={{ '--category-color': c.color }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="blog-status">Carregant articles...</div>}
      {!loading && error && <div className="blog-error">{error}</div>}
      {!loading && !error && articles.length === 0 && (
        <div className="blog-status">Encara no hi ha articles publicats.</div>
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="blog-grid">
          {articles.map((a) => (
            <Link key={a.id} to={`/blog/${a.slug}`} className="blog-card">
              <div className="blog-card-cover">
                {a.cover_url ? (
                  <img src={a.cover_url} alt={a.title} loading="lazy" />
                ) : (
                  <div className="blog-card-no-cover">Corriols</div>
                )}
              </div>
              <div className="blog-card-body">
                <h2 className="blog-card-title">{a.title}</h2>
                {a.excerpt && <p className="blog-card-excerpt">{a.excerpt}</p>}
                <div className="blog-card-meta">
                  {a.original_author && <span>per {a.original_author}</span>}
                  <span>{formatDate(a.published_at || a.created_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
