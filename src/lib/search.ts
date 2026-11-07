import type { RawAircraft } from '../types'
import { RELAY_URL, upstream } from './upstream'
import { modelName, isKnownType } from './aircraftTypes'
import { RARE_TYPES } from './rare'
import { distanceNm } from './geo'

/** Airline IATA (2-letter, on tickets) → ICAO (3-letter, what planes broadcast). */
const IATA_TO_ICAO: Record<string, string> = {
  AA: 'AAL', DL: 'DAL', UA: 'UAL', WN: 'SWA', B6: 'JBU', AS: 'ASA', NK: 'NKS', F9: 'FFT', HA: 'HAL', G4: 'AAY',
  SY: 'SCX', MX: 'MXY', XP: 'VXP', OO: 'SKW', YX: 'RPA', MQ: 'ENY', '9E': 'EDV', OH: 'JIA', PT: 'PDT', YV: 'ASH',
  QX: 'QXE', C5: 'UCA', FX: 'FDX', '5X': 'UPS', '5Y': 'GTI', K4: 'CKS', AC: 'ACA', WS: 'WJA', TS: 'TSC', PD: 'POE',
  AM: 'AMX', Y4: 'VOI', VB: 'VIV', CM: 'CMP', AV: 'AVA', LA: 'LAN', G3: 'GLO', AD: 'AZU', BA: 'BAW', VS: 'VIR',
  U2: 'EZY', FR: 'RYR', AF: 'AFR', KL: 'KLM', LH: 'DLH', LX: 'SWR', OS: 'AUA', SK: 'SAS', AY: 'FIN', IB: 'IBE',
  VY: 'VLG', UX: 'AEA', TP: 'TAP', AZ: 'ITY', EI: 'EIN', FI: 'ICE', DY: 'NAX', W6: 'WZZ', LO: 'LOT', TK: 'THY',
  PC: 'PGT', EW: 'EWG', SN: 'BEL', EK: 'UAE', QR: 'QTR', EY: 'ETD', SV: 'SVA', LY: 'ELY', RJ: 'RJA', SQ: 'SIA',
  CX: 'CPA', JL: 'JAL', NH: 'ANA', KE: 'KAL', OZ: 'AAR', CA: 'CCA', MU: 'CES', CZ: 'CSN', BR: 'EVA', CI: 'CAL',
  QF: 'QFA', NZ: 'ANZ', VA: 'VOZ', AI: 'AIC', ET: 'ETH',
}

export interface WorldResult {
  hex: string
  callsign: string
  registration?: string
  model?: string
  lat: number
  lon: number
  altitude: number | null
  speed?: number
  distance: number
  matched: string
}

/** Work out which worldwide lookups a search term could mean. */
export function searchPlans(raw: string): { path: string; label: string }[] {
  const q = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (q.length < 2) return []
  const plans: { path: string; label: string }[] = []
  if (/^[0-9A-F]{6}$/.test(q)) plans.push({ path: `/v2/hex/${q.toLowerCase()}`, label: 'transponder code' })
  const iata = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(q)
  if (iata && IATA_TO_ICAO[iata[1]]) plans.push({ path: `/v2/callsign/${IATA_TO_ICAO[iata[1]]}${iata[2]}`, label: `flight ${q}` })
  if (/^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(q) || /^[A-Z]{2,7}\d{0,4}$/.test(q)) plans.push({ path: `/v2/callsign/${q}`, label: 'callsign' })
  if (/^[A-Z0-9-]{3,8}$/.test(q) && /\d/.test(q)) plans.push({ path: `/v2/reg/${q}`, label: 'tail number' })
  if (isKnownType(q) || RARE_TYPES.some((t) => t.code === q)) plans.push({ path: `/v2/type/${q}`, label: 'aircraft type' })
  return plans
}

export async function searchWorld(term: string, from: { lat: number; lon: number }): Promise<WorldResult[]> {
  const plans = searchPlans(term)
  const out = new Map<string, WorldResult>()
  await Promise.all(
    plans.map(async (p) => {
      try {
        const res = await fetch(`${upstream('adsblol')}${p.path}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) return
        const json = (await res.json()) as { ac?: RawAircraft[] }
        for (const a of json.ac ?? []) {
          if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || out.has(a.hex)) continue
          out.set(a.hex, {
            hex: a.hex,
            callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
            registration: a.r,
            model: modelName(a.t, a.desc),
            lat: a.lat,
            lon: a.lon,
            altitude: a.alt_baro === 'ground' ? null : typeof a.alt_baro === 'number' ? a.alt_baro : null,
            speed: a.gs,
            distance: distanceNm(from.lat, from.lon, a.lat, a.lon),
            matched: p.label,
          })
        }
      } catch {
        /* other lookups may still work */
      }
    }),
  )
  // Nothing from the free sources? Ask ADS-B Exchange, if it's connected to the relay.
  if (out.size === 0 && RELAY_URL) {
    for (const p of plans.filter((x) => /^\/v2\/(callsign|reg|hex)\//.test(x.path))) {
      try {
        const res = await fetch(`${RELAY_URL.replace(/\/+$/, '')}/adsbx${p.path}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) continue
        const json = (await res.json()) as { ac?: RawAircraft[] }
        for (const a of json.ac ?? []) {
          if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || out.has(a.hex)) continue
          out.set(a.hex, {
            hex: a.hex,
            callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
            registration: a.r,
            model: modelName(a.t, a.desc),
            lat: a.lat,
            lon: a.lon,
            altitude: a.alt_baro === 'ground' ? null : typeof a.alt_baro === 'number' ? a.alt_baro : null,
            speed: a.gs,
            distance: distanceNm(from.lat, from.lon, a.lat, a.lon),
            matched: `${p.label} (ADS-B Exchange)`,
          })
        }
        if (out.size) break
      } catch {
        /* not connected */
      }
    }
  }
  return [...out.values()].sort((a, b) => a.distance - b.distance).slice(0, 100)
}

/** Whether the relay has ADS-B Exchange connected. */
export async function adsbxConnected(): Promise<boolean> {
  if (!RELAY_URL) return false
  try {
    const r = await fetch(`${RELAY_URL.replace(/\/+$/, '')}/adsbx/status`)
    return r.ok && Boolean(((await r.json()) as { connected?: boolean }).connected)
  } catch {
    return false
  }
}

/** Find one aircraft by its transponder code (used by notification and share links). */
export async function findByHex(hex: string, from: { lat: number; lon: number }) {
  const r = await searchWorld(hex, from)
  return r.find((x) => x.hex.toLowerCase() === hex.toLowerCase()) ?? null
}
