import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { parseGpxFull } from '../lib/gpxParser'

const COLORS = [
  '#E63946',
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
]

const GpxSessionContext = createContext(null)

export function GpxSessionProvider({ children }) {
  const [routes, setRoutes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const colorIndexRef = useRef(0)

  const addRoutes = useCallback((files) => {
    const readers = files.map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const text = e.target.result
            const parsed = parseGpxFull(text)
            const color = COLORS[colorIndexRef.current % COLORS.length]
            colorIndexRef.current++
            resolve({
              id: crypto.randomUUID(),
              name: parsed.name,
              fileName: file.name,
              points: parsed.points,
              latLngs: parsed.latLngs,
              stats: parsed.stats,
              bounds: parsed.bounds,
              rawXml: text,
              color,
              visible: true,
            })
          } catch (err) {
            reject({ fileName: file.name, error: err.message })
          }
        }
        reader.onerror = () => reject({ fileName: file.name, error: 'Error llegint el fitxer' })
        reader.readAsText(file)
      })
    )

    return Promise.allSettled(readers).then((results) => {
      const succeeded = []
      const failed = []
      results.forEach((r) => {
        if (r.status === 'fulfilled') succeeded.push(r.value)
        else failed.push(r.reason)
      })
      setRoutes((prev) => {
        const next = [...prev, ...succeeded]
        if (succeeded.length > 0 && !selectedId) {
          setSelectedId(succeeded[0].id)
        }
        return next
      })
      return { succeeded, failed }
    })
  }, [selectedId])

  const removeRoute = useCallback((id) => {
    setRoutes((prev) => {
      const next = prev.filter((r) => r.id !== id)
      return next
    })
    setSelectedId((prev) => {
      if (prev === id) return null
      return prev
    })
  }, [])

  const toggleVisibility = useCallback((id) => {
    setRoutes((prev) =>
      prev.map((r) => r.id === id ? { ...r, visible: !r.visible } : r)
    )
  }, [])

  const updateRoute = useCallback((id, changes) => {
    setRoutes((prev) =>
      prev.map((r) => r.id === id ? { ...r, ...changes } : r)
    )
  }, [])

  const clearAll = useCallback(() => {
    setRoutes([])
    setSelectedId(null)
    colorIndexRef.current = 0
  }, [])

  const selectedRoute = routes.find((r) => r.id === selectedId) ?? null

  return (
    <GpxSessionContext.Provider value={{
      routes,
      selectedId,
      selectedRoute,
      setSelectedId,
      addRoutes,
      removeRoute,
      updateRoute,
      toggleVisibility,
      clearAll,
    }}>
      {children}
    </GpxSessionContext.Provider>
  )
}

export function useGpxSession() {
  const ctx = useContext(GpxSessionContext)
  if (!ctx) throw new Error('useGpxSession must be used within GpxSessionProvider')
  return ctx
}
