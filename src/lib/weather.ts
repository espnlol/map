/**
 * Local time zone and current weather for a spot, from Open-Meteo
 * (free, no key, allows browser requests).
 */
export interface PlaceInfo {
  timezone: string // IANA, e.g. "Asia/Riyadh"
  offsetSec: number
  tempC: number | null
  code: number | null // WMO weather code
  windKt: number | null
  gustKt: number | null
  visibilityM: number | null
}

const cache = new Map<string, { at: number; p: Promise<PlaceInfo | null> }>()

export function placeInfo(lat: number, lon: number): Promise<PlaceInfo | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.p
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,visibility',
    wind_speed_unit: 'kn',
    timezone: 'auto',
  })
  const p = fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) =>
      j
        ? {
            timezone: j.timezone,
            offsetSec: j.utc_offset_seconds ?? 0,
            tempC: j.current?.temperature_2m ?? null,
            code: j.current?.weather_code ?? null,
            windKt: j.current?.wind_speed_10m ?? null,
            gustKt: j.current?.wind_gusts_10m ?? null,
            visibilityM: j.current?.visibility ?? null,
          }
        : null,
    )
    .catch(() => null)
  cache.set(key, { at: Date.now(), p })
  return p
}

/** "+03 (UTC +03:00)" */
export function fmtOffset(sec: number) {
  const sign = sec < 0 ? '-' : '+'
  const m = Math.abs(Math.round(sec / 60))
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${sign}${hh}${mm !== '00' ? `:${mm}` : ''} (UTC ${sign}${hh}:${mm})`
}

const WMO: [number[], string, string][] = [
  [[0], '☀️', 'Clear'],
  [[1, 2], '🌤️', 'Partly cloudy'],
  [[3], '☁️', 'Cloudy'],
  [[45, 48], '🌫️', 'Fog'],
  [[51, 53, 55, 56, 57], '🌦️', 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Rain'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Snow'],
  [[95, 96, 99], '⛈️', 'Thunderstorms'],
]

export function weatherLabel(code: number | null): { icon: string; text: string } {
  for (const [codes, icon, text] of WMO) if (code != null && codes.includes(code)) return { icon, text }
  return { icon: '', text: '' }
}

export const useFahrenheit = () => /^en-US\b/.test(navigator.language)
export const fmtTemp = (c: number | null) => (c == null ? '' : useFahrenheit() ? `${Math.round(c * 1.8 + 32)}°F` : `${Math.round(c)}°C`)

/** Rough "is the weather a problem for flying" check, used for disruptions. */
export function weatherTrouble(p: PlaceInfo | null): string | null {
  if (!p) return null
  const bits: string[] = []
  if (p.code != null && [95, 96, 99].includes(p.code)) bits.push('thunderstorms')
  if (p.code != null && [71, 73, 75, 77, 85, 86, 66, 67, 56, 57].includes(p.code)) bits.push('snow or ice')
  if (p.code != null && [45, 48].includes(p.code)) bits.push('fog')
  if ((p.gustKt ?? 0) >= 35) bits.push(`gusts ${Math.round(p.gustKt!)} kt`)
  if (p.visibilityM != null && p.visibilityM < 1600) bits.push('low visibility')
  return bits.length ? bits.join(', ') : null
}
