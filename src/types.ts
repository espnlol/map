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

export type Phase = 'Takeoff' | 'Climb' | 'Cruise' | 'Approach' | 'Landing'

export interface Crash {
  id: string
  name: string
  /** ISO date, YYYY-MM-DD */
  date: string
  lat: number
  lng: number
  location: string
  /** Country (or ocean) where it happened */
  country: string
  operator: string
  aircraft: string
  flight?: string
  fatalities: number
  survivors?: number
  category: Category
  cause: Cause
  phase: Phase
  summary: string
  /** English Wikipedia article title */
  wiki: string
  /** Optional specific YouTube video URL; overrides the default search link */
  video?: string
}
