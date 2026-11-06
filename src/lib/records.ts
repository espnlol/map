/** Today's records, from everything SkyWatch has seen live today. */
import type { Aircraft } from '../types'
import { createStore } from './store'
import { distanceNm } from './geo'
import { airlineName } from './owner'

export interface RecordHolder {
  value: number
  hex: string
  callsign: string
  model?: string
  at: number
}

interface RecordsState {
  day: string
  holders: Record<string, RecordHolder>
  peak: { value: number; at: number }
  seen: string[]
  airlines: Record<string, number>
  types: Record<string, number>
  heavies: number
  helicopters: number
  military: number
}

const today = () => new Date().toDateString()
const empty = (): RecordsState => ({ day: today(), holders: {}, peak: { value: 0, at: 0 }, seen: [], airlines: {}, types: {}, heavies: 0, helicopters: 0, military: 0 })

export const records = createStore<RecordsState>('skywatch.records', empty())

let mem: RecordsState | null = null
let lastFlush = 0

/** The records SkyWatch keeps, with how to show each one. */
export const RECORD_DEFS: { key: string; title: string; icon: string; fmt: (v: number) => string; best: 'max' | 'min' }[] = [
  { key: 'fastest', title: 'Fastest', icon: '🚀', fmt: (v) => `${Math.round(v)} kt (${Math.round(v * 1.15078)} mph)`, best: 'max' },
  { key: 'highest', title: 'Highest', icon: '🏔️', fmt: (v) => `${Math.round(v).toLocaleString()} ft`, best: 'max' },
  { key: 'lowest', title: 'Lowest in the air', icon: '🐜', fmt: (v) => `${Math.round(v).toLocaleString()} ft`, best: 'min' },
  { key: 'slowest', title: 'Slowest in the air', icon: '🐢', fmt: (v) => `${Math.round(v)} kt`, best: 'min' },
  { key: 'climb', title: 'Steepest climb', icon: '📈', fmt: (v) => `${Math.round(v).toLocaleString()} ft/min`, best: 'max' },
  { key: 'dive', title: 'Steepest descent', icon: '📉', fmt: (v) => `${Math.round(Math.abs(v)).toLocaleString()} ft/min`, best: 'min' },
  { key: 'longest', title: 'Longest route', icon: '🌍', fmt: (v) => `${Math.round(v).toLocaleString()} nm`, best: 'max' },
  { key: 'heliHigh', title: 'Highest helicopter', icon: '🚁', fmt: (v) => `${Math.round(v).toLocaleString()} ft`, best: 'max' },
  { key: 'heliFast', title: 'Fastest helicopter', icon: '💨', fmt: (v) => `${Math.round(v)} kt`, best: 'max' },
  { key: 'smallFast', title: 'Fastest small plane', icon: '🛩️', fmt: (v) => `${Math.round(v)} kt`, best: 'max' },
  { key: 'highestMil', title: 'Highest military', icon: '🎖️', fmt: (v) => `${Math.round(v).toLocaleString()} ft`, best: 'max' },
]

/** Fold one traffic update into today's records (live data only). */
export function recordTraffic(aircraft: Aircraft[], now = Date.now()) {
  if (!mem || mem.day !== today()) mem = records.get().day === today() ? structuredClone(records.get()) : empty()
  const s = mem
  const seen = new Set(s.seen)
  const consider = (key: string, v: number | null | undefined, a: Aircraft) => {
    if (v == null || !Number.isFinite(v)) return
    const def = RECORD_DEFS.find((d) => d.key === key)!
    const cur = s.holders[key]
    if (!cur || (def.best === 'max' ? v > cur.value : v < cur.value)) s.holders[key] = { value: v, hex: a.hex, callsign: a.callsign, model: a.model, at: now }
  }
  let airborne = 0
  for (const a of aircraft) {
    if (!a.onGround) airborne++
    if (!seen.has(a.hex)) {
      seen.add(a.hex)
      const code = /^([A-Z]{3})\d/.exec(a.callsign)?.[1]
      const name = code && airlineName(code)
      if (name) s.airlines[name] = (s.airlines[name] ?? 0) + 1
      if (a.model) s.types[a.model] = (s.types[a.model] ?? 0) + 1
      if (a.category === 'A5') s.heavies++
      if (a.category === 'A7') s.helicopters++
      if (a.special.some((x) => x.tag === 'milgov')) s.military++
    }
    if (a.onGround) continue
    const alt = a.altitude
    const gs = a.groundSpeed
    consider('fastest', gs != null && gs < 750 ? gs : null, a)
    consider('highest', alt != null && alt < 66000 ? alt : null, a)
    if (alt != null && alt >= 100 && (gs ?? 0) > 30) consider('lowest', alt, a)
    if (gs != null && gs >= 15 && (alt ?? 0) > 500) consider('slowest', gs, a)
    if (a.verticalRate != null && Math.abs(a.verticalRate) < 15000) {
      consider('climb', a.verticalRate, a)
      consider('dive', a.verticalRate, a)
    }
    const o = a.route?.origin
    const d = a.route?.destination
    if (o?.lat != null && d?.lat != null && a.route?.plausible) consider('longest', distanceNm(o.lat, o.lon!, d.lat, d.lon!), a)
    if (a.category === 'A7') {
      consider('heliHigh', alt, a)
      consider('heliFast', gs, a)
    }
    if (a.category === 'A1') consider('smallFast', gs, a)
    if (a.special.some((x) => x.tag === 'milgov')) consider('highestMil', alt, a)
  }
  if (airborne > s.peak.value) s.peak = { value: airborne, at: now }
  s.seen = [...seen]
  if (now - lastFlush > 20_000) {
    lastFlush = now
    records.set(structuredClone(s))
  }
}

export const topOf = (m: Record<string, number>, n = 5) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)

// ---------------------------------------------------------------------------
// "Most tracked": the planes you open the most
// ---------------------------------------------------------------------------

export interface OpenCount {
  key: string
  callsign: string
  model?: string
  count: number
  lastAt: number
}

export const opens = createStore<Record<string, OpenCount>>('skywatch.opens', {})

export function countOpen(a: Aircraft) {
  const key = a.registration || a.hex
  opens.set((all) => {
    const prev = all[key]
    return { ...all, [key]: { key, callsign: a.callsign, model: a.model, count: (prev?.count ?? 0) + 1, lastAt: Date.now() } }
  })
}
