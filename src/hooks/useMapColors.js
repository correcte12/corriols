import { useRef } from 'react'

const COLORS = [
  '#E63946',
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
]

export function useMapColors() {
  const indexRef = useRef(0)
  const mapRef = useRef({})

  function getColor(id) {
    if (!mapRef.current[id]) {
      mapRef.current[id] = COLORS[indexRef.current % COLORS.length]
      indexRef.current++
    }
    return mapRef.current[id]
  }

  function releaseColor(id) {
    delete mapRef.current[id]
  }

  function reset() {
    indexRef.current = 0
    mapRef.current = {}
  }

  return { getColor, releaseColor, reset, COLORS }
}
