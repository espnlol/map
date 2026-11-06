/**
 * Military arrival watch: tell me when a military-labelled aircraft is
 * arriving at, or lands at, the airports I pick.
 */
import type { Aircraft, RawAircraft } from '../types'
import { createStore } from './store'
import { bearingDeg, distanceNm } from './geo'
import { upstream } from './upstream'
import { modelName } from './aircraftTypes'

export interface WatchedAirport {
  code: string
  name: string
  lat: number
  lon: number
  elevation: number
}

export interface MilArrival {
  id: string
  hex: string
  callsign: string
  model?: string
  airport: string
  status: 'arriving' | 'landed'
  at: number
  distanceNm: number
  altitude: number | null
}

export const milWatch = createStore<{ airports: WatchedAirport[]; notify: boolean }>('skywatch.milWatch', { airports: [], notify: true })
export const milArrivals = createStore<MilArrival[]>('skywatch.milArrivals', [])

interface Seen {
  hex: string
  callsign: string
  model?: string
  lat: number
  lon: number
  altitude: number | null
  onGround: boolean
  vr: number | null
  track: number | null
}

const ARRIVE_NM = 40
const LANDED_NM = 4
const REPEAT_MS = 3 * 3600e3

/** Is this aircraft arriving at / landed at one of the watched airports? Returns new events. */
export function checkArrivals(planes: Seen[], now = Date.now()): MilArrival[] {
  const { airports } = milWatch.get()
  if (!airports.length) return []
  const log = milArrivals.get()
  const fresh: MilArrival[] = []
  for (const p of planes) {
    for (const ap of airports) {
      const d = distanceNm(p.lat, p.lon, ap.lat, ap.lon)
      if (d > ARRIVE_NM) continue
      const agl = p.onGround ? 0 : (p.altitude ?? 99999) - ap.elevation
      let status: MilArrival['status'] | null = null
      if (d <= LANDED_NM && (p.onGround || agl < 400)) status = 'landed'
      else if (!p.onGround && agl < 12000 && (p.vr ?? 0) < -250) {
        const toward = p.track == null ? true : Math.abs(((bearingDeg(p.lat, p.lon, ap.lat, ap.lon) - p.track + 540) % 360) - 180) < 60
        if (toward || d < 10) status = 'arriving'
      }
      if (!status) continue
      const dup = [...fresh, ...log].some((e) => e.hex === p.hex && e.airport === ap.code && e.status === status && now - e.at < REPEAT_MS)
      if (dup) continue
      fresh.push({ id: `${p.hex}-${ap.code}-${status}-${now}`, hex: p.hex, callsign: p.callsign, model: p.model, airport: ap.code, status, at: now, distanceNm: d, altitude: p.onGround ? null : p.altitude })
    }
  }
  if (fresh.length) milArrivals.set([...fresh, ...log].filter((e) => now - e.at < 7 * 86400e3).slice(0, 200))
  return fresh
}

export const fromAircraft = (a: Aircraft): Seen => ({
  hex: a.hex,
  callsign: a.callsign,
  model: a.model,
  lat: a.lat,
  lon: a.lon,
  altitude: a.altitude,
  onGround: a.onGround,
  vr: a.verticalRate,
  track: a.track,
})

/** Check the worldwide military list (for watched airports outside your map area). */
export async function scanMilitary(): Promise<MilArrival[]> {
  if (!milWatch.get().airports.length) return []
  try {
    const res = await fetch(`${upstream('adsblol')}/v2/mil`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const j = (await res.json()) as { ac?: RawAircraft[] }
    const planes: Seen[] = (j.ac ?? [])
      .filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number')
      .map((a) => ({
        hex: a.hex,
        callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
        model: modelName(a.t, a.desc),
        lat: a.lat!,
        lon: a.lon!,
        altitude: typeof a.alt_baro === 'number' ? a.alt_baro : null,
        onGround: a.alt_baro === 'ground',
        vr: a.baro_rate ?? a.geom_rate ?? null,
        track: a.track ?? null,
      }))
    return checkArrivals(planes)
  } catch {
    return []
  }
}

/** Military aircraft near watched airports right now (from your map). */
export function nearWatched(aircraft: Aircraft[]) {
  const { airports } = milWatch.get()
  const out: { a: Aircraft; airport: string; d: number }[] = []
  for (const a of aircraft) {
    if (!a.special.some((s) => s.tag === 'milgov')) continue
    for (const ap of airports) {
      const d = distanceNm(a.lat, a.lon, ap.lat, ap.lon)
      if (d <= ARRIVE_NM) out.push({ a, airport: ap.code, d })
    }
  }
  return out.sort((x, y) => x.d - y.d)
}

/** Fold in arrivals the relay saw while the app was closed. */
export function mergeRelayArrivals(list: MilArrival[] | undefined) {
  if (!list?.length) return
  const have = milArrivals.get()
  const add = list.filter((e) => !have.some((h) => h.hex === e.hex && h.airport === e.airport && h.status === e.status && Math.abs(h.at - e.at) < REPEAT_MS))
  if (add.length) milArrivals.set([...add, ...have].sort((a, b) => b.at - a.at).slice(0, 200))
}
