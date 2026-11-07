import type { Aircraft } from '../types'
import { createStore } from './store'
import { planeKey } from './logbook'

/** Every time you open a plane, for its profile: when, as which flight, and where it was going. */
export interface Sighting {
  at: number
  callsign: string
  from?: string
  to?: string
  altitude: number | null
  lat: number
  lon: number
}

export interface PlaneRecord {
  key: string
  hex: string
  registration?: string
  model?: string
  typeCode?: string
  firstAt: number
  lastAt: number
  count: number
  callsigns: Record<string, number>
  recent: Sighting[]
}

const MAX_PLANES = 300
const MAX_RECENT = 15
/** Opening the same plane again within this window updates the last sighting instead of adding one. */
const SAME_VISIT = 30 * 60_000

export const sightings = createStore<Record<string, PlaneRecord>>('skywatch.sightings', {})

const code = (a?: { iata?: string; icao?: string }) => a?.iata || a?.icao || undefined

export function recordSighting(a: Aircraft, now = Date.now()) {
  const key = planeKey(a)
  const callsign = a.callsign.trim()
  const s: Sighting = {
    at: now,
    callsign,
    from: code(a.route?.origin),
    to: code(a.route?.destination),
    altitude: a.onGround ? 0 : a.altitude,
    lat: a.lat,
    lon: a.lon,
  }
  sightings.set((all) => {
    const prev = all[key]
    let rec: PlaneRecord
    if (!prev) {
      rec = { key, hex: a.hex, registration: a.registration, model: a.model, typeCode: a.typeCode, firstAt: now, lastAt: now, count: 1, callsigns: { [callsign]: 1 }, recent: [s] }
    } else {
      const last = prev.recent[0]
      const sameVisit = last && now - last.at < SAME_VISIT && last.callsign === callsign
      rec = {
        ...prev,
        hex: a.hex,
        registration: a.registration ?? prev.registration,
        model: a.model ?? prev.model,
        typeCode: a.typeCode ?? prev.typeCode,
        lastAt: now,
        count: sameVisit ? prev.count : prev.count + 1,
        callsigns: sameVisit ? prev.callsigns : { ...prev.callsigns, [callsign]: (prev.callsigns[callsign] ?? 0) + 1 },
        recent: sameVisit ? [{ ...s, at: last.at, from: s.from ?? last.from, to: s.to ?? last.to }, ...prev.recent.slice(1)] : [s, ...prev.recent].slice(0, MAX_RECENT),
      }
    }
    const next = { ...all, [key]: rec }
    const keys = Object.keys(next)
    if (keys.length > MAX_PLANES) {
      keys.sort((x, y) => next[x].lastAt - next[y].lastAt)
      for (const k of keys.slice(0, keys.length - MAX_PLANES)) delete next[k]
    }
    return next
  })
}

export const findSightings = (all: Record<string, PlaneRecord>, p: { hex: string; registration?: string }) =>
  all[planeKey(p)] ?? Object.values(all).find((r) => r.hex.toLowerCase() === p.hex.toLowerCase())

/** Combine two devices' sighting histories. */
export function mergeSightings(a: Record<string, PlaneRecord> = {}, b: Record<string, PlaneRecord> = {}): Record<string, PlaneRecord> {
  const out: Record<string, PlaneRecord> = { ...a }
  for (const [k, r] of Object.entries(b)) {
    const p = out[k]
    if (!p) {
      out[k] = r
      continue
    }
    const seen = new Set<number>()
    const recent = [...p.recent, ...r.recent]
      .sort((x, y) => y.at - x.at)
      .filter((s) => (seen.has(s.at) ? false : (seen.add(s.at), true)))
      .slice(0, MAX_RECENT)
    const callsigns = { ...p.callsigns }
    for (const [c, n] of Object.entries(r.callsigns)) callsigns[c] = Math.max(n, callsigns[c] ?? 0)
    const newer = r.lastAt > p.lastAt ? r : p
    out[k] = { ...newer, firstAt: Math.min(p.firstAt, r.firstAt), lastAt: Math.max(p.lastAt, r.lastAt), count: Math.max(p.count, r.count, recent.length), callsigns, recent }
  }
  return out
}
