/**
 * Extra per-aircraft lookups that only happen for the plane you click:
 * its flight history (where it has been) and a photo of the actual airframe.
 */

import { upstream } from './upstream'

/** [lat, lon, altitude in ft (null = on the ground), epoch ms] */
export type PathPoint = [number, number, number | null, number]

export interface FlightPath {
  points: PathPoint[]
  source: string
  /** true when the history starts at the departure (we saw it on the ground or at a leg start) */
  fromTakeoff: boolean
}

interface TraceJson {
  timestamp: number
  trace: unknown[][]
}

const TRACE_SOURCES = [
  { name: 'adsb.lol', base: () => upstream('adsblolglobe') },
  { name: 'airplanes.live', base: () => upstream('airplanesliveglobe') },
]

/**
 * Fetch today's track for an aircraft from the networks' tar1090 "trace"
 * files and cut it down to the current flight (since the last time it was on
 * the ground or the network marked a new leg).
 */
const traceCache = new Map<string, { at: number; json: TraceJson; source: string } | null>()

/** Today's raw track file for an aircraft (shared by the path and the "today's flights" list). */
async function fetchTrace(hex: string): Promise<{ json: TraceJson; source: string } | null> {
  const h = hex.toLowerCase().replace(/^~/, '')
  const hit = traceCache.get(h)
  if (hit && Date.now() - hit.at < 50_000) return hit
  const file = `/data/traces/${h.slice(-2)}/trace_full_${h}.json`
  for (const src of TRACE_SOURCES) {
    try {
      const res = await fetch(src.base() + file, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = (await res.json()) as TraceJson
      if (!json || !Array.isArray(json.trace)) continue
      const entry = { at: Date.now(), json, source: src.name }
      traceCache.set(h, entry)
      return entry
    } catch {
      // try the next source
    }
  }
  return null
}

export async function fetchFlightPath(hex: string): Promise<FlightPath | null> {
  const t = await fetchTrace(hex)
  if (!t) return null
  const path = parseTrace(t.json)
  return path ? { ...path, source: t.source } : null
}

export interface Leg {
  departedAt: number
  departLat: number
  departLon: number
  fromGround: boolean // we saw it on the ground before takeoff
  arrivedAt: number
  arriveLat: number
  arriveLon: number
  landed: boolean // we saw it on the ground after
  ongoing: boolean
  maxAltitude: number
}

/** Split today's track into separate flights. */
export function parseLegs(json: TraceJson): Leg[] {
  if (!json || typeof json.timestamp !== 'number' || !Array.isArray(json.trace)) return []
  const pts: { t: number; lat: number; lon: number; alt: number | null; newLeg: boolean }[] = []
  for (const row of json.trace) {
    const [dt, lat, lon, alt, , , flags] = row as [number, number, number, number | 'ground' | null, unknown, unknown, number]
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    pts.push({ t: (json.timestamp + dt) * 1000, lat, lon, alt: alt === 'ground' ? null : typeof alt === 'number' ? alt : 0, newLeg: typeof flags === 'number' && (flags & 2) === 2 })
  }
  const legs: Leg[] = []
  // Coverage gaps (oceans, remote areas) can last a while; only a long one splits a flight.
  const GAP = 90 * 60 * 1000
  let i = 0
  while (i < pts.length) {
    if (pts[i].alt === null) {
      i++
      continue
    }
    // an airborne run
    const start = i
    let maxAlt = 0
    while (i < pts.length && pts[i].alt !== null && (i === start || (!pts[i].newLeg && pts[i].t - pts[i - 1].t < GAP))) {
      maxAlt = Math.max(maxAlt, pts[i].alt ?? 0)
      i++
    }
    const end = i - 1
    const before = start > 0 && pts[start - 1].alt === null && pts[start].t - pts[start - 1].t < 15 * 60 * 1000 ? pts[start - 1] : null
    const after = i < pts.length && pts[i].alt === null && pts[i].t - pts[end].t < 15 * 60 * 1000 ? pts[i] : null
    const first = before ?? pts[start]
    const last = after ?? pts[end]
    if (last.t - first.t < 4 * 60 * 1000 && !after) continue // a blip, not a flight
    legs.push({
      departedAt: pts[start].t,
      departLat: first.lat,
      departLon: first.lon,
      fromGround: !!before,
      arrivedAt: after ? after.t : pts[end].t,
      arriveLat: last.lat,
      arriveLon: last.lon,
      landed: !!after,
      ongoing: !after && end === pts.length - 1 && Date.now() - pts[end].t < 10 * 60 * 1000,
      maxAltitude: maxAlt,
    })
  }
  return legs
}

export async function fetchTodaysLegs(hex: string): Promise<Leg[] | null> {
  const t = await fetchTrace(hex)
  return t ? parseLegs(t.json) : null
}

export function parseTrace(json: TraceJson): Omit<FlightPath, 'source'> | null {
  if (!json || typeof json.timestamp !== 'number' || !Array.isArray(json.trace)) return null
  const all: { p: PathPoint; newLeg: boolean }[] = []
  for (const row of json.trace) {
    const [dt, lat, lon, alt, , , flags] = row as [number, number, number, number | 'ground' | null, unknown, unknown, number]
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    const altitude = alt === 'ground' ? null : typeof alt === 'number' ? alt : NaN
    // flags bit 2 = "start of a new leg" in readsb traces
    all.push({ p: [lat, lon, Number.isNaN(altitude) ? (all[all.length - 1]?.p[2] ?? 0) : altitude, (json.timestamp + dt) * 1000], newLeg: typeof flags === 'number' && (flags & 2) === 2 })
  }
  if (all.length === 0) return null

  // Walk back from now to the start of this flight.
  let start = 0
  let fromTakeoff = false
  for (let i = all.length - 1; i > 0; i--) {
    const cur = all[i]
    const prev = all[i - 1]
    const gap = cur.p[3] - prev.p[3]
    if (cur.newLeg || gap > 30 * 60 * 1000) {
      start = i
      fromTakeoff = cur.newLeg
      break
    }
    if (prev.p[2] === null && cur.p[2] !== null) {
      start = i - 1 // keep the last ground point so the path starts on the runway
      fromTakeoff = true
      break
    }
  }
  const points = all.slice(start).map((x) => x.p)
  // If the aircraft is on the ground now and has been for a while, show the flight that just ended.
  return { points, fromTakeoff }
}

// ---------------------------------------------------------------------------
// Photos — Planespotters.net public API (free, attribution required).
// ---------------------------------------------------------------------------

export interface PlanePhoto {
  thumb: string
  large: string
  link: string
  photographer: string
}

const photoCache = new Map<string, PlanePhoto | null>()

export async function fetchPhoto(hex: string, registration?: string): Promise<PlanePhoto | null> {
  const key = hex.toLowerCase()
  if (photoCache.has(key)) return photoCache.get(key)!
  const base = upstream('planespotters')
  const urls = [`${base}/pub/photos/hex/${key.replace(/^~/, '')}`]
  if (registration) urls.push(`${base}/pub/photos/reg/${encodeURIComponent(registration)}`)
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = (await res.json()) as {
        photos?: { thumbnail?: { src: string }; thumbnail_large?: { src: string }; link: string; photographer: string }[]
      }
      const p = json.photos?.[0]
      if (p && (p.thumbnail_large || p.thumbnail)) {
        const photo = {
          thumb: (p.thumbnail ?? p.thumbnail_large)!.src,
          large: (p.thumbnail_large ?? p.thumbnail)!.src,
          link: p.link,
          photographer: p.photographer,
        }
        photoCache.set(key, photo)
        return photo
      }
    } catch {
      // try the next lookup
    }
  }
  photoCache.set(key, null)
  return null
}

