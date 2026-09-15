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

export interface MenuPreviewItem {
  name: string
  priceLabel: string
}

export interface DispensaryPreview {
  /** a few sample items, highest-priced first */
  items: MenuPreviewItem[]
  /** total product count at this dispensary — real, already-loaded data,
   * not a network call */
  totalCount: number
}

/** Extracts every drawn shape's outer ring as plain {lat,lng} points —
 * this is what lets multiple simultaneously-drawn polygons/rectangles all
 * count toward the search area, instead of the latest one replacing the
 * rest. Uses this app's own zero-dependency pointInPolygon (via
 * isWithinBoundary/utils/geo.ts) rather than pulling in @turf/turf for
 * the same job. */
function collectPolygons(group: L.FeatureGroup): Coordinates[][] {
  const polygons: Coordinates[][] = []
  group.eachLayer((layer) => {
    if (!('getLatLngs' in layer)) return
    const outerRing = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[]
    polygons.push(outerRing.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
  })
  return polygons
}

export interface DispensaryMapProps {
  dispensaries: Dispensary[]
  /** dispensaries currently allowed by the drawn boundary (or all, if none) */
  visibleIds: Set<string>
  selectedIds: Set<string>
  boundary: BoundaryShape
  onBoundaryChange: (b: BoundaryShape) => void
  /** point used to show "x mi away" tooltips, if any */
  referencePoint: Coordinates | null
  /** when true, the next map click sets the radius-circle center */
  pickingCenter: boolean
  onPickCenter: (c: Coordinates) => void
  /** which draw tools (if any) are active on the toolbar */
  drawMode: 'none' | 'shape'
  /** a few sample menu items (+ total count) per dispensary, shown in its
   * map popup */
  previews: Map<string, DispensaryPreview>
  /** "View full menu" was clicked in a dispensary's popup */
  onViewMenu: (id: string) => void
}

function buildPopupHtml(
  d: Dispensary,
  visible: boolean,
  dist: number | null,
  preview: DispensaryPreview,
): string {
  const parts: string[] = [`<div style="min-width:200px;max-width:240px">`]
  parts.push(`<strong>${escapeHtml(d.name)}</strong><br/>`)
  parts.push(
    `<span style="color:#78716c;font-size:12px">${escapeHtml(d.address)}, ${escapeHtml(d.city)}</span><br/>`,
  )

  const meta: string[] = []
  if (d.rating !== undefined) meta.push(`★ ${d.rating.toFixed(1)}`)
  if (dist !== null) meta.push(`${dist.toFixed(1)} mi`)
  if (meta.length) parts.push(`<span style="font-size:12px;color:#57534e">${meta.join(' · ')}</span><br/>`)

  if (d.website) {
    parts.push(
      `<a href="${escapeHtml(d.website)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#29774e">Visit website ↗</a><br/>`,
    )
  }

  if (d.source === 'openstreetmap') {
    parts.push(
      `<span style="font-size:11px;font-style:italic;color:#b45309">Real location — sample menu, not live inventory</span><br/>`,
    )
  }

  if (!visible) {
    parts.push(`<span style="font-size:12px;font-style:italic;color:#a8a29e">Outside current search area</span>`)
  } else {
    if (preview.items.length > 0) {
      parts.push(
        `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e7e5e4;font-size:12px">`,
      )
      for (const item of preview.items) {
        parts.push(
          `<div style="display:flex;justify-content:space-between;gap:10px">` +
            `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.name)}</span>` +
            `<span style="white-space:nowrap;font-weight:600">${escapeHtml(item.priceLabel)}</span>` +
            `</div>`,
        )
      }
      parts.push(
        `<div style="margin-top:4px;color:#78716c">${preview.totalCount} items in this sample menu</div>`,
      )
      parts.push(`</div>`)
    }
    parts.push(
      `<button type="button" class="leafmap-view-menu-btn" style="margin-top:8px;width:100%;padding:6px 8px;border:none;border-radius:8px;background:#29774e;color:white;font-size:12px;font-weight:600;cursor:pointer">View full menu →</button>`,
    )
  }

  parts.push(`</div>`)
  return parts.join('')
}

export function DispensaryMap({
  dispensaries,
  visibleIds,
  selectedIds,
  boundary,
  onBoundaryChange,
  referencePoint,
  pickingCenter,
  onPickCenter,
  drawMode,
  previews,
  onViewMenu,
}: DispensaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const circleLayerRef = useRef<L.LayerGroup | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)

  // refs mirror the latest callback props so the one-time map-init effect
  // never closes over stale versions of them
  const onBoundaryChangeRef = useRef(onBoundaryChange)
  const onPickCenterRef = useRef(onPickCenter)
  const onViewMenuRef = useRef(onViewMenu)
  const pickingCenterRef = useRef(pickingCenter)
  useEffect(() => {
    onBoundaryChangeRef.current = onBoundaryChange
    onPickCenterRef.current = onPickCenter
    onViewMenuRef.current = onViewMenu
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
          // showArea's live tooltip hits a long-standing leaflet-draw bug
          // (its bundled GeometryUtil.readableArea references an
          // out-of-scope `type` and throws) — confirmed via a Playwright
          // draw test that still finished the polygon, but spammed
          // ReferenceErrors on every mouse move while drawing. Not worth
          // the area readout; leave it off.
          showArea: false,
          shapeOptions: { color: '#29774e', fillOpacity: 0.12 },
        },
        rectangle: { showArea: false, shapeOptions: { color: '#29774e', fillOpacity: 0.12 } },
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

    // Each of these adds/edits/removes ONE shape in `drawnItems`, but the
    // boundary this app searches by is ALL shapes currently in that group
    // — so every handler recomputes the full polygon list from scratch
    // rather than tracking just the one shape that changed. This is what
    // lets someone draw several separate areas (e.g. two neighborhoods)
    // and have dispensaries in either one count.
    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = (e as L.DrawEvents.Created).layer as L.Polygon
      drawnItems.addLayer(layer)
      onBoundaryChangeRef.current({ kind: 'polygon', polygons: collectPolygons(drawnItems) })
    })
    map.on(L.Draw.Event.EDITED, () => {
      onBoundaryChangeRef.current({ kind: 'polygon', polygons: collectPolygons(drawnItems) })
    })
    map.on(L.Draw.Event.DELETED, () => {
      const remaining = collectPolygons(drawnItems)
      onBoundaryChangeRef.current(remaining.length > 0 ? { kind: 'polygon', polygons: remaining } : null)
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

      // Clicking a pin only opens its info/menu-preview popup — it must NOT
      // also mutate selection state. Selection changes make this effect's
      // dependencies change, which clears and rebuilds every marker; doing
      // that from the same click that's opening this exact marker's popup
      // destroys the popup before/while it opens (a real bug, caught via a
      // Playwright click test, not just a hover-tooltip check). Dispensary
      // selection is a sidebar-checkbox-only action for that reason.
      const preview = previews.get(d.id) ?? { items: [], totalCount: 0 }
      marker.bindPopup(buildPopupHtml(d, visible, dist, preview), { maxWidth: 260 })
      marker.on('popupopen', () => {
        const btn = marker.getPopup()?.getElement()?.querySelector('.leafmap-view-menu-btn')
        btn?.addEventListener('click', () => onViewMenuRef.current(d.id), { once: true })
      })
      marker.addTo(layer)
    }
  }, [dispensaries, selectedIds, visibleIds, referencePoint, previews])

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
      // Avoid clobbering shapes the user just drew/edited (already sitting
      // in `drawn` from the CREATED/EDITED handlers) — only (re)render if
      // empty, e.g. right after loading a persisted boundary from
      // localStorage, where `drawn` starts out with nothing in it.
      if (drawn.getLayers().length === 0) {
        for (const points of boundary.polygons) {
          const latlngs = points.map((p) => [p.lat, p.lng]) as [number, number][]
          L.polygon(latlngs, { color: '#29774e', fillOpacity: 0.12 }).addTo(drawn)
        }
      }
    } else {
      drawn.clearLayers()
    }
  }, [boundary])

  return <div ref={containerRef} className="h-full w-full" />
}
