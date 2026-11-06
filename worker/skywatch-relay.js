// SkyWatch relay — paste this whole file into your Cloudflare Worker.
//
// 1. Relay: the flight-data sites don't let web pages on other websites call
//    them directly, so the hosted SkyWatch asks this Worker instead. It only
//    talks to the services below and only answers SkyWatch's own websites.
// 2. Accounts (optional, needs the same KV): sign in to keep your logbook,
//    teams and emergency history safe and on every device.
// 3. Background checks (optional): with a KV namespace bound as SKYWATCH and a
//    cron trigger, it checks your team planes, emergencies near home and rare
//    planes every few minutes and sends notifications to your phone, even when
//    SkyWatch is closed.

const UPSTREAMS = {
  adsblol: 'https://api.adsb.lol',
  airplaneslive: 'https://api.airplanes.live',
  adsblolglobe: 'https://globe.adsb.lol',
  airplanesliveglobe: 'https://globe.airplanes.live',
  planespotters: 'https://api.planespotters.net',
  hexdb: 'https://hexdb.io',
  airportdata: 'https://www.airport-data.com',
  faa: 'https://nasstatus.faa.gov',
}

// Websites allowed to use this relay.
const ALLOWED_ORIGINS = [/^https:\/\/espnlol\.github\.io$/, /^http:\/\/localhost(:\d+)?$/]

// How long (seconds) to reuse an answer.
const CACHE_SECONDS = { adsblol: 2, airplaneslive: 2, adsblolglobe: 30, airplanesliveglobe: 30, planespotters: 86400, hexdb: 86400, airportdata: 86400, faa: 120 }
// Worldwide lookups (rare types, a tail number) change slowly; share them for a minute.
const SLOW_PATHS = /^\/v2\/(type|reg|callsign|hex|mil|sqk)\b/

const APP_URL = 'https://espnlol.github.io/map/'
const UA = 'SkyWatch relay (personal flight tracker)'

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
      const bg = env.SKYWATCH ? 'Background checks: set up.' : 'Background checks: not set up (no SKYWATCH KV binding).'
      return new Response(`SkyWatch relay is running.\n${bg}`, { headers: { 'Content-Type': 'text/plain', ...cors } })
    }
    if (!allowed) return new Response('Not allowed', { status: 403, headers: cors })

    if (url.pathname.startsWith('/push/')) return handlePush(request, url, env, cors)
    if (url.pathname.startsWith('/account/')) return handleAccount(request, url, env, cors)

    if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
    const [, name, ...rest] = url.pathname.split('/')
    const base = UPSTREAMS[name]
    if (!base) return new Response('Unknown service', { status: 404, headers: cors })
    const path = '/' + rest.join('/')
    const target = `${base}${path}${url.search}`
    const ttl = SLOW_PATHS.test(path) ? 60 : CACHE_SECONDS[name] ?? 5

    const init = { method: request.method, headers: { Accept: request.headers.get('Accept') || 'application/json', 'User-Agent': UA, Referer: `${base}/` } }
    if (request.method === 'POST') {
      init.headers['Content-Type'] = 'application/json'
      init.body = await request.text()
    } else {
      init.cf = { cacheTtl: ttl, cacheEverything: true }
    }
    let upstream
    try {
      upstream = await fetch(target, init)
    } catch (err) {
      return new Response(`Upstream error: ${err}`, { status: 502, headers: cors })
    }
    const headers = new Headers(cors)
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
    headers.set('Cache-Control', `public, max-age=${ttl}`)
    return new Response(upstream.body, { status: upstream.status, headers })
  },

  async scheduled(event, env, ctx) {
    if (env.SKYWATCH) ctx.waitUntil(runChecks(env))
  },
}

// ---------------------------------------------------------------------------
// Push endpoints used by the app
// ---------------------------------------------------------------------------

