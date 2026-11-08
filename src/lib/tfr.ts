import { useEffect, useState } from 'react'
import { upstream } from './upstream'

/**
 * FAA Temporary Flight Restrictions (TFRs): the no-fly zones the FAA puts up
 * for presidential visits, wildfires, rocket launches, stadiums and so on.
 *
 * Two free FAA feeds, both through the relay:
 * - the TFR list (number, type, state, short description)
 * - the TFR map service (the shapes, as GeoJSON)
 * Joined by NOTAM number. Parsed carefully, since the FAA changes these feeds
 * now and then.
 */

export type TfrKind = 'vip' | 'security' | 'hazard' | 'space' | 'event' | 'other'

export interface Tfr {
  id: string // NOTAM number, like "5/1234"
  title: string
  type: string // FAA's own label, like "SECURITY"
  kind: TfrKind
  state?: string
  facility?: string
  polygons: [number, number][][] // [lat, lon] rings
  lat?: number
  lon?: number
  url: string
  /** Limits, when the FAA feed includes them (as text, ready to show). */
  start?: string
  end?: string
  lower?: string
  upper?: string
}

export const TFR_KINDS: Record<TfrKind, { label: string; color: string; emoji: string }> = {
  vip: { label: 'VIP / presidential', color: '#ef4444', emoji: '🇺🇸' },
  security: { label: 'Security', color: '#f97316', emoji: '🛡️' },
  hazard: { label: 'Hazard / fire', color: '#f59e0b', emoji: '🔥' },
  space: { label: 'Space launch', color: '#a78bfa', emoji: '🚀' },
  event: { label: 'Event / air show', color: '#38bdf8', emoji: '🏟️' },
  other: { label: 'Restricted', color: '#94a3b8', emoji: '⛔' },
}

const WFS =
  '/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=500&outputFormat=application/json&srsname=EPSG:4326'

type Obj = Record<string, unknown>

