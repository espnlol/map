/**
 * Extra per-aircraft lookups that only happen for the plane you click:
 * its flight history (where it has been) and a photo of the actual airframe.
 */

const proxied = () => import.meta.env.DEV || location.port === '4173'

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
  { name: 'adsb.lol', base: () => (proxied() ? '/proxy/adsblolglobe' : 'https://globe.adsb.lol') },
  { name: 'airplanes.live', base: () => (proxied() ? '/proxy/airplanesliveglobe' : 'https://globe.airplanes.live') },
]

/**
 * Fetch today's track for an aircraft from the networks' tar1090 "trace"
 * files and cut it down to the current flight (since the last time it was on
 * the ground or the network marked a new leg).
 */
export async function fetchFlightPath(hex: string): Promise<FlightPath | null> {
  const h = hex.toLowerCase()
  const file = `/data/traces/${h.slice(-2)}/trace_full_${h}.json`
  for (const src of TRACE_SOURCES) {
    try {
      const res = await fetch(src.base() + file, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = (await res.json()) as TraceJson
      const path = parseTrace(json)
      if (path) return { ...path, source: src.name }
    } catch {
      // try the next source
    }
  }
  return null
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
  const base = proxied() ? '/proxy/planespotters' : 'https://api.planespotters.net'
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
