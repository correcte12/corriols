import { supabase } from './supabase'

const BUCKET = import.meta.env.VITE_SUPABASE_GALLERY_BUCKET || 'galeriamont'

/**
 * Puja un fitxer GPX a Storage i retorna la URL signada (24h).
 * Path: gpx/{userId}/{itemId}.gpx
 */
export const uploadGpx = async (userId, itemId, file) => {
  const path = `gpx/${userId}/${itemId}.gpx`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: 'application/gpx+xml',
      upsert: true,
    })

  if (error) throw new Error(`No s'ha pogut pujar el GPX: ${error.message}`)

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 any

  if (signError) throw new Error(`No s'ha pogut signar la URL del GPX: ${signError.message}`)

  return { path, url: data.signedUrl }
}

/**
 * Elimina un fitxer GPX de Storage.
 */
export const deleteGpx = async (userId, itemId) => {
  const path = `gpx/${userId}/${itemId}.gpx`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`No s'ha pogut eliminar el GPX: ${error.message}`)
}

/**
 * Retorna una URL signada fresca per a un path de GPX guardat.
 * Útil quan la URL signada caducada.
 */
export const refreshGpxUrl = async (path) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24)

  if (error) throw new Error(`No s'ha pogut renovar la URL del GPX: ${error.message}`)
  return data.signedUrl
}

/**
 * Puja un PDF a Storage i retorna la URL signada.
 * Path: pdf/{userId}/{itemId}.pdf
 */
export const uploadPdf = async (userId, itemId, file) => {
  const path = `pdf/${userId}/${itemId}.pdf`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) throw new Error(`No s'ha pogut pujar el PDF: ${error.message}`)

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  if (signError) throw new Error(`No s'ha pogut signar la URL del PDF: ${signError.message}`)

  return { path, url: data.signedUrl }
}

/**
 * Elimina un PDF de Storage.
 */
export const deletePdf = async (userId, itemId) => {
  const path = `pdf/${userId}/${itemId}.pdf`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`No s'ha pogut eliminar el PDF: ${error.message}`)
}
