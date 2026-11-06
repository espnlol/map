import type { Aircraft } from '../types'
import { createStore } from './store'
import { airlineName, operatorFromCallsign } from './owner'

export interface LogEntry {
  id: string
  at: number
  hex: string
  callsign: string
  registration?: string
  model?: string
  typeCode?: string
  category: string
  airline?: string
  owner?: string
  from?: string
  to?: string
  altitude: number | null
  lat: number
  lon: number
  photo?: string
  note?: string
}

export const logbook = createStore<LogEntry[]>('skywatch.logbook', [])

/** One logbook entry per plane: matched by tail number, or transponder code if there isn't one. */
export const planeKey = (e: { hex: string; registration?: string }) =>
  e.registration ? `reg:${e.registration.toUpperCase().replace(/-/g, '')}` : `hex:${e.hex.toLowerCase()}`

export const findLogged = (a: { hex: string; registration?: string }) =>
  logbook.get().find((e) => planeKey(e) === planeKey(a) || e.hex.toLowerCase() === a.hex.toLowerCase())

// Clean up duplicates saved before this rule existed: keep the first sighting,
// but keep a photo or owner that a later copy found.
{
  const all = logbook.get()
  const byKey = new Map<string, LogEntry>()
  for (const e of [...all].sort((x, y) => x.at - y.at)) {
    const k = planeKey(e)
    const first = byKey.get(k)
    if (!first) byKey.set(k, e)
    else byKey.set(k, { ...first, photo: first.photo ?? e.photo, owner: first.owner ?? e.owner })
  }
  if (byKey.size !== all.length) logbook.set([...byKey.values()].sort((x, y) => y.at - x.at))
}

export function addToLogbook(a: Aircraft): { entry: LogEntry; newType: boolean; newAirline: boolean } | null {
  if (findLogged(a)) return null
  const all = logbook.get()
  const op = operatorFromCallsign(a.callsign)
  const entry: LogEntry = {
    id: `${a.hex}-${Date.now()}`,
    at: Date.now(),
    hex: a.hex,
    callsign: a.callsign,
    registration: a.registration,
    model: a.model,
    typeCode: a.typeCode,
    category: a.category,
    airline: op?.name ?? (op ? op.code : undefined),
    from: a.route?.origin?.iata || a.route?.origin?.icao,
    to: a.route?.destination?.iata || a.route?.destination?.icao,
    altitude: a.onGround ? null : a.altitude,
    lat: a.lat,
    lon: a.lon,
  }
  const newType = !!a.typeCode && !all.some((e) => e.typeCode === a.typeCode)
  const newAirline = !!entry.airline && !all.some((e) => e.airline === entry.airline)
  logbook.set([entry, ...all])
  logbookRemoved.set((r) => {
    const { [planeKey(entry)]: _, ...rest } = r
    return rest
  })
  return { entry, newType, newAirline }
}

export function patchLogEntry(id: string, patch: Partial<LogEntry>) {
  logbook.set((all) => all.map((e) => (e.id === id ? { ...e, ...patch } : e)))
}

/** Planes you removed (plane key → when), so syncing doesn't bring them back. */
export const logbookRemoved = createStore<Record<string, number>>('skywatch.logbookRemoved', {})

export function removeLogEntry(id: string) {
  const e = logbook.get().find((x) => x.id === id)
  if (e) logbookRemoved.set((r) => ({ ...r, [planeKey(e)]: Date.now() }))
  logbook.set((all) => all.filter((x) => x.id !== id))
}

export function logStats(all: LogEntry[]) {
  return {
    sightings: all.length,
    planes: new Set(all.map(planeKey)).size,
    types: new Set(all.map((e) => e.typeCode).filter(Boolean)).size,
    airlines: new Set(all.map((e) => e.airline).filter(Boolean)).size,
  }
}

export { airlineName }
