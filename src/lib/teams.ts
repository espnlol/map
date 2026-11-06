import type { RawAircraft } from '../types'
import { createStore } from './store'
import { upstream } from './upstream'
import { fetchLiveRoutes, cachedRoute } from './api'
import { modelName } from './aircraftTypes'

/**
 * Following sports teams' planes. Teams rarely publish this, so a team is
 * just a name plus the tail numbers (registrations) or callsigns you want to
 * follow. A few team-owned jets are well known and offered as presets.
 */
export interface Team {
  id: string
  name: string
  league?: string
  idents: string[] // tail numbers like N36NE, or callsigns like GXA123
}

export interface TeamPreset extends Omit<Team, 'id'> {
  note: string
}

export const TEAM_PRESETS: TeamPreset[] = [
  {
    name: 'New England Patriots',
    league: 'NFL',
    idents: ['N36NE', 'N225NE'],
    note: 'The team owns two Boeing 767s painted in Patriots colors.',
  },
]

export const teams = createStore<Team[]>('skywatch.teams', [])
/** Teams you stopped following (name → when), so syncing doesn't bring them back. */
export const teamsRemoved = createStore<Record<string, number>>('skywatch.teamsRemoved', {})

export function removeTeam(id: string) {
  const t = teams.get().find((x) => x.id === id)
  if (t) teamsRemoved.set((r) => ({ ...r, [t.name.toLowerCase()]: Date.now() }))
  teams.set((all) => all.filter((x) => x.id !== id))
}

export type PlaneState = 'airborne' | 'ground' | 'offline'

export interface PlaneStatus {
  ident: string
  state: PlaneState
  checkedAt: number
  hex?: string
  callsign?: string
  model?: string
  lat?: number
  lon?: number
  altitude?: number | null
  speed?: number
  from?: string
  to?: string
}

/** What we last saw for each followed plane, plus observed takeoff/landing times. */
export interface PlaneHistory {
  lastSeenAt?: number
  lastTakeoff?: number
  lastLanding?: number
  lastState?: PlaneState
  lastFrom?: string
  lastTo?: string
}

export const teamHistory = createStore<Record<string, PlaneHistory>>('skywatch.teamHistory', {})

const isCallsign = (s: string) => /^[A-Z]{3}\d/.test(s)

export const normalizeIdent = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

/** Look a plane up anywhere in the world by tail number or callsign. */
export async function checkPlane(identRaw: string): Promise<PlaneStatus> {
  const ident = normalizeIdent(identRaw)
  const path = isCallsign(ident) ? `/v2/callsign/${ident}` : `/v2/reg/${ident}`
  const res = await fetch(`${upstream('adsblol')}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`lookup failed (${res.status})`)
  const json = (await res.json()) as { ac?: RawAircraft[] }
  const a = (json.ac ?? []).find((x) => typeof x.lat === 'number')
  const now = Date.now()
  if (!a) return { ident, state: 'offline', checkedAt: now }
  const callsign = (a.flight ?? '').trim()
  if (callsign) await fetchLiveRoutes([{ callsign, lat: a.lat!, lon: a.lon! }])
  const route = callsign ? cachedRoute(callsign) : null
  return {
    ident,
    state: a.alt_baro === 'ground' ? 'ground' : 'airborne',
    checkedAt: now,
    hex: a.hex,
    callsign: callsign || undefined,
    model: modelName(a.t, a.desc),
    lat: a.lat,
    lon: a.lon,
    altitude: a.alt_baro === 'ground' ? null : typeof a.alt_baro === 'number' ? a.alt_baro : null,
    speed: a.gs,
    from: route?.origin?.iata || route?.origin?.icao,
    to: route?.destination?.iata || route?.destination?.icao,
  }
}

/** Fold a fresh status into the saved history (detects takeoffs and landings). */
export function rememberStatus(s: PlaneStatus) {
  teamHistory.set((all) => {
    const prev = all[s.ident] ?? {}
    const h: PlaneHistory = { ...prev }
    if (s.state !== 'offline') {
      h.lastSeenAt = s.checkedAt
      if (s.from) h.lastFrom = s.from
      if (s.to) h.lastTo = s.to
    }
    if (prev.lastState && prev.lastState !== s.state) {
      // ground/offline → airborne = took off; airborne → ground = landed
      if (s.state === 'airborne') h.lastTakeoff = s.checkedAt
      if (prev.lastState === 'airborne' && s.state === 'ground') h.lastLanding = s.checkedAt
    }
    h.lastState = s.state
    return { ...all, [s.ident]: h }
  })
}

export const teamStatus = createStore<Record<string, PlaneStatus & { error?: string }>>('skywatch.teamStatus', {})

let refreshing = false

/** Check every followed plane once (one small request each). */
export async function refreshTeams() {
  if (refreshing) return
  refreshing = true
  try {
    const idents = [...new Set(teams.get().flatMap((t) => t.idents))]
    for (const ident of idents) {
      try {
        const s = await checkPlane(ident)
        rememberStatus(s)
        teamStatus.set((all) => ({ ...all, [ident]: s }))
      } catch (err) {
        teamStatus.set((all) => ({ ...all, [ident]: { ...(all[ident] ?? { ident, state: 'offline', checkedAt: 0 }), error: String(err) } }))
      }
    }
  } finally {
    refreshing = false
  }
}
