// SkyWatch relay — paste this whole file into a Cloudflare Worker.
//
// The flight-data sites don't let web pages on other websites call them
// directly, so the hosted SkyWatch asks this Worker instead. It only talks to
// the services below, only answers SkyWatch's own websites, and adds the
// "Access-Control-Allow-Origin" header browsers need.

const UPSTREAMS = {
  adsblol: 'https://api.adsb.lol',
  airplaneslive: 'https://api.airplanes.live',
  adsblolglobe: 'https://globe.adsb.lol',
  airplanesliveglobe: 'https://globe.airplanes.live',
  planespotters: 'https://api.planespotters.net',
  hexdb: 'https://hexdb.io',
}

// Websites allowed to use this relay.
const ALLOWED_ORIGINS = [/^https:\/\/espnlol\.github\.io$/, /^http:\/\/localhost(:\d+)?$/]

// How long (seconds) to reuse an answer. Live positions change every few
// seconds; photos and owner records almost never do.
const CACHE_SECONDS = { adsblol: 2, airplaneslive: 2, adsblolglobe: 30, airplanesliveglobe: 30, planespotters: 86400, hexdb: 86400 }

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || ''
    const allowed = ALLOWED_ORIGINS.some((re) => re.test(origin))
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'https://espnlol.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('SkyWatch relay is running.', { headers: { 'Content-Type': 'text/plain', ...cors } })
    }
    if (!allowed) return new Response('Not allowed', { status: 403, headers: cors })
    if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

    // /<name>/<rest of path>
    const [, name, ...rest] = url.pathname.split('/')
    const base = UPSTREAMS[name]
    if (!base) return new Response('Unknown service', { status: 404, headers: cors })
    const target = `${base}/${rest.join('/')}${url.search}`

    const init = {
      method: request.method,
      headers: {
        Accept: request.headers.get('Accept') || 'application/json',
        'User-Agent': 'SkyWatch relay (personal flight tracker)',
        Referer: `${base}/`,
      },
    }
    if (request.method === 'POST') {
      init.headers['Content-Type'] = 'application/json'
      init.body = await request.text()
    } else {
      init.cf = { cacheTtl: CACHE_SECONDS[name] ?? 5, cacheEverything: true }
    }

    let upstream
    try {
      upstream = await fetch(target, init)
    } catch (err) {
      return new Response(`Upstream error: ${err}`, { status: 502, headers: cors })
    }
    const headers = new Headers(cors)
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS[name] ?? 5}`)
    return new Response(upstream.body, { status: upstream.status, headers })
  },
}
