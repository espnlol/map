export interface CategoryInfo {
  code: string
  label: string
  short: string
  color: string
  description: string
}

/** ADS-B emitter categories (DO-260B), grouped the way people think about them. */
export const CATEGORIES: CategoryInfo[] = [
  { code: 'A1', short: 'Light', label: 'Light aircraft', color: '#22d3ee', description: 'Under 15,500 lb — Cessnas, Pipers, small private planes' },
  { code: 'A2', short: 'Small', label: 'Small', color: '#34d399', description: '15,500–75,000 lb — regional jets, turboprops, business jets' },
  { code: 'A3', short: 'Large', label: 'Large', color: '#facc15', description: '75,000–300,000 lb — 737, A320 family, most airliners' },
  { code: 'A4', short: 'B757', label: 'High-vortex large', color: '#fb923c', description: 'Boeing 757 class (large wake turbulence)' },
  { code: 'A5', short: 'Heavy', label: 'Heavy', color: '#f472b6', description: 'Over 300,000 lb — 777, 787, A350, 747, A380' },
  { code: 'A6', short: 'High perf', label: 'High performance', color: '#a78bfa', description: 'Over 5g and 400 kt — mostly military jets' },
  { code: 'A7', short: 'Rotorcraft', label: 'Helicopter', color: '#60a5fa', description: 'Helicopters and other rotorcraft' },
  { code: 'B1', short: 'Glider', label: 'Glider / sailplane', color: '#a3e635', description: 'Gliders and sailplanes' },
  { code: 'B2', short: 'Balloon', label: 'Lighter-than-air', color: '#e879f9', description: 'Balloons and airships' },
  { code: 'B4', short: 'Ultralight', label: 'Ultralight', color: '#2dd4bf', description: 'Ultralights, hang gliders, paragliders' },
  { code: 'B6', short: 'Drone', label: 'UAV / drone', color: '#f87171', description: 'Unmanned aerial vehicles' },
  { code: 'C', short: 'Ground', label: 'Ground vehicle', color: '#94a3b8', description: 'Airport surface vehicles and obstacles' },
  { code: '?', short: 'Unknown', label: 'Unknown', color: '#cbd5e1', description: 'Aircraft not broadcasting a category' },
]

/** Normalise a raw category to one of the CATEGORIES codes. */
export function categoryKey(raw: string | undefined): string {
  if (!raw) return '?'
  if (raw.startsWith('C')) return 'C'
  if (raw === 'B3') return 'B4' // parachutist → lump with ultralight/sport
  if (raw === 'B7') return 'A6' // space/trans-atmospheric → high performance
  if (CATEGORIES.some((c) => c.code === raw)) return raw
  return '?'
}

export function categoryInfo(raw: string | undefined): CategoryInfo {
  const key = categoryKey(raw)
  return CATEGORIES.find((c) => c.code === key) ?? CATEGORIES[CATEGORIES.length - 1]
}
