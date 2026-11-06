/**
 * Recognising what aircraft are doing from the shape of their recent track:
 * military racetracks and orbits, airliners holding near airports, and
 * go-arounds (an aborted landing).
 */
import type { Aircraft } from '../types'
import { bearingDeg, distanceNm } from './geo'
import type { AirportInfo } from './airports'
import { createStore } from './store'

type Pt = [number, number, number | null, number?]

export interface OrbitStats {
  turns: number
  spreadNm: number
  lat: number
  lon: number
  minutes: number
  hull: [number, number][]
}

/** Turns made and area covered in the last `windowMs` of an aircraft's trail. */
export function orbitStats(trail: Pt[], windowMs: number, now = Date.now()): OrbitStats | null {
  const pts = trail.filter((p) => (p[3] ?? now) >= now - windowMs)
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
  let total = 0
  let prevBrg: number | null = null
  let last = pts[0]
  for (const p of pts.slice(1)) {
    if (distanceNm(last[0], last[1], p[0], p[1]) < 0.05) continue
    const brg = bearingDeg(last[0], last[1], p[0], p[1])
    if (prevBrg != null) total += ((brg - prevBrg + 540) % 360) - 180
    prevBrg = brg
    last = p
  }
  const t0 = pts[0][3] ?? now
  const t1 = pts[pts.length - 1][3] ?? now
  return { turns: Math.abs(total) / 360, spreadNm: spread, lat, lon, minutes: (t1 - t0) / 60000, hull: convexHull(pts.map((p) => [p[0], p[1]])) }
}

function convexHull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  if (p.length < 3) return p
  const cross = (o: number[], a: number[], b: number[]) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower: [number, number][] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: [number, number][] = []
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

// ---------------------------------------------------------------------------
// Military patterns
// ---------------------------------------------------------------------------

const TANKERS = /^(K35R|KC46|K46|KC10|DC10|A332|A339|MRTT|KC2|KC30|KC39|KC135|K135|KC13)$/
const SURVEILLANCE = /^(E3TF|E3CF|E6|E6B|E8|P8|R135|RC35|E7|E2|U2|Q4|RQ4|MQ9|Q9|GLEX|GL5T|C12|B350|BE20|EP3|P3|E737)$/
const FIGHTERS = /^(F15|F16|F18|F18S|F18H|F22|F35|F5|T38|T6|T45|A10|EUFI|RFAL|GRIF|TOR|HAWK)$/

export interface MilitaryPattern {
  hex: string
  callsign: string
  model?: string
  kind: 'Refueling track' | 'Surveillance orbit' | 'Training / patrol area' | 'Military orbit'
  why: string
  lat: number
  lon: number
  spreadNm: number
  minutes: number
  turns: number
  altitude: number | null
  hull: [number, number][]
}

export function findMilitaryPatterns(aircraft: Aircraft[], now = Date.now()): MilitaryPattern[] {
  const out: MilitaryPattern[] = []
  for (const a of aircraft) {
    if (a.onGround) continue
    const mil = a.special.some((s) => s.tag === 'milgov') || a.category === 'A6'
    const t = (a.typeCode ?? '').toUpperCase()
    const tanker = TANKERS.test(t)
    const isr = SURVEILLANCE.test(t)
    const fighter = FIGHTERS.test(t) || a.category === 'A6'
    if (!mil && !tanker && !isr) continue
    const s = orbitStats(a.trail, 45 * 60 * 1000, now)
    if (!s || s.minutes < 12 || s.turns < 1 || s.spreadNm < 3 || s.spreadNm > 120) continue
    const kind: MilitaryPattern['kind'] = tanker && (a.altitude ?? 0) > 15000 ? 'Refueling track' : isr ? 'Surveillance orbit' : fighter ? 'Training / patrol area' : 'Military orbit'
    const why =
      kind === 'Refueling track'
        ? 'A tanker flying a racetrack while other aircraft come to it for fuel.'
        : kind === 'Surveillance orbit'
          ? 'Circling one area for a long time: watching, listening or relaying signals.'
          : kind === 'Training / patrol area'
            ? 'Fast jets looping inside a training or patrol area.'
            : 'A military aircraft flying repeated loops over one area.'
    out.push({ hex: a.hex, callsign: a.callsign, model: a.model, kind, why, lat: s.lat, lon: s.lon, spreadNm: s.spreadNm, minutes: s.minutes, turns: Math.round(s.turns * 10) / 10, altitude: a.altitude, hull: s.hull })
  }
  return out.sort((x, y) => y.minutes - x.minutes)
}

