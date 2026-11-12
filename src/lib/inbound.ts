import type { Aircraft } from '../types'
import type { AirportInfo } from './airports'
import { bearingDeg, distanceNm } from './geo'

export interface Inbound {
  a: Aircraft
  distNm: number
  /** Minutes to the airport at the current ground speed (straight line). */
  etaMin: number | null
  /** scheduled: its route says it's landing here. approach: it's low, descending and pointed at the field. */
  why: 'scheduled' | 'approach'
}

const angleDiff = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180)

/** Every airborne aircraft heading to an airport, nearest arrival first. */
export function inboundTo(ap: AirportInfo, aircraft: Aircraft[]): Inbound[] {
  const codes = new Set([ap.iata, ap.ident, ...(ap.aka?.codes ?? [])].filter(Boolean).map((c) => c.toUpperCase()))
  const out: Inbound[] = []
  for (const a of aircraft) {
    if (a.onGround) continue
    const d = distanceNm(a.lat, a.lon, ap.lat, ap.lon)
    const dest = a.route?.destination
    const toHere = !!dest && (codes.has((dest.iata ?? '').toUpperCase()) || codes.has((dest.icao ?? '').toUpperCase()))
    let why: Inbound['why'] | null = toHere ? 'scheduled' : null

    // No route (or the route says elsewhere but it's clearly landing here): judge by how it's flying.
    if (!why && (!dest || d < 20) && d < 50) {
      const alt = (a.altitude ?? 99999) - (ap.elevation ?? 0)
      const descending = (a.verticalRate ?? 0) <= -300
      const pointed = a.track != null && angleDiff(a.track, bearingDeg(a.lat, a.lon, ap.lat, ap.lon)) < (d < 8 ? 50 : 30)
      if (pointed && alt < 14000 && (descending || alt < 4000)) why = 'approach'
    }
    if (!why) continue
    const gs = a.groundSpeed ?? 0
    out.push({ a, distNm: d, etaMin: gs > 40 ? (d / gs) * 60 : null, why })
  }
  return out.sort((x, y) => (x.etaMin ?? x.distNm / 4) - (y.etaMin ?? y.distNm / 4))
}
