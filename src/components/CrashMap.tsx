import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Crash } from '../types'
import { CAUSE_COLORS } from '../styles'

export type MarkerMode = 'markers' | 'heatmap'
export type Projection = 'globe' | 'flat'
export type BaseMap = 'satellite' | 'terrain' | 'dark'

// Esri's public basemap tiles: free, no API key, and they work on any domain.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const esri = (path: string) => [`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`]
const ESRI_ATTR = 'Tiles &copy; Esri, Maxar, Earthstar Geographics'

const BASE_LAYERS: Record<BaseMap, string[]> = {
  satellite: ['satellite', 'satellite-labels'],
  terrain: ['terrain'],
  dark: ['dark', 'dark-labels'],
}

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#0b1324',
    'horizon-color': '#1e3a5f',
    'fog-color': '#0b1324',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  },
  sources: {
    satellite: { type: 'raster', tiles: esri('World_Imagery'), tileSize: 256, maxzoom: 18, attribution: ESRI_ATTR },
    'satellite-labels': { type: 'raster', tiles: esri('Reference/World_Boundaries_and_Places'), tileSize: 256, maxzoom: 18 },
    terrain: { type: 'raster', tiles: esri('World_Topo_Map'), tileSize: 256, maxzoom: 18, attribution: ESRI_ATTR },
    dark: { type: 'raster', tiles: esri('Canvas/World_Dark_Gray_Base'), tileSize: 256, maxzoom: 16, attribution: ESRI_ATTR },
    'dark-labels': { type: 'raster', tiles: esri('Canvas/World_Dark_Gray_Reference'), tileSize: 256, maxzoom: 16 },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1324' } },
    { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.15, 'raster-brightness-max': 0.92 } },
    { id: 'satellite-labels', type: 'raster', source: 'satellite-labels' },
    { id: 'terrain', type: 'raster', source: 'terrain', layout: { visibility: 'none' } },
    { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
    { id: 'dark-labels', type: 'raster', source: 'dark-labels', layout: { visibility: 'none' } },
  ],
}

// A top-down airliner silhouette, drawn white so MapLibre can tint it (SDF).
const PLANE_PATH =
  'M12 2c.8 0 1.4.7 1.4 1.6V9l7.6 4.4v2l-7.6-2.2v4.6l2.4 1.8V21l-3.8-1.1L8.2 21v-1.5l2.4-1.8v-4.6L3 15.4v-2L10.6 9V3.6C10.6 2.7 11.2 2 12 2z'

function planeImage(size: number): ImageData {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.scale(size / 24, size / 24)
  ctx.fillStyle = '#fff'
  ctx.fill(new Path2D(PLANE_PATH))
  return ctx.getImageData(0, 0, size, size)
}

// A burst shape for the selected crash.
function burstImage(size: number): ImageData {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  ctx.translate(r, r)
  ctx.beginPath()
  for (let i = 0; i < 24; i++) {
    const rad = i % 2 ? r * 0.55 : r * 0.98
    const a = (i / 24) * Math.PI * 2
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fillStyle = '#fff'
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// Stable pseudo-random heading per crash so the planes don't all point north.
function heading(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

// On the globe, MapLibre sometimes stops drawing frames before a GeoJSON source
// that was just added or updated has loaded, so the planes wouldn't show until
// the map moved. Keep nudging it with a frame until the source reports loaded.
const nudgers = new WeakMap<maplibregl.Map, number>()
function ensureLoaded(map: maplibregl.Map) {
  clearInterval(nudgers.get(map))
  let tries = 0
  const timer = window.setInterval(() => {
    if (map.isSourceLoaded('crashes') || ++tries > 40) {
      clearInterval(timer)
      // One last frame so the newly loaded data is drawn.
      map.triggerRepaint()
      return
    }
    map.triggerRepaint()
  }, 300)
  nudgers.set(map, timer)
}

/** Points along the great-circle path between two places, so routes curve like real flights. */
function greatCircle(a: [number, number], b: [number, number], steps = 64): [number, number][] {
  const rad = Math.PI / 180
  const [lng1, lat1] = [a[0] * rad, a[1] * rad]
  const [lng2, lat2] = [b[0] * rad, b[1] * rad]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2))
  if (d < 1e-6) return [a, b]
  const pts: [number, number][] = []
  let prevLng = a[0]
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    let lng = Math.atan2(y, x) / rad
    // keep the line continuous across the antimeridian
    while (lng - prevLng > 180) lng -= 360
    while (lng - prevLng < -180) lng += 360
    prevLng = lng
    pts.push([lng, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad])
  }
  return pts
}