// ---------------------------------------------------------------------------
// Holding near airports, and go-arounds
// ---------------------------------------------------------------------------

export interface Holding {
  hex: string
  callsign: string
  airport: string
  turns: number
  altitude: number | null
}

function nearestAirport(lat: number, lon: number, airports: AirportInfo[], maxNm: number) {
  let best: AirportInfo | null = null
  let bd = maxNm
  for (const p of airports) {
    if (!p.large && maxNm > 10) continue
    if (Math.abs(p.lat - lat) > maxNm / 50 || Math.abs(p.lon - lon) > maxNm / 35) continue
    const d = distanceNm(lat, lon, p.lat, p.lon)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best ? { ap: best, d: bd } : null
}

export function findHolding(aircraft: Aircraft[], airports: AirportInfo[], now = Date.now()): Holding[] {
  const out: Holding[] = []
  for (const a of aircraft) {
    if (a.onGround || a.special.some((s) => s.tag === 'milgov')) continue
    const alt = a.altitude ?? 0
    if (alt < 3000 || alt > 25000 || !['A2', 'A3', 'A4', 'A5'].includes(a.category)) continue
    const s = orbitStats(a.trail, 20 * 60 * 1000, now)
    if (!s || s.turns < 0.9 || s.spreadNm > 15 || s.minutes < 5) continue
    const near = nearestAirport(s.lat, s.lon, airports, 60)
    if (!near) continue
    out.push({ hex: a.hex, callsign: a.callsign, airport: near.ap.iata || near.ap.ident, turns: Math.round(s.turns * 10) / 10, altitude: a.altitude })
  }
  return out
}

export interface GoAround {
  id: string
  hex: string
  callsign: string
  airport: string
  at: number
  lowest: number
}

export const goArounds = createStore<GoAround[]>('skywatch.goArounds', [])

/** A plane that came down low near an airport, then climbed away again. */
export function detectGoArounds(aircraft: Aircraft[], airports: AirportInfo[], now = Date.now()) {
  const found: GoAround[] = []
  for (const a of aircraft) {
    if (a.onGround || (a.verticalRate ?? 0) < 500 || (a.altitude ?? 0) > 5000) continue
    const pts = a.trail.filter((p) => (p[3] ?? now) >= now - 8 * 60 * 1000 && p[2] != null)
    if (pts.length < 6) continue
    let iMin = 0
    for (let i = 1; i < pts.length; i++) if ((pts[i][2] ?? 99999) < (pts[iMin][2] ?? 99999)) iMin = i
    const low = pts[iMin]
    const lowAlt = low[2] ?? 99999
    const before = pts.slice(0, iMin).some((p) => (p[2] ?? 0) > lowAlt + 800)
    const after = (a.altitude ?? 0) > lowAlt + 600
    if (!before || !after || iMin === pts.length - 1) continue
    const near = nearestAirport(low[0], low[1], airports, 6)
    if (!near || lowAlt > 1500 + (near.ap.elevation ?? 0)) continue
    found.push({ id: `${a.hex}-${Math.round((low[3] ?? now) / 60000)}`, hex: a.hex, callsign: a.callsign, airport: near.ap.iata || near.ap.ident, at: low[3] ?? now, lowest: lowAlt })
  }
  if (!found.length) return []
  const prev = goArounds.get()
  const fresh = found.filter((g) => !prev.some((p) => p.hex === g.hex && Math.abs(p.at - g.at) < 15 * 60 * 1000))
  if (fresh.length) goArounds.set([...fresh, ...prev].filter((g) => now - g.at < 24 * 3600e3).slice(0, 100))
  return fresh
}
