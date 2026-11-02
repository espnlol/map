import type { Airport, RawAircraft, Route } from '../types'
import { distanceNm } from './geo'

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

const viaProxy = (prefix: string, path: string) => `/proxy/${prefix}${path}`

function sources(): Source[] {
  const proxied = import.meta.env.DEV || location.port === '4173'
  const lol = (p: string) => (proxied ? viaProxy('adsblol', p) : `https://api.adsb.lol${p}`)
  const live = (p: string) => (proxied ? viaProxy('airplaneslive', p) : `https://api.airplanes.live${p}`)
  return [
    { name: 'adsb.lol', url: (lat, lon, nm) => lol(`/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${nm}`) },
    { name: 'airplanes.live', url: (lat, lon, nm) => live(`/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${nm}`) },
  ]
}

function routesetUrl(): string {
  const proxied = import.meta.env.DEV || location.port === '4173'
  return proxied ? viaProxy('adsblol', '/api/0/routeset') : 'https://api.adsb.lol/api/0/routeset'
}

let preferred = 0

export async function fetchLiveAircraft(
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
  return {
    origin: airports[best],
    destination: airports[best + 1],
    plausible: e.plausible === undefined ? true : Boolean(e.plausible),
  }
}