function routeGeoJSON(c: Crash | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  if (c) {
    const site: [number, number] = [c.lng, c.lat]
    const from = c.from?.lat != null && c.from.lng != null ? ([c.from.lng, c.from.lat] as [number, number]) : null
    const to = c.to?.lat != null && c.to.lng != null ? ([c.to.lng, c.to.lat] as [number, number]) : null
    if (from) {
      features.push({ type: 'Feature', properties: { leg: 'flown' }, geometry: { type: 'LineString', coordinates: greatCircle(from, site) } })
      features.push({ type: 'Feature', properties: { end: 'from', name: c.from!.name }, geometry: { type: 'Point', coordinates: from } })
    }
    if (to) {
      features.push({ type: 'Feature', properties: { leg: 'planned' }, geometry: { type: 'LineString', coordinates: greatCircle(site, to) } })
      features.push({ type: 'Feature', properties: { end: 'to', name: c.to!.name }, geometry: { type: 'Point', coordinates: to } })
    }
  }
  return { type: 'FeatureCollection', features }
}

function toGeoJSON(crashes: Crash[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: crashes.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { id: c.id, name: c.name, year: c.date.slice(0, 4), fatalities: c.fatalities ?? 0, color: CAUSE_COLORS[c.cause], rot: heading(c.id) },
    })),
  }
}

