/**
 * What transponder ("squawk") codes mean. A handful are reserved for special
 * situations; almost every other code is a one-off number that air traffic
 * control hands a single flight so it can be told apart on radar.
 */
export type SquawkLevel = 'emergency' | 'special' | 'normal'

export interface SquawkInfo {
  code: string
  title: string
  meaning: string
  where: string
  level: SquawkLevel
}

export const SQUAWKS: SquawkInfo[] = [
  { code: '7500', level: 'emergency', where: 'Worldwide', title: 'Hijack', meaning: 'The aircraft is being hijacked or under unlawful interference.' },
  { code: '7600', level: 'emergency', where: 'Worldwide', title: 'Radio failure', meaning: 'The pilots have lost two-way radio contact with air traffic control.' },
  { code: '7700', level: 'emergency', where: 'Worldwide', title: 'General emergency', meaning: 'Any emergency: engine failure, medical problem, fire, fuel, damage and so on. Everyone gets out of its way.' },
  { code: '1200', level: 'normal', where: 'US & Canada', title: 'VFR, not talking to ATC', meaning: 'Flying by sight under Visual Flight Rules without an assigned code. Typical for small private planes.' },
  { code: '7000', level: 'normal', where: 'Europe & most of the world', title: 'VFR, not talking to ATC', meaning: 'The non-US equivalent of 1200: flying by sight with no assigned code.' },
  { code: '2000', level: 'normal', where: 'Europe & oceanic', title: 'No code assigned yet', meaning: 'Arriving from an area without radar (often over an ocean) and not yet given a code.' },
  { code: '1000', level: 'normal', where: 'Europe', title: 'IFR, tracked by Mode S', meaning: 'Instrument flight that ATC identifies by its Mode S address instead of a unique code.' },
  { code: '1202', level: 'special', where: 'US', title: 'Glider', meaning: 'A glider flying VFR and not talking to ATC.' },
  { code: '1255', level: 'special', where: 'US', title: 'Firefighting', meaning: 'An aircraft fighting a fire.' },
  { code: '1276', level: 'special', where: 'US', title: 'Air defense zone, no contact', meaning: 'Entering an Air Defense Identification Zone without being able to reach ATC.' },
  { code: '1277', level: 'special', where: 'US', title: 'Search and rescue', meaning: 'A VFR aircraft flying a search and rescue mission.' },
  { code: '4000', level: 'special', where: 'US', title: 'Military operations', meaning: 'Military aircraft in restricted or warning areas, or doing frequent quick climbs and descents.' },
  { code: '5000', level: 'special', where: 'US', title: 'NORAD', meaning: 'Reserved for aircraft working with NORAD (North American air defense).' },
  { code: '7777', level: 'special', where: 'US', title: 'Military intercept', meaning: 'Military interceptor operations. Also used by some fixed test transponders.' },
  { code: '7001', level: 'special', where: 'UK', title: 'Military climb-out', meaning: 'A military aircraft climbing suddenly out of low-level flying.' },
  { code: '7004', level: 'special', where: 'UK & Europe', title: 'Aerobatics / display', meaning: 'An aircraft doing aerobatics or flying at an air show.' },
  { code: '7010', level: 'special', where: 'UK', title: 'Airport circuit', meaning: 'Flying VFR in the traffic pattern around an airport.' },
  { code: '0033', level: 'special', where: 'UK', title: 'Parachute drop', meaning: 'An aircraft dropping parachutists.' },
  { code: '0000', level: 'special', where: 'Worldwide', title: 'No code / fault', meaning: 'Usually a transponder that has not been set or is not working properly.' },
]

const BY_CODE = new Map(SQUAWKS.map((s) => [s.code, s]))

export function squawkInfo(code?: string): SquawkInfo | null {
  if (!code) return null
  const known = BY_CODE.get(code)
  if (known) return known
  return {
    code,
    level: 'normal',
    where: '',
    title: 'Assigned by ATC',
    meaning: 'A unique code air traffic control gave this flight so controllers can pick it out on radar. It has no special meaning.',
  }
}
