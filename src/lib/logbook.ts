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

export function addToLogbook(a: Aircraft): { entry: LogEntry; newType: boolean; newAirline: boolean; timesBefore: number } {
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
  const timesBefore = all.filter((e) => e.hex === a.hex).length
  logbook.set([entry, ...all])
  return { entry, newType, newAirline, timesBefore }
}

export function patchLogEntry(id: string, patch: Partial<LogEntry>) {
  logbook.set((all) => all.map((e) => (e.id === id ? { ...e, ...patch } : e)))
}

export function removeLogEntry(id: string) {
  logbook.set((all) => all.filter((e) => e.id !== id))
}

export function logStats(all: LogEntry[]) {
  return {
    sightings: all.length,
    planes: new Set(all.map((e) => e.hex)).size,
    types: new Set(all.map((e) => e.typeCode).filter(Boolean)).size,
    airlines: new Set(all.map((e) => e.airline).filter(Boolean)).size,
  }
}

export { airlineName }
