/**
 * Who owns and who operates an aircraft.
 *
 * - Registered owner and manufacturer come from hexdb.io, a free community
 *   database built largely from national aircraft registries (FAA etc.).
 * - The operator ("who usually flies it") comes from the flight's callsign:
 *   airline flights use a 3-letter ICAO airline code (AAL123 = American).
 */

import { upstream } from './upstream'

export interface OwnerRecord {
  registration?: string
  manufacturer?: string
  type?: string
  owner?: string
  operatorCode?: string
  typeCode?: string
}

const cache = new Map<string, OwnerRecord | null>()

/** What a previous lookup found, without asking again (undefined = never looked up). */
export const cachedOwner = (hex: string) => cache.get(hex.replace(/^~/, '').toLowerCase())

export async function fetchOwner(hex: string): Promise<OwnerRecord | null> {
  const key = hex.replace(/^~/, '').toLowerCase()
  if (hex.startsWith('~')) return null // non-ICAO addresses aren't in registries
  if (cache.has(key)) return cache.get(key)!
  const base = upstream('hexdb')
  try {
    const res = await fetch(`${base}/api/v1/aircraft/${key}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as Record<string, string | undefined>
    const clean = (v?: string) => (v && v.trim() && !/^(unknown|n\/a|none|-)$/i.test(v.trim()) ? v.trim() : undefined)
    const rec: OwnerRecord = {
      registration: clean(j.Registration),
      manufacturer: clean(j.Manufacturer),
      type: clean(j.Type),
      owner: clean(j.RegisteredOwners),
      operatorCode: clean(j.OperatorFlagCode),
      typeCode: clean(j.ICAOTypeCode),
    }
    const empty = !rec.registration && !rec.owner && !rec.type
    cache.set(key, empty ? null : rec)
    return empty ? null : rec
  } catch {
    return null // not cached, so a later click can retry
  }
}

/** Common ICAO airline / operator codes. */
const AIRLINES: Record<string, string> = {
  AAL: 'American Airlines', DAL: 'Delta Air Lines', UAL: 'United Airlines', SWA: 'Southwest Airlines',
  JBU: 'JetBlue', ASA: 'Alaska Airlines', NKS: 'Spirit Airlines', FFT: 'Frontier Airlines', HAL: 'Hawaiian Airlines',
  AAY: 'Allegiant Air', SCX: 'Sun Country Airlines', MXY: 'Breeze Airways', VXP: 'Avelo Airlines',
  SKW: 'SkyWest Airlines (flies for United, Delta, American, Alaska)', RPA: 'Republic Airways (flies for American, Delta, United)',
  ENY: 'Envoy Air (American Eagle)', EDV: 'Endeavor Air (Delta Connection)', JIA: 'PSA Airlines (American Eagle)',
  PDT: 'Piedmont Airlines (American Eagle)', ASH: 'Mesa Airlines (United Express)', GJS: 'GoJet (United Express)',
  QXE: 'Horizon Air (Alaska)', CPZ: 'Compass Airlines', UCA: 'CommutAir (United Express)', AWI: 'Air Wisconsin',
  FDX: 'FedEx Express', UPS: 'UPS Airlines', GTI: 'Atlas Air', ABX: 'ABX Air', ATN: 'Air Transport International',
  CKS: 'Kalitta Air', KFS: 'Kalitta Charters', PAC: 'Polar Air Cargo', AJT: 'Amerijet', SOO: 'Southern Air',
  EJA: 'NetJets', LXJ: 'Flexjet', XOJ: 'XOJET', JTL: 'Jet Linx', TWY: 'Solairus Aviation', VJT: 'VistaJet',
  GXA: 'GlobalX (charter)', SWQ: 'iAero Airways (charter)', WUP: 'Wheels Up', EJM: 'Executive Jet Management',
  ACA: 'Air Canada', JZA: 'Jazz (Air Canada Express)', WJA: 'WestJet', TSC: 'Air Transat', POE: 'Porter Airlines',
  ROU: 'Air Canada Rouge', AMX: 'Aeroméxico', VOI: 'Volaris', VIV: 'VivaAerobus', CMP: 'Copa Airlines', AVA: 'Avianca',
  LAN: 'LATAM', TAM: 'LATAM Brasil', GLO: 'GOL', AZU: 'Azul',
  BAW: 'British Airways', VIR: 'Virgin Atlantic', EZY: 'easyJet', RYR: 'Ryanair', AFR: 'Air France', KLM: 'KLM',
  DLH: 'Lufthansa', SWR: 'Swiss', AUA: 'Austrian Airlines', SAS: 'SAS', FIN: 'Finnair', IBE: 'Iberia', VLG: 'Vueling',
  AEA: 'Air Europa', TAP: 'TAP Air Portugal', ITY: 'ITA Airways', EIN: 'Aer Lingus', ICE: 'Icelandair', NAX: 'Norwegian',
  WZZ: 'Wizz Air', LOT: 'LOT Polish Airlines', THY: 'Turkish Airlines', PGT: 'Pegasus', EWG: 'Eurowings', BEL: 'Brussels Airlines',
  UAE: 'Emirates', QTR: 'Qatar Airways', ETD: 'Etihad', SVA: 'Saudia', ELY: 'El Al', RJA: 'Royal Jordanian',
  SIA: 'Singapore Airlines', CPA: 'Cathay Pacific', JAL: 'Japan Airlines', ANA: 'All Nippon Airways', KAL: 'Korean Air',
  AAR: 'Asiana', CCA: 'Air China', CES: 'China Eastern', CSN: 'China Southern', EVA: 'EVA Air', CAL: 'China Airlines',
  QFA: 'Qantas', ANZ: 'Air New Zealand', VOZ: 'Virgin Australia', AIC: 'Air India', ETH: 'Ethiopian Airlines',
  RCH: 'US Air Force (Air Mobility Command)', SAM: 'US Air Force (Special Air Mission)', CNV: 'US Navy', PAT: 'US Army',
  NASA: 'NASA',
  AMF: 'Ameriflight (cargo feeder)', MTN: 'Mountain Air Cargo (flies for FedEx)', WGN: 'Western Global Airlines (cargo)',
  NCR: 'National Airlines (charter & cargo)', KAP: 'Cape Air', SIL: 'Silver Airways', CLX: 'Cargolux', GEC: 'Lufthansa Cargo',
  BOX: 'AeroLogic (DHL cargo)', DHK: 'DHL Air UK', BCS: 'European Air Transport (DHL)', CAO: 'Air China Cargo',
  LOF: 'Trans States Airlines', ENT: 'Enter Air', TOM: 'TUI Airways', EXS: 'Jet2', SXS: 'SunExpress',
  AFL: 'Aeroflot', CSZ: 'Shenzhen Airlines', HVN: 'Vietnam Airlines', THA: 'Thai Airways', MAS: 'Malaysia Airlines',
  GIA: 'Garuda Indonesia', PAL: 'Philippine Airlines', ASL: 'Air Serbia', AUI: 'Ukraine International',
  MSR: 'EgyptAir', RAM: 'Royal Air Maroc', SAA: 'South African Airways', KQA: 'Kenya Airways', OMA: 'Oman Air',
  GFA: 'Gulf Air', KAC: 'Kuwait Airways', PIA: 'Pakistan International', JST: 'Jetstar',
  FLE: 'Flair Airlines', SWG: 'Sunwing Airlines', CJT: 'Cargojet',
}

export function airlineName(code?: string): string | undefined {
  return code ? AIRLINES[code.toUpperCase()] || undefined : undefined
}

/** The operator implied by a callsign like "DAL1234", if it's an airline-style one. */
export function operatorFromCallsign(callsign: string): { code: string; name?: string } | null {
  const m = /^([A-Z]{3})\d/.exec(callsign)
  if (!m) return null
  return { code: m[1], name: airlineName(m[1]) }
}

/** Country of registration from the registration's prefix. */
const REG_PREFIXES: [string, string][] = [
  ['N', 'United States'], ['C-', 'Canada'], ['XA-', 'Mexico'], ['XB-', 'Mexico'], ['XC-', 'Mexico'],
  ['G-', 'United Kingdom'], ['EI-', 'Ireland'], ['F-', 'France'], ['D-', 'Germany'], ['OE-', 'Austria'],
  ['HB-', 'Switzerland'], ['PH-', 'Netherlands'], ['OO-', 'Belgium'], ['EC-', 'Spain'], ['CS-', 'Portugal'],
  ['I-', 'Italy'], ['SE-', 'Sweden'], ['LN-', 'Norway'], ['OY-', 'Denmark'], ['OH-', 'Finland'], ['TF-', 'Iceland'],
  ['SP-', 'Poland'], ['OK-', 'Czechia'], ['HA-', 'Hungary'], ['9H-', 'Malta'], ['TC-', 'Türkiye'], ['4X-', 'Israel'],
  ['A6-', 'United Arab Emirates'], ['A7-', 'Qatar'], ['HZ-', 'Saudi Arabia'], ['VT-', 'India'], ['9V-', 'Singapore'],
  ['B-', 'China / Taiwan / Hong Kong'], ['JA', 'Japan'], ['HL', 'South Korea'], ['VH-', 'Australia'], ['ZK-', 'New Zealand'],
  ['PR-', 'Brazil'], ['PT-', 'Brazil'], ['PP-', 'Brazil'], ['PS-', 'Brazil'], ['LV-', 'Argentina'], ['CC-', 'Chile'],
  ['HK-', 'Colombia'], ['HP-', 'Panama'], ['ZS-', 'South Africa'], ['ET-', 'Ethiopia'], ['M-', 'Isle of Man'],
  ['VP-B', 'Bermuda'], ['VQ-B', 'Bermuda'], ['2-', 'Guernsey'], ['T7-', 'San Marino'], ['RA-', 'Russia'],
]

export function registrationCountry(reg?: string): string | undefined {
  if (!reg) return undefined
  const r = reg.toUpperCase()
  if (/^N[1-9][0-9A-Z]{0,4}$/.test(r)) return 'United States'
  // longest matching prefix wins (e.g. "VP-B" before shorter ones)
  const hit = [...REG_PREFIXES].filter(([p]) => p !== 'N').sort((a, b) => b[0].length - a[0].length).find(([p]) => r.startsWith(p))
  return hit?.[1]
}

/** Links to official registries and ownership history. */
export function registryLinks(reg: string | undefined, hex: string) {
  const out: { label: string; href: string; hint: string }[] = []
  const r = reg?.toUpperCase()
  if (r && /^N[1-9]/.test(r))
    out.push({ label: 'FAA Registry', href: `https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${r.slice(1)}`, hint: 'Official US owner record' })
  if (r?.startsWith('G-')) out.push({ label: 'UK CAA G-INFO', href: 'https://siteapps.caa.co.uk/g-info/', hint: `Search ${r} in the UK register` })
  if (r?.startsWith('C-')) out.push({ label: 'Transport Canada', href: 'https://wwwapps.tc.gc.ca/saf-sec-sur/2/ccarcs-riacc/RchSimp.aspx', hint: `Search ${r} in the Canadian register` })
  if (r?.startsWith('VH-')) out.push({ label: 'CASA Register', href: 'https://www.casa.gov.au/search-centre/aircraft-register', hint: `Search ${r} in the Australian register` })
  out.push({ label: 'Planespotters', href: `https://www.planespotters.net/hex/${hex.replace(/^~/, '').toUpperCase()}`, hint: 'Every airline that has flown it' })
  return out
}
