import { useEffect, useState } from 'react'
import { upstream } from './upstream'

/**
 * FAA Temporary Flight Restrictions (TFRs): the no-fly zones the FAA puts up
 * for presidential visits, wildfires, rocket launches, stadiums and so on.
 *
 * Two free FAA feeds, both through the relay:
 * - the TFR list (number, type, state, short description)
 * - the TFR map service (the shapes, as GeoJSON)
 * Joined by NOTAM number. Parsed carefully, since the FAA changes these feeds
 * now and then.
 */

export type TfrKind = 'vip' | 'security' | 'hazard' | 'space' | 'event' | 'other'

export interface Tfr {
  id: string // NOTAM number, like "5/1234"
  title: string
  type: string // FAA's own label, like "SECURITY"
  kind: TfrKind
  state?: string
  facility?: string
  polygons: [number, number][][] // [lat, lon] rings
  lat?: number
  lon?: number
  url: string
}

export const TFR_KINDS: Record<TfrKind, { label: string; color: string; emoji: string }> = {
  vip: { label: 'VIP / presidential', color: '#ef4444', emoji: '🇺🇸' },
  security: { label: 'Security', color: '#f97316', emoji: '🛡️' },
  hazard: { label: 'Hazard / fire', color: '#f59e0b', emoji: '🔥' },
  space: { label: 'Space launch', color: '#a78bfa', emoji: '🚀' },
  event: { label: 'Event / air show', color: '#38bdf8', emoji: '🏟️' },
  other: { label: 'Restricted', color: '#94a3b8', emoji: '⛔' },
}

const WFS =
  '/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=500&outputFormat=application/json&srsname=EPSG:4326'

type Obj = Record<string, unknown>

/** Case-insensitive property lookup. */
function prop(o: Obj, ...names: string[]): string | undefined {
  for (const k of Object.keys(o)) {
    if (names.includes(k.toLowerCase())) {
      const v = o[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
  }
  return undefined
}

function notamNumber(s: string | undefined): string | undefined {
  return s?.match(/\d{1,2}\/\d{3,5}/)?.[0]
}

export function classify(type: string, text: string): TfrKind {
  const all = `${type} ${text}`.toUpperCase()
  if (/\bVIP\b|PRESIDENT|POTUS|VICE PRESIDENT/.test(all)) return 'vip'
  if (/SPACE|LAUNCH|ROCKET|REENTRY/.test(all)) return 'space'
  if (/HAZARD|FIRE|FIREFIGHT|VOLCAN|DISASTER|FLOOD|HURRICANE|OIL SPILL/.test(all)) return 'hazard'
  if (/SPORT|STADIUM|AIR SHOW|AIRSHOW|SPECIAL EVENT|DEMONSTRATION|PARACHUTE/.test(all)) return 'event'
  if (/SECURITY|91\.141|99\.7|NATIONAL DEFENSE/.test(all)) return 'security'
  return 'other'
}

export const tfrUrl = (id: string) => `https://tfr.faa.gov/tfr3/?page=detail_${id.replace('/', '_')}`

/** Turn one GeoJSON coordinate into [lat, lon], whatever order or projection the feed used. */
export function toLatLon(c: unknown): [number, number] | null {
  if (!Array.isArray(c) || c.length < 2) return null
  const x = Number(c[0])
  const y = Number(c[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    if (Math.abs(x) <= 90 && Math.abs(y) <= 180) return [x, y] // lat, lon with a lon past ±90
    // Web Mercator meters
    const R = 6378137
    const lon = (x / R) * (180 / Math.PI)
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null
  }
  // US airspace: longitudes are west (negative), latitudes north. Swapped axes show up as (+lat, -lon).
  if (x > 0 && y < 0 && x <= 90) return [x, y]
  return [y, x]
}

function ringsOf(geom: Obj | null | undefined): [number, number][][] {
  if (!geom) return []
  const t = String(geom.type || '')
  const coords = geom.coordinates as unknown
  const ring = (r: unknown) => (Array.isArray(r) ? r.map(toLatLon).filter((p): p is [number, number] => !!p) : [])
  if (t === 'Polygon' && Array.isArray(coords)) return [ring(coords[0])].filter((r) => r.length >= 3)
  if (t === 'MultiPolygon' && Array.isArray(coords))
    return coords.map((p) => (Array.isArray(p) ? ring(p[0]) : [])).filter((r) => r.length >= 3)
  if (t === 'GeometryCollection' && Array.isArray(geom.geometries)) return (geom.geometries as Obj[]).flatMap(ringsOf)
  return []
}

/** Combine the list and the shapes into one TFR per NOTAM. */
export function parseTfrs(list: unknown, geo: unknown): Tfr[] {
  const byId = new Map<string, Tfr>()
  const get = (id: string) => {
    let t = byId.get(id)
    if (!t) {
      t = { id, title: '', type: '', kind: 'other', polygons: [], url: tfrUrl(id) }
      byId.set(id, t)
    }
    return t
  }

  const rows: unknown[] = Array.isArray(list) ? list : Array.isArray((list as Obj)?.data) ? ((list as Obj).data as unknown[]) : []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Obj
    const id = notamNumber(prop(o, 'notam_id', 'notam', 'notamid', 'notam_key', 'id'))
    if (!id) continue
    const t = get(id)
    t.type = prop(o, 'type', 'tfr_type') ?? t.type
    t.title = prop(o, 'description', 'title', 'name') ?? t.title
    t.state = prop(o, 'state') ?? t.state
    t.facility = prop(o, 'facility') ?? t.facility
  }

  const feats: unknown[] = Array.isArray((geo as Obj)?.features) ? ((geo as Obj).features as unknown[]) : []
  for (const f of feats) {
    if (!f || typeof f !== 'object') continue
    const p = ((f as Obj).properties ?? {}) as Obj
    const id = notamNumber(prop(p, 'notam_key', 'notam_id', 'notam', 'name')) ?? notamNumber(String((f as Obj).id ?? ''))
    if (!id) continue
    const t = get(id)
    t.polygons.push(...ringsOf((f as Obj).geometry as Obj))
    if (!t.title) t.title = prop(p, 'title', 'description', 'legal') ?? ''
    if (!t.type) t.type = prop(p, 'legal', 'type') ?? ''
    if (!t.state) t.state = prop(p, 'state')
  }

  const out: Tfr[] = []
  for (const t of byId.values()) {
    t.title = t.title.replace(/\s+/g, ' ')
    t.kind = classify(t.type, t.title)
    const pts = t.polygons.flat()
    if (pts.length) {
      t.lat = pts.reduce((s, p) => s + p[0], 0) / pts.length
      t.lon = pts.reduce((s, p) => s + p[1], 0) / pts.length
    }
    out.push(t)
  }
  const order: TfrKind[] = ['vip', 'space', 'security', 'hazard', 'event', 'other']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id))
}

