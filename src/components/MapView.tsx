import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { Aircraft, Center } from '../types'
import { categoryInfo } from '../lib/categories'
import type { FlightPath } from '../lib/history'
import { busyness, liveAtcUrl, loadAirports, type AirportInfo } from '../lib/airports'
import { settings, type BaseMap } from '../lib/settings'
import type { Hotspot } from '../lib/happening'
import type { MilitaryPattern } from '../lib/patterns'
import { STATIONS, mapLat, type Station } from '../lib/antarctica'
import { TFR_KINDS, explainTfr, fetchTfrDetail, liveContext, quickCauses, type Tfr, type TfrDetail } from '../lib/tfr'

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
  showAirports: boolean
  path: FlightPath | null
  highlight: Highlight | null
  onClearHighlight: () => void
  /** Height of anything covering the bottom of the map (the phone panel), in px. */
  bottomInset: number
  hotspots: Hotspot[]
  military: MilitaryPattern[]
  /** An airport (ident) to open the info card for, once its marker is on the map. */
  focusAirport: string | null
  onAirportFocused: () => void
  /** FAA restricted airspace to outline. */
  tfrs: Tfr[]
  /** A TFR (NOTAM number) to zoom to and open. */
  focusTfr: string | null
  onTfrFocused: () => void
}

/** A saved path or spot to show on the map (an emergency or a logbook entry). */
export interface Highlight {
  points: [number, number, number | null][]
  label: string
}

function planeSvg(color: string, rotation: number, size: number, isHeli: boolean) {
  const body = isHeli
    ? `<circle cx="12" cy="12" r="4" fill="${color}" stroke="#0b1220" stroke-width="1"/><path d="M2 12h20M12 2v20" stroke="${color}" stroke-width="1.6"/>`
    : `<path d="M12 2c.8 0 1.4.7 1.4 1.6V9l7.6 4.4v2l-7.6-2.2v4.6l2.4 1.8V21l-3.8-1.1L8.2 21v-1.5l2.4-1.8v-4.6L3 15.4v-2L10.6 9V3.6C10.6 2.7 11.2 2 12 2z" fill="${color}" stroke="#0b1220" stroke-width="0.8"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${rotation}deg)">${body}</svg>`
}

const SERVICE_TAGS = { police: 'POLICE', medical: 'MEDICAL', news: 'NEWS' } as const
function serviceTag(a: Aircraft) {
  const sp = a.special.find((s) => s.tag in SERVICE_TAGS)
  return sp ? `<span class="service-tag service-${sp.tag}">${SERVICE_TAGS[sp.tag as keyof typeof SERVICE_TAGS]}</span>` : ''
}

