import type { Aircraft } from '../types'
import { bearingDeg, distanceNm } from './geo'
import type { AirportInfo } from './airports'

/** A place where one or more aircraft are flying circles. */
export interface Hotspot {
  id: string
  lat: number
  lon: number
  radiusNm: number
  since: number
  aircraft: { hex: string; callsign: string; model?: string; milgov: boolean; heli: boolean; altitude: number | null; turns: number }[]
  nearAirport?: string
}

const WINDOW_MS = 15 * 60 * 1000
const firstCircling = new Map<string, number>()

/** How many full turns an aircraft has made recently, and how tightly. */
function circling(a: Aircraft, now: number): { turns: number; lat: number; lon: number; spread: number } | null {
  if (a.onGround || (a.altitude ?? 0) > 12000) return null
  // airliners looping at altitude are holding for an airport, not "something happening"
  if (['A3', 'A4', 'A5'].includes(a.category) && (a.altitude ?? 0) > 5000) return null
  const pts = a.trail.filter((p) => (p[3] ?? now) >= now - WINDOW_MS)
  if (pts.length < 12) return null
  let lat = 0
  let lon = 0
  for (const p of pts) {
    lat += p[0]
    lon += p[1]
  }
  lat /= pts.length
  lon /= pts.length
  let spread = 0
  for (const p of pts) spread = Math.max(spread, distanceNm(lat, lon, p[0], p[1]))
  if (spread > 4) return null // flying somewhere, not circling
  let total = 0
  let prevBrg: number | null = null
  let last = pts[0]
  for (const p of pts.slice(1)) {
    if (distanceNm(last[0], last[1], p[0], p[1]) < 0.03) continue
    const brg = bearingDeg(last[0], last[1], p[0], p[1])
    if (prevBrg != null) total += ((brg - prevBrg + 540) % 360) - 180
    prevBrg = brg
    last = p
  }
  const turns = Math.abs(total) / 360
  return turns >= 1.5 ? { turns, lat, lon, spread } : null
}

export function findHotspots(aircraft: Aircraft[], airports: AirportInfo[], ignoreAirports: boolean): Hotspot[] {
  const now = Date.now()
  const found: { a: Aircraft; c: NonNullable<ReturnType<typeof circling>> }[] = []
  for (const a of aircraft) {
    const c = circling(a, now)
    if (!c) {
      firstCircling.delete(a.hex)
      continue
    }
    const ap = airports.find((p) => Math.abs(p.lat - c.lat) < 0.1 && Math.abs(p.lon - c.lon) < 0.15 && distanceNm(p.lat, p.lon, c.lat, c.lon) < 3)
    if (ap && ignoreAirports && (a.altitude ?? 0) < 3500 + (ap.elevation ?? 0)) continue
    if (!firstCircling.has(a.hex)) firstCircling.set(a.hex, now)
    found.push({ a, c })
  }
  // group aircraft circling the same spot
  const spots: Hotspot[] = []
  for (const { a, c } of found) {
    const entry = {
      hex: a.hex,
      callsign: a.callsign,
      model: a.model,
      milgov: a.special.some((s) => s.tag === 'milgov'),
      heli: a.category === 'A7',
      altitude: a.altitude,
      turns: Math.round(c.turns * 10) / 10,
    }
    const near = spots.find((s) => distanceNm(s.lat, s.lon, c.lat, c.lon) < 3)
    if (near) {
      near.aircraft.push(entry)
      near.radiusNm = Math.max(near.radiusNm, c.spread + distanceNm(near.lat, near.lon, c.lat, c.lon))
      near.since = Math.min(near.since, firstCircling.get(a.hex)!)
    } else {
      const ap = airports.find((p) => distanceNm(p.lat, p.lon, c.lat, c.lon) < 3)
      spots.push({ id: a.hex, lat: c.lat, lon: c.lon, radiusNm: Math.max(0.5, c.spread), since: firstCircling.get(a.hex)!, aircraft: [entry], nearAirport: ap ? ap.iata || ap.ident : undefined })
    }
  }
  return spots.sort((x, y) => y.aircraft.length - x.aircraft.length)
}

/** Nearest airport, as a rough "where is this" label. */
export function describePlace(lat: number, lon: number, airports: AirportInfo[]): string | null {
  let best: AirportInfo | null = null
  let bd = Infinity
  for (const p of airports) {
    if (Math.abs(p.lat - lat) > 1.5 || Math.abs(p.lon - lon) > 2) continue
    const d = distanceNm(lat, lon, p.lat, p.lon)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  if (!best) return null
  return `${Math.round(bd)} nm from ${best.city || best.name} (${best.iata || best.ident})`
}
