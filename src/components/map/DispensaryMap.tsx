import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import type { BoundaryShape, Coordinates, Dispensary } from '../../types'
import { distanceMiles } from '../../utils/geo'

const DENVER_CENTER: Coordinates = { lat: 39.7392, lng: -104.9903 }
const METERS_PER_MILE = 1609.34

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

function pinIcon(selected: boolean, dimmed: boolean): L.DivIcon {
  const size = selected ? 34 : 26
  const fill = selected ? '#16a34a' : dimmed ? '#a8a29e' : '#29774e'
  return L.divIcon({
    className: 'leafmap-pin',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="white" stroke-width="1">
      <path d="M12 0C7 0 3 4 3 9c0 6.5 9 15 9 15s9-8.5 9-15c0-5-4-9-9-9z"/>
      <circle cx="12" cy="9" r="3.1" fill="white"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}

export interface DispensaryMapProps {
  dispensaries: Dispensary[]
  /** dispensaries currently allowed by the drawn boundary (or all, if none) */
  visibleIds: Set<string>
  selectedIds: Set<string>
  onToggleDispensary: (id: string) => void
  boundary: BoundaryShape
  onBoundaryChange: (b: BoundaryShape) => void
  /** point used to show "x mi away" tooltips, if any */
  referencePoint: Coordinates | null
  /** when true, the next map click sets the radius-circle center */
  pickingCenter: boolean
  onPickCenter: (c: Coordinates) => void
  /** which draw tools (if any) are active on the toolbar */
  drawMode: 'none' | 'shape'
}

export function DispensaryMap({
  dispensaries,
  visibleIds,
  selectedIds,
  onToggleDispensary,
  boundary,
  onBoundaryChange,
  referencePoint,
  pickingCenter,
  onPickCenter,
  drawMode,
}: DispensaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const circleLayerRef = useRef<L.LayerGroup | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)

  // refs mirror the latest callback props so the one-time map-init effect
  // never closes over stale versions of them
  const onToggleDispensaryRef = useRef(onToggleDispensary)
  const onBoundaryChangeRef = useRef(onBoundaryChange)
  const onPickCenterRef = useRef(onPickCenter)
  const pickingCenterRef = useRef(pickingCenter)
  useEffect(() => {
    onToggleDispensaryRef.current = onToggleDispensary
    onBoundaryChangeRef.current = onBoundaryChange
    onPickCenterRef.current = onPickCenter
    pickingCenterRef.current = pickingCenter
  })

  // --- create the map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [DENVER_CENTER.lat, DENVER_CENTER.lng],
      zoom: 11,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    circleLayerRef.current = L.layerGroup().addTo(map)
    const drawnItems = new L.FeatureGroup().addTo(map)
    drawnItemsRef.current = drawnItems

    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: '#29774e', fillOpacity: 0.12 },
        },
        rectangle: { shapeOptions: { color: '#29774e', fillOpacity: 0.12 } },
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })
    drawControlRef.current = drawControl

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = (e as L.DrawEvents.Created).layer as L.Polygon
      drawnItems.clearLayers()
      drawnItems.addLayer(layer)
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map((ll) => ({ lat: ll.lat, lng: ll.lng }))
      onBoundaryChangeRef.current({ kind: 'polygon', points: latlngs })
    })
    map.on(L.Draw.Event.EDITED, (e) => {
      const layers = (e as L.DrawEvents.Edited).layers
      layers.eachLayer((layer) => {
        const latlngs = ((layer as L.Polygon).getLatLngs()[0] as L.LatLng[]).map((ll) => ({
          lat: ll.lat,
          lng: ll.lng,
        }))
        onBoundaryChangeRef.current({ kind: 'polygon', points: latlngs })
      })
    })
    map.on(L.Draw.Event.DELETED, () => {
      onBoundaryChangeRef.current(null)
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickingCenterRef.current) {
        onPickCenterRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // --- toggle draw toolbar visibility based on mode ---
  useEffect(() => {
    const map = mapRef.current
    const control = drawControlRef.current
    if (!map || !control) return
    if (drawMode === 'shape') {
      map.addControl(control)
    } else {
      map.removeControl(control)
    }
  }, [drawMode])

  // --- cursor feedback while picking a center point ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.style.cursor = pickingCenter ? 'crosshair' : ''
  }, [pickingCenter])

  // --- sync markers ---
  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const d of dispensaries) {
      const selected = selectedIds.has(d.id)
      const visible = visibleIds.has(d.id)
      const marker = L.marker([d.coords.lat, d.coords.lng], {
        icon: pinIcon(selected, !visible),
        opacity: visible ? 1 : 0.45,
        riseOnHover: true,
      })
      const dist = referencePoint ? distanceMiles(referencePoint, d.coords) : null
      const tooltipParts = [escapeHtml(d.name)]
      if (dist !== null) tooltipParts.push(`${dist.toFixed(1)} mi`)
      marker.bindTooltip(tooltipParts.join(' · '), { direction: 'top', offset: [0, -6] })
      if (visible) {
        marker.on('click', () => onToggleDispensaryRef.current(d.id))
      }
      marker.addTo(layer)
    }
  }, [dispensaries, selectedIds, visibleIds, referencePoint])

  // --- sync circle overlay (radius boundary) ---
  useEffect(() => {
    const overlay = circleLayerRef.current
    const drawn = drawnItemsRef.current
    if (!overlay || !drawn) return

    overlay.clearLayers()
    if (boundary?.kind === 'circle') {
      drawn.clearLayers()
      L.circle([boundary.center.lat, boundary.center.lng], {
        radius: boundary.radiusMiles * METERS_PER_MILE,
        color: '#29774e',
        weight: 2,
        fillColor: '#399462',
        fillOpacity: 0.1,
      }).addTo(overlay)
      L.circleMarker([boundary.center.lat, boundary.center.lng], {
        radius: 5,
        color: '#16532c',
        weight: 2,
        fillColor: '#16532c',
        fillOpacity: 1,
      }).addTo(overlay)
    } else if (boundary?.kind === 'polygon') {
      // Avoid clobbering a polygon the user just drew (already sitting in
      // `drawn` from the CREATED handler) — only (re)render if it's empty,
      // e.g. right after loading a persisted boundary from localStorage.
      if (drawn.getLayers().length === 0) {
        const latlngs = boundary.points.map((p) => [p.lat, p.lng]) as [number, number][]
        L.polygon(latlngs, { color: '#29774e', fillOpacity: 0.12 }).addTo(drawn)
      }
    } else {
      drawn.clearLayers()
    }
  }, [boundary])

  return <div ref={containerRef} className="h-full w-full" />
}