async function handlePush(request, url, env, cors) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const kv = env.SKYWATCH
  if (!kv) return json({ error: 'Background checks are not set up on the relay yet (no SKYWATCH KV binding).' }, 501)
  const route = url.pathname.slice('/push/'.length)

  if (route === 'key') return json({ publicKey: (await getVapid(kv)).publicKey })

  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
  const token = body.token || url.searchParams.get('token') || ''
  const owner = await kv.get('owner')

  if (route === 'register') {
    if (owner && token !== owner) {
      // A signed-in profile can re-link after a reinstall. The first profile to do
      // this becomes the relay's owner profile; after that only it can re-link.
      const user = body.session ? await kv.get(`session:${body.session}`) : null
      const ownerUser = await kv.get('ownerUser')
      if (!user || (ownerUser && ownerUser !== user))
        return json({ error: 'This relay is linked to another device. Sign in to your profile (Settings → Profile) and try again, or enter that device\'s link code.' }, 403)
      if (!ownerUser) await kv.put('ownerUser', user)
    }
    const newOwner = owner || randomToken()
    if (!owner) await kv.put('owner', newOwner)
    if (!owner && body.session) {
      const user = await kv.get(`session:${body.session}`)
      if (user && !(await kv.get('ownerUser'))) await kv.put('ownerUser', user)
    }
    if (body.subscription?.endpoint) {
      const subs = (await kv.get('subs', 'json')) || []
      const others = subs.filter((s) => s.endpoint !== body.subscription.endpoint)
      await kv.put('subs', JSON.stringify([...others, body.subscription].slice(-5)))
    }
    return json({ token: newOwner })
  }

  if (!owner || token !== owner) return json({ error: 'Not linked to this relay' }, 403)

  if (route === 'config') {
    await kv.put('config', JSON.stringify(body.config || {}))
    return json({ ok: true })
  }
  if (route === 'state') {
    const state = (await kv.get('state', 'json')) || {}
    const subs = (await kv.get('subs', 'json')) || []
    return json({ ...state, devices: subs.length })
  }
  if (route === 'test') {
    const sent = await notifyAll(kv, [{ title: 'SkyWatch', body: 'Notifications are working ✈', url: APP_URL, tag: 'test' }])
    return json({ sent })
  }
  if (route === 'unregister') {
    const subs = (await kv.get('subs', 'json')) || []
    await kv.put('subs', JSON.stringify(subs.filter((s) => s.endpoint !== body.endpoint)))
    return json({ ok: true })
  }
  return json({ error: 'Unknown' }, 404)
}

// ---------------------------------------------------------------------------
// Accounts: keep a person's logbook, teams and emergency history safe.
//
// The app stretches the password on the phone (PBKDF2, 150,000 rounds) and
// sends only that result ("proof"); the relay stores a salted SHA-256 of it.
// So the password never leaves the phone and the stored value can't be
// turned back into it. Sessions are random tokens that expire after 180 days.
// ---------------------------------------------------------------------------

