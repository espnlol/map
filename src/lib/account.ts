/**
 * Profiles: sign in to keep your logbook, followed teams and emergency
 * history on the SkyWatch relay, so they survive a lost phone or a cleared
 * browser and show up on every device you sign in on.
 */
import { createStore } from './store'
import { RELAY_URL } from './upstream'
import { logbook, logbookRemoved, planeKey, type LogEntry } from './logbook'
import { teams, teamsRemoved, teamHistory, type Team, type PlaneHistory } from './teams'
import { emergencyLog, type EmergencyRecord } from './emergencyLog'
import { mergeSightings, sightings, type PlaneRecord } from './sightings'
import { settings, settingsChangedAt, type Settings } from './settings'
import { milWatch, type WatchedAirport } from './milwatch'

interface AccountState {
  username: string | null
  token: string | null
  lastSync: number
  syncing: boolean
  error: string | null
}

export const account = createStore<AccountState>('skywatch.account', { username: null, token: null, lastSync: 0, syncing: false, error: null })

interface SyncedData {
  logbook?: LogEntry[]
  logbookRemoved?: Record<string, number>
  teams?: Team[]
  teamsRemoved?: Record<string, number>
  teamHistory?: Record<string, PlaneHistory>
  emergencies?: EmergencyRecord[]
  settings?: Settings
  settingsAt?: number
  milAirports?: WatchedAirport[]
  sightings?: Record<string, PlaneRecord>
  updatedAt?: number
}

const relay = () => RELAY_URL.replace(/\/+$/, '')

async function call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const url = `${relay()}/account/${path}`
  const res = await fetch(url, method === 'POST' ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== 'login') account.set((a) => ({ ...a, token: null, error: 'Signed out. Please sign in again.' }))
  if (!res.ok) throw new Error((json as { error?: string }).error || `The relay answered ${res.status}. Is the latest relay code deployed?`)
  return json
}

/** Stretch the password on this device; only the result is sent. */
async function proofFor(username: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`skywatch:${username.trim().toLowerCase()}`), iterations: 150_000 },
    key,
    256,
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signIn(username: string, password: string, create: boolean) {
  if (!relay()) throw new Error('No relay is set up.')
  const u = username.trim().toLowerCase()
  if (create && password.length < 8) throw new Error('Use a password of at least 8 characters.')
  const { token, username: name } = (await call(create ? 'signup' : 'login', { username: u, proof: await proofFor(u, password) })) as {
    token: string
    username: string
  }
  account.set({ username: name, token, lastSync: 0, syncing: false, error: null })
  await syncNow() // brings the profile's data in and adds anything already on this device
}

export async function signOut() {
  const { token } = account.get()
  try {
    if (token) await call('logout', { token })
  } catch {
    /* already signed out */
  }
  account.set({ username: null, token: null, lastSync: 0, syncing: false, error: null })
}

export async function deleteProfile() {
  const { token } = account.get()
  if (token) await call('delete', { token })
  account.set({ username: null, token: null, lastSync: 0, syncing: false, error: null })
}

// ---- merging what's on this device with what's in the profile ----

const newer = (a?: number, b?: number) => (a && (!b || a > b) ? a : b)

