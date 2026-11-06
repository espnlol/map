import type { Airport, Phase, TimeValue } from '../types'
import { settings } from './settings'

const metres = () => settings.get().altUnit === 'm'

export const fmtAlt = (ft: number | null, onGround: boolean) => {
  if (onGround) return 'Ground'
  if (ft == null) return '—'
  if (metres()) return `${Math.round(ft * 0.3048).toLocaleString()} m`
  return ft >= 18000 ? `FL${Math.round(ft / 100)}` : `${ft.toLocaleString()} ft`
}

export const fmtAltFull = (ft: number | null, onGround: boolean) =>
  onGround ? 'On the ground' : ft == null ? '—' : metres() ? `${Math.round(ft * 0.3048).toLocaleString()} m` : `${Math.round(ft).toLocaleString()} ft`

/** The other altitude unit, as a small secondary line. */
export const fmtAltOther = (ft: number | null) =>
  ft == null ? undefined : metres() ? `${Math.round(ft).toLocaleString()} ft` : `${Math.round(ft * 0.3048).toLocaleString()} m`

const SPEED = { kt: [1, 'kt'], mph: [1.15078, 'mph'], kmh: [1.852, 'km/h'] } as const

export const fmtSpeed = (kt: number | null) => {
  if (kt == null) return '—'
  const [f, u] = SPEED[settings.get().speedUnit]
  return `${Math.round(kt * f)} ${u}`
}

/** A secondary speed line in a different unit from the main one. */
export const fmtMph = (kt: number | null) => {
  if (kt == null) return ''
  return settings.get().speedUnit === 'mph' ? `${Math.round(kt)} kt` : `${Math.round(kt * 1.15078)} mph`
}

export const fmtVr = (fpm: number | null) =>
  fpm == null || Math.abs(fpm) < 64 ? 'Level' : `${fpm > 0 ? '↑' : '↓'} ${Math.abs(Math.round(fpm)).toLocaleString()} ft/min`

export function fmtClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !settings.get().clock24 })
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
