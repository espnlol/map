import type { RawAircraft } from '../types'
import { cachedOwner } from './owner'
import { inferCategory } from './aircraftTypes'

/**
 * "Special" groups that ADS-B doesn't broadcast directly. They're worked out
 * from the aircraft's address, callsign, registration and operator, so they're
 * best-effort and every match carries the reason it matched.
 */
export type SpecialTag = 'milgov' | 'sports' | 'news'

export interface SpecialMatch {
  tag: SpecialTag
  reason: string
}

export const SPECIAL_GROUPS: { tag: SpecialTag; label: string; color: string; description: string }[] = [
  {
    tag: 'milgov',
    label: 'Military / Gov',
    color: '#84cc16',
    description: 'Military and government aircraft: air forces, navies, coast guards, police, customs, NASA and similar',
  },
  {
    tag: 'sports',
    label: 'Sports',
    color: '#f97316',
    description: 'Likely sports-team flights: team-owned jets and airlines that mostly fly team charters',
  },
  {
    tag: 'news',
    label: 'News',
    color: '#e879f9',
    description: 'TV news helicopters and planes: owned by a TV station or broadcaster, or by a company that flies news helicopters for them',
  },
]

// Callsign prefixes used by military and government operators.
const MILGOV_CALLSIGNS: Record<string, string> = {
  RCH: 'US Air Force Air Mobility Command ("Reach")',
  SPAR: 'US Air Force VIP transport',
  SAM: 'US Air Force Special Air Mission',
  AF1: 'Air Force One',
  AF2: 'Air Force Two',
  VENUS: 'US Air Force VIP transport',
  CNV: 'US Navy',
  VV: 'US Navy',
  PAT: 'US Army priority air transport',
  EVAC: 'US military aeromedical evacuation',
  TOPCAT: 'US military',
  NAVY: 'US Navy',
  ARMY: 'US Army',
  CG: 'US Coast Guard',
  COAST: 'US Coast Guard',
  OMAHA: 'US Customs and Border Protection',
  NASA: 'NASA',
  RRR: 'Royal Air Force',
  ASCOT: 'Royal Air Force',
  CFC: 'Royal Canadian Air Force',
  CANFORCE: 'Royal Canadian Air Force',
  GAF: 'German Air Force',
  FAF: 'French Air and Space Force',
  CTM: 'French Air and Space Force',
  IAM: 'Italian Air Force',
  BAF: 'Belgian Air Component',
  NAF: 'Royal Netherlands Air Force',
  ASY: 'Royal Australian Air Force',
  KIWI: 'Royal New Zealand Air Force',
  SUI: 'Swiss Air Force',
  SHF: 'Swedish Air Force',
  HAF: 'Hellenic Air Force',
  PLF: 'Polish Air Force',
  MMF: 'NATO Multinational MRTT Fleet',
  NATO: 'NATO',
}

const MILGOV_OPERATOR_WORDS = [
  'AIR FORCE', 'NAVY', 'ARMY', 'MARINE CORPS', 'COAST GUARD', 'NATIONAL GUARD', 'AIR NATIONAL GUARD',
  'DEPARTMENT OF', 'DEPT OF', 'POLICE', 'SHERIFF', 'HIGHWAY PATROL', 'STATE PATROL', 'STATE OF ', 'COUNTY OF',
  'CITY OF', 'UNITED STATES', 'U S ', 'US GOVERNMENT', 'FEDERAL', 'CUSTOMS', 'BORDER PROTECTION', 'HOMELAND',
  'FBI', 'NASA', 'NOAA', 'FAA', 'FOREST SERVICE', 'FISH AND WILDLIFE', 'MINISTRY OF DEFENCE', 'GOVERNMENT',
]

// Airlines whose flying is mostly team charters (NFL, NBA, NHL, MLB, college).
const SPORTS_CALLSIGNS: Record<string, string> = {
  GXA: 'GlobalX, a charter airline that flies many sports teams',
  SWQ: 'iAero Airways, a charter airline that flies many sports teams',
  KFS: 'Kalitta Charters, used for team and event charters',
}

// Aircraft owned by or dedicated to teams.
const SPORTS_REGISTRATIONS: Record<string, string> = {
  N36NE: 'New England Patriots team plane',
  N225NE: 'New England Patriots team plane',
}

const SPORTS_OPERATOR_WORDS = [
  'SPORTS', 'ATHLETIC', 'PATRIOTS', 'COWBOYS', 'PACKERS', 'YANKEES', 'LAKERS', 'CELTICS', 'WARRIORS',
  'FOOTBALL', 'BASEBALL', 'BASKETBALL', 'HOCKEY', 'SOCCER', 'RACING', 'NASCAR', 'NFL', 'NBA', 'NHL', 'MLB',
]