export function mergeData(local: SyncedData, remote: SyncedData): SyncedData {
  // logbook: one entry per plane, keep the first sighting and any photo/owner found
  const removed = { ...remote.logbookRemoved, ...local.logbookRemoved }
  for (const [k, t] of Object.entries(remote.logbookRemoved ?? {})) removed[k] = Math.max(t, removed[k] ?? 0)
  const byKey = new Map<string, LogEntry>()
  for (const e of [...(remote.logbook ?? []), ...(local.logbook ?? [])]) {
    const k = planeKey(e)
    if (removed[k] && removed[k] >= e.at) continue
    const prev = byKey.get(k)
    if (!prev) byKey.set(k, e)
    else {
      const first = prev.at <= e.at ? prev : e
      byKey.set(k, { ...first, photo: first.photo ?? prev.photo ?? e.photo, owner: first.owner ?? prev.owner ?? e.owner })
    }
  }
  const logbookOut = [...byKey.values()].sort((a, b) => b.at - a.at)
  for (const k of Object.keys(removed)) if (byKey.has(k)) delete removed[k]

  // teams: by name, combining tail numbers
  const teamsGone = { ...remote.teamsRemoved, ...local.teamsRemoved }
  const teamMap = new Map<string, Team>()
  for (const t of [...(remote.teams ?? []), ...(local.teams ?? [])]) {
    const k = t.name.toLowerCase()
    if (teamsGone[k] && teamsGone[k] >= Number(t.id || 0)) continue
    const prev = teamMap.get(k)
    teamMap.set(k, prev ? { ...prev, idents: [...new Set([...prev.idents, ...t.idents])] } : t)
  }

  // team history: newest times win
  const hist: Record<string, PlaneHistory> = { ...remote.teamHistory }
  for (const [id, h] of Object.entries(local.teamHistory ?? {})) {
    const r = hist[id] ?? {}
    hist[id] = {
      ...r,
      ...h,
      lastSeenAt: newer(h.lastSeenAt, r.lastSeenAt),
      lastTakeoff: newer(h.lastTakeoff, r.lastTakeoff),
      lastLanding: newer(h.lastLanding, r.lastLanding),
    }
  }

  // emergencies: by id, keep the most recently updated copy
  const em = new Map<string, EmergencyRecord>()
  for (const r of [...(remote.emergencies ?? []), ...(local.emergencies ?? [])]) {
    const prev = em.get(r.id)
    if (!prev || r.lastSeenAt >= prev.lastSeenAt) em.set(r.id, r)
  }

  // settings: whichever device changed them last wins
  const useRemote = (remote.settingsAt ?? 0) > (local.settingsAt ?? 0)
  // watched airports: last device to change settings decides, otherwise combine
  const mil = useRemote ? remote.milAirports ?? local.milAirports : local.milAirports?.length ? local.milAirports : remote.milAirports
  return {
    milAirports: mil ?? [],
    settings: useRemote ? remote.settings : local.settings,
    settingsAt: useRemote ? remote.settingsAt : local.settingsAt,
    logbook: logbookOut,
    logbookRemoved: removed,
    teams: [...teamMap.values()],
    teamsRemoved: teamsGone,
    teamHistory: hist,
    emergencies: [...em.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 200),
    sightings: mergeSightings(remote.sightings, local.sightings),
  }
}

const localData = (): SyncedData => ({
  logbook: logbook.get(),
  logbookRemoved: logbookRemoved.get(),
  teams: teams.get(),
  teamsRemoved: teamsRemoved.get(),
  teamHistory: teamHistory.get(),
  emergencies: emergencyLog.get(),
  settings: settings.get(),
  settingsAt: settingsChangedAt.get(),
  milAirports: milWatch.get().airports,
  sightings: sightings.get(),
})

let applying = false
let lastPushed = ''

export async function syncNow() {
  const { token } = account.get()
  if (!token || !relay()) return
  account.set((a) => ({ ...a, syncing: true }))
  try {
    const remote = (await call(`data?token=${encodeURIComponent(token)}`)) as SyncedData
    const merged = mergeData(localData(), remote)
    applying = true
    logbook.set(merged.logbook!)
    logbookRemoved.set(merged.logbookRemoved!)
    teams.set(merged.teams!)
    teamsRemoved.set(merged.teamsRemoved!)
    teamHistory.set(merged.teamHistory!)
    emergencyLog.set(merged.emergencies!)
    sightings.set(merged.sightings!)
    if (merged.milAirports) milWatch.set((w) => ({ ...w, airports: merged.milAirports! }))
    if (merged.settings && merged.settingsAt && merged.settingsAt > settingsChangedAt.get()) settings.replace(merged.settings, merged.settingsAt)
    applying = false
    const text = JSON.stringify(merged)
    if (text !== lastPushed) {
      await call('data', { token, data: merged })
      lastPushed = text
    }
    account.set((a) => ({ ...a, syncing: false, lastSync: Date.now(), error: null }))
  } catch (err) {
    applying = false
    account.set((a) => ({ ...a, syncing: false, error: err instanceof Error ? err.message : String(err) }))
  }
}

// Save a few seconds after anything changes, and when the app comes back.
let timer: ReturnType<typeof setTimeout> | undefined
const schedule = () => {
  if (applying || !account.get().token) return
  clearTimeout(timer)
  timer = setTimeout(syncNow, 4000)
}
export function startAutoSync() {
  const unsubs = [logbook, logbookRemoved, teams, teamsRemoved, emergencyLog, settingsChangedAt, milWatch, sightings].map((s) => s.subscribe(schedule))
  const onVisible = () => !document.hidden && account.get().token && syncNow()
  document.addEventListener('visibilitychange', onVisible)
  if (account.get().token) syncNow()
  return () => {
    unsubs.forEach((u) => u())
    document.removeEventListener('visibilitychange', onVisible)
  }
}
