/** Raw aircraft record as returned by readsb-style APIs (adsb.lol / airplanes.live). */
export interface RawAircraft {
  hex: string
  flight?: string
  r?: string // registration
  t?: string // ICAO type designator, e.g. B738
  desc?: string // long type description when the feed has it
  ownOp?: string
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number // ground speed, knots
  tas?: number
  mach?: number
  track?: number
  true_heading?: number
  baro_rate?: number
  geom_rate?: number
  squawk?: string
  emergency?: string
  category?: string
  lat?: number
  lon?: number
  seen?: number
  seen_pos?: number
  dbFlags?: number
}

export interface Airport {
  iata?: string
  icao?: string
  name?: string
  location?: string
  countryiso2?: string
  lat?: number
  lon?: number
}

export interface Route {
  origin?: Airport
  destination?: Airport
  /** false when the route database itself thinks the match is implausible. */
  plausible: boolean
  /** Every stop when one flight number makes several (A → B → C), and which leg this is. */
  stops?: Airport[]
  leg?: number
}

export type Phase = 'ground' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'approach' | 'unknown'

export interface TimeValue {
  at: number // epoch ms
  kind: 'observed' | 'estimated'
}

export interface Aircraft {
  hex: string
  callsign: string
  registration?: string
  typeCode?: string
  model?: string
  operator?: string
  category: string // A0..C7 or '' for unknown
  lat: number
  lon: number
  altitude: number | null // ft, null when on ground
  onGround: boolean
  groundSpeed: number | null // kt
  track: number | null
  verticalRate: number | null // ft/min
  squawk?: string
  emergency: EmergencyInfo | null
  lastSeen: number // epoch ms
  phase: Phase
  takeoff: TimeValue | null
  touchdown: TimeValue | null
  route?: Route
  /** [lat, lon, altitude ft or null on the ground, time] seen while SkyWatch was open */
  trail: [number, number, number | null, number?][]
  special: import('./lib/special').SpecialMatch[]
}

export interface EmergencyInfo {
  code: string
  label: string
  detail: string
}

export interface FlightEvent {
  id: string
  at: number
  hex: string
  callsign: string
  kind: 'takeoff' | 'landing' | 'emergency'
  text: string
}

export interface Center {
  lat: number
  lon: number
  label: string
}