const SESSION_TTL = 180 * 24 * 3600
const MAX_FAILS = 10

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function handleAccount(request, url, env, cors) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const kv = env.SKYWATCH
  if (!kv) return json({ error: 'Accounts need the SKYWATCH storage on the relay.' }, 501)
  const route = url.pathname.slice('/account/'.length)
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}

  if (route === 'signup' || route === 'login') {
    const name = String(body.username || '').trim().toLowerCase()
    const proof = String(body.proof || '')
    if (!/^[a-z0-9_.-]{3,24}$/.test(name)) return json({ error: 'Usernames are 3–24 letters, numbers, dots, dashes or underscores.' }, 400)
    if (!/^[A-Za-z0-9_-]{40,}$/.test(proof)) return json({ error: 'Bad sign-in request.' }, 400)
    const key = `user:${name}`
    const user = await kv.get(key, 'json')
    if (route === 'signup') {
      if (user) return json({ error: 'That username is taken. Pick another, or sign in.' }, 409)
      const salt = randomToken()
      await kv.put(key, JSON.stringify({ name, salt, verifier: await sha256hex(salt + proof), created: Date.now() }))
    } else {
      if (!user) return json({ error: 'No profile with that username.' }, 404)
      const failsKey = `fails:${name}`
      const fails = Number((await kv.get(failsKey)) || 0)
      if (fails >= MAX_FAILS) return json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, 429)
      if (!sameString(await sha256hex(user.salt + proof), user.verifier)) {
        await kv.put(failsKey, String(fails + 1), { expirationTtl: 900 })
        return json({ error: 'Wrong password.' }, 401)
      }
      if (fails) await kv.delete(failsKey)
    }
    const token = randomToken() + randomToken()
    await kv.put(`session:${token}`, name, { expirationTtl: SESSION_TTL })
    return json({ token, username: name })
  }

  const token = body.token || url.searchParams.get('token') || ''
  const name = token ? await kv.get(`session:${token}`) : null
  if (!name) return json({ error: 'Signed out. Please sign in again.' }, 401)

  if (route === 'data' && request.method === 'GET') {
    return json((await kv.get(`data:${name}`, 'json')) || { updatedAt: 0 })
  }
  if (route === 'data' && request.method === 'POST') {
    const data = body.data || {}
    const text = JSON.stringify({ ...data, updatedAt: Date.now() })
    if (text.length > 5_000_000) return json({ error: 'Too much data to save.' }, 413)
    await kv.put(`data:${name}`, text)
    return json({ ok: true })
  }
  if (route === 'logout') {
    await kv.delete(`session:${token}`)
    return json({ ok: true })
  }
  if (route === 'delete') {
    await Promise.all([kv.delete(`user:${name}`), kv.delete(`data:${name}`), kv.delete(`session:${token}`)])
    return json({ ok: true })
  }
  return json({ error: 'Unknown' }, 404)
}

// ---------------------------------------------------------------------------
// Background checks (cron)
// ---------------------------------------------------------------------------

const EMERGENCY_LABEL = { '7500': 'Hijack', '7600': 'Radio failure', '7700': 'General emergency', general: 'General emergency', lifeguard: 'Medical', minfuel: 'Minimum fuel', nordo: 'Radio failure', unlawful: 'Hijack', downed: 'Downed aircraft' }