let cache: { at: number; data: Tfr[] } | null = null

export async function fetchTfrs(force = false): Promise<Tfr[]> {
  if (!force && cache && Date.now() - cache.at < 10 * 60_000) return cache.data
  const base = upstream('tfr')
  const get = async (path: string) => {
    const r = await fetch(base + path, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`TFR ${r.status}`)
    return r.json()
  }
  const [list, geo] = await Promise.allSettled([get('/tfrapi/exportTfrList'), get(WFS)])
  if (list.status === 'rejected' && geo.status === 'rejected') throw list.reason
  const data = parseTfrs(list.status === 'fulfilled' ? list.value : [], geo.status === 'fulfilled' ? geo.value : null)
  cache = { at: Date.now(), data }
  return data
}

/** TFRs, refreshed every 15 minutes while `enabled`. `null` = couldn't load. */
export function useTfrs(enabled: boolean): Tfr[] | null {
  const [tfrs, setTfrs] = useState<Tfr[] | null>([])
  useEffect(() => {
    if (!enabled) return
    let stop = false
    const load = () =>
      fetchTfrs()
        .then((t) => !stop && setTfrs(t))
        .catch(() => !stop && setTfrs((prev) => (prev && prev.length ? prev : null)))
    load()
    const id = setInterval(load, 15 * 60_000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [enabled])
  return enabled ? tfrs : []
}

/** TFRs whose outline is within `nm` nautical miles of a point (by center, rough). */
export function tfrsNear(tfrs: Tfr[], lat: number, lon: number, nm: number): Tfr[] {
  const r = nm / 60
  return tfrs.filter((t) => t.lat != null && t.lon != null && Math.abs(t.lat - lat) < r && Math.abs(t.lon - lon) < r / Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
}
