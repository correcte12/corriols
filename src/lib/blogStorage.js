import { supabase } from './supabase'

const TABLE = 'articles'

export const getBlogBucketName = () =>
  import.meta.env.VITE_SUPABASE_BLOG_BUCKET || 'blog'

// Camps que es retornen a la llista (sense el cos sencer, per estalviar dades)
const LIST_FIELDS =
  'id, title, slug, excerpt, cover_url, original_author, source_url, published, published_at, created_at, updated_at'

export const slugify = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // treu accents
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const mapError = (action, error) =>
  new Error(`${action}: ${error?.message || 'Error desconegut de Supabase.'}`)

// Llista d'articles. Per defecte només publicats (vista pública).
export const listArticles = async ({ publishedOnly = true } = {}) => {
  let query = supabase
    .from(TABLE)
    .select(LIST_FIELDS)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (publishedOnly) query = query.eq('published', true)

  const { data, error } = await query
  if (error) throw mapError('No s\'han pogut carregar els articles', error)
  return data || []
}

export const getArticleBySlug = async (slug) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw mapError('No s\'ha pogut carregar l\'article', error)
  return data
}

export const getArticleById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw mapError('No s\'ha pogut carregar l\'article', error)
  return data
}

// Genera un slug únic afegint un sufix numèric si ja existeix.
const ensureUniqueSlug = async (baseSlug, ignoreId = null) => {
  const base = baseSlug || `article-${Date.now()}`
  let candidate = base
  let suffix = 2
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase.from(TABLE).select('id').eq('slug', candidate)
    if (ignoreId) query = query.neq('id', ignoreId)
    const { data, error } = await query.maybeSingle()
    if (error) throw mapError('No s\'ha pogut validar el slug', error)
    if (!data) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export const createArticle = async (payload, authorId) => {
  const baseSlug = slugify(payload.slug || payload.title)
  const slug = await ensureUniqueSlug(baseSlug)

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: payload.title,
      slug,
      excerpt: payload.excerpt || null,
      body: payload.body || '',
      cover_url: payload.cover_url || null,
      original_author: payload.original_author || null,
      source_url: payload.source_url || null,
      published: payload.published ?? false,
      published_at: payload.published_at || null,
      author_id: authorId || null,
    })
    .select(LIST_FIELDS)
    .single()

  if (error) throw mapError('No s\'ha pogut crear l\'article', error)
  return data
}

export const updateArticle = async (id, payload) => {
  const updates = {
    title: payload.title,
    excerpt: payload.excerpt || null,
    body: payload.body || '',
    cover_url: payload.cover_url || null,
    original_author: payload.original_author || null,
    source_url: payload.source_url || null,
    published: payload.published ?? false,
    published_at: payload.published_at || null,
    updated_at: new Date().toISOString(),
  }

  // Només recalculem el slug si l'usuari l'ha tocat explícitament
  if (payload.slug) {
    updates.slug = await ensureUniqueSlug(slugify(payload.slug), id)
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select(LIST_FIELDS)
    .single()

  if (error) throw mapError('No s\'ha pogut desar l\'article', error)
  return data
}

export const setArticlePublished = async (id, published) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(LIST_FIELDS)
    .single()
  if (error) throw mapError('No s\'ha pogut canviar l\'estat de publicació', error)
  return data
}

export const deleteArticle = async (id) => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw mapError('No s\'ha pogut eliminar l\'article', error)
}

// Puja una imatge (portada o inserida al cos) al Storage i retorna la URL pública.
export const uploadBlogImage = async (file) => {
  const bucket = getBlogBucketName()
  const { optimizeImage } = await import('./imageOptimizer.js')

  let uploadFile = file
  try {
    uploadFile = await optimizeImage(file)
  } catch (optimizeError) {
    console.warn('No es va poder optimitzar la imatge; es puja l\'original.', optimizeError)
  }

  const ext = uploadFile.name.split('.').pop() || 'webp'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, uploadFile, {
    contentType: uploadFile.type || file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw mapError('No s\'ha pogut pujar la imatge', error)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

// ─── Importació d'artícles externs ─────────────────────────────────────────

// Obtenir artícles de Movethera (WordPress REST API)
export const listMovetheraArticles = async () => {
  try {
    const response = await fetch('https://movethera.com/wp-json/wp/v2/posts?per_page=100&orderby=date&order=desc')
    if (!response.ok) throw new Error('No s\'ha pogut connectar amb Movethera')
    const posts = await response.json()

    return posts.map(post => ({
      id: `movethera-${post.id}`,
      title: post.title?.rendered || post.title || '',
      excerpt: post.excerpt?.rendered?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
      cover_url: post.featured_media_url || null,
      original_author: post.author_name || 'Movethera',
      source_url: post.link,
      published_at: post.date_gmt,
      body: post.content?.rendered || '',
      source_type: 'movethera',
    }))
  } catch (error) {
    console.error('Error fetching Movethera articles:', error)
    return []
  }
}

// Importar un artículo extern com a esborrany (DRAFT)
export const importExternalArticle = async (externalArticle, authorId) => {
  const baseSlug = slugify(externalArticle.title)
  const slug = await ensureUniqueSlug(baseSlug)

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: externalArticle.title,
      slug,
      excerpt: externalArticle.excerpt || null,
      body: externalArticle.body || '',
      cover_url: externalArticle.cover_url || null,
      original_author: externalArticle.original_author || 'Font externa',
      source_url: externalArticle.source_url || null,
      published: false, // Sempre com a DRAFT
      published_at: null,
      author_id: authorId || null,
    })
    .select(LIST_FIELDS)
    .single()

  if (error) throw mapError('No s\'ha pogut importar l\'article', error)
  return data
}
