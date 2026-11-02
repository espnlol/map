import type { EmergencyInfo } from '../types'

const BY_SQUAWK: Record<string, EmergencyInfo> = {
  '7500': { code: '7500', label: 'Hijack', detail: 'Squawking 7500 — unlawful interference' },
  '7600': { code: '7600', label: 'Radio failure', detail: 'Squawking 7600 — lost communications' },
  '7700': { code: '7700', label: 'General emergency', detail: 'Squawking 7700 — general emergency' },
}

const BY_FIELD: Record<string, EmergencyInfo> = {
  general: { code: 'general', label: 'General emergency', detail: 'ADS-B emergency status: general' },
  lifeguard: { code: 'lifeguard', label: 'Medical / lifeguard', detail: 'ADS-B emergency status: lifeguard (medical priority)' },
  minfuel: { code: 'minfuel', label: 'Minimum fuel', detail: 'ADS-B emergency status: minimum fuel' },
  nordo: { code: 'nordo', label: 'Radio failure', detail: 'ADS-B emergency status: no communications' },
  unlawful: { code: 'unlawful', label: 'Hijack', detail: 'ADS-B emergency status: unlawful interference' },
  downed: { code: 'downed', label: 'Downed aircraft', detail: 'ADS-B emergency status: downed aircraft' },
}

export function detectEmergency(squawk?: string, field?: string): EmergencyInfo | null {
  if (field && field !== 'none' && BY_FIELD[field]) return BY_FIELD[field]
  if (squawk && BY_SQUAWK[squawk]) return BY_SQUAWK[squawk]
  return null
}
