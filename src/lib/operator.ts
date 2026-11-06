/**
 * Working out who actually flies an aircraft, from three clues:
 * the callsign, the registered owner's name, and the aircraft type.
 */
import type { Aircraft } from '../types'
import { airlineName } from './owner'

export interface OperatorGuess {
  headline: string
  detail: string
  basis: 'callsign' | 'owner' | 'type' | 'military' | 'none'
}

interface OwnerPattern {
  re: RegExp
  role: string
  detail: string
}

// Order matters: the first match wins.
const OWNER_PATTERNS: OwnerPattern[] = [
  { re: /\b(NETJETS|NET JETS)\b/, role: 'NetJets (fractional ownership)', detail: 'Owned through NetJets, a fractional program: several people or companies each own a share and NetJets pilots fly it for them.' },
  { re: /\b(FLEXJET|FLEX JET)\b/, role: 'Flexjet (fractional ownership)', detail: 'A Flexjet fractional jet: shared by several owners and flown by Flexjet crews.' },
  { re: /\bWHEELS UP\b/, role: 'Wheels Up (private jet membership)', detail: 'A Wheels Up aircraft, flown for its members and charter customers.' },
  { re: /\b(PLANESENSE|AIRSHARE|PLANE SENSE)\b/, role: 'Fractional ownership program', detail: 'Shared by several owners through a fractional program and flown by its pilots.' },
  { re: /\b(WELLS FARGO|BANK OF UTAH|UMB BANK|WILMINGTON TRUST|BANK OF AMERICA|U ?S BANK|AIRCRAFT GUARANTY|SOUTHWEST AIRCRAFT TITLE)\b.*\bTRUST/, role: 'Hidden behind a bank trust', detail: 'Registered to a bank acting as trustee. People and foreign companies do this to keep the real owner private; it is usually a business jet flown by its owner\'s pilots.' },
  { re: /\bTRUSTEE?\b|\bOWNER TRUST\b/, role: 'Hidden behind a trust', detail: 'Registered through a trust, which keeps the real owner private.' },
  { re: /\b(AERCAP|AIR LEASE|AVOLON|SMBC AVIATION|BOC AVIATION|CARLYLE AVIATION|AVIATION CAPITAL|DAE CAPITAL|CASTLELAKE|ALTAVAIR|WILLIS LEASE|AIRCASTLE|LEASING|LESSOR)\b/, role: 'Owned by a leasing company', detail: 'A leasing company owns it and rents it to an airline, which flies it.' },
  { re: /\b(AIR METHODS|PHI AIR MEDICAL|PHI HEALTH|AIR EVAC|LIFE ?FLIGHT|LIFENET|CAREFLIGHT|CARE FLIGHT|MED ?FLIGHT|MEDSTAR|AIRMED|AIR MED|MERCY ?FLIGHT|STAT MEDEVAC|GUARDIAN FLIGHT|BOSTON MEDFLIGHT|HOSPITAL|MEDICAL CENTER|HEALTH SYSTEM)\b/, role: 'Air ambulance', detail: 'A medical helicopter or plane: flight nurses and paramedics fly patients to hospitals.' },
  { re: /\b(POLICE|SHERIFF|HIGHWAY PATROL|STATE PATROL|PUBLIC SAFETY|LAW ENFORCEMENT|CONSTABULARY)\b/, role: 'Police / sheriff aviation', detail: 'Flown by a police or sheriff\'s aviation unit for searches, pursuits and patrols.' },
  { re: /\b(FIRE|CAL FIRE|FORESTRY|FOREST SERVICE|EMERGENCY MANAGEMENT)\b/, role: 'Firefighting / emergency services', detail: 'Used for firefighting, rescue or emergency response.' },
  { re: /\b(COAST GUARD)\b/, role: 'Coast Guard', detail: 'Coast Guard search and rescue or patrol.' },
  { re: /\b(BROADCAST|TELEVISION|TV|NEWS|MEDIA|NBC|ABC|CBS|FOX)\b/, role: 'TV news', detail: 'A news helicopter or plane owned by a broadcaster.' },
  { re: /\b(FLIGHT (SCHOOL|TRAINING|ACADEMY|CENTER)|AVIATION ACADEMY|AERO CLUB|FLYING CLUB|FLIGHT CLUB|PILOT TRAINING|AIRLINE ACADEMY|ATP FLIGHT)\b/, role: 'Flight school / flying club', detail: 'Used to train new pilots or shared by flying-club members.' },
  { re: /\b(UNIVERSITY|COLLEGE|INSTITUTE OF TECHNOLOGY|EMBRY.?RIDDLE|PURDUE)\b/, role: 'University aviation program', detail: 'Owned by a university, usually for its pilot-training program.' },
  { re: /\b(TOURS?|SIGHTSEEING|SCENIC|EXCURSION)\b/, role: 'Sightseeing tours', detail: 'Flies paying passengers on scenic tours.' },
  { re: /\b(SKYDIV|PARACHUT|JUMP)\b/, role: 'Skydiving', detail: 'Takes skydivers up to jump.' },
  { re: /\b(AERIAL SURVEY|SURVEY|MAPPING|AERIAL IMAGING|PHOTOGRAMMETRY|GEOSPATIAL)\b/, role: 'Aerial survey / mapping', detail: 'Flies back-and-forth photo or mapping patterns.' },
  { re: /\b(AG ?AVIATION|CROP|DUSTING|SPRAYING|AGRI)\b/, role: 'Crop dusting', detail: 'Sprays crops at very low altitude.' },
  { re: /\b(CHARTER|AIR CHARTER|JET CHARTER|AIR TAXI)\b/, role: 'Charter operator', detail: 'Rented out with its crew to anyone who books a trip.' },
  { re: /\b(JET MANAGEMENT|AVIATION MANAGEMENT|AIRCRAFT MANAGEMENT|SOLAIRUS|CLAY LACY|JET AVIATION|GAMA AVIATION|EXECUTIVE JET MANAGEMENT)\b/, role: 'Managed jet', detail: 'A management company crews and maintains it for its owner and may charter it out when the owner isn\'t using it.' },
  { re: /\b(UNITED STATES|U S|DEPARTMENT OF|DEPT OF|STATE OF|COUNTY OF|CITY OF|GOVERNMENT|FAA|NASA|NOAA|CUSTOMS)\b/, role: 'Government', detail: 'Owned by a government agency.' },
  { re: /\b(AIRLINES?|AIRWAYS|AIR LINES)\b/, role: 'Airline-owned', detail: 'Owned directly by an airline.' },
  { re: /\b(LLC|L L C|INC|CORP|CORPORATION|HOLDINGS|COMPANY|CO|LTD|LP|PARTNERS)\b/, role: 'A company (corporate or private)', detail: 'Registered to a company. Many are one-plane LLCs that individuals set up to own their aircraft; others are corporate flight departments flying executives.' },
]