// Owners that mean TV news. Station helicopters are usually registered to the
// station's parent company or to a company that flies them for the station.
const NEWS_OWNER_WORDS: [RegExp, string][] = [
  [/\bTELEVISION\b/, 'a TV station or network'],
  [/\bBROADCAST(ING|ERS?)?\b/, 'a broadcaster'],
  [/\b[KW][A-Z]{2,3}[- ]?TV\b/, 'a TV station'],
  [/\bTV\b/, 'a TV company'],
  [/\bNEWS\b/, 'a news organization'],
  [/\bTEGNA\b/, 'TEGNA, owner of many local TV stations'],
  [/\bNEXSTAR\b/, 'Nexstar, owner of many local TV stations'],
  [/\bSINCLAIR\b/, 'Sinclair, owner of many local TV stations'],
  [/\bGRAY (MEDIA|TELEVISION)\b/, 'Gray Media, owner of many local TV stations'],
  [/\bSCRIPPS\b/, 'Scripps, owner of many local TV stations'],
  [/\bHEARST\b/, 'Hearst Television'],
  [/\bNBC ?UNIVERSAL\b|\bNBC\b/, 'NBC'],
  [/\bCBS\b/, 'CBS'],
  [/\bFOX (TELEVISION|TV|STATIONS|CORP)/, 'Fox Television Stations'],
  [/\bAMERICAN BROADCASTING\b|\bABC INC\b|\bABC HOLDING/, 'ABC'],
  [/\bTELEMUNDO\b/, 'Telemundo'],
  [/\bUNIVISION\b|\bTELEVISAUNIVISION\b/, 'Univision'],
  [/\bCOX MEDIA\b/, 'Cox Media Group, owner of local TV stations'],
  [/\bGRAHAM MEDIA\b/, 'Graham Media Group, owner of local TV stations'],
  [/\bALLEN MEDIA\b/, 'Allen Media, owner of local TV stations'],
  [/\bHELINET\b/, 'Helinet, which flies TV news helicopters'],
  [/\bANGEL CITY AIR\b/, 'Angel City Air, which flies TV news helicopters'],
]

function hexIn(hex: string, lo: number, hi: number): boolean {
  const n = parseInt(hex.replace(/^~/, ''), 16)
  return !Number.isNaN(n) && n >= lo && n <= hi && !hex.startsWith('~')
}

function prefixMatch(callsign: string, table: Record<string, string>): string | null {
  for (const [prefix, why] of Object.entries(table)) {
    if (callsign.startsWith(prefix) && /^\d/.test(callsign.slice(prefix.length))) return why
    if (callsign === prefix) return why
  }
  return null
}

export function detectSpecial(r: RawAircraft, callsign: string): SpecialMatch[] {
  const out: SpecialMatch[] = []
  // The feed's operator, or the registered owner if we've looked this plane up.
  const op = (r.ownOp || cachedOwner(r.hex)?.owner || '').toUpperCase()
  const reg = (r.r ?? '').toUpperCase().replace(/-/g, '')

  // --- Military / government -------------------------------------------
  let mil: string | null = null
  if (typeof r.dbFlags === 'number' && r.dbFlags & 1) mil = 'Flagged as military in the aircraft database'
  else if (hexIn(r.hex, 0xadf7c8, 0xafffff)) mil = 'US military transponder address block'
  else if (hexIn(r.hex, 0x43c000, 0x43cfff)) mil = 'UK military transponder address block'
  else if (callsign) mil = prefixMatch(callsign, MILGOV_CALLSIGNS)
  if (!mil && op) {
    const w = MILGOV_OPERATOR_WORDS.find((x) => op.includes(x))
    if (w) mil = `Operator: ${titleCase(op)}`
  }
  if (!mil && r.category === 'A6') mil = 'High-performance category (usually military jets)'
  if (mil) out.push({ tag: 'milgov', reason: mil })

  // --- Sports ------------------------------------------------------------
  let sport: string | null = SPORTS_REGISTRATIONS[reg] ?? null
  if (!sport && callsign) sport = prefixMatch(callsign, SPORTS_CALLSIGNS)
  if (!sport && op) {
    const w = SPORTS_OPERATOR_WORDS.find((x) => new RegExp(`\\b${x}\\b`).test(op))
    if (w) sport = `Operator: ${titleCase(op)}`
  }
  if (sport) out.push({ tag: 'sports', reason: sport })

  // --- TV news -------------------------------------------------------------
  const heli = r.category === 'A7' || inferCategory(r.t) === 'A7'
  let news: string | null = null
  if (op && !mil) {
    const hit = NEWS_OWNER_WORDS.find(([re]) => re.test(op))
    if (hit) news = `Owned by ${titleCase(op)} (${hit[1]})`
  }
  // Many station helicopters carry "TV" in their tail number (N4TV, N11TV…).
  if (!news && heli && /^N\d{1,3}[A-Z]?TV$/.test(reg)) news = `Tail number ${reg} ends in "TV", a common pick for TV station helicopters`
  if (!news && heli && /^(NEWS|CHOPPER)\d{1,2}$/.test(callsign)) news = `Callsign ${callsign}`
  if (news) out.push({ tag: 'news', reason: heli ? news : `${news}. A station plane, not a helicopter` })

  return out
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
}
