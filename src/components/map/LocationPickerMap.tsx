import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../../types'

const DEFAULT_CENTER: Coordinates = { lat: 39.7392, lng: -104.9903 }

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<svg viewBox="0 0 24 24" width="30" height="30" fill="#dc2626" stroke="white" stroke-width="1">
      <path d="M12 0C7 0 3 4 3 9c0 6.5 9 15 9 15s9-8.5 9-15c0-5-4-9-9-9z"/>
      <circle cx="12" cy="9" r="3.1" fill="white"/>
    </svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  })
}

export interface LocationPickerMapProps {
  /** null = no location set yet, no marker shown */
  value: Coordinates | null
  onChange: (c: Coordinates) => void
}

/** A minimal, single-purpose map: click anywhere to place (or drag to
 * fine-tune) one marker. Deliberately separate from DispensaryMap.tsx,
 * which has a lot of unrelated concerns (every dispensary's pin, the
 * boundary draw tool, selection) that a "pick where your dispensary is"
 * form control has no business depending on. */
export function LocationPickerMap({ value, onChange }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // --- create the map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const center = value ?? DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: value ? 14 : 10,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- keep the marker in sync with `value` (covers both clicks handled
  // above and the value being set some other way, e.g. editing an
  // existing dispensary) ---
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      const marker = L.marker([value.lat, value.lng], { icon: pinIcon(), draggable: true }).addTo(map)
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        onChangeRef.current({ lat: ll.lat, lng: ll.lng })
      })
      markerRef.current = marker
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 13))
    } else {
      markerRef.current.setLatLng([value.lat, value.lng])
    }
  }, [value])

  return <div ref={containerRef} className="h-full w-full" />
}
