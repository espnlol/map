import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Aircraft, Center } from '../types'
import { categoryInfo } from '../lib/categories'

interface Props {
  aircraft: Aircraft[]
  selected: string | null
  onSelect: (hex: string | null) => void
  center: Center
  radiusNm: number
  onSearchHere: (lat: number, lon: number) => void
}

function planeSvg(color: string, rotation: number, size: number, isHeli: boolean) {
  const body = isHeli
    ? `<circle cx="12" cy="12" r="4" fill="${color}" stroke="#0b1220" stroke-width="1"/><path d="M2 12h20M12 2v20" stroke="${color}" stroke-width="1.6"/>`
    : `<path d="M12 2c.8 0 1.4.7 1.4 1.6V9l7.6 4.4v2l-7.6-2.2v4.6l2.4 1.8V21l-3.8-1.1L8.2 21v-1.5l2.4-1.8v-4.6L3 15.4v-2L10.6 9V3.6C10.6 2.7 11.2 2 12 2z" fill="${color}" stroke="#0b1220" stroke-width="0.8"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${rotation}deg)">${body}</svg>`
}

function iconFor(a: Aircraft, selected: boolean) {
  const info = categoryInfo(a.category)
  const color = a.emergency ? '#ef4444' : a.onGround ? '#64748b' : info.color
  const size = selected ? 34 : a.category === 'A5' ? 28 : a.category === 'A1' || a.category === 'A7' ? 20 : 24
  const ring = a.emergency ? '<span class="emergency-ring"></span>' : ''
  const sel = selected ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #fff"></span>` : ''
  return L.divIcon({
    className: 'plane-icon',
    html: `<div style="position:relative;width:${size}px;height:${size}px">${ring}${sel}${planeSvg(color, a.track ?? 0, size, a.category === 'A7')}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function MapView({ aircraft, selected, onSelect, center, radiusNm, onSearchHere }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, { m: L.Marker; key: string }>())
  const trail = useRef<L.Polyline | null>(null)
  const routeLine = useRef<L.Polyline | null>(null)
  const ring = useRef<L.Circle | null>(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, worldCopyJump: true }).setView([center.lat, center.lon], 8)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(m)
    m.on('click', () => selectRef.current(null))
    map.current = m
    return () => {
      m.remove()
      map.current = null
      markers.current.clear()
    }
  }, [])

  // Recentre + radius ring when the search area changes.
  useEffect(() => {
    const m = map.current
    if (!m) return
    ring.current?.remove()
    ring.current = L.circle([center.lat, center.lon], {
      radius: radiusNm * 1852,
      color: '#38bdf8',
      weight: 1,
      opacity: 0.4,
      fill: false,
      dashArray: '4 6',
      interactive: false,
    }).addTo(m)
    m.fitBounds(ring.current.getBounds(), { padding: [20, 20] })
  }, [center.lat, center.lon, radiusNm])

  // Sync markers.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const live = new Set<string>()
    for (const a of aircraft) {
      live.add(a.hex)
      const isSel = a.hex === selected
      const key = `${a.category}|${Math.round(a.track ?? 0)}|${a.onGround}|${a.emergency?.code ?? ''}|${isSel}`
      const existing = markers.current.get(a.hex)
      if (existing) {
        existing.m.setLatLng([a.lat, a.lon])
        if (existing.key !== key) {
          existing.m.setIcon(iconFor(a, isSel))
          existing.key = key
        }
        existing.m.setTooltipContent(tooltip(a))
        existing.m.setZIndexOffset(isSel ? 1000 : a.emergency ? 500 : 0)
      } else {
        const mk = L.marker([a.lat, a.lon], { icon: iconFor(a, isSel), zIndexOffset: a.emergency ? 500 : 0 })
          .bindTooltip(tooltip(a), { direction: 'top', offset: [0, -10], className: '' })
          .on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            selectRef.current(a.hex)
          })
          .addTo(m)
        markers.current.set(a.hex, { m: mk, key })
      }
    }
    for (const [hex, { m: mk }] of markers.current) {
      if (!live.has(hex)) {
        mk.remove()
        markers.current.delete(hex)
      }
    }

    // Trail + route line for the selected aircraft.
    trail.current?.remove()
    routeLine.current?.remove()
    trail.current = null
    routeLine.current = null
    const sel = aircraft.find((a) => a.hex === selected)
    if (sel) {
      if (sel.trail.length > 1) trail.current = L.polyline(sel.trail, { color: '#f8fafc', weight: 2, opacity: 0.8 }).addTo(m)
      const o = sel.route?.origin
      const d = sel.route?.destination
      const pts: [number, number][] = []
      if (o?.lat != null && o.lon != null) pts.push([o.lat, o.lon])
      pts.push([sel.lat, sel.lon])
      if (d?.lat != null && d.lon != null) pts.push([d.lat, d.lon])
      if (pts.length > 1)
        routeLine.current = L.polyline(pts, { color: '#38bdf8', weight: 1.5, dashArray: '6 6', opacity: 0.7, interactive: false }).addTo(m)
    }
  }, [aircraft, selected])

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      <button
        className="absolute right-3 top-3 z-[500] rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-medium text-sky-300 shadow ring-1 ring-slate-700 hover:bg-slate-800"
        onClick={() => {
          const c = map.current?.getCenter()
          if (c) onSearchHere(c.lat, c.lng)
        }}
      >
        Track planes here
      </button>
    </div>
  )
}

function tooltip(a: Aircraft) {
  const alt = a.onGround ? 'GND' : a.altitude != null ? `${a.altitude.toLocaleString()} ft` : ''
  return `<b>${a.callsign}</b> ${a.typeCode ?? ''}<br/>${alt}${a.emergency ? `<br/><span style="color:#ef4444">⚠ ${a.emergency.label}</span>` : ''}`
}
