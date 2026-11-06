import { distanceNm } from './geo'
import type { Aircraft } from '../types'

/** One airport from public/airports.json (built by scripts/build-airports.py from OurAirports). */
export interface AirportInfo {
  ident: string
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  elevation: number | null
  large: boolean
  runways: { lat1: number; lon1: number; lat2: number; lon2: number; lengthFt: number; name: string }[]
}

type Row = [string, string, string, string, string, number, number, number | null, 'L' | 'M', [number, number, number, number, number, string][]]

let loading: Promise<AirportInfo[]> | null = null

export function loadAirports(): Promise<AirportInfo[]> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}airports.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Row[]>) : []))
      .then((rows) =>
        rows.map((r) => ({
          ident: r[0],
          iata: r[1],
          name: r[2],
          city: r[3],
          country: r[4],
          lat: r[5],
          lon: r[6],
          elevation: r[7],
          large: r[8] === 'L',
          runways: r[9].map(([lat1, lon1, lat2, lon2, lengthFt, name]) => ({ lat1, lon1, lat2, lon2, lengthFt, name })),
        })),
      )
      .catch(() => {
        loading = null
        return []
      })
  }
  return loading
}

export interface Busyness {
  onGround: number
  arriving: number
  departing: number
  total: number
}

/** Aircraft on the ground at, or low and close to, an airport. */
export function busyness(ap: AirportInfo, aircraft: Aircraft[]): Busyness {
  const b: Busyness = { onGround: 0, arriving: 0, departing: 0, total: 0 }
  const near = ap.large ? 4 : 3
  for (const a of aircraft) {
    if (Math.abs(a.lat - ap.lat) > 0.3 || Math.abs(a.lon - ap.lon) > 0.4) continue
    const d = distanceNm(a.lat, a.lon, ap.lat, ap.lon)
    if (a.onGround && d < near) b.onGround++
    else if (!a.onGround && d < 12 && (a.altitude ?? 99999) < 5000 + (ap.elevation ?? 0)) {
      if ((a.verticalRate ?? 0) > 200) b.departing++
      else b.arriving++
    } else continue
    b.total++
  }
  return b
}
