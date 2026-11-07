import type { Aircraft, RawAircraft } from '../types'
import { createStore } from './store'
import { upstream } from './upstream'
import { distanceNm } from './geo'
import { modelName } from './aircraftTypes'
import { settings } from './settings'

export type RareTier = 'legendary' | 'rare' | 'uncommon'

export interface RareType {
  code: string // ICAO type designator
  name: string
  why: string
  tier: RareTier
}

/** What counts as "rare". ICAO type codes; worldwide lookups use adsb.lol's /v2/type/<code>. */
export const RARE_TYPES: RareType[] = [
  // legendary: a few in the world, or famous
  { code: 'VC25', name: 'Air Force One (VC-25)', why: "The US President's 747", tier: 'legendary' },
  { code: 'E4', name: 'Boeing E-4B "Doomsday plane"', why: 'Airborne command post, only 4 exist', tier: 'legendary' },
  { code: 'B52', name: 'Boeing B-52 Stratofortress', why: 'Cold War strategic bomber, still flying', tier: 'legendary' },
  { code: 'B1', name: 'Rockwell B-1 Lancer', why: 'Supersonic swing-wing bomber', tier: 'legendary' },
  { code: 'A124', name: 'Antonov An-124 Ruslan', why: 'One of the largest cargo planes ever built', tier: 'legendary' },
  { code: 'A3ST', name: 'Airbus Beluga', why: 'Whale-shaped Airbus parts carrier', tier: 'legendary' },
  { code: 'A337', name: 'Airbus BelugaXL', why: 'The newer, bigger Beluga', tier: 'legendary' },
  { code: 'SGUP', name: 'Aero Spacelines Super Guppy', why: 'NASA outsize cargo plane, one left flying', tier: 'legendary' },
  { code: 'B17', name: 'Boeing B-17 Flying Fortress', why: 'WWII bomber, a handful still fly', tier: 'legendary' },
  { code: 'B29', name: 'Boeing B-29 Superfortress', why: 'WWII bomber, two still fly', tier: 'legendary' },
  { code: 'CONI', name: 'Lockheed Constellation', why: '1940s–50s airliner, extremely rare today', tier: 'legendary' },
  { code: 'ER2', name: 'NASA ER-2', why: "NASA's high-altitude research jet", tier: 'legendary' },
  { code: 'WB57', name: 'NASA WB-57', why: '1950s-design high-altitude research jet', tier: 'legendary' },
  // rare
  { code: 'B74S', name: 'Boeing 747SP', why: 'Short 747 from the 1970s, very few left', tier: 'rare' },
  { code: 'BLCF', name: 'Boeing Dreamlifter', why: 'Giant 747 that carries 787 parts, 4 exist', tier: 'rare' },
  { code: 'C5M', name: 'Lockheed C-5 Galaxy', why: 'Huge US military transport', tier: 'rare' },
  { code: 'E3TF', name: 'Boeing E-3 Sentry (AWACS)', why: 'Radar-dish surveillance plane', tier: 'rare' },
  { code: 'E3CF', name: 'Boeing E-3 Sentry (AWACS)', why: 'Radar-dish surveillance plane', tier: 'rare' },
  { code: 'E6', name: 'Boeing E-6 Mercury', why: 'Navy nuclear command relay plane', tier: 'rare' },
  { code: 'U2', name: 'Lockheed U-2', why: 'High-altitude spy plane', tier: 'rare' },
  { code: 'R135', name: 'Boeing RC-135', why: 'Reconnaissance jet', tier: 'rare' },
  { code: 'DC3', name: 'Douglas DC-3 / C-47', why: '1930s airliner, a few still work', tier: 'rare' },
  { code: 'DC6', name: 'Douglas DC-6', why: 'Piston airliner, mostly in Alaska now', tier: 'rare' },
  { code: 'P51', name: 'North American P-51 Mustang', why: 'WWII fighter at air shows', tier: 'rare' },
  { code: 'SPIT', name: 'Supermarine Spitfire', why: 'WWII fighter', tier: 'rare' },
  { code: 'L101', name: 'Lockheed L-1011 TriStar', why: 'Three-engine 1970s widebody, nearly extinct', tier: 'rare' },
  { code: 'DC10', name: 'McDonnell Douglas DC-10', why: 'Three-engine widebody, a few freighters and tankers left', tier: 'rare' },
  { code: 'IL76', name: 'Ilyushin Il-76', why: 'Soviet-era heavy freighter', tier: 'rare' },
  // uncommon: special but there are quite a few
  { code: 'A388', name: 'Airbus A380', why: 'The largest passenger jet', tier: 'uncommon' },
  { code: 'B748', name: 'Boeing 747-8', why: 'The last and longest 747', tier: 'uncommon' },
  { code: 'B744', name: 'Boeing 747-400', why: 'The classic Queen of the Skies', tier: 'uncommon' },
  { code: 'MD11', name: 'McDonnell Douglas MD-11', why: 'Three-engine freighter', tier: 'uncommon' },
  { code: 'V22', name: 'Bell Boeing V-22 Osprey', why: 'Tilt-rotor, takes off like a helicopter', tier: 'uncommon' },
  { code: 'A400', name: 'Airbus A400M Atlas', why: 'European military turboprop transport', tier: 'uncommon' },
]