// ---------------------------------------------------------------------------
// Links to look the aircraft up elsewhere.
// ---------------------------------------------------------------------------

export function lookupLinks(a: { hex: string; callsign: string; registration?: string; typeCode?: string; model?: string }) {
  const hex = a.hex.replace(/^~/, '').toLowerCase()
  const cs = /^[A-Z]{3}\d/.test(a.callsign) ? a.callsign : null // airline-style flight number
  const reg = a.registration
  const links: { label: string; href: string; hint: string }[] = []
  if (cs) links.push({ label: 'FlightAware', href: `https://www.flightaware.com/live/flight/${cs}`, hint: 'Flight status, schedule, gate times' })
  else if (reg) links.push({ label: 'FlightAware', href: `https://www.flightaware.com/live/flight/${reg.replace(/-/g, '')}`, hint: 'Flight history for this tail number' })
  if (reg) links.push({ label: 'Flightradar24', href: `https://www.flightradar24.com/data/aircraft/${reg.toLowerCase()}`, hint: 'Recent flights by this aircraft' })
  links.push({ label: 'ADS-B Exchange', href: `https://globe.adsbexchange.com/?icao=${hex}`, hint: 'Live track and replay' })
  links.push({ label: 'adsb.lol', href: `https://adsb.lol/?icao=${hex}`, hint: 'Live track (same data as SkyWatch)' })
  links.push({ label: 'Planespotters', href: `https://www.planespotters.net/hex/${hex.toUpperCase()}`, hint: 'Photos, age and airframe history' })
  if (reg) links.push({ label: 'JetPhotos', href: `https://www.jetphotos.com/registration/${encodeURIComponent(reg)}`, hint: 'More photos of this aircraft' })
  if (a.model) links.push({ label: 'Wikipedia', href: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(a.model)}`, hint: `About the ${a.model}` })
  return links
}