export function CrashMap({ crashes, selected, onSelect, mode, projection, baseMap, fitRequest }: {
  crashes: Crash[]
  selected: Crash | null
  onSelect: (id: string | null) => void
  mode: MarkerMode
  projection: Projection
  baseMap: BaseMap
  /** Bump this number to zoom the map out/in to fit every crash being shown */
  fitRequest?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const crashesRef = useRef(crashes)
  crashesRef.current = crashes
  // The data the source currently holds. Re-setting identical data while the
  // globe's first tiles are loading leaves the source empty, so skip that.
  const shownRef = useRef<Crash[] | null>(null)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE,
      center: [10, 25],
      zoom: 1.6,
      maxZoom: 17,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    // The side panel opening/closing changes the map's size without a window resize.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container.current!)

    map.on('load', () => {
      map.addImage('plane', planeImage(64), { sdf: true })
      map.addImage('burst', burstImage(64), { sdf: true })
      shownRef.current = crashesRef.current
      map.addSource('crashes', { type: 'geojson', data: toGeoJSON(crashesRef.current) })
      map.addSource('selected', { type: 'geojson', data: toGeoJSON([]) })
      map.addSource('route', { type: 'geojson', data: routeGeoJSON(null) })

      map.addLayer({
        id: 'heat',
        type: 'heatmap',
        source: 'crashes',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'fatalities'], 0, 0.15, 100, 0.6, 500, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1.2, 8, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 18, 4, 30, 9, 60],
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.15, '#1d4ed8', 0.35, '#06b6d4', 0.55, '#facc15', 0.75, '#f97316', 1, '#dc2626',
          ],
        },
      })
      map.addLayer({
        id: 'plane-halo',
        type: 'circle',
        source: 'crashes',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-radius': ['interpolate', ['linear'], ['get', 'fatalities'], 0, 9, 100, 14, 600, 24],
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.5,
        },
      })
      map.addLayer({
        id: 'planes',
        type: 'symbol',
        source: 'crashes',
        layout: {
          'icon-image': 'plane',
          'icon-size': ['interpolate', ['linear'], ['get', 'fatalities'], 0, 0.32, 100, 0.42, 600, 0.6],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['-', 0, ['get', 'fatalities']],
        },
        paint: { 'icon-color': ['get', 'color'], 'icon-halo-color': '#0b1324', 'icon-halo-width': 1.5 },
      })
      // Route of the selected flight: flown leg, then the leg it never finished.
      map.addLayer({
        id: 'route-planned',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'leg'], 'planned'],
        paint: { 'line-color': '#f87171', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [1.5, 2] },
      })
      map.addLayer({
        id: 'route-flown',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'leg'], 'flown'],
        paint: { 'line-color': '#facc15', 'line-width': 2.5, 'line-opacity': 0.9, 'line-dasharray': [3, 1.5] },
      })
      map.addLayer({
        id: 'route-airports',
        type: 'circle',
        source: 'route',
        filter: ['has', 'end'],
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get', 'end'], 'from', '#facc15', '#f87171'],
          'circle-stroke-color': '#0b1324',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'selected-burst',
        type: 'symbol',
        source: 'selected',
        layout: { 'icon-image': 'burst', 'icon-size': 0.75, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-color': '#ef4444', 'icon-opacity': 0.9 },
      })
      map.addLayer({
        id: 'selected-plane',
        type: 'symbol',
        source: 'selected',
        layout: {
          'icon-image': 'plane', 'icon-size': 0.5, 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true, 'icon-ignore-placement': true,
        },
        paint: { 'icon-color': '#facc15', 'icon-halo-color': '#7f1d1d', 'icon-halo-width': 2 },
      })

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'crash-tip' })
      map.on('mouseenter', 'route-airports', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { end: string; name: string }
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<b>${p.end === 'from' ? 'Departed' : 'Was flying to'}</b><br>${p.name.replace(/</g, '&lt;')}`)
          .addTo(map)
      })
      map.on('mouseleave', 'route-airports', () => popup.remove())
      for (const layer of ['planes', 'plane-halo']) {
        map.on('mouseenter', layer, (e) => {
          map.getCanvas().style.cursor = 'pointer'
          const f = e.features?.[0]
          if (!f) return
          const p = f.properties as { name: string; year: string; fatalities: number }
          popup
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(`<b>${p.name.replace(/</g, '&lt;')}</b><br>${p.year} · ${p.fatalities} deaths`)
            .addTo(map)
        })
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
      }
      map.on('click', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['planes', 'plane-halo'] })[0]
        if (f) onSelectRef.current(f.properties.id as string)
      })
      ensureLoaded(map)
      setReady(true)
    })
    return () => { ro.disconnect(); clearInterval(nudgers.get(map)); map.remove() }
  }, [])

  useEffect(() => {
    if (!ready || shownRef.current === crashes) return
    shownRef.current = crashes
    ;(mapRef.current!.getSource('crashes') as GeoJSONSource).setData(toGeoJSON(crashes))
    ensureLoaded(mapRef.current!)
  }, [crashes, ready])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    ;(map.getSource('selected') as GeoJSONSource).setData(toGeoJSON(selected ? [selected] : []))
    ;(map.getSource('route') as GeoJSONSource).setData(routeGeoJSON(selected))
    if (selected) {
      // Leave room for the side panel on wide screens and the bottom sheet on phones.
      const wide = map.getContainer().clientWidth >= 768
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: Math.max(map.getZoom(), 8.5),
        speed: 1.4,
        padding: wide ? { left: 0, top: 0, right: 0, bottom: 0 } : { left: 0, top: 0, right: 0, bottom: map.getContainer().clientHeight * 0.45 },
      })
    }
  }, [selected, ready])

  useEffect(() => {
    if (!ready || !fitRequest || !crashesRef.current.length) return
    const list = crashesRef.current
    const bounds = new maplibregl.LngLatBounds()
    for (const c of list) bounds.extend([c.lng, c.lat])
    const map = mapRef.current!
    const wide = map.getContainer().clientWidth >= 768
    map.fitBounds(bounds, {
      padding: wide ? 80 : { top: 80, left: 30, right: 30, bottom: map.getContainer().clientHeight * 0.5 },
      maxZoom: 7,
      duration: 1200,
    })
  }, [fitRequest, ready])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    const heat = mode === 'heatmap'
    map.setLayoutProperty('heat', 'visibility', heat ? 'visible' : 'none')
    for (const id of ['planes', 'plane-halo']) map.setLayoutProperty(id, 'visibility', heat ? 'none' : 'visible')
  }, [mode, ready])

  useEffect(() => {
    if (ready) mapRef.current!.setProjection({ type: projection === 'globe' ? 'globe' : 'mercator' })
  }, [projection, ready])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    for (const [base, layers] of Object.entries(BASE_LAYERS)) {
      for (const l of layers) map.setLayoutProperty(l, 'visibility', base === baseMap ? 'visible' : 'none')
    }
  }, [baseMap, ready])

  return <div ref={container} className="h-full w-full" />
}