function iconFor(a: Aircraft, selected: boolean, label: boolean) {
  const info = categoryInfo(a.category)
  const color = a.emergency ? '#ef4444' : a.onGround ? '#64748b' : info.color
  const size = selected ? 34 : a.category === 'A5' ? 28 : a.category === 'A1' || a.category === 'A7' ? 20 : 24
  const ring = a.emergency ? '<span class="emergency-ring"></span>' : ''
  const sel = selected ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #fff"></span>` : ''
  return L.divIcon({
    className: 'plane-icon',
    html: `<div style="position:relative;width:${size}px;height:${size}px">${ring}${sel}${planeSvg(color, a.track ?? 0, size, a.category === 'A7')}${
      label ? `<span class="plane-label">${a.callsign}</span>` : ''
    }${serviceTag(a)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function MapView({ aircraft, selected, onSelect, center, radiusNm, onSearchHere, showTrails, showAirports, path, highlight, onClearHighlight, bottomInset, hotspots, military, focusAirport, onAirportFocused, tfrs, focusTfr, onTfrFocused }: Props) {
  const cfg = settings.use()
  const [zoom, setZoom] = useState(8)
  const showLabels = cfg.labels && zoom >= 9
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, { m: L.Marker; key: string }>())
  const trails = useRef<L.LayerGroup | null>(null)
  const selPath = useRef<L.LayerGroup | null>(null)
  const renderer = useRef<L.Renderer>(L.canvas({ padding: 0.3 }))
  const fittedFor = useRef<string | null>(null)
  const fitTimer = useRef<ReturnType<typeof setTimeout>>()
  const airportLayer = useRef<L.LayerGroup | null>(null)
  const highlightLayer = useRef<L.LayerGroup | null>(null)
  const insetRef = useRef(bottomInset)
  insetRef.current = bottomInset
  const airportMarkers = useRef(new Map<string, L.CircleMarker>())
  const runwayLayer = useRef<L.LayerGroup | null>(null)
  const [airports, setAirports] = useState<AirportInfo[]>([])
  const [view, setView] = useState(0) // bumps on pan/zoom so the airport layer re-filters
  const aircraftRef = useRef(aircraft)
  aircraftRef.current = aircraft
  const searchRef = useRef(onSearchHere)
  searchRef.current = onSearchHere
  const routeLine = useRef<L.Polyline | null>(null)
  const ring = useRef<L.Circle | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)
  const baseLayers = useRef<Record<BaseMap, L.Layer> | null>(null)
  const hotspotLayer = useRef<L.LayerGroup | null>(null)
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
    const bases: Record<BaseMap, L.Layer> = { dark, streets, satellite }
    bases[settings.get().baseMap].addTo(m)
    baseLayers.current = bases
    L.control.layers({ Dark: dark, Streets: streets, Satellite: satellite }, undefined, { position: 'topleft' }).addTo(m)
    m.on('baselayerchange', (e) => {
      const name = e.name.toLowerCase() as BaseMap
      if (settings.get().baseMap !== name) settings.update({ baseMap: name })
    })
    m.on('zoomend', () => setZoom(m.getZoom()))
    // The container can be sized after Leaflet initialises (flex layout), so
    // keep Leaflet in sync or it zooms/positions against a 0×0 box.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    resizeObs.current = ro
    runwayLayer.current = L.layerGroup().addTo(m)
    highlightLayer.current = L.layerGroup().addTo(m)
    airportLayer.current = L.layerGroup().addTo(m)
    trails.current = L.layerGroup().addTo(m)
    hotspotLayer.current = L.layerGroup().addTo(m)
    m.on('moveend zoomend', () => setView((v) => v + 1))
    m.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector<HTMLButtonElement>('[data-track]')
      if (btn)
        btn.onclick = () => {
          const [la, lo] = btn.dataset.track!.split(',').map(Number)
          m.closePopup()
          searchRef.current(la, lo)
        }
    })
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
    })
    if (settings.get().rangeRing) ring.current.addTo(m)
    const bounds = ring.current.getBounds()
    const fit = () => m.fitBounds(bounds, { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20 + insetRef.current] })
    m.invalidateSize()
    fit()
    // Re-fit once layout has settled, in case the map was still 0×0 above.
    const t = setTimeout(() => {
      m.invalidateSize()
      fit()
    }, 250)
    return () => clearTimeout(t)
  }, [center.lat, center.lon, radiusNm])

  // Sync markers.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const live = new Set<string>()
    // Only draw aircraft near the visible part of the map (big areas can hold thousands).
    const inView = m.getBounds().pad(0.25)
    const visible = aircraft.filter((a) => a.hex === selected || inView.contains([a.lat, a.lon]))
    for (const a of visible) {
      live.add(a.hex)
      const isSel = a.hex === selected
      const key = `${a.category}|${Math.round(a.track ?? 0)}|${a.onGround}|${a.emergency?.code ?? ''}|${isSel}|${showLabels ? a.callsign : ''}|${a.special.map((s) => s.tag).join()}`
      const existing = markers.current.get(a.hex)
      if (existing) {
        existing.m.setLatLng([a.lat, a.lon])
        if (existing.key !== key) {
          existing.m.setIcon(iconFor(a, isSel, showLabels))
          existing.key = key
        }
        existing.m.setTooltipContent(tooltip(a))
        existing.m.setZIndexOffset(isSel ? 1000 : a.emergency ? 500 : 0)
      } else {
        const mk = L.marker([a.lat, a.lon], { icon: iconFor(a, isSel, showLabels), zIndexOffset: a.emergency ? 500 : 0 })
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
      for (const a of visible) {
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
      let pts: [number, number, number | null][] = sel.trail.map(([la, lo, al]) => [la, lo, al])
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
      // Frame the whole trip once per selected plane: where it took off (or its
      // flown path), where it is now, and where it's going.
      if (fittedFor.current !== sel.hex) {
        const fit = () => {
          if (fittedFor.current === sel.hex) return
          fittedFor.current = sel.hex
          if (!settings.get().tripZoom) {
            // trip zoom off: keep the view, just bring the plane on-screen if it isn't
            const visible = m.getBounds()
            if (!visible.contains([sel.lat, sel.lon])) m.panTo([sel.lat, sel.lon])
            return
          }
          const b = L.latLngBounds([[sel.lat, sel.lon]])
          for (const [la, lo] of pts) b.extend([la, lo])
          const o = sel.route?.origin
          const dst = sel.route?.destination
          if (o?.lat != null && o.lon != null && !path) b.extend([o.lat, o.lon])
          if (dst?.lat != null && dst.lon != null) b.extend([dst.lat, dst.lon])
          m.fitBounds(b, { paddingTopLeft: [50, 60], paddingBottomRight: [50, 70 + insetRef.current], maxZoom: 10 })
        }
        clearTimeout(fitTimer.current)
        if (path && pts.length > 1) fit()
        else if (!settings.get().tripZoom) fit()
        else fitTimer.current = setTimeout(fit, 2500) // no flight history (yet): frame what we know
      }
      const d = sel.route?.destination
      if (d?.lat != null && d.lon != null)
      {
        routeLine.current = L.polyline([[sel.lat, sel.lon], [d.lat, d.lon]], { color: '#38bdf8', weight: 1.5, dashArray: '6 6', opacity: 0.7, interactive: false }).addTo(m)
        // mark where it's going
        L.circleMarker([d.lat, d.lon], { radius: 5, color: '#f8fafc', weight: 2, fillColor: '#38bdf8', fillOpacity: 1, renderer: renderer.current, interactive: false })
          .bindTooltip(d.iata || d.icao || 'Destination', { permanent: true, direction: 'right', offset: [6, 0], className: 'airport-label' })
          .addTo(selPath.current!)
      }
    } else {
      fittedFor.current = null
    }
    if (sel && settings.get().followSelected && !m.getBounds().pad(-0.25).contains([sel.lat, sel.lon])) m.panTo([sel.lat, sel.lon])
  }, [aircraft, selected, showTrails, path, view, showLabels])

  // Map style and range ring follow Settings.
  useEffect(() => {
    const m = map.current
    const bases = baseLayers.current
    if (!m || !bases) return
    for (const [name, layer] of Object.entries(bases)) {
      if (name === cfg.baseMap && !m.hasLayer(layer)) layer.addTo(m)
      if (name !== cfg.baseMap && m.hasLayer(layer)) m.removeLayer(layer)
    }
  }, [cfg.baseMap])
  useEffect(() => {
    const m = map.current
    if (!m || !ring.current) return
    if (cfg.rangeRing) ring.current.addTo(m)
    else ring.current.remove()
  }, [cfg.rangeRing])

  // Open the info card of an airport picked in search.
  useEffect(() => {
    if (!focusAirport) return
    const mk = airportMarkers.current.get(focusAirport)
    if (mk) {
      mk.openPopup()
      onAirportFocused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAirport, view, airports])

  // Military loops, outlined.
  const milLayer = useRef<L.LayerGroup | null>(null)
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!milLayer.current || !m.hasLayer(milLayer.current)) milLayer.current = L.layerGroup().addTo(m)
    milLayer.current.clearLayers()
    for (const p of military) {
      if (p.hull.length < 3) continue
      L.polygon(p.hull, { color: '#a3e635', weight: 1.5, dashArray: '6 5', fillColor: '#a3e635', fillOpacity: 0.06, interactive: false }).addTo(milLayer.current)
      L.marker([p.lat, p.lon], {
        interactive: false,
        icon: L.divIcon({ className: 'mil-label', html: `<span>🎖️ ${p.kind}</span>`, iconSize: [0, 0] }),
      }).addTo(milLayer.current)
    }
  }, [military])

  // Antarctic research stations (names appear from zoom 4).
  const stationLayer = useRef<L.LayerGroup | null>(null)
  const stationNames = view >= 0 && (map.current?.getZoom() ?? 0) >= 4
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!stationLayer.current || !m.hasLayer(stationLayer.current)) stationLayer.current = L.layerGroup().addTo(m)
    stationLayer.current.clearLayers()
    if (!cfg.antarcticBases) return
    const showNames = stationNames
    for (const s of STATIONS) {
      L.marker([mapLat(s.lat), s.lon], {
        icon: L.divIcon({
          className: 'station-icon',
          html: `<span class="station-dot ${s.season === 'summer' ? 'summer' : ''}"></span>${showNames ? `<span class="station-name">${esc(s.name.replace(/ (Station|Base|Research Station|Research Base)$/, ''))}</span>` : ''}`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
        zIndexOffset: -100,
      })
        .bindTooltip(`${s.flag} ${esc(s.name)}`, { direction: 'top', offset: [0, -6] })
        .bindPopup(stationPopup(s), { maxWidth: 280 })
        .addTo(stationLayer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.antarcticBases, stationNames])

  // Restricted airspace (FAA TFRs).
  const tfrLayer = useRef<L.LayerGroup | null>(null)
  const tfrShapes = useRef(new Map<string, L.Polygon>())
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!tfrLayer.current || !m.hasLayer(tfrLayer.current)) tfrLayer.current = L.layerGroup().addTo(m)
    tfrLayer.current.clearLayers()
    tfrShapes.current.clear()
    for (const t of tfrs) {
      if (t.polygons.length === 0) continue
      const k = TFR_KINDS[t.kind]
      const shape = L.polygon(t.polygons, {
        color: k.color,
        weight: 1.5,
        dashArray: t.kind === 'vip' ? undefined : '4 4',
        fillColor: k.color,
        fillOpacity: t.kind === 'vip' ? 0.14 : 0.08,
        renderer: renderer.current,
      })
        .bindTooltip(`${k.emoji} ${esc(explainTfr(t).what)}`, { sticky: true })
        .on('popupopen', () => {
          const live = liveContext(t, aircraftRef.current).notes
          shape.setPopupContent(tfrPopup(t, undefined, live))
          fetchTfrDetail(t).then((d) => shape.isPopupOpen() && shape.setPopupContent(tfrPopup(t, d, liveContext(t, aircraftRef.current).notes)))
        })
        .bindPopup(tfrPopup(t), { maxWidth: 300, maxHeight: 330, autoPanPaddingTopLeft: [20, 70], autoPanPaddingBottomRight: [20, 40 + insetRef.current] })
        .addTo(tfrLayer.current)
      tfrShapes.current.set(t.id, shape)
    }
  }, [tfrs])

  useEffect(() => {
    const m = map.current
    if (!m || !focusTfr) return
    const shape = tfrShapes.current.get(focusTfr)
    if (!shape) return
    m.fitBounds(shape.getBounds(), { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + insetRef.current], maxZoom: 11 })
    shape.openPopup(shape.getBounds().getCenter())
    onTfrFocused()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTfr, tfrs])

  // Places where aircraft are circling.
  useEffect(() => {
    const layer = hotspotLayer.current
    if (!layer) return
    layer.clearLayers()
    for (const h of hotspots) {
      L.circle([h.lat, h.lon], { radius: (h.radiusNm + 0.3) * 1852, color: '#fb923c', weight: 2, fillColor: '#fb923c', fillOpacity: 0.12, className: 'hotspot-ring', interactive: false }).addTo(layer)
      L.marker([h.lat, h.lon], {
        interactive: false,
        icon: L.divIcon({ className: 'hotspot-label', html: `<span>👀 ${h.aircraft.length > 1 ? `${h.aircraft.length} circling` : 'Circling'}</span>`, iconSize: [0, 0] }),
      }).addTo(layer)
    }
  }, [hotspots])

  // A saved emergency path or logbook spot.
  useEffect(() => {
    const m = map.current
    const layer = highlightLayer.current
    if (!m || !layer) return
    layer.clearLayers()
    if (!highlight || highlight.points.length === 0) return
    const pts = highlight.points
    if (pts.length > 1) {
      L.polyline(pts.map(([la, lo]) => [la, lo] as [number, number]), { color: '#0b1220', weight: 7, opacity: 0.7, interactive: false, renderer: renderer.current }).addTo(layer)
      drawAltitudePath(pts, layer, renderer.current, 4)
    }
    const [la, lo] = pts[pts.length - 1]
    L.circleMarker([la, lo], { radius: 7, color: '#f8fafc', weight: 2, fillColor: '#ef4444', fillOpacity: 1, renderer: renderer.current })
      .bindTooltip(highlight.label, { permanent: true, direction: 'top', offset: [0, -8] })
      .addTo(layer)
    const b = L.latLngBounds(pts.map(([a, o]) => [a, o] as [number, number]))
    m.fitBounds(b, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + insetRef.current], maxZoom: 10 })
  }, [highlight])

  useEffect(() => {
    if (showAirports && airports.length === 0) loadAirports().then(setAirports)
  }, [showAirports, airports.length])

  // Airports + runways in view. Large airports from zoom 6, medium from zoom 8, runways from zoom 10.
  useEffect(() => {
    const m = map.current
    const layer = airportLayer.current
    const rw = runwayLayer.current
    if (!m || !layer || !rw) return
    rw.clearLayers()
    if (!showAirports || airports.length === 0) {
      layer.clearLayers()
      airportMarkers.current.clear()
      return
    }
    const z = m.getZoom()
    const bounds = m.getBounds().pad(0.2)
    const wanted = new Set<string>()
    for (const ap of airports) {
      if (z < 6 || (!ap.large && z < 8) || !bounds.contains([ap.lat, ap.lon])) continue
      wanted.add(ap.ident)
      const b = busyness(ap, aircraft)
      const color = b.total >= 10 ? '#f87171' : b.total >= 4 ? '#fbbf24' : b.total >= 1 ? '#38bdf8' : '#64748b'
      const radius = (ap.large ? 6 : 4) + Math.min(6, b.total * 0.4)
      let mk = airportMarkers.current.get(ap.ident)
      if (!mk) {
        mk = L.circleMarker([ap.lat, ap.lon], { radius, color: '#0f172a', weight: 1.5, fillColor: color, fillOpacity: 0.9, renderer: renderer.current })
          .bindPopup('', { maxWidth: 280 })
          .addTo(layer)
        airportMarkers.current.set(ap.ident, mk)
      } else mk.setStyle({ fillColor: color }).setRadius(radius)
      const code = ap.iata || ap.ident
      const label = `<b>${code}</b>${b.total ? ` · ${b.total}` : ''}`
      const permanent = z >= 9 || (ap.large && z >= 7)
      const tip = mk.getTooltip()
      if (!tip || tip.options.permanent !== permanent) {
        mk.unbindTooltip().bindTooltip(label, { direction: 'right', offset: [8, 0], className: 'airport-label', permanent })
      } else mk.setTooltipContent(label)
      if (!mk.isPopupOpen()) mk.setPopupContent(airportPopup(ap, b))
      if (z >= 10)
        for (const r of ap.runways)
          L.polyline([[r.lat1, r.lon1], [r.lat2, r.lon2]], { color: '#94a3b8', weight: z >= 13 ? 6 : 3, opacity: 0.8, interactive: false, renderer: renderer.current }).addTo(rw)
    }
    for (const [id, mk] of airportMarkers.current) {
      if (!wanted.has(id)) {
        mk.remove()
        airportMarkers.current.delete(id)
      }
    }
  }, [airports, showAirports, aircraft, view])

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      <TripZoomButton />
      {highlight && (
        <button
          onClick={onClearHighlight}
          className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-slate-900/95 px-3 py-1.5 text-xs text-slate-200 shadow ring-1 ring-slate-700"
        >
          Showing {highlight.label} <span className="ml-1 text-slate-400">✕</span>
        </button>
      )}
      {selected && (
        <div
          style={{ bottom: bottomInset + 8 }}
          className="pointer-events-none absolute left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-slate-900/85 px-2.5 py-1 text-[9px] text-slate-300 ring-1 ring-slate-700"
          aria-label="Path colours by altitude"
        >
          <span>Low</span>
          {[null, 0, 5000, 10000, 20000, 30000, 40000].map((v, i) => (
            <span key={i} className="h-1.5 w-3.5 rounded-sm" style={{ background: altColor(v) }} />
          ))}
          <span>40k ft</span>
        </div>
      )}
      <button
        className="absolute right-3 top-3 z-[500] rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-medium text-sky-300 shadow ring-1 ring-slate-700 hover:bg-slate-800"
        onClick={() => {
          const m = map.current
          if (!m) return
          // the middle of the part of the map you can see (not the part under the phone panel)
          const size = m.getSize()
          const c = m.containerPointToLatLng(L.point(size.x / 2, Math.max(40, (size.y - insetRef.current) / 2)))
          onSearchHere(c.lat, c.lng)
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

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function airportPopup(ap: AirportInfo, b: ReturnType<typeof busyness>) {
  const codes = [ap.iata, ap.ident].filter(Boolean).join(' · ')
  const runways = ap.runways
    .slice(0, 8)
    .map((r) => `${esc(r.name)} <span style="color:#94a3b8">${r.lengthFt ? r.lengthFt.toLocaleString() + ' ft' : ''}</span>`)
    .join('<br/>')
  return `<div style="font-size:12px;line-height:1.45">
    <div style="font-weight:700;font-size:14px">${esc(ap.name)}</div>
    ${ap.aka ? `<div style="color:#94a3b8">Formerly ${esc(ap.aka.name)}</div>` : ''}
    <div style="color:#64748b">${esc(codes)} · ${esc([ap.city, ap.country].filter(Boolean).join(', '))}${ap.elevation != null ? ` · ${ap.elevation.toLocaleString()} ft` : ''}</div>
    <div style="margin-top:6px"><b>Right now:</b> ${b.onGround} on the ground, ${b.arriving} arriving, ${b.departing} departing</div>
    ${runways ? `<div style="margin-top:6px"><b>Runways</b><br/>${runways}</div>` : ''}
    <button data-track="${ap.lat},${ap.lon}" style="margin-top:8px;width:100%;padding:6px;border-radius:6px;background:#0ea5e9;color:#020617;font-weight:600">Track planes here</button>
    ${liveAtcUrl(ap.ident, ap.iata) ? `<a href="${liveAtcUrl(ap.ident, ap.iata)}" target="_blank" rel="noreferrer" style="display:block;margin-top:6px;text-align:center;padding:6px;border-radius:6px;border:1px solid #334155;color:#7dd3fc;font-weight:600;text-decoration:none">🎧 Listen to ATC (LiveATC)</a>` : ''}
  </div>`
}

function stationPopup(s: Station) {
  return `<div style="font-size:12px;line-height:1.45;max-width:260px">
    <div style="font-weight:700;font-size:14px">${s.flag} ${esc(s.name)}</div>
    <div style="color:#64748b">${esc(s.country)} · ${s.season === 'year-round' ? 'Staffed year-round' : 'Summer only (about Nov–Feb)'}</div>
    ${s.note ? `<div style="margin-top:6px">${esc(s.note)}</div>` : ''}
    ${s.air ? `<div style="margin-top:6px"><b>Getting there by air:</b> ${esc(s.air)}</div>` : ''}
    <div style="margin-top:6px;color:#64748b">Few ADS-B receivers reach Antarctica, so flights here often drop off the map.</div>
    <button data-track="${s.lat},${s.lon}" style="margin-top:8px;width:100%;padding:6px;border-radius:6px;background:#0ea5e9;color:#020617;font-weight:600">Track planes here</button>
    <a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(s.name + ' Antarctica')}" target="_blank" rel="noreferrer" style="display:block;margin-top:6px;text-align:center;padding:6px;border-radius:6px;border:1px solid #334155;color:#7dd3fc;font-weight:600;text-decoration:none">About this station ↗</a>
  </div>`
}

/** detail: undefined = still loading, null = couldn't load. */
function tfrPopup(t: Tfr, detail?: TfrDetail | null, live: string[] = []) {
  const k = TFR_KINDS[t.kind]
  const x = explainTfr(t)
  const where = [t.facility, t.state].filter(Boolean).join(' · ')
  const causes = detail?.causes.length ? detail.causes : quickCauses(t)
  const lower = detail?.lower ?? t.lower
  const upper = detail?.upper ?? t.upper
  const start = detail?.start ?? t.start
  const end = detail?.end ?? t.end
  const limits = [
    lower || upper ? `From ${esc(lower ?? 'the ground')} up to ${esc(upper ?? '?')}` : '',
    start || end ? `${start ? `Starts ${esc(start)}` : ''}${start && end ? ', ' : ''}${end ? `ends ${esc(end)}` : ''}` : '',
  ].filter(Boolean)
  const label = (s: string) => `<b style="color:#94a3b8;font-size:10px;letter-spacing:.06em;text-transform:uppercase">${s}</b>`
  const part = (name: string, text?: string) => (text ? `<div style="margin-top:7px">${label(name)}<br/>${text}</div>` : '')
  const cause = [
    ...causes.map((c) => `<b>${esc(c)}</b>`),
    ...live.map((n) => `<span style="color:#fbbf24">● ${esc(n)}</span>`),
    detail?.purpose ? esc(detail.purpose) : '',
    detail?.inCharge ? `Run by ${esc(detail.inCharge)}` : '',
    detail?.place ? `Location: ${esc(detail.place)}` : '',
    detail === undefined ? '<span style="color:#64748b">Reading the FAA notice…</span>' : '',
    detail === null && !causes.length ? '<span style="color:#64748b">The FAA notice didn\'t load, so this is based on the zone\'s type.</span>' : '',
  ].filter(Boolean)
  return `<div style="font-size:12px;line-height:1.45;max-width:280px">
    <div style="font-weight:700;font-size:14px;color:${k.color}">${k.emoji} ${esc(x.what)}</div>
    <div style="color:#64748b">${esc(k.label)} · NOTAM ${esc(t.id)}${where ? ` · ${esc(where)}` : ''}</div>
    ${t.title ? `<div style="margin-top:6px;font-style:italic">"${esc(t.title)}"</div>` : ''}
    ${part("What's causing it", cause.join('<br/>'))}
    ${part('This one', limits.join('<br/>'))}
    ${part('Who can fly in it', esc(x.who))}
    ${part('About this kind of zone', esc(x.why) + (x.usual ? ` ${esc(x.usual)}` : ''))}
    ${detail?.text ? `<details style="margin-top:7px"><summary style="cursor:pointer;color:#7dd3fc">Full FAA notice</summary><div style="margin-top:4px;color:#cbd5e1;white-space:pre-wrap">${esc(detail.text)}</div></details>` : ''}
    <div style="margin-top:6px;color:#64748b">${x.rule ? `FAA rule ${esc(x.rule)}. ` : ''}The outline is approximate; the FAA notice has the exact limits and times.</div>
    <a href="${t.url}" target="_blank" rel="noreferrer" style="display:block;margin-top:8px;text-align:center;padding:6px;border-radius:6px;border:1px solid #334155;color:#7dd3fc;font-weight:600;text-decoration:none">Read the FAA notice ↗</a>
  </div>`
}

/** A small, out-of-the-way switch under the map's zoom and layer buttons. */
function TripZoomButton() {
  const on = settings.use().tripZoom
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1400)
    return () => clearTimeout(t)
  }, [flash])
  return (
    <div className="absolute left-[10px] top-[142px] z-[500] flex items-center gap-1.5">
      <button
        onClick={() => {
          settings.update({ tripZoom: !on })
          setFlash(true)
        }}
        aria-pressed={on}
        aria-label={on ? 'Trip zoom on: opening a plane zooms out to its whole trip' : 'Trip zoom off: opening a plane keeps the map where it is'}
        title={on ? 'Trip zoom: on' : 'Trip zoom: off'}
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border-2 border-black/20 bg-clip-padding text-sm shadow-sm ${on ? 'bg-white' : 'bg-white/60 grayscale'}`}
      >
        🔭
      </button>
      {flash && <span className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-200 ring-1 ring-slate-700">Trip zoom {on ? 'on' : 'off'}</span>}
    </div>
  )
}
