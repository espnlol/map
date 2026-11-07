/**
 * The most interesting flights anywhere in the world right now, from
 * adsb.lol's worldwide lookups: emergency squawks, all military aircraft,
 * plus the rare-plane scan.
 */
import type { RawAircraft } from '../types'
import { upstream } from './upstream'
import { modelName } from './aircraftTypes'
import { rareInfo, rareStore } from './rare'
import { detectEmergency } from './emergency'
import { createStore } from './store'

export interface WorldFlight {
  hex: string
  callsign: string
  model?: string
  typeCode?: string
  lat: number
  lon: number
  altitude: number | null
  speed?: number
  score: number
  tags: string[]
  kind: 'emergency' | 'legendary' | 'rare' | 'vip' | 'bomber' | 'tanker' | 'surveillance' | 'military' | 'uncommon'
}

interface WorldState {
  flights: WorldFlight[]
  militaryCount: number
  emergencyCount: number
  checkedAt: number
  error: string | null
}

export const world = createStore<WorldState>('skywatch.world', { flights: [], militaryCount: 0, emergencyCount: 0, checkedAt: 0, error: null })

const VIP = /^(VC25|C32|C40|C37|C37A|C37B|GLF5|GLF4|GLEX|A319|B737|B742|B744|B748|A332|A333|A359|CL60)$/
const BOMBERS = /^(B52|B1|B2|TU95|TU22|TU16|H6)$/
const TANKERS = /^(K35R|KC46|K46|KC10|DC10|A332|MRTT|KC2|KC30|KC39|K135)$/
const ISR = /^(E3TF|E3CF|E6|E7|E8|P8|R135|RC35|U2|Q4|RQ4|MQ9|Q9|EP3|P3|E737|E2|GLEX|GL5T)$/
const VIP_CALLSIGNS = /^(AF1|AF2|SAM\d|SPAR\d|EXEC1F|VENUS\d|RRR\d|CFC0?01|GAF\d|CTM\d|ASY\d|KIWI\d)/

async function get(path: string): Promise<RawAircraft[]> {
  const res = await fetch(`${upstream('adsblol')}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  const j = (await res.json()) as { ac?: RawAircraft[] }
  return (j.ac ?? []).filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number' && a.alt_baro !== 'ground')
}

const base = (a: RawAircraft) => ({
  hex: a.hex,
  callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
  model: modelName(a.t, a.desc),
  typeCode: a.t,
  lat: a.lat!,
  lon: a.lon!,
  altitude: typeof a.alt_baro === 'number' ? a.alt_baro : null,
  speed: a.gs,
})

export async function scanWorld() {
  const out = new Map<string, WorldFlight>()
  const add = (f: WorldFlight) => {
    const prev = out.get(f.hex)
    if (!prev) out.set(f.hex, f)
    else out.set(f.hex, { ...prev, score: Math.max(prev.score, f.score), tags: [...new Set([...prev.tags, ...f.tags])], kind: prev.score >= f.score ? prev.kind : f.kind })
  }
  let military = 0
  let emergencies = 0
  let failures = 0

  // 1. Emergency squawks anywhere
  for (const sq of ['7700', '7600', '7500']) {
    try {
      for (const a of await get(`/v2/sqk/${sq}`)) {
        const e = detectEmergency(a.squawk, a.emergency)
        if (!e) continue
        emergencies++
        add({ ...base(a), score: sq === '7500' ? 120 : 100, tags: [`${e.label} (${e.code})`], kind: 'emergency' })
      }
    } catch {
      failures++
    }
  }

  // 2. Military worldwide: keep the notable ones
  try {
    const mil = await get('/v2/mil')
    military = mil.length
    for (const a of mil) {
      const t = (a.t ?? '').toUpperCase()
      const cs = (a.flight ?? '').trim()
      const r = rareInfo(t, cs)
      if (VIP_CALLSIGNS.test(cs) || (r && r.tier === 'legendary' && /^AF[12]$|^SAM/.test(r.code)))
        add({ ...base(a), score: 90, tags: [r?.name ?? 'VIP / government transport'], kind: 'vip' })
      else if (BOMBERS.test(t)) add({ ...base(a), score: 75, tags: ['Bomber'], kind: 'bomber' })
      else if (r && r.tier === 'legendary') add({ ...base(a), score: 80, tags: [r.name], kind: 'legendary' })
      else if (ISR.test(t)) add({ ...base(a), score: 55, tags: ['Surveillance / reconnaissance'], kind: 'surveillance' })
      else if (TANKERS.test(t)) add({ ...base(a), score: 45, tags: ['Tanker'], kind: 'tanker' })
      else if (r) add({ ...base(a), score: r.tier === 'rare' ? 50 : 20, tags: [r.name], kind: r.tier === 'rare' ? 'rare' : 'uncommon' })
      else if (VIP.test(t) && /^(SAM|SPAR|EXEC|VENUS)/.test(cs)) add({ ...base(a), score: 70, tags: ['VIP transport'], kind: 'vip' })
    }
  } catch {
    failures++
  }

  // 3. Rare planes the rare spotter already found worldwide
  for (const r of rareStore.get().current) {
    add({
      hex: r.hex,
      callsign: r.callsign,
      model: r.model,
      typeCode: r.type.code,
      lat: r.lat,
      lon: r.lon,
      altitude: r.altitude,
      score: r.type.tier === 'legendary' ? 80 : r.type.tier === 'rare' ? 50 : 20,
      tags: [`${r.type.tier} · ${r.type.name}`],
      kind: r.type.tier === 'legendary' ? 'legendary' : r.type.tier === 'rare' ? 'rare' : 'uncommon',
    })
  }

  const flights = [...out.values()].sort((a, b) => b.score - a.score || (b.altitude ?? 0) - (a.altitude ?? 0)).slice(0, 80)
  world.set({
    flights,
    militaryCount: military,
    emergencyCount: emergencies,
    checkedAt: Date.now(),
    error: failures >= 4 ? "Couldn't reach the worldwide lookups. Check your connection, or update the relay." : null,
  })
}

/** Planes squawking an emergency code anywhere in the world right now. */
export async function worldEmergencies(include7600: boolean) {
  const codes = ['7700', '7500', ...(include7600 ? ['7600'] : [])]
  const out: (ReturnType<typeof base> & { code: string; label: string })[] = []
  for (const sq of codes) {
    try {
      for (const a of await get(`/v2/sqk/${sq}`)) {
        const e = detectEmergency(a.squawk, a.emergency)
        if (e && !out.some((o) => o.hex === a.hex)) out.push({ ...base(a), code: sq, label: e.label })
      }
    } catch {
      /* try the next code */
    }
  }
  return out
}
