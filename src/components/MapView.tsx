import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Aircraft, Center } from '../types'
import { categoryInfo } from '../lib/categories'
import type { FlightPath } from '../lib/history'

/** Altitude → colour, low = orange, high = violet (same idea as most flight trackers). */
export function altColor(alt: number | null): string {
  if (alt === null) return '#94a3b8'
  const t = Math.max(0, Math.min(1, alt / 40000))
  const hue = 25 + t * 255
  return `hsl(${Math.round(hue / 15) * 15} 90% 58%)`
}

/** Merge consecutive same-colour segments so long paths stay fast. */
function drawAltitudePath(points: [number, number, number | null][], layer: L.LayerGroup, renderer: L.Renderer, weight: number) {
  let run: [number, number][] = []
  let runColor = ''
  const flush = () => {
    if (run.length > 1) L.polyline(run, { color: runColor, weight, opacity: 0.95, renderer, interactive: false }).addTo(layer)
  }
  for (let i = 1; i < points.length; i++) {
    const [lat0, lon0] = points[i - 1]
    const [lat1, lon1, alt] = points[i]
    if (Math.abs(lon1 - lon0) > 180) {
      flush()
      run = []
      continue
    }
    const color = altColor(alt)
    if (color !== runColor) {
      flush()
      run = [[lat0, lon0]]
      runColor = color
    }
    run.push([lat1, lon1])
  }
  flush()
}

interface Props {
  aircraft: Aircraft[]
  selected: string | null
  onSelect: (hex: string | null) => void
  center: Center
  radiusNm: number
  onSearchHere: (lat: number, lon: number) => void
  showTrails: boolean
  path: FlightPath | null
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

export default function MapView({ aircraft, selected, onSelect, center, radiusNm, onSearchHere, showTrails, path }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, { m: L.Marker; key: string }>())
  const trails = useRef<L.LayerGroup | null>(null)
  const selPath = useRef<L.LayerGroup | null>(null)
  const renderer = useRef<L.Renderer>(L.canvas({ padding: 0.3 }))
  const fittedFor = useRef<string | null>(null)
  const routeLine = useRef<L.Polyline | null>(null)
  const ring = useRef<L.Circle | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, worldCopyJump: true }).setView([center.lat, center.lon], 8)
    // Keyless basemaps (CARTO's free tiles now require an API key).
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services'
    const esriAttr = 'Tiles &copy; Esri'
    const dark = L.layerGroup([
      L.tileLayer(`${esri}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution: `${esriAttr} &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors`, maxNativeZoom: 16, maxZoom: 19 }),
      L.tileLayer(`${esri}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 16, maxZoom: 19 }),
    ])
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    })
    const satellite = L.layerGroup([
      L.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { attribution: `${esriAttr} &mdash; Maxar, Earthstar Geographics`, maxNativeZoom: 18, maxZoom: 19 }),
      L.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 18, maxZoom: 19 }),
    ])
    dark.addTo(m)
    L.control.layers({ Dark: dark, Streets: streets, Satellite: satellite }, undefined, { position: 'topleft' }).addTo(m)
    // The container can be sized after Leaflet initialises (flex layout), so
    // keep Leaflet in sync or it zooms/positions against a 0×0 box.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    resizeObs.current = ro
    trails.current = L.layerGroup().addTo(m)
    selPath.current = L.layerGroup().addTo(m)
    m.on('click', () => selectRef.current(null))
    map.current = m
    return () => {
      resizeObs.current?.disconnect()
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
    const bounds = ring.current.getBounds()
    m.invalidateSize()
    m.fitBounds(bounds, { padding: [20, 20] })
    // Re-fit once layout has settled, in case the map was still 0×0 above.
    const t = setTimeout(() => {
      m.invalidateSize()
      m.fitBounds(bounds, { padding: [20, 20] })
    }, 250)
    return () => clearTimeout(t)
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

    // Short trails for every aircraft (where it's been while SkyWatch was open).
    trails.current?.clearLayers()
    if (showTrails) {
      for (const a of aircraft) {
        if (a.hex === selected || a.trail.length < 2) continue
        L.polyline(a.trail.map(([la, lo]) => [la, lo] as [number, number]), {
          color: a.emergency ? '#ef4444' : categoryInfo(a.category).color,
          weight: 1.5,
          opacity: 0.45,
          renderer: renderer.current,
          interactive: false,
        }).addTo(trails.current!)
      }
    }

    // Full flight path + route line for the selected aircraft.
    selPath.current?.clearLayers()
    routeLine.current?.remove()
    routeLine.current = null
    const sel = aircraft.find((a) => a.hex === selected)
    if (sel) {
      let pts: [number, number, number | null][] = sel.trail
      if (path && path.points.length > 1) {
        const lastT = path.points[path.points.length - 1][3]
        pts = path.points.map(([la, lo, al]) => [la, lo, al] as [number, number, number | null])
        // add anything we've seen live since the history file was written
        if (Date.now() - lastT < 10 * 60 * 1000) pts = [...pts, [sel.lat, sel.lon, sel.onGround ? null : sel.altitude]]
      }
      if (pts.length > 1) {
        drawAltitudePath(pts, selPath.current!, renderer.current, 3)
        L.circleMarker([pts[0][0], pts[0][1]], { radius: 4, color: '#f8fafc', weight: 2, fillColor: '#0f172a', fillOpacity: 1, renderer: renderer.current })
          .bindTooltip(path?.fromTakeoff ? 'Takeoff' : 'Start of known path')
          .addTo(selPath.current!)
      }
      if (path && fittedFor.current !== sel.hex && pts.length > 1) {
        fittedFor.current = sel.hex
        m.fitBounds(L.latLngBounds(pts.map(([la, lo]) => [la, lo] as [number, number])).extend([sel.lat, sel.lon]), { padding: [40, 40], maxZoom: 11 })
      }
      const d = sel.route?.destination
      if (d?.lat != null && d.lon != null)
        routeLine.current = L.polyline([[sel.lat, sel.lon], [d.lat, d.lon]], { color: '#38bdf8', weight: 1.5, dashArray: '6 6', opacity: 0.7, interactive: false }).addTo(m)
    } else {
      fittedFor.current = null
    }
  }, [aircraft, selected, showTrails, path])

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      {selected && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-[10px] text-slate-300 ring-1 ring-slate-700">
          <div className="mb-1 text-center font-semibold uppercase tracking-wider text-slate-400">Path altitude</div>
          <div className="flex items-center gap-1.5">
            <span>Ground</span>
            {[null, 0, 5000, 10000, 20000, 30000, 40000].map((v, i) => (
              <span key={i} className="h-2 w-5 rounded-sm" style={{ background: altColor(v) }} />
            ))}
            <span>40,000 ft</span>
          </div>
        </div>
      )}
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
