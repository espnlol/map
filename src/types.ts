export type Category = 'Commercial' | 'Cargo' | 'Military / State' | 'General aviation'

export type Cause =
  | 'Mechanical'
  | 'Human error'
  | 'Weather'
  | 'Fire'
  | 'Collision'
  | 'Bird strike'
  | 'Terrorism'
  | 'Shootdown'
  | 'Deliberate'
  | 'Unknown'

export type Phase = 'Taxi' | 'Takeoff' | 'Climb' | 'Cruise' | 'Approach' | 'Landing'

export interface RouteEnd {
  name: string
  lat?: number
  lng?: number
}

export interface Crash {
  /** Wikidata id (Q123) or a hand-written slug for the curated entries */
  id: string
  name: string
  /** ISO date: YYYY-MM-DD, or YYYY-MM / YYYY when only that is known */
  date: string
  lat: number
  lng: number
  /** Crash site as described on Wikipedia */
  location?: string
  /** Country, or the ocean/sea for crashes at sea */
  country: string
  /** Ocean or sea, when the crash happened over water */
  region?: string
  operator?: string
  operators?: string[]
  aircraft?: string
  aircraftTypes?: string[]
  flight?: string
  registration?: string
  /** Deaths, including people on the ground where Wikipedia counts them */
  fatalities?: number
  survivors?: number
  injured?: number
  aboard?: number
  category: Category
  cause: Cause
  phase?: Phase
  /** Wikipedia's one-line summary, or a longer hand-written one */
  summary?: string
  /** What kind of event Wikidata calls it (mid-air collision, bombing, ...) */
  kind?: string
  from?: RouteEnd
  to?: RouteEnd
  /** English Wikipedia article title */
  wiki?: string
  /** Optional specific YouTube video URL; overrides the default search link */
  video?: string
  /** True for the hand-written entries with longer summaries */
  curated?: boolean
}
