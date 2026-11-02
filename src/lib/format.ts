import type { Airport, Phase, TimeValue } from '../types'

export const fmtAlt = (ft: number | null, onGround: boolean) =>
  onGround ? 'Ground' : ft == null ? '—' : ft >= 18000 ? `FL${Math.round(ft / 100)}` : `${ft.toLocaleString()} ft`

export const fmtAltFull = (ft: number | null, onGround: boolean) =>
  onGround ? 'On the ground' : ft == null ? '—' : `${Math.round(ft).toLocaleString()} ft`

export const fmtSpeed = (kt: number | null) => (kt == null ? '—' : `${Math.round(kt)} kt`)
export const fmtMph = (kt: number | null) => (kt == null ? '' : `${Math.round(kt * 1.15078)} mph`)

export const fmtVr = (fpm: number | null) =>
  fpm == null || Math.abs(fpm) < 64 ? 'Level' : `${fpm > 0 ? '↑' : '↓'} ${Math.abs(Math.round(fpm)).toLocaleString()} ft/min`

export function fmtClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtRelative(ms: number, now = Date.now()) {
  const mins = Math.round((ms - now) / 60000)
  if (Math.abs(mins) < 1) return 'now'
  const abs = Math.abs(mins)
  const s = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`
  return mins > 0 ? `in ${s}` : `${s} ago`
}

export function fmtTime(t: TimeValue | null) {
  if (!t) return null
  return { clock: fmtClock(t.at), rel: fmtRelative(t.at), kind: t.kind }
}

export const airportCode = (a?: Airport) => a?.iata || a?.icao || '???'
export const airportName = (a?: Airport) => [a?.name, a?.location && a.location !== a.name ? a.location : null].filter(Boolean).join(' · ')

export const PHASE_LABEL: Record<Phase, string> = {
  ground: 'On ground',
  takeoff: 'Taking off',
  climb: 'Climbing',
  cruise: 'Cruising',
  descent: 'Descending',
  approach: 'On approach',
  unknown: 'Unknown',
}
