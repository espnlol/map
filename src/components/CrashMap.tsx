import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Crash } from '../types'
import { CAUSE_COLORS, radiusFor } from '../styles'

function FlyTo({ crash }: { crash: Crash | null }) {
  const map = useMap()
  useEffect(() => {
    if (crash) map.flyTo([crash.lat, crash.lng], Math.max(map.getZoom(), 6), { duration: 1.2 })
  }, [crash, map])
  return null
}

export function CrashMap({ crashes, selected, onSelect }: {
  crashes: Crash[]
  selected: Crash | null
  onSelect: (c: Crash) => void
}) {
  // Draw small markers last so big ones don't swallow their clicks.
  const ordered = [...crashes].sort((a, b) => b.fatalities - a.fatalities)
  return (
    <MapContainer
      center={[25, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      className="h-full w-full bg-slate-900"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      {ordered.map((c) => {
        const isSel = c.id === selected?.id
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={radiusFor(c.fatalities)}
            pathOptions={{
              color: isSel ? '#ffffff' : CAUSE_COLORS[c.cause],
              weight: isSel ? 3 : 1.5,
              fillColor: CAUSE_COLORS[c.cause],
              fillOpacity: isSel ? 0.9 : 0.55,
            }}
            eventHandlers={{ click: () => onSelect(c) }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <b>{c.name}</b>
              <br />
              {c.date.slice(0, 4)} · {c.fatalities} deaths
            </Tooltip>
          </CircleMarker>
        )
      })}
      <FlyTo crash={selected} />
    </MapContainer>
  )
}
