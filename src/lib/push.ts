/**
 * Notifications while SkyWatch is closed. The SkyWatch relay (Cloudflare
 * Worker) runs the checks on a timer and sends Web Push messages; this file
 * signs the device up and keeps the relay's copy of your settings current.
 */
import { createStore } from './store'
import { RELAY_URL } from './upstream'
import { settings } from './settings'
import { teams, teamHistory, type PlaneHistory } from './teams'
import { RARE_TYPES, enabledTiers } from './rare'
import { mergeRelayArrivals, milWatch, type MilArrival } from './milwatch'

interface PushState {
  token: string | null
  enabled: boolean
  lastSync: number
  error: string | null
}

export const pushStore = createStore<PushState>('skywatch.push', { token: null, enabled: false, lastSync: 0, error: null })

const relay = () => RELAY_URL.replace(/\/+$/, '')

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export function pushSupport(): { ok: boolean; reason?: string } {
  if (!relay()) return { ok: false, reason: 'No relay is set up.' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (isIOS() && !isStandalone()) return { ok: false, reason: 'On iPhone, open SkyWatch from its Home Screen icon first. Notifications only work there.' }
    return { ok: false, reason: "This browser can't receive notifications." }
  }
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'On iPhone, open SkyWatch from its Home Screen icon first. Notifications only work there.' }
  return { ok: true }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${relay()}/push/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `Relay answered ${res.status}`)
  return json
}

const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

/** Ask permission, subscribe this device and link it to the relay. Must run from a tap. */
export async function enablePush(linkCode?: string) {
  const support = pushSupport()
  if (!support.ok) throw new Error(support.reason)
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed. You can allow them in Settings → Notifications → SkyWatch.')
  const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  await navigator.serviceWorker.ready
  const keyRes = await fetch(`${relay()}/push/key`)
  const key = await keyRes.json().catch(() => ({}))
  if (!keyRes.ok) throw new Error((key as { error?: string }).error || 'The relay is not set up for notifications yet.')
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes((key as { publicKey: string }).publicKey) }))
  const { account } = await import('./account')
  const { token } = (await post('register', {
    subscription: sub.toJSON(),
    token: linkCode || pushStore.get().token || undefined,
    session: account.get().token || undefined,
  })) as { token: string }
  pushStore.set({ token, enabled: true, lastSync: 0, error: null })
  await syncPushConfig()
}

export async function disablePush() {
  const { token } = pushStore.get()
  try {
    const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    const sub = await reg?.pushManager.getSubscription()
    if (sub && token) await post('unregister', { token, endpoint: sub.endpoint })
    await sub?.unsubscribe()
  } catch {
    /* already gone */
  }
  pushStore.set((s) => ({ ...s, enabled: false }))
}

/** Link a second device (e.g. your PC) to the same relay without notifications on it. */
export function linkWithCode(code: string) {
  pushStore.set((s) => ({ ...s, token: code.trim() }))
}

export async function sendTestPush() {
  const { token } = pushStore.get()
  if (!token) throw new Error('Not linked yet')
  return (await post('test', { token })) as { sent: number; errors?: string[] }
}

/** Send the relay what to watch: your team planes, home area and which alerts you want. */
export async function syncPushConfig() {
  const { token } = pushStore.get()
  if (!token || !relay()) return
  const s = settings.get()
  const tiers = enabledTiers()
  const config = {
    teams: teams.get().flatMap((t) => t.idents.map((ident) => ({ ident, team: t.name }))),
    home: s.home,
    radius: s.notifyRadius,
    notify: { teams: s.notifyTeams, emergencies: s.notifyEmergencies, emergencyScope: s.emergencyScope, include7600: s.include7600, rare: s.notifyRare, mil: milWatch.get().notify },
    milAirports: milWatch.get().airports.map(({ code, lat, lon, elevation }) => ({ code, lat, lon, elevation })),
    rareTypes: RARE_TYPES.filter((t) => tiers.includes(t.tier)).map((t) => ({ code: t.code, name: t.name })),
  }
  try {
    await post('config', { token, config })
    pushStore.set((p) => ({ ...p, lastSync: Date.now(), error: null }))
  } catch (err) {
    pushStore.set((p) => ({ ...p, error: String(err instanceof Error ? err.message : err) }))
  }
}

interface RelayPlane {
  state?: 'airborne' | 'ground' | 'offline'
  lastSeenAt?: number
  lastTakeoff?: number
  lastLanding?: number
  lastFrom?: string
  lastTo?: string
}

/** Pull what the relay saw while the app was closed (exact team takeoff/landing times). */
export interface RelayCheck {
  at: number
  steps: string[]
  errors: string[]
  alerts: number
  sent: number
  pushErrors: string[]
}

export interface RelayStatus {
  lastRun?: number
  devices?: number
  lastCheck?: RelayCheck
  today?: { day: string; alerts: number; sent: number; runs: number }
}

/** Ask the relay to run its background check right now and report back. */
export async function runCheckNow(): Promise<RelayStatus> {
  const { token } = pushStore.get()
  if (!token) throw new Error('Turn notifications on first.')
  return (await post('run', { token })) as RelayStatus
}

export async function pullRelayState(): Promise<RelayStatus | null> {
  const { token } = pushStore.get()
  if (!token || !relay()) return null
  try {
    const res = await fetch(`${relay()}/push/state?token=${encodeURIComponent(token)}`)
    if (!res.ok) return null
    const st = (await res.json()) as RelayStatus & { planes?: Record<string, RelayPlane>; milLog?: MilArrival[] }
    mergeRelayArrivals(st.milLog)
    teamHistory.set((all) => {
      const next = { ...all }
      for (const [ident, p] of Object.entries(st.planes ?? {})) {
        const h: PlaneHistory = { ...(next[ident] ?? {}) }
        const newer = (a?: number, b?: number) => (a && (!b || a > b) ? a : b)
        h.lastTakeoff = newer(p.lastTakeoff, h.lastTakeoff)
        h.lastLanding = newer(p.lastLanding, h.lastLanding)
        h.lastSeenAt = newer(p.lastSeenAt, h.lastSeenAt)
        h.lastFrom = p.lastFrom ?? h.lastFrom
        h.lastTo = p.lastTo ?? h.lastTo
        next[ident] = h
      }
      return next
    })
    return { lastRun: st.lastRun, devices: st.devices, lastCheck: st.lastCheck, today: st.today }
  } catch {
    return null
  }
}
