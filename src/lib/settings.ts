import { createStore } from './store'

export type BaseMap = 'dark' | 'streets' | 'satellite'

export interface Settings {
  // map
  baseMap: BaseMap
  trails: boolean
  airports: boolean
  labels: boolean
  rangeRing: boolean
  followSelected: boolean
  groundVehicles: boolean
  // units & time
  altUnit: 'ft' | 'm'
  speedUnit: 'kt' | 'mph' | 'kmh'
  distUnit: 'auto' | 'mi' | 'nm' | 'km'
  clock24: boolean
  // updates
  refresh: 'fast' | 'normal' | 'saver'
  // alerts inside the app
  emergencyBanner: boolean
  sounds: boolean
  rareSpotter: boolean
  rareLegendary: boolean
  rareRare: boolean
  rareUncommon: boolean
  rareWorldwide: boolean
  rareToasts: boolean
  happening: boolean
  happeningIgnoreAirports: boolean
  militaryPatterns: boolean
  goAroundAlerts: boolean
  // notifications while the app is closed (needs the relay set up for it)
  notifyTeams: boolean
  notifyEmergencies: boolean
  notifyRare: boolean
  notifyRadius: number
  home: { lat: number; lon: number; label: string } | null
}

export const DEFAULT_SETTINGS: Settings = {
  baseMap: 'dark',
  trails: true,
  airports: true,
  labels: false,
  rangeRing: true,
  followSelected: false,
  groundVehicles: true,
  altUnit: 'ft',
  speedUnit: 'kt',
  distUnit: 'auto',
  clock24: false,
  refresh: 'normal',
  emergencyBanner: true,
  sounds: false,
  rareSpotter: true,
  rareLegendary: true,
  rareRare: true,
  rareUncommon: false,
  rareWorldwide: true,
  rareToasts: true,
  happening: true,
  happeningIgnoreAirports: true,
  militaryPatterns: true,
  goAroundAlerts: true,
  notifyTeams: true,
  notifyEmergencies: true,
  notifyRare: false,
  notifyRadius: 100,
  home: null,
}

function migrate(): Settings {
  const s = { ...DEFAULT_SETTINGS }
  try {
    // carry over the two switches that existed before Settings did
    const t = localStorage.getItem('skywatch.trails')
    const a = localStorage.getItem('skywatch.airports')
    if (t != null) s.trails = JSON.parse(t)
    if (a != null) s.airports = JSON.parse(a)
  } catch {
    /* ignore */
  }
  return s
}

const store = createStore<Settings>('skywatch.settings', migrate())
// fill in options added after the settings were first saved
store.set((s) => ({ ...DEFAULT_SETTINGS, ...s }))

/** When settings last changed on this device (for syncing with your profile). */
export const settingsChangedAt = createStore<number>('skywatch.settingsAt', 0)

export const settings = {
  get: store.get,
  use: store.use,
  subscribe: store.subscribe,
  update: (patch: Partial<Settings>) => {
    store.set((s) => ({ ...s, ...patch }))
    settingsChangedAt.set(Date.now())
  },
  reset: () => {
    store.set(DEFAULT_SETTINGS)
    settingsChangedAt.set(Date.now())
  },
  /** Replace settings with ones saved in your profile (doesn't count as a local change). */
  replace: (s: Settings, at: number) => {
    store.set({ ...DEFAULT_SETTINGS, ...s })
    settingsChangedAt.set(at)
  },
}

export const pollMs = (radiusNm: number) => {
  const s = settings.get().refresh
  const base = s === 'fast' ? 4000 : s === 'saver' ? 15000 : 6000
  return radiusNm > 250 ? Math.max(15000, base) : base
}
