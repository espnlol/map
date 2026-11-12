/**
 * Where to send API requests.
 *
 * - Running from the PC (Start SkyWatch, ports 5173/4173): Vite's built-in
 *   proxy at /proxy/<name>.
 * - The hosted website: the SkyWatch relay (a Cloudflare Worker, see
 *   worker/skywatch-relay.js), because the flight-data sites don't allow
 *   browsers on other websites to call them directly.
 * - Otherwise: the service itself.
 */

/** Set this to your Cloudflare Worker's address, with no slash at the end. */
export const RELAY_URL = 'https://skywatch-relay.thenameisespn.workers.dev'

export const UPSTREAMS = {
  adsblol: 'https://api.adsb.lol',
  airplaneslive: 'https://api.airplanes.live',
  adsblolglobe: 'https://globe.adsb.lol',
  airplanesliveglobe: 'https://globe.airplanes.live',
  planespotters: 'https://api.planespotters.net',
  hexdb: 'https://hexdb.io',
  airportdata: 'https://airport-data.com',
  faa: 'https://nasstatus.faa.gov',
  tfr: 'https://tfr.faa.gov',
} as const

export type UpstreamName = keyof typeof UPSTREAMS

export const runningLocally = () => import.meta.env.DEV || location.port === '4173'

/** Base URL (no trailing slash) for an upstream service. */
export function upstream(name: UpstreamName): string {
  if (runningLocally()) return `/proxy/${name}`
  const relay = relayUrl()
  if (relay) return `${relay}/${name}`
  return UPSTREAMS[name]
}

function relayUrl(): string {
  // ?relay=https://... lets you try a relay before it's built in.
  try {
    const fromQuery = new URLSearchParams(location.search).get('relay')
    if (fromQuery) localStorage.setItem('skywatch.relay', fromQuery)
    const saved = localStorage.getItem('skywatch.relay')
    if (saved) return saved.replace(/\/+$/, '')
  } catch {
    /* storage unavailable */
  }
  return RELAY_URL.replace(/\/+$/, '')
}