export function classifyOwner(owner?: string): { role: string; detail: string } | null {
  if (!owner) return null
  const o = owner.toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ')
  for (const p of OWNER_PATTERNS) if (p.re.test(o)) return { role: p.role, detail: p.detail }
  // A plain name with no company words is usually an individual.
  if (/^[A-Z' -]+$/.test(o) && o.split(' ').length <= 4) return { role: 'A private owner', detail: 'Registered to an individual, who usually flies it themselves.' }
  return null
}

// How aircraft of each type are usually used.
const TYPE_HINTS: [RegExp, string][] = [
  [/^(C150|C152|C172|PA28|P28A|P28B|DA20|DA40|DA42|PA44|BE76|SR20|C162|TECN?)/, 'Planes like this are mostly flown by flight schools and private pilots.'],
  [/^(SR22|BE35|BE36|PA32|PA46|C182|C206|C210|M20)/, 'Usually owned and flown by private pilots, for travel or fun.'],
  [/^(C208|PC12|TBM|KODI|BE20|B350|BE9L|PC6)/, 'Workhorse turboprops: private owners, charters, cargo feeders, skydiving and air ambulance.'],
  [/^(C25|C5|C6|C7|E50P|E55P|PC24|LJ|CL3|CL6|GL|GLF|G280|FA|F2TH|F900|HA4T|H25|SF50|E545|E550)/, 'A business jet: flown for a company\'s executives, a wealthy owner, a charter company or a fractional program.'],
  [/^(R22|R44|R66)/, 'Light Robinson helicopters: flight training, tours, news, police and private owners.'],
  [/^(EC35|EC45|EC30|AS50|AS65|A109|A139|A169|B407|B429|B412|S76|EC55|H160)/, 'Helicopters like this are mostly air ambulances, police, news, offshore oil crews and VIP transport.'],
  [/^(H60|UH1|H47|V22|AH64|UH72)/, 'A military helicopter.'],
  [/^(C130|C30J|C17|C5M|K35R|KC46|A400|E3|E6|P8|R135|U2|B52|B1|F16|F18|F35|F15|F22|T38|T6)/, 'A military aircraft.'],
  [/^(BALL)/, 'A hot-air balloon, usually flying sightseeing passengers.'],
  [/^(GLID|ASK|DG|LS)/, 'A glider, flown for sport at gliding clubs.'],
]

export function typeHint(typeCode?: string): string | null {
  if (!typeCode) return null
  const t = typeCode.toUpperCase()
  for (const [re, hint] of TYPE_HINTS) if (re.test(t)) return hint
  return null
}

const isTailCallsign = (cs: string, reg?: string) => /^N\d[0-9A-Z]{0,4}$/.test(cs) || (!!reg && cs.replace(/-/g, '') === reg.replace(/-/g, '').toUpperCase())

/** The best single answer to "who flies this?", plus why we think so. */
export function guessOperator(a: Aircraft, owner?: string, fileCode?: string): OperatorGuess {
  const cs = a.callsign
  const m = /^([A-Z]{3})(\d{1,4})([A-Z]?)$/.exec(cs)
  const milgov = a.special.find((s) => s.tag === 'milgov')

  if (m) {
    const name = airlineName(m[1])
    if (name)
      return {
        headline: name,
        detail: `Callsign ${cs} is ${name.split(' (')[0]} flight ${Number(m[2])}${m[3]}. The first three letters (${m[1]}) are the airline's code.`,
        basis: 'callsign',
      }
  }
  if (milgov) return { headline: 'Military / government', detail: milgov.reason, basis: 'military' }
  const ownerClass = classifyOwner(owner)
  if (fileCode && airlineName(fileCode)) return { headline: airlineName(fileCode)!, detail: `The aircraft database lists ${fileCode} as its usual operator.`, basis: 'owner' }
  if (ownerClass && ownerClass.role !== 'A company (corporate or private)' && ownerClass.role !== 'A private owner')
    return { headline: ownerClass.role, detail: ownerClass.detail, basis: 'owner' }
  if (m)
    return { headline: `Operator code ${m[1]}`, detail: `The callsign starts with ${m[1]}, a company code SkyWatch doesn't have a name for. Search "${m[1]} ICAO airline code" to look it up.`, basis: 'callsign' }
  const tail = isTailCallsign(cs, a.registration)
  const hint = typeHint(a.typeCode)
  if (ownerClass)
    return {
      headline: ownerClass.role === 'A private owner' ? 'Its private owner' : 'The owning company or its pilots',
      detail: `${ownerClass.detail}${tail ? ' It is flying under its tail number, so this is a private (non-airline) flight.' : ''}${hint ? ` ${hint}` : ''}`,
      basis: 'owner',
    }
  if (hint) return { headline: 'Private / general aviation', detail: `${tail ? 'Flying under its tail number, so this is a private (non-airline) flight. ' : ''}${hint}`, basis: 'type' }
  return {
    headline: 'Not known',
    detail: tail ? 'Flying under its tail number, so this is a private (non-airline) flight. Check the official registry below for the owner.' : 'No airline or owner information is published for this aircraft.',
    basis: 'none',
  }
}
