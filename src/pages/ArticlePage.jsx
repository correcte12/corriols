import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { getArticleBySlug } from '../lib/blogStorage'
import './ArticlePage.css'

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ca-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

export default function ArticlePage() {
  const { slug } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getArticleBySlug(slug)
        if (!data || !data.published) {
          setError("Aquest article no existeix o no està disponible.")
        } else {
          setArticle(data)
        }
      } catch (err) {
        setError(err.message || "No s'ha pogut carregar l'article.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  if (loading) return <div className="article-page"><div className="article-status">Carregant...</div></div>

  if (error) {
    return (
      <div className="article-page">
        <div className="article-error">{error}</div>
        <Link to="/blog" className="article-back-link">← Tornar al blog</Link>
      </div>
    )
  }

  const safeHtml = DOMPurify.sanitize(article.body || '', {
    ADD_ATTR: ['target', 'rel'],
  })

  return (
    <article className="article-page">
      <Link to="/blog" className="article-back-link">← Tornar al blog</Link>

      <header className="article-head">
        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">
          {article.original_author && <span>per {article.original_author}</span>}
          <span>{formatDate(article.published_at || article.created_at)}</span>
        </div>
      </header>

      {article.cover_url && (
        <img src={article.cover_url} alt={article.title} className="article-cover" />
      )}

      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {(article.original_author || article.source_url) && (
        <footer className="article-credit">
          <p>
            Article original
            {article.original_author && (
              <> de <strong>{article.original_author}</strong></>
            )}
            {article.source_url && (
              <>
                {' — '}
                <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                  veure la publicació original
                </a>
              </>
            )}
          </p>
          <p className="article-credit-note">
            Publicat amb permís de l'autor. Tots els drets pertanyen al seu autor original.
          </p>
        </footer>
      )}
    </article>
  )
}