/** Case-insensitive property lookup. */
function prop(o: Obj, ...names: string[]): string | undefined {
  for (const k of Object.keys(o)) {
    if (names.includes(k.toLowerCase())) {
      const v = o[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
  }
  return undefined
}

function notamNumber(s: string | undefined): string | undefined {
  return s?.match(/\d{1,2}\/\d{3,5}/)?.[0]
}

export function classify(type: string, text: string): TfrKind {
  const all = `${type} ${text}`.toUpperCase()
  if (/\bVIP\b|PRESIDENT|POTUS|VICE PRESIDENT/.test(all)) return 'vip'
  if (/SPACE|LAUNCH|ROCKET|REENTRY/.test(all)) return 'space'
  if (/HAZARD|FIRE|FIREFIGHT|VOLCAN|DISASTER|FLOOD|HURRICANE|OIL SPILL/.test(all)) return 'hazard'
  if (/SPORT|STADIUM|AIR SHOW|AIRSHOW|SPECIAL EVENT|DEMONSTRATION|PARACHUTE/.test(all)) return 'event'
  if (/SECURITY|91\.141|99\.7|NATIONAL DEFENSE/.test(all)) return 'security'
  return 'other'
}

export const tfrUrl = (id: string) => `https://tfr.faa.gov/tfr3/?page=detail_${id.replace('/', '_')}`

/** Turn one GeoJSON coordinate into [lat, lon], whatever order or projection the feed used. */
export function toLatLon(c: unknown): [number, number] | null {
  if (!Array.isArray(c) || c.length < 2) return null
  const x = Number(c[0])
  const y = Number(c[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    if (Math.abs(x) <= 90 && Math.abs(y) <= 180) return [x, y] // lat, lon with a lon past ±90
    // Web Mercator meters
    const R = 6378137
    const lon = (x / R) * (180 / Math.PI)
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null
  }
  // US airspace: longitudes are west (negative), latitudes north. Swapped axes show up as (+lat, -lon).
  if (x > 0 && y < 0 && x <= 90) return [x, y]
  return [y, x]
}

function ringsOf(geom: Obj | null | undefined): [number, number][][] {
  if (!geom) return []
  const t = String(geom.type || '')
  const coords = geom.coordinates as unknown
  const ring = (r: unknown) => (Array.isArray(r) ? r.map(toLatLon).filter((p): p is [number, number] => !!p) : [])
  if (t === 'Polygon' && Array.isArray(coords)) return [ring(coords[0])].filter((r) => r.length >= 3)
  if (t === 'MultiPolygon' && Array.isArray(coords))
    return coords.map((p) => (Array.isArray(p) ? ring(p[0]) : [])).filter((r) => r.length >= 3)
  if (t === 'GeometryCollection' && Array.isArray(geom.geometries)) return (geom.geometries as Obj[]).flatMap(ringsOf)
  return []
}

/** Combine the list and the shapes into one TFR per NOTAM. */
export function parseTfrs(list: unknown, geo: unknown): Tfr[] {
  const byId = new Map<string, Tfr>()
  const get = (id: string) => {
    let t = byId.get(id)
    if (!t) {
      t = { id, title: '', type: '', kind: 'other', polygons: [], url: tfrUrl(id) }
      byId.set(id, t)
    }
    return t
  }

  const rows: unknown[] = Array.isArray(list) ? list : Array.isArray((list as Obj)?.data) ? ((list as Obj).data as unknown[]) : []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Obj
    const id = notamNumber(prop(o, 'notam_id', 'notam', 'notamid', 'notam_key', 'id'))
    if (!id) continue
    const t = get(id)
    t.type = prop(o, 'type', 'tfr_type') ?? t.type
    t.title = prop(o, 'description', 'title', 'name') ?? t.title
    t.state = prop(o, 'state') ?? t.state
    t.facility = prop(o, 'facility') ?? t.facility
    readLimits(t, o)
  }

  const feats: unknown[] = Array.isArray((geo as Obj)?.features) ? ((geo as Obj).features as unknown[]) : []
  for (const f of feats) {
    if (!f || typeof f !== 'object') continue
    const p = ((f as Obj).properties ?? {}) as Obj
    const id = notamNumber(prop(p, 'notam_key', 'notam_id', 'notam', 'name')) ?? notamNumber(String((f as Obj).id ?? ''))
    if (!id) continue
    const t = get(id)
    t.polygons.push(...ringsOf((f as Obj).geometry as Obj))
    if (!t.title) t.title = prop(p, 'title', 'description', 'legal') ?? ''
    if (!t.type) t.type = prop(p, 'legal', 'type') ?? ''
    if (!t.state) t.state = prop(p, 'state')
    readLimits(t, p)
  }

  const out: Tfr[] = []
  for (const t of byId.values()) {
    t.title = t.title.replace(/\s+/g, ' ')
    t.kind = classify(t.type, t.title)
    const pts = t.polygons.flat()
    if (pts.length) {
      t.lat = pts.reduce((s, p) => s + p[0], 0) / pts.length
      t.lon = pts.reduce((s, p) => s + p[1], 0) / pts.length
    }
    out.push(t)
  }
  const order: TfrKind[] = ['vip', 'space', 'security', 'hazard', 'event', 'other']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Times and altitudes, if the feed has them (field names vary, so match loosely)
// ---------------------------------------------------------------------------

function fmtWhen(v: string): string | undefined {
  const n = Number(v)
  const d = /^\d{12,13}$/.test(v) ? new Date(n) : /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v) : null
  if (!d || Number.isNaN(d.getTime())) return undefined
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtAltitude(v: string): string | undefined {
  const t = v.trim().toUpperCase()
  if (!t) return undefined
  if (/^(SFC|SURFACE|GND|0)$/.test(t)) return 'the ground'
  if (/^\d+$/.test(t)) return `${Number(t).toLocaleString()} ft`
  if (/^FL\s?\d+$/.test(t)) return t.replace(/\s/, '')
  return t.length < 30 ? t.toLowerCase() : undefined
}

function readLimits(t: Tfr, o: Obj) {
  for (const [k, raw] of Object.entries(o)) {
    if (raw == null || typeof raw === 'object') continue
    const key = k.toLowerCase()
    const v = String(raw).trim()
    if (!v || /mod|creat|updat|issue/.test(key)) continue
    if (!t.start && /effective|start|begin/.test(key)) t.start = fmtWhen(v)
    else if (!t.end && /expir|end_|_end|^end|stop/.test(key)) t.end = fmtWhen(v)
    else if (!t.upper && /upper|ceiling|top/.test(key)) t.upper = fmtAltitude(v)
    else if (!t.lower && /lower|floor|bottom/.test(key)) t.lower = fmtAltitude(v)
  }
}

// ---------------------------------------------------------------------------
// Plain-English explanations
// ---------------------------------------------------------------------------

export interface TfrExplanation {
  /** Short, specific name: "Wildfire", "Stadium", "Drones only"… */
  what: string
  /** Why it's there. */
  why: string
  /** Who can and can't fly in it. */
  who: string
  /** What these usually look like. */
  usual?: string
  /** The rule that creates it. */
  rule?: string
}

export function explainTfr(t: Tfr): TfrExplanation {
  const all = `${t.type} ${t.title}`.toUpperCase()
  const drones = /\bUAS\b|UNMANNED|DRONE/.test(all)

  if (t.kind === 'vip')
    return {
      what: /VICE PRESIDENT/.test(all) ? 'Vice President visit' : /PRESIDENT|POTUS/.test(all) ? 'Presidential visit' : 'VIP visit',
      why: 'Protects the President, Vice President or another top official while they travel or stay in the area. These follow the motorcade and Air Force One, so they can appear and disappear within hours.',
      who: 'Usually a 10-nautical-mile inner core where almost all private flying, drones and banner towing are banned, inside a 30-mile outer ring where pilots must file a flight plan, stay in contact with air traffic control and squawk an assigned code. Airline flights at major airports keep flying. Military jets and Coast Guard helicopters intercept planes that stray in.',
      usual: 'Inner core 10 nm, outer ring 30 nm, from the ground up to 17,999 ft.',
      rule: '14 CFR 91.141',
    }

  if (t.kind === 'space')
    return {
      what: /REENTRY|RE-ENTRY|RECOVERY/.test(all) ? 'Spacecraft reentry' : 'Rocket launch',
      why: 'Keeps aircraft out from under the rocket\'s path and the area where debris could fall if something goes wrong.',
      who: 'Closed to all aircraft during the launch window except those working the launch. Airline flights are rerouted around it, which can add delays across Florida and the Atlantic.',
      usual: 'Long corridors stretching offshore along the flight path, active only for the launch window (often a few hours) and moved to a backup day if the launch slips.',
      rule: '14 CFR 91.143',
    }

  if (t.kind === 'hazard') {
    if (/FIRE/.test(all))
      return {
        what: 'Wildfire',
        why: 'Keeps the sky clear for firefighting air tankers, helicopters and spotter planes working low over the fire.',
        who: 'Only aircraft working the fire, plus others with permission from the fire\'s air operations. A single drone flying here can force every firefighting aircraft to land until it\'s gone.',
        usual: 'A few miles around the fire, up to several thousand feet. It grows or moves as the fire does.',
        rule: '14 CFR 91.137',
      }
    if (/HURRICANE|FLOOD|TORNADO|EARTHQUAKE|DISASTER|STORM/.test(all))
      return {
        what: 'Disaster relief',
        why: 'Gives relief and rescue aircraft room to work after a natural disaster.',
        who: 'Relief, rescue and medical flights only. News and sightseeing flights need permission.',
        usual: 'Sized to the disaster area, usually from the ground up to a few thousand feet.',
        rule: '14 CFR 91.137',
      }
    if (/VOLCAN/.test(all))
      return {
        what: 'Volcano',
        why: 'Keeps aircraft away from an erupting or restless volcano. Ash can stop jet engines.',
        who: 'Closed to most aircraft. Scientists\' and authorized flights only.',
        rule: '14 CFR 91.137',
      }
    if (/SEARCH|RESCUE|RECOVERY/.test(all))
      return {
        what: 'Search and rescue',
        why: 'Keeps the area clear for aircraft searching for missing people or recovering a crash.',
        who: 'Search and rescue aircraft only. Others need permission.',
        rule: '14 CFR 91.137',
      }
    if (/CHEMICAL|HAZMAT|GAS|SPILL|EXPLOS|NUCLEAR|RADIA/.test(all))
      return {
        what: 'Hazardous materials',
        why: 'Keeps aircraft away from a chemical spill, gas leak, explosion or similar hazard on the ground.',
        who: 'Closed to aircraft except those responding to the incident.',
        rule: '14 CFR 91.137',
      }
    if (/POLICE|LAW ENFORCEMENT|SECURITY/.test(all))
      return {
        what: 'Police incident',
        why: 'Gives police helicopters room to work over an active incident on the ground.',
        who: 'Police and emergency aircraft only. News helicopters need permission and often orbit just outside.',
        usual: 'Small, often 1–3 nm, up to a few thousand feet, for a few hours.',
        rule: '14 CFR 91.137',
      }
    return {
      what: 'Emergency on the ground',
      why: 'Protects people on the ground or emergency aircraft working an incident (accident, fire, rescue or other emergency).',
      who: 'Emergency and relief aircraft only. Others need permission.',
      usual: 'Usually a few miles wide, up to a few thousand feet.',
      rule: '14 CFR 91.137',
    }
  }

  if (t.kind === 'event') {
    if (/AIR ?SHOW|DEMONSTRATION|AEROBATIC|FLYOVER|PARACHUTE|BLUE ANGELS|THUNDERBIRDS/.test(all))
      return {
        what: /PARACHUTE/.test(all) ? 'Parachute jumping' : 'Air show',
        why: 'Reserves the airspace for performers at an air show or flying demonstration.',
        who: 'Only the performing aircraft and those with permission, during show times.',
        usual: 'A few miles around the show area, active only during performances.',
        rule: '14 CFR 91.145',
      }
    return {
      what: /RACE|SPEEDWAY|NASCAR|INDY/.test(all) ? 'Motor race' : 'Stadium event',
      why: 'Protects big crowds at a major sporting event.',
      who: 'No private planes, banner towers or drones. Broadcast, police and medical aircraft with permission can fly.',
      usual: 'Stadiums with 30,000+ seats for MLB, NFL, NCAA Division I football and major motor races: 3 nm around the venue, up to 3,000 ft above the ground, from 1 hour before to 1 hour after the event.',
      rule: drones ? '14 CFR 99.7' : '14 CFR 99.7 / 91.145',
    }
  }

  if (t.kind === 'security') {
    if (/DISNEY/.test(all))
      return {
        what: 'Disney park',
        why: 'A permanent restriction over Disneyland and Walt Disney World, set up after 9/11.',
        who: 'No private planes, banner towers or drones. Police, medical and some other flights are allowed.',
        usual: '3 nm around the park, up to 3,000 ft above the ground, always active.',
        rule: '14 CFR 99.7',
      }
    if (drones)
      return {
        what: 'Drones only',
        why: 'Keeps drones away from a sensitive site such as a military base, prison, power plant or government facility.',
        who: 'Drones are banned. Regular planes and helicopters can still fly through.',
        usual: 'Usually small, often under 1 nm, up to 400 ft above the ground.',
        rule: '14 CFR 99.7',
      }
    return {
      what: /MILITARY|BASE|NAVAL|ARMY|AIR FORCE/.test(all) ? 'Military security' : 'Security zone',
      why: 'A national security restriction, for example a sensitive site, a major event or a protective operation.',
      who: 'Varies. Read the FAA notice for who can enter and what pilots must do.',
      rule: '14 CFR 99.7',
    }
  }

  return {
    what: 'Flight restriction',
    why: 'A temporary restriction the FAA put up for safety or security.',
    who: 'Pilots need permission to enter. Read the FAA notice for details.',
  }
}

/** Is a point inside the TFR's outline? */
export function insideTfr(t: Tfr, lat: number, lon: number): boolean {
  for (const ring of t.polygons) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i]
      const [yj, xj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    if (inside) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// The full FAA notice: what's actually causing a zone
// ---------------------------------------------------------------------------

export interface TfrDetail {
  /** The notice's stated purpose, in plain case. */
  purpose?: string
  /** Specific causes pulled from the notice: "The Ridge Fire", "SpaceX Falcon 9 launch"… */
  causes: string[]
  /** Who runs it / who to call, if named. */
  inCharge?: string
  place?: string
  start?: string
  end?: string
  upper?: string
  lower?: string
  /** The full notice, lightly cleaned up. */
  text?: string
}

const ACRONYMS = /\b(faa|tfr|vip|uas|notam|atc|artcc|fdc|nm|nmr|ft|msl|agl|utc|usc|cfr|us|usa|nfl|mlb|ncaa|nascar|nhl|nba|mls|ifr|vfr|cal|dod|nasa|noaa|fbi|dhs|tsa|ems|ny|nj|dc|ca|fl|tx|nypd|lapd|lasd|chp|dec|sfs|afb|ula)\b/g

/** NOTAM text is all caps; make it readable. */
export function sentenceCase(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(ACRONYMS, (m) => m.toUpperCase())
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase())
}

const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bOf\b|\bThe\b|\bAnd\b/g, (m, i) => (i ? m.toLowerCase() : m))
    .replace(new RegExp(ACRONYMS.source, 'gi'), (m) => m.toUpperCase())

const STOP = new Set(['THE', 'A', 'AN', 'FOR', 'OF', 'TO', 'AND', 'IN', 'AT', 'ON', 'WITH', 'NEAR', 'BY', 'FROM', 'DUE', 'GAME', 'EVENT', 'IS', 'ARE'])
/** Keep only the words after the last little word ("SAFE ENVIRONMENT FOR" → "", "NFL GAME AT METLIFE" → "METLIFE"). */
function tail(words: string): string {
  const w = words.trim().split(' ')
  let i = w.length
  while (i > 0 && !STOP.has(w[i - 1])) i--
  return w.slice(i).join(' ')
}

const ROCKETS: [RegExp, string][] = [
  [/FALCON ?9/, 'SpaceX Falcon 9'], [/FALCON HEAVY/, 'SpaceX Falcon Heavy'], [/STARSHIP|SUPER HEAVY/, 'SpaceX Starship'],
  [/NEW GLENN/, 'Blue Origin New Glenn'], [/NEW SHEPARD/, 'Blue Origin New Shepard'], [/ATLAS ?V/, 'ULA Atlas V'],
  [/VULCAN/, 'ULA Vulcan'], [/ELECTRON/, 'Rocket Lab Electron'], [/NEUTRON/, 'Rocket Lab Neutron'], [/ANTARES/, 'Northrop Grumman Antares'],
  [/MINOTAUR/, 'Minotaur'], [/\bSLS\b|ARTEMIS/, 'NASA SLS / Artemis'], [/DRAGON/, 'SpaceX Dragon'], [/STARLINER/, 'Boeing Starliner'],
  [/\bMISSILE\b/, 'Missile test'],
]

const EVENTS: [RegExp, string][] = [
  [/SUPER ?BOWL/, 'the Super Bowl'], [/WORLD SERIES/, 'the World Series'], [/\bNFL\b/, 'an NFL game'], [/\bMLB\b|BASEBALL/, 'an MLB game'],
  [/NCAA|COLLEGE FOOTBALL/, 'a college football game'], [/NASCAR/, 'a NASCAR race'], [/INDY ?CAR|INDIANAPOLIS 500|INDY 500/, 'an IndyCar race'],
  [/FORMULA (1|ONE)|\bF1\b|GRAND PRIX/, 'a Formula 1 race'], [/KENTUCKY DERBY/, 'the Kentucky Derby'], [/MARATHON/, 'a marathon'],
  [/PARADE/, 'a parade'], [/CONCERT|FESTIVAL/, 'a concert or festival'], [/GRADUATION|COMMENCEMENT/, 'a graduation'],
  [/UNITED NATIONS|UN GENERAL ASSEMBLY|UNGA/, 'the UN General Assembly'], [/STATE OF THE UNION/, 'the State of the Union'],
  [/INAUGURATION/, 'the inauguration'], [/G7|G20|SUMMIT/, 'a summit'], [/CONVENTION/, 'a convention'], [/FUNERAL|MEMORIAL/, 'a memorial or funeral'],
]

const INCIDENTS: [RegExp, string][] = [
  [/AIRCRAFT (ACCIDENT|CRASH)|PLANE CRASH/, 'an aircraft accident'], [/BUILDING COLLAPSE/, 'a building collapse'], [/BRIDGE COLLAPSE/, 'a bridge collapse'],
  [/CHEMICAL (SPILL|RELEASE|FIRE)|HAZMAT|HAZARDOUS MATERIAL/, 'a hazardous-materials incident'], [/GAS (LEAK|EXPLOSION)|PIPELINE/, 'a gas or pipeline incident'],
  [/TRAIN DERAIL|DERAILMENT/, 'a train derailment'], [/OIL SPILL/, 'an oil spill'], [/SEARCH AND RESCUE|\bSAR\b/, 'search and rescue'],
  [/LAW ENFORCEMENT/, 'law enforcement activity'], [/VOLCANIC|ERUPTION/, 'volcanic activity'], [/FLOOD/, 'flooding'],
  [/PRESCRIBED (BURN|FIRE)|CONTROLLED BURN/, 'a prescribed (controlled) burn'], [/DEMOLITION|IMPLOSION/, 'a demolition'],
  [/HURRICANE ([A-Z]+)/, ''], [/TROPICAL STORM ([A-Z]+)/, ''],
]

/** Pull the specific causes out of a notice's text. */
export function findCauses(raw: string, t?: Tfr): { causes: string[]; inCharge?: string; purpose?: string } {
  const u = raw.toUpperCase().replace(/\s+/g, ' ')
  const causes: string[] = []
  const add = (c: string) => c && !causes.includes(c) && causes.push(c)

  // Named fires: "THE RIDGE FIRE", "DIXIE COMPLEX"
  for (const m of u.matchAll(/\b([A-Z][A-Z0-9'-]*(?: [A-Z][A-Z0-9'-]*){0,3}) (FIRE|COMPLEX)\b/g)) {
    if (/^ ?(FIGHT|SUPPRESS|DEPARTMENT|DEPT|RESCUE|AIRCRAFT|OPERATIONS|TRAINING)/.test(u.slice((m.index ?? 0) + m[0].length))) continue
    const name = tail(m[1])
    if (!name || /^(WILD|BRUSH|FOREST|SUPPORT|ACTIVE|STRUCTURE|GRASS|LARGE|PRESCRIBED|CONTROLLED|VEHICLE|HOUSE|BUILDING)$/.test(name)) continue
    if (/(FIGHTING|SUPPRESSION|RELIEF|AIRCRAFT|OPERATIONS)$/.test(name)) continue
    add(`The ${title(name)} ${m[2] === 'COMPLEX' ? 'Complex fire' : 'Fire'}`)
  }
  for (const [re, label] of ROCKETS) if (re.test(u)) add(/test/.test(label) ? label : `${label} ${/REENTRY|RE-ENTRY|RECOVERY|SPLASHDOWN/.test(u) ? 'return' : 'launch'}`)
  for (const [re, label] of EVENTS) if (re.test(u)) add(`For ${label}`)
  for (const [re, label] of INCIDENTS) {
    const m = u.match(re)
    if (m) add(label ? `Because of ${label}` : `Because of ${title(m[0])}`)
  }
  // Venue: "AT METLIFE STADIUM", "DAYTONA INTERNATIONAL SPEEDWAY"
  const venue = u.match(/\b((?:[A-Z][A-Z.&'-]*\s){0,4}(?:STADIUM|SPEEDWAY|FIELD|ARENA|BALLPARK|RACEWAY|MOTOR SPEEDWAY|COLISEUM|BOWL|DOME))\b/)
  const venueName = venue ? tail(venue[1].trim()) : ''
  if (venueName && venueName.includes(' ') && (t?.kind === 'event' || t?.kind === 'security') && !/AIRFIELD|AIRPORT/.test(venueName)) add(`At ${title(venueName)}`)
  if (/VIP MOVEMENT|VIP/.test(u) && t?.kind === 'vip') add(/VICE PRESIDENT/.test(u) ? 'Vice Presidential movement' : 'VIP movement (usually the President)')
  if (/\bUAS\b|UNMANNED/.test(u) && !causes.length) add('Drone (UAS) restriction')

  const purposeM = u.match(/(TO PROVIDE A SAFE ENVIRONMENT FOR [^.]+|DUE TO [^.]{8,140}|FOR THE PURPOSE OF [^.]+|TO PROTECT [^.]+)/)
  const chargeM = u.match(/UNDER (?:THE )?DIRECTION OF ([^.]{4,90}?)(?: ARE AUTHORIZED| IS AUTHORIZED|\.|,| TELEPHONE| PHONE| FREQ)/) ?? u.match(/(?:^|\. )([A-Z][A-Z .&'-]{3,60}?) IS IN CHARGE OF THE ON SCENE EMERGENCY RESPONSE/)
  return {
    causes,
    purpose: purposeM ? sentenceCase(purposeM[1]) + '.' : undefined,
    inCharge: chargeM ? title(chargeM[1].trim()) : undefined,
  }
}

function xmlField(doc: Document, ...names: string[]): string | undefined {
  const wanted = names.map((n) => n.toLowerCase())
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (wanted.includes(el.localName.toLowerCase()) && el.textContent?.trim()) return el.textContent.trim()
  }
  return undefined
}

function parseDetail(body: string, t?: Tfr): TfrDetail | null {
  let text = ''
  let d: Partial<TfrDetail> = {}
  if (/^\s*</.test(body) && /<\?xml|<XNOTAM|<Group|<Not/i.test(body.slice(0, 500))) {
    const doc = new DOMParser().parseFromString(body, 'text/xml')
    text = xmlField(doc, 'txtDescrUSNS', 'txtDescrTraditional', 'txtDescrModern') ?? ''
    const purpose = xmlField(doc, 'txtDescrPurpose')
    const upperVal = xmlField(doc, 'valDistVerUpper')
    const lowerVal = xmlField(doc, 'valDistVerLower')
    const upperRef = xmlField(doc, 'codeDistVerUpper')
    const lowerRef = xmlField(doc, 'codeDistVerLower')
    const ref = (r?: string) => (r === 'HEI' ? ' above the ground' : r === 'ALT' ? ' above sea level' : '')
    const city = [xmlField(doc, 'txtNameCity'), xmlField(doc, 'txtNameUSState')].filter(Boolean).join(', ')
    d = {
      purpose: purpose ? sentenceCase(purpose) : undefined,
      place: city ? title(city) : undefined,
      start: (() => { const v = xmlField(doc, 'dateEffective'); return v ? fmtWhen(v.endsWith('Z') ? v : v + 'Z') ?? v : undefined })(),
      end: (() => { const v = xmlField(doc, 'dateExpire'); return v ? fmtWhen(v.endsWith('Z') ? v : v + 'Z') ?? v : undefined })(),
      upper: upperVal ? (fmtAltitude(upperVal) ?? upperVal) + ref(upperRef) : undefined,
      lower: lowerVal ? (fmtAltitude(lowerVal) ?? lowerVal) + (lowerVal === '0' ? '' : ref(lowerRef)) : undefined,
    }
    if (!text) text = Array.from(doc.getElementsByTagName('*')).map((e) => (e.children.length ? '' : e.textContent ?? '')).sort((a, b) => b.length - a.length)[0] ?? ''
  } else {
    // HTML or plain text
    text = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    try {
      const j = JSON.parse(body)
      if (typeof j === 'string') text = j
      else if (j && typeof j === 'object') text = Object.values(j).filter((v) => typeof v === 'string').sort((a, b) => (b as string).length - (a as string).length)[0] as string
    } catch {
      /* not JSON */
    }
  }
  text = text.trim()
  if (!text && !d.purpose) return null
  const found = findCauses(`${d.purpose ?? ''} ${text}`, t)
  return {
    ...d,
    causes: found.causes,
    inCharge: found.inCharge,
    purpose: (() => {
      const pur = d.purpose ?? found.purpose
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z ]/g, '').trim()
      // Skip a purpose that just repeats a cause ("VIP movement").
      return pur && !found.causes.some((c) => norm(c).includes(norm(pur)) || norm(pur).length < 16) ? pur : undefined
    })(),
    text: text ? sentenceCase(text) : undefined,
  }
}

const details = new Map<string, Promise<TfrDetail | null>>()

/** The full notice for one TFR, with its causes pulled out. Cached. */
export function fetchTfrDetail(t: Tfr): Promise<TfrDetail | null> {
  let p = details.get(t.id)
  if (!p) {
    const base = upstream('tfr')
    const get = async (path: string) => {
      const r = await fetch(base + path)
      if (!r.ok) throw new Error(String(r.status))
      return r.text()
    }
    p = get(`/save_pages/detail_${t.id.replace('/', '_')}.xml`)
      .catch(() => get(`/tfrapi/getWebText?notamId=${encodeURIComponent(t.id)}`))
      .then((body) => parseDetail(body, t))
      .catch(() => {
        details.delete(t.id) // try again next time
        return null
      })
    details.set(t.id, p)
  }
  return p
}

/** Causes we can tell from the short description alone (before the full notice loads). */
export const quickCauses = (t: Tfr) => findCauses(`${t.type} ${t.title}`, t).causes

/** What live traffic says about a zone: presidential planes nearby, who's inside. */
export function liveContext<A extends { callsign: string; typeCode?: string; lat: number; lon: number; onGround: boolean }>(t: Tfr, aircraft: A[]): { notes: string[]; inside: A[] } {
  const notes: string[] = []
  if (t.kind === 'vip' && t.lat != null && t.lon != null) {
    const vip = aircraft.filter(
      (a) =>
        (/^(AF1|AF2|SAM\d|EXEC1F|EXEC2F|VENUS)/.test(a.callsign) || ['VC25', 'C32', 'C40', 'B748'].includes(a.typeCode ?? '') && /^(AF|SAM|EXEC|VENUS)/.test(a.callsign)) &&
        Math.abs(a.lat - t.lat!) < 1.2 && Math.abs(a.lon - t.lon!) < 1.6,
    )
    for (const a of vip.slice(0, 3))
      notes.push(`${a.callsign === 'AF1' ? 'Air Force One' : a.callsign === 'AF2' ? 'Air Force Two' : `VIP jet ${a.callsign}`} is ${a.onGround ? 'on the ground' : 'flying'} nearby`)
  }
  const inside = t.polygons.length ? aircraft.filter((a) => !a.onGround && insideTfr(t, a.lat, a.lon)) : []
  const fireFighting = inside.filter((a) => ['C130', 'DC10', 'B737', 'RJ85', 'B462', 'B463', 'S2P', 'S2T', 'AT8T', 'AT802', 'CL2T', 'CL415', 'DH8D', 'S64', 'H64', 'K-MAX', 'KMAX', 'UH60', 'H60', 'B212', 'B412'].includes(a.typeCode ?? ''))
  if (t.kind === 'hazard' && fireFighting.length) notes.push(`${fireFighting.length} likely firefighting aircraft inside right now (${fireFighting.slice(0, 3).map((a) => a.callsign).join(', ')})`)
  return { notes, inside }
}

let cache: { at: number; data: Tfr[] } | null = null

export async function fetchTfrs(force = false): Promise<Tfr[]> {
  if (!force && cache && Date.now() - cache.at < 10 * 60_000) return cache.data
  const base = upstream('tfr')
  const get = async (path: string) => {
    const r = await fetch(base + path, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`TFR ${r.status}`)
    return r.json()
  }
  const [list, geo] = await Promise.allSettled([get('/tfrapi/exportTfrList'), get(WFS)])
  if (list.status === 'rejected' && geo.status === 'rejected') throw list.reason
  const data = parseTfrs(list.status === 'fulfilled' ? list.value : [], geo.status === 'fulfilled' ? geo.value : null)
  cache = { at: Date.now(), data }
  return data
}

/** TFRs, refreshed every 15 minutes while `enabled`. `null` = couldn't load. */
export function useTfrs(enabled: boolean): Tfr[] | null {
  const [tfrs, setTfrs] = useState<Tfr[] | null>([])
  useEffect(() => {
    if (!enabled) return
    let stop = false
    const load = () =>
      fetchTfrs()
        .then((t) => !stop && setTfrs(t))
        .catch(() => !stop && setTfrs((prev) => (prev && prev.length ? prev : null)))
    load()
    const id = setInterval(load, 15 * 60_000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [enabled])
  return enabled ? tfrs : []
}

/** TFRs whose outline is within `nm` nautical miles of a point (by center, rough). */
export function tfrsNear(tfrs: Tfr[], lat: number, lon: number, nm: number): Tfr[] {
  const r = nm / 60
  return tfrs.filter((t) => t.lat != null && t.lon != null && Math.abs(t.lat - lat) < r && Math.abs(t.lon - lon) < r / Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
}
