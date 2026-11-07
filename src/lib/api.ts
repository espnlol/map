import type { Airport, RawAircraft, Route } from '../types'
import { destinationPoint, distanceNm } from './geo'
import { upstream } from './upstream'

/**
 * Live data comes from community ADS-B networks that publish a free, keyless
 * readsb-format API. During `npm run dev` / `npm run preview` the requests go
 * through Vite's proxy (see vite.config.ts) so browser CORS rules never get in
 * the way; a static deploy calls the APIs directly.
 */
interface Source {
  name: string
  url: (lat: number, lon: number, nm: number) => string
}

function sources(): Source[] {
  return [
    { name: 'adsb.lol', url: (lat, lon, nm) => `${upstream('adsblol')}/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${nm}` },
    { name: 'airplanes.live', url: (lat, lon, nm) => `${upstream('airplaneslive')}/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${nm}` },
  ]
}

function routesetUrl(): string {
  return `${upstream('adsblol')}/api/0/routeset`
}

let preferred = 0

/** The live APIs cap one query at 250 nm. */
export const MAX_QUERY_NM = 250

/**
 * Aircraft within radiusNm of a point. Up to 250 nm is one query; beyond that
 * the area is covered by a centre circle plus a ring of six 250 nm circles
 * (good to ~490 nm), merged and de-duplicated.
 */
export async function fetchLiveAircraft(
  lat: number,
  lon: number,
  radiusNm: number,
): Promise<{ aircraft: RawAircraft[]; source: string }> {
  if (radiusNm <= MAX_QUERY_NM) return fetchArea(lat, lon, radiusNm)
  const ring = Math.min(400, radiusNm - 100)
  const tiles: [number, number][] = [[lat, lon], ...[0, 60, 120, 180, 240, 300].map((b) => destinationPoint(lat, lon, b, ring))]
  const results: { aircraft: RawAircraft[]; source: string }[] = []
  let lastErr: unknown
  // two at a time, to stay polite to the free APIs
  for (let i = 0; i < tiles.length; i += 2) {
    const batch = await Promise.allSettled(tiles.slice(i, i + 2).map(([la, lo]) => fetchArea(la, lo, MAX_QUERY_NM)))
    for (const r of batch) {
      if (r.status === 'fulfilled') results.push(r.value)
      else lastErr = r.reason
    }
  }
  if (results.length === 0) throw lastErr instanceof Error ? lastErr : new Error('All live data sources failed')
  const byHex = new Map<string, RawAircraft>()
  for (const { aircraft } of results)
    for (const a of aircraft) {
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
      if (distanceNm(lat, lon, a.lat, a.lon) > radiusNm) continue
      const prev = byHex.get(a.hex)
      if (!prev || (a.seen ?? 99) < (prev.seen ?? 99)) byHex.set(a.hex, a)
    }
  return { aircraft: [...byHex.values()], source: results[0].source + (results.length < tiles.length ? ' (partial)' : '') }
}

async function fetchArea(
  lat: number,
  lon: number,
  radiusNm: number,
): Promise<{ aircraft: RawAircraft[]; source: string }> {
  const list = sources()
  const order = [preferred, ...list.map((_, i) => i).filter((i) => i !== preferred)]
  let lastErr: unknown
  for (const i of order) {
    const src = list[i]
    try {
      const res = await fetch(src.url(lat, lon, Math.min(250, Math.round(radiusNm))), {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`${src.name} responded ${res.status}`)
      const json = (await res.json()) as { ac?: RawAircraft[]; aircraft?: RawAircraft[] }
      preferred = i
      return { aircraft: json.ac ?? json.aircraft ?? [], source: src.name }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All live data sources failed')
}

// ---------------------------------------------------------------------------
// Routes (origin / destination) — adsb.lol's route lookup, keyed by callsign.
// ---------------------------------------------------------------------------

interface RoutesetEntry {
  callsign?: string
  _airports?: Airport[]
  airport_codes?: string
  plausible?: boolean | number
}

const routeCache = new Map<string, { route: Route | null; at: number }>()
const ROUTE_TTL = 30 * 60 * 1000

export function cachedRoute(callsign: string): Route | null | undefined {
  const hit = routeCache.get(callsign)
  if (!hit) return undefined
  if (Date.now() - hit.at > ROUTE_TTL) return undefined
  return hit.route
}

/** Look up routes for callsigns not already cached. Failures are cached briefly as "unknown". */
export async function fetchLiveRoutes(planes: { callsign: string; lat: number; lon: number }[]): Promise<void> {
  const need = planes.filter((p) => p.callsign && cachedRoute(p.callsign) === undefined).slice(0, 100)
  if (need.length === 0) return
  try {
    const res = await fetch(routesetUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ planes: need.map((p) => ({ callsign: p.callsign, lat: p.lat, lng: p.lon })) }),
    })
    if (!res.ok) throw new Error(`routeset ${res.status}`)
    const data = (await res.json()) as RoutesetEntry[]
    const byCallsign = new Map<string, RoutesetEntry>()
    for (const e of Array.isArray(data) ? data : []) if (e.callsign) byCallsign.set(e.callsign.trim(), e)
    const now = Date.now()
    for (const p of need) {
      const e = byCallsign.get(p.callsign)
      routeCache.set(p.callsign, { route: e ? toRoute(e, p.lat, p.lon) : null, at: now })
    }
  } catch {
    // Mark as unknown for a few minutes so we don't hammer the endpoint.
    const retryAt = Date.now() - ROUTE_TTL + 3 * 60 * 1000
    for (const p of need) routeCache.set(p.callsign, { route: null, at: retryAt })
  }
}

function toRoute(e: RoutesetEntry, lat: number, lon: number): Route | null {
  const airports = (e._airports ?? []).filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number')
  if (airports.length < 2) return null
  // Multi-leg flight numbers (A→B→C): pick the leg the aircraft is actually on.
  let best = 0
  let bestScore = Infinity
  for (let i = 0; i < airports.length - 1; i++) {
    const a = airports[i]
    const b = airports[i + 1]
    const detour =
      distanceNm(a.lat!, a.lon!, lat, lon) + distanceNm(lat, lon, b.lat!, b.lon!) - distanceNm(a.lat!, a.lon!, b.lat!, b.lon!)
    if (detour < bestScore) {
      bestScore = detour
      best = i
    }
  }
  // Flight numbers get reused (Southwest especially), so the database can hand
  // back a route this plane isn't flying. If the plane is far off the path
  // between the two airports, don't trust it.
  const a = airports[best]
  const b = airports[best + 1]
  const legNm = distanceNm(a.lat!, a.lon!, b.lat!, b.lon!)
  if (bestScore > Math.max(200, legNm * 0.35)) return null
  return {
    origin: a,
    destination: b,
    plausible: e.plausible === undefined ? true : Boolean(e.plausible),
    stops: airports.length > 2 ? airports : undefined,
    leg: best,
  }
}
