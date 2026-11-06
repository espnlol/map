import type { Aircraft } from '../types'
import { createStore } from './store'

export type EmergencyOutcome = 'ongoing' | 'landed' | 'cleared' | 'out of range'

export interface EmergencyRecord {
  id: string
  hex: string
  callsign: string
  registration?: string
  model?: string
  codes: { code: string; label: string }[]
  startedAt: number
  lastSeenAt: number
  endedAt?: number
  outcome: EmergencyOutcome
  origin?: string
  destination?: string
  lastAltitude: number | null
  lastSpeed: number | null
  /** [lat, lon, altitude ft or null on ground, time] */
  path: [number, number, number | null, number][]
}

const MAX_RECORDS = 100
const MAX_POINTS = 400
const LOST_AFTER = 3 * 60 * 1000

export const emergencyLog = createStore<EmergencyRecord[]>('skywatch.emergencies', [])

const label = (a: Aircraft) => a.route?.origin?.iata || a.route?.origin?.icao

/** Fold one update of live traffic into the emergency history. */
export function recordEmergencies(aircraft: Aircraft[], now: number) {
  const records = emergencyLog.get()
  const byHex = new Map(aircraft.map((a) => [a.hex, a]))
  let changed = false
  const next = records.map((r) => {
    if (r.outcome !== 'ongoing') return r
    const a = byHex.get(r.hex)
    if (!a) {
      if (now - r.lastSeenAt > LOST_AFTER) {
        changed = true
        return { ...r, outcome: 'out of range' as const, endedAt: r.lastSeenAt }
      }
      return r
    }
    changed = true
    const path = [...r.path, [a.lat, a.lon, a.onGround ? null : a.altitude, now] as EmergencyRecord['path'][number]].slice(-MAX_POINTS)
    const upd: EmergencyRecord = {
      ...r,
      lastSeenAt: now,
      lastAltitude: a.onGround ? null : a.altitude,
      lastSpeed: a.groundSpeed,
      path,
      destination: r.destination ?? (a.route?.destination?.iata || a.route?.destination?.icao),
      origin: r.origin ?? label(a),
    }
    if (a.emergency && !upd.codes.some((c) => c.code === a.emergency!.code)) upd.codes = [...upd.codes, { code: a.emergency.code, label: a.emergency.label }]
    if (a.onGround) return { ...upd, outcome: 'landed' as const, endedAt: now }
    if (!a.emergency) return { ...upd, outcome: 'cleared' as const, endedAt: now }
    return upd
  })
  for (const a of aircraft) {
    if (!a.emergency || a.onGround) continue
    if (next.some((r) => r.hex === a.hex && r.outcome === 'ongoing')) continue
    changed = true
    next.unshift({
      id: `${a.hex}-${now}`,
      hex: a.hex,
      callsign: a.callsign,
      registration: a.registration,
      model: a.model,
      codes: [{ code: a.emergency.code, label: a.emergency.label }],
      startedAt: now,
      lastSeenAt: now,
      outcome: 'ongoing',
      origin: label(a),
      destination: a.route?.destination?.iata || a.route?.destination?.icao,
      lastAltitude: a.altitude,
      lastSpeed: a.groundSpeed,
      // start from the trail SkyWatch already has, so the path shows the lead-up
      path: a.trail.slice(-60).map(([la, lo, al]) => [la, lo, al, now] as EmergencyRecord['path'][number]),
    })
  }
  if (changed) emergencyLog.set(next.slice(0, MAX_RECORDS))
}
