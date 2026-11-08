import type { Cause } from './types'

export const CAUSE_COLORS: Record<Cause, string> = {
  Mechanical: '#f59e0b',
  'Human error': '#3b82f6',
  Weather: '#06b6d4',
  Fire: '#f97316',
  Collision: '#a855f7',
  'Bird strike': '#84cc16',
  Terrorism: '#ef4444',
  Shootdown: '#e11d48',
  Deliberate: '#ec4899',
  Unknown: '#9ca3af',
}

export function radiusFor(fatalities: number): number {
  return 5 + Math.sqrt(fatalities) * 0.75
}

export function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

