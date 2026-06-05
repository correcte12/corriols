import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts'

function buildProfileData(route) {
  let dist = 0
  return route.points
    .filter((p) => p.ele !== null)
    .map((p, i, arr) => {
      if (i > 0) {
        const prev = arr[i - 1]
        const dLat = (p.lat - prev.lat) * Math.PI / 180
        const dLon = (p.lon - prev.lon) * Math.PI / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(prev.lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2
        dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      return { dist: Math.round(dist * 10) / 10, ele: Math.round(p.ele) }
    })
}

const DOWNSAMPLE = 200

function downsample(data) {
  if (data.length <= DOWNSAMPLE) return data
  const step = Math.ceil(data.length / DOWNSAMPLE)
  return data.filter((_, i) => i % step === 0 || i === data.length - 1)
}

export default function GpxElevationProfile({ routes }) {
  const visible = routes.filter((r) => r.visible && r.points?.some((p) => p.ele !== null))

  const profiles = useMemo(() =>
    visible.map((r) => ({ route: r, data: downsample(buildProfileData(r)) })),
    [visible]
  )

  if (!profiles.length) {
    return (
      <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0', textAlign: 'center' }}>
        Cap ruta visible amb dades d'elevació
      </div>
    )
  }

  // Merge all distances as X axis keys
  const allDists = [...new Set(profiles.flatMap((p) => p.data.map((d) => d.dist)))].sort((a, b) => a - b)

  const chartData = allDists.map((dist) => {
    const point = { dist }
    profiles.forEach(({ route, data }) => {
      const closest = data.reduce((prev, cur) =>
        Math.abs(cur.dist - dist) < Math.abs(prev.dist - dist) ? cur : prev
      )
      if (Math.abs(closest.dist - dist) < 0.5) point[route.id] = closest.ele
    })
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis
          dataKey="dist"
          tickFormatter={(v) => `${v} km`}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => `${v}m`}
          tick={{ fontSize: 11 }}
          width={45}
        />
        <Tooltip
          formatter={(value, name) => {
            const r = profiles.find((p) => p.route.id === name)
            return [`${value} m`, r?.route.name ?? name]
          }}
          labelFormatter={(v) => `${v} km`}
        />
        {profiles.length > 1 && <Legend formatter={(name) => {
          const r = profiles.find((p) => p.route.id === name)
          return r?.route.name ?? name
        }} />}
        {profiles.map(({ route }) => (
          <Line
            key={route.id}
            type="monotone"
            dataKey={route.id}
            stroke={route.color}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