async function getJson(path) {
  const res = await fetch(`https://api.adsb.lol${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

function distNm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 2 * 3440.065 * Math.asin(Math.sqrt(a))
}

async function routeFor(callsign, lat, lon) {
  try {
    const res = await fetch('https://api.adsb.lol/api/0/routeset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ planes: [{ callsign, lat, lng: lon }] }),
    })
    const [r] = await res.json()
    const codes = (r?.airport_codes || r?._airport_codes_iata || '').split('-').filter(Boolean)
    return codes.length >= 2 ? { from: codes[0], to: codes[codes.length - 1] } : {}
  } catch {
    return {}
  }
}

export async function runChecks(env) {
  const kv = env.SKYWATCH
  const [config, subs] = await Promise.all([kv.get('config', 'json'), kv.get('subs', 'json')])
  if (!config) return
  const before = (await kv.get('state', 'json')) || {}
  const state = { planes: { ...(before.planes || {}) }, emerg: { ...(before.emerg || {}) }, rare: { ...(before.rare || {}) }, milSeen: { ...(before.milSeen || {}) }, milLog: [...(before.milLog || [])] }
  const now = Date.now()
  const notes = []
  const home = config.home

  // 1. Team planes: detect takeoffs and landings.
  for (const { ident, team } of (config.teams || []).slice(0, 10)) {
    try {
      const isCs = /^[A-Z]{3}\d/.test(ident)
      const data = await getJson(isCs ? `/v2/callsign/${ident}` : `/v2/reg/${ident}`)
      const a = (data.ac || []).find((x) => typeof x.lat === 'number')
      const prev = state.planes[ident] || {}
      const st = !a ? 'offline' : a.alt_baro === 'ground' ? 'ground' : 'airborne'
      const p = { ...prev, state: st, checkedAt: now }
      if (a) {
        p.lastSeenAt = now
        p.hex = a.hex
        p.callsign = (a.flight || '').trim() || p.callsign
        p.lat = a.lat
        p.lon = a.lon
      }
      if (st === 'airborne' && prev.state && prev.state !== 'airborne') {
        p.lastTakeoff = now
        const r = p.callsign ? await routeFor(p.callsign, a.lat, a.lon) : {}
        p.lastFrom = r.from || p.lastFrom
        p.lastTo = r.to || p.lastTo
        if (config.notify?.teams)
          notes.push({ title: `🛫 ${team}: took off`, body: `${ident}${p.callsign && p.callsign !== ident ? ` (${p.callsign})` : ''}${r.from ? ` from ${r.from}` : ''}${r.to ? ` to ${r.to}` : ''}`, url: `${APP_URL}?plane=${a.hex}`, tag: `team-${ident}` })
      }
      if (st === 'ground' && prev.state === 'airborne') {
        p.lastLanding = now
        if (config.notify?.teams) notes.push({ title: `🛬 ${team}: landed`, body: `${ident}${p.lastTo ? ` at ${p.lastTo}` : ''}`, url: `${APP_URL}?plane=${a.hex}`, tag: `team-${ident}` })
      }
      state.planes[ident] = p
    } catch {
      // try again next run
    }
  }

  // 2. Emergencies near home.
  if (config.notify?.emergencies && home) {
    try {
      const r = Math.min(250, config.radius || 100)
      const data = await getJson(`/v2/lat/${home.lat.toFixed(3)}/lon/${home.lon.toFixed(3)}/dist/${r}`)
      for (const a of data.ac || []) {
        const code = a.emergency && a.emergency !== 'none' ? a.emergency : ['7500', '7600', '7700'].includes(a.squawk) ? a.squawk : null
        if (!code || a.alt_baro === 'ground' || typeof a.lat !== 'number') continue
        const key = `${a.hex}-${code}`
        if (state.emerg[key] && now - state.emerg[key] < 6 * 3600e3) continue
        state.emerg[key] = now
        const d = Math.round(distNm(home.lat, home.lon, a.lat, a.lon))
        notes.push({ title: `⚠️ ${EMERGENCY_LABEL[code] || 'Emergency'}`, body: `${(a.flight || a.r || a.hex).trim()}${a.t ? ` (${a.t})` : ''} is ${d} nm from ${home.label || 'home'}`, url: `${APP_URL}?plane=${a.hex}`, tag: key })
      }
    } catch {
      /* next run */
    }
  }

  // 3. Rare planes anywhere in the world.
  if (config.notify?.rare) {
    for (const t of (config.rareTypes || []).slice(0, 20)) {
      try {
        const data = await getJson(`/v2/type/${t.code}`)
        for (const a of data.ac || []) {
          if (a.alt_baro === 'ground' || typeof a.lat !== 'number') continue
          if (state.rare[a.hex] && now - state.rare[a.hex] < 12 * 3600e3) continue
          state.rare[a.hex] = now
          const where = home ? ` · ${Math.round(distNm(home.lat, home.lon, a.lat, a.lon)).toLocaleString()} nm away` : ''
          notes.push({ title: `✨ Rare plane in the air`, body: `${t.name}${a.flight ? ` (${a.flight.trim()})` : ''}${where}`, url: `${APP_URL}?plane=${a.hex}`, tag: `rare-${a.hex}` })
        }
      } catch {
        /* next run */
      }
    }
  }

  // 4. Military aircraft arriving at / landing at watched airports.
  const watched = (config.milAirports || []).slice(0, 25)
  if (watched.length) {
    try {
      const data = await getJson('/v2/mil')
      for (const a of data.ac || []) {
        if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
        const onGround = a.alt_baro === 'ground'
        const alt = typeof a.alt_baro === 'number' ? a.alt_baro : null
        const vr = a.baro_rate ?? a.geom_rate ?? 0
        for (const ap of watched) {
          const d = distNm(a.lat, a.lon, ap.lat, ap.lon)
          if (d > 40) continue
          const agl = onGround ? 0 : (alt ?? 99999) - (ap.elevation || 0)
          let status = null
          if (d <= 4 && (onGround || agl < 400)) status = 'landed'
          else if (!onGround && agl < 12000 && vr < -250) status = 'arriving'
          if (!status) continue
          const key = `${a.hex}-${ap.code}-${status}`
          if (state.milSeen[key] && now - state.milSeen[key] < 3 * 3600e3) continue
          state.milSeen[key] = now
          const callsign = (a.flight || a.r || a.hex).trim()
          state.milLog.unshift({ id: `${key}-${now}`, hex: a.hex, callsign, model: a.t, airport: ap.code, status, at: now, distanceNm: d, altitude: alt })
          if (config.notify?.mil)
            notes.push({
              title: status === 'landed' ? `🎖️🛬 Military landed at ${ap.code}` : `🎖️ Military arriving at ${ap.code}`,
              body: `${callsign}${a.t ? ` (${a.t})` : ''}${status === 'arriving' ? ` · ${Math.round(d * 1.15)} mi out, ${alt != null ? `${alt.toLocaleString()} ft` : 'descending'}` : ''}`,
              url: `${APP_URL}?plane=${a.hex}`,
              tag: key,
            })
        }
      }
      state.milLog = state.milLog.filter((e) => now - e.at < 7 * 86400e3).slice(0, 100)
    } catch {
      /* next run */
    }
  }

  // forget old de-duplication entries
  for (const m of [state.emerg, state.rare, state.milSeen]) for (const k of Object.keys(m)) if (now - m[k] > 24 * 3600e3) delete m[k]
  state.lastRun = now
  await kv.put('state', JSON.stringify(state))

  if (notes.length && subs?.length) {
    // never flood the phone: send the first few, then a summary
    const send = notes.length > 4 ? [...notes.slice(0, 3), { title: 'SkyWatch', body: `${notes.length - 3} more alerts. Open SkyWatch to see them.`, url: APP_URL, tag: 'more' }] : notes
    await notifyAll(kv, send)
  }
}

async function notifyAll(kv, notes) {
  const subs = (await kv.get('subs', 'json')) || []
  if (!subs.length) return 0
  const vapid = await getVapid(kv)
  const dead = new Set()
  let sent = 0
  for (const sub of subs)
    for (const n of notes) {
      try {
        const res = await sendPush(sub, JSON.stringify(n), vapid)
        if (res.status === 404 || res.status === 410) dead.add(sub.endpoint)
        else if (res.ok) sent++
      } catch {
        /* skip */
      }
    }
  if (dead.size) await kv.put('subs', JSON.stringify(subs.filter((s) => !dead.has(s.endpoint))))
  return sent
}

// ---------------------------------------------------------------------------
// Web Push (RFC 8291 encryption + RFC 8292 VAPID), using only WebCrypto
// ---------------------------------------------------------------------------

const enc = new TextEncoder()
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(18)))

async function getVapid(kv) {
  const saved = await kv.get('vapid', 'json')
  if (saved) return saved
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const vapid = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) }
  await kv.put('vapid', JSON.stringify(vapid))
  return vapid
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

export async function encryptPayload(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh)
  const authSecret = unb64u(sub.keys.auth)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))))
  const header = new Uint8Array(21 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

export async function vapidAuth(endpoint, vapid) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: APP_URL })))
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`))
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`
}

async function sendPush(sub, payload, vapid) {
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: await encryptPayload(sub, payload),
  })
}