const BY_CODE = new Map(RARE_TYPES.map((t) => [t.code, t]))

// Callsigns that are special whatever the aircraft type.
const RARE_CALLSIGNS: [RegExp, RareType][] = [
  [/^AF1$/, { code: 'AF1', name: 'Air Force One', why: 'The President is on board', tier: 'legendary' }],
  [/^AF2$/, { code: 'AF2', name: 'Air Force Two', why: 'The Vice President is on board', tier: 'legendary' }],
  [/^SAM\d/, { code: 'SAM', name: 'Special Air Mission', why: 'US government VIP flight', tier: 'rare' }],
]

export function enabledTiers(): RareTier[] {
  const s = settings.get()
  return [s.rareLegendary && 'legendary', s.rareRare && 'rare', s.rareUncommon && 'uncommon'].filter(Boolean) as RareTier[]
}

export function rareInfo(typeCode?: string, callsign?: string): RareType | null {
  for (const [re, t] of RARE_CALLSIGNS) if (callsign && re.test(callsign)) return t
  return (typeCode && BY_CODE.get(typeCode.toUpperCase())) || null
}

export interface RareSighting {
  hex: string
  callsign: string
  type: RareType
  lat: number
  lon: number
  altitude: number | null
  model?: string
  distance: number | null // nm from your map centre
  nearby: boolean // inside your current search area
  firstSeen: number
}

interface RareState {
  current: RareSighting[]
  seen: Record<string, number> // hex → first time we noticed it
  lastViewed: number
  checkedAt: number
}

export const rareStore = createStore<RareState>('skywatch.rare', { current: [], seen: {}, lastViewed: 0, checkedAt: 0 })

export const unseenRare = (s: RareState) => s.current.filter((r) => r.firstSeen > s.lastViewed).length

/** Merge the area's live traffic with a worldwide scan, then remember what's new. */
export async function scanRare(local: Aircraft[], center: { lat: number; lon: number }, radiusNm: number, worldwide: boolean) {
  const tiers = enabledTiers()
  const now = Date.now()
  const found = new Map<string, Omit<RareSighting, 'firstSeen'>>()
  for (const a of local) {
    const t = rareInfo(a.typeCode, a.callsign)
    if (!t || !tiers.includes(t.tier) || a.onGround) continue
    found.set(a.hex, { hex: a.hex, callsign: a.callsign, type: t, lat: a.lat, lon: a.lon, altitude: a.altitude, model: a.model, distance: distanceNm(center.lat, center.lon, a.lat, a.lon), nearby: true })
  }
  if (worldwide) {
    const types = RARE_TYPES.filter((t) => tiers.includes(t.tier))
    for (const t of types) {
      // space the lookups out so the free flight-data services don't refuse us (429)
      await new Promise((r) => setTimeout(r, 300))
      try {
        const res = await fetch(`${upstream('adsblol')}/v2/type/${t.code}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) continue
        const json = (await res.json()) as { ac?: RawAircraft[] }
        for (const a of json.ac ?? []) {
          if (a.alt_baro === 'ground' || typeof a.lat !== 'number' || typeof a.lon !== 'number' || found.has(a.hex)) continue
          const d = distanceNm(center.lat, center.lon, a.lat, a.lon)
          found.set(a.hex, {
            hex: a.hex,
            callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
            type: t,
            lat: a.lat,
            lon: a.lon,
            altitude: typeof a.alt_baro === 'number' ? a.alt_baro : null,
            model: modelName(a.t, a.desc),
            distance: d,
            nearby: d <= radiusNm,
          })
        }
      } catch {
        /* skip this type this time */
      }
    }
  }
  const prev = rareStore.get()
  const seen = { ...prev.seen }
  const current: RareSighting[] = [...found.values()].map((r) => {
    if (!seen[r.hex]) seen[r.hex] = now
    return { ...r, firstSeen: seen[r.hex] }
  })
  for (const k of Object.keys(seen)) if (now - seen[k] > 24 * 3600e3 && !found.has(k)) delete seen[k]
  const order = { legendary: 0, rare: 1, uncommon: 2 }
  current.sort((a, b) => Number(b.nearby) - Number(a.nearby) || order[a.type.tier] - order[b.type.tier] || (a.distance ?? 0) - (b.distance ?? 0))
  const fresh = current.filter((r) => !prev.current.some((p) => p.hex === r.hex))
  rareStore.set({ ...prev, current, seen, checkedAt: now })
  return fresh
}

export const markRareViewed = () => rareStore.set((s) => ({ ...s, lastViewed: Date.now() }))
