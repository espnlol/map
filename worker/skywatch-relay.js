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
  airportdata: 'https://airport-data.com',
  faa: 'https://nasstatus.faa.gov',
  tfr: 'https://tfr.faa.gov',
}

// Websites allowed to use this relay.
const ALLOWED_ORIGINS = [/^https:\/\/espnlol\.github\.io$/, /^http:\/\/localhost(:\d+)?$/]

// How long (seconds) to reuse an answer.
const CACHE_SECONDS = { adsblol: 2, airplaneslive: 2, adsblolglobe: 30, airplanesliveglobe: 30, planespotters: 86400, hexdb: 86400, airportdata: 86400, faa: 120, tfr: 900 }
// Worldwide lookups (rare types, a tail number) change slowly; share them for a minute.
// Lockdown: each service may only be asked for the things SkyWatch uses, so the
// relay can't be used as a general-purpose proxy.
const ALLOWED_PATHS = {
  adsblol: /^\/(v2\/[a-z]+(\/[A-Za-z0-9.~_-]+)*\/?|api\/0\/routeset)$/,
  airplaneslive: /^\/v2\/[a-z]+(\/[A-Za-z0-9.~_-]+)*\/?$/,
  adsblolglobe: /^\/data\/traces\/[0-9a-f]{2}\/trace_(full|recent)_~?[0-9a-f]{6}\.json$/,
  airplanesliveglobe: /^\/data\/traces\/[0-9a-f]{2}\/trace_(full|recent)_~?[0-9a-f]{6}\.json$/,
  planespotters: /^\/pub\/photos\/(hex|reg)\/[A-Za-z0-9-]+$/,
  hexdb: /^\/api\/v1\/aircraft\/[0-9a-fA-F]{6}$/,
  airportdata: /^\/api\/ac_thumb\.json$/,
  faa: /^\/api\/airport-status-information$/,
  tfr: /^\/(geoserver\/TFR\/ows|tfrapi\/[A-Za-z]+|save_pages\/detail_\d{1,2}_\d{3,5}\.xml)$/,
}

const SLOW_PATHS = /^\/v2\/(type|reg|callsign|hex|mil|sqk)\b/

const APP_URL = 'https://espnlol.github.io/map/'
const RELAY_VERSION = '2026-11-12'
// Planespotters (and others) require a contact URL in the User-Agent.
const UA = 'SkyWatch/1.0 (+https://espnlol.github.io/map/)'

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
      return new Response(`SkyWatch relay is running.\n${bg}\nRelay version ${RELAY_VERSION}`, { headers: { 'Content-Type': 'text/plain', ...cors } })
    }
    if (!allowed) return new Response('Not allowed', { status: 403, headers: cors })

    if (url.pathname.startsWith('/push/')) return handlePush(request, url, env, cors)
    if (url.pathname.startsWith('/account/')) return handleAccount(request, url, env, cors)

    if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
    const [, name, ...rest] = url.pathname.split('/')
    const base = UPSTREAMS[name]
    if (!base) return new Response('Unknown service', { status: 404, headers: cors })
    if (!ALLOWED_PATHS[name].test('/' + rest.join('/'))) return new Response('Not allowed', { status: 403, headers: cors })
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
      // adsb.lol busy? try airplanes.live for the same lookup
      if (name === 'adsblol' && (upstream.status === 429 || upstream.status >= 500) && request.method === 'GET' && path.startsWith('/v2/'))
        upstream = await fetch(`${UPSTREAMS.airplaneslive}${airplanesLivePath(path)}${url.search}`, { ...init, headers: { ...init.headers, Referer: `${UPSTREAMS.airplaneslive}/` } })
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
    const r = await notifyAll(kv, [{ title: 'SkyWatch', body: 'Notifications are working ✈', url: APP_URL, tag: 'test' }])
    return json(r)
  }
  if (route === 'run') {
    const last = Number((await kv.get('lastManualRun')) || 0)
    if (Date.now() - last < 60_000) {
      const state = (await kv.get('state', 'json')) || {}
      return json({ lastCheck: state.lastCheck, today: state.today, note: 'A check ran less than a minute ago; showing that one.' })
    }
    await kv.put('lastManualRun', String(Date.now()), { expirationTtl: 300 })
    await runChecks(env)
    const state = (await kv.get('state', 'json')) || {}
    return json({ lastCheck: state.lastCheck, today: state.today })
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
      // Lockdown: this relay belongs to one person. Once a profile exists, new
      // ones are refused (set the Worker variable ALLOW_SIGNUPS=1 to allow more).
      if (env.ALLOW_SIGNUPS !== '1') {
        const existing = await kv.list({ prefix: 'user:', limit: 1 })
        if (existing.keys.length) return json({ error: 'This SkyWatch relay already has its owner profile. Sign in to it instead.' }, 403)
      }
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The same lookup on airplanes.live, which names one path differently. */
function airplanesLivePath(path) {
  const m = /^\/v2\/lat\/([-\d.]+)\/lon\/([-\d.]+)\/dist\/(\d+)/.exec(path)
  return m ? `/v2/point/${m[1]}/${m[2]}/${m[3]}` : path
}

/**
 * Ask adsb.lol; if it says "too many requests" (429) or is down, ask
 * airplanes.live instead. Answers are cached for a minute at Cloudflare, so
 * the app and the background check share them instead of asking twice.
 */
async function getJson(path) {
  const opts = { headers: { Accept: 'application/json', 'User-Agent': UA }, cf: { cacheTtl: 60, cacheEverything: true } }
  let res = await fetch(`https://api.adsb.lol${path}`, opts)
  if (res.status === 429 || res.status >= 500) {
    await sleep(1100) // airplanes.live allows about one request a second
    res = await fetch(`https://api.airplanes.live${airplanesLivePath(path)}`, opts)
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

/** Run each item; one failed lookup doesn't stop the rest. */
async function each(items, fn, errors, label) {
  for (const it of items) {
    try {
      await fn(it)
    } catch (err) {
      errors.push(`${label}: ${String(err && err.message ? err.message : err).slice(0, 100)}`)
    }
    await sleep(250)
  }
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

// Kept small on purpose: Cloudflare's free plan allows very little processing
// time per run, so each check uses small, targeted lookups (never the giant
// "everything within 250 nm" or "all military worldwide" lists) and the rare-
// plane types are spread across runs. Every run records what happened in
// state.lastCheck so the app can show it.
const MIL_HEX = (hex) => {
  const n = parseInt(hex, 16)
  return (n >= 0xadf7c8 && n <= 0xafffff) || (n >= 0x43c000 && n <= 0x43cfff)
}
const MIL_CALLSIGN = /^(RCH|SPAR|SAM|CNV|PAT|EVAC|NAVY|ARMY|COAST|CFC|RRR|ASCOT|GAF|CTM|IAM|NATO|MMF|PEARL|TOPCAT|VV)\d*/

export async function runChecks(env) {
  const kv = env.SKYWATCH
  const [config, subs] = await Promise.all([kv.get('config', 'json'), kv.get('subs', 'json')])
  const now = Date.now()
  const before = (await kv.get('state', 'json')) || {}
  const state = {
    ...before,
    planes: { ...(before.planes || {}) },
    emerg: { ...(before.emerg || {}) },
    rare: { ...(before.rare || {}) },
    milSeen: { ...(before.milSeen || {}) },
    milLog: [...(before.milLog || [])],
  }
  const check = { at: now, steps: [], errors: [], alerts: 0, sent: 0, pushErrors: [] }
  const step = async (name, fn) => {
    try {
      await fn()
      check.steps.push(name)
    } catch (err) {
      check.errors.push(`${name}: ${String(err && err.message ? err.message : err).slice(0, 120)}`)
    }
  }
  if (!config) {
    check.errors.push('No settings from the app yet: turn notifications on in SkyWatch.')
    state.lastCheck = check
    state.lastRun = now
    await kv.put('state', JSON.stringify(state))
    return
  }
  const notes = []
  const home = config.home

  // 1. Team planes: detect takeoffs and landings.
  if ((config.teams || []).length)
    await step('teams', async () => {
      await each(config.teams.slice(0, 10), async ({ ident, team }) => {
        const isCs = /^[A-Z]{3}\d/.test(ident)
        const data = await getJson(isCs ? `/v2/callsign/${ident}` : `/v2/reg/${ident}`)
        const a = (data.ac || []).find((x) => typeof x.lat === 'number')
        const prev = state.planes[ident] || {}
        const st = !a ? 'offline' : a.alt_baro === 'ground' ? 'ground' : 'airborne'
        const p = { ...prev, state: st, checkedAt: now }
        if (a) Object.assign(p, { lastSeenAt: now, hex: a.hex, callsign: (a.flight || '').trim() || p.callsign, lat: a.lat, lon: a.lon })
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
      }, check.errors, 'team')
    })

  // 2. Emergencies: near home, or anywhere in the world. The three worldwide
  //    emergency-squawk lists are tiny, so both use them.
  const world = config.notify?.emergencyScope === 'world'
  if (config.notify?.emergencies && (home || world))
    await step('emergencies', async () => {
      const r = Math.min(250, config.radius || 100)
      const codes = ['7700', '7500', ...(config.notify?.include7600 ? ['7600'] : [])]
      await each(codes, async (sq) => {
        const data = await getJson(`/v2/sqk/${sq}`)
        for (const a of data.ac || []) {
          if (a.alt_baro === 'ground' || typeof a.lat !== 'number') continue
          const d = home ? distNm(home.lat, home.lon, a.lat, a.lon) : null
          if (!world && (d == null || d > r)) continue
          const key = `${a.hex}-${sq}`
          if (state.emerg[key] && now - state.emerg[key] < 6 * 3600e3) continue
          state.emerg[key] = now
          const cs = (a.flight || a.r || a.hex).trim()
          const route = a.flight ? await routeFor(cs, a.lat, a.lon) : {}
          const bits = [
            cs + (a.t ? ` (${a.t})` : ''),
            route.from && route.to ? `${route.from} → ${route.to}` : null,
            typeof a.alt_baro === 'number' ? `${a.alt_baro.toLocaleString()} ft` : null,
            d != null ? `${Math.round(d * 1.15).toLocaleString()} mi from ${world ? 'you' : home.label || 'home'}` : null,
          ].filter(Boolean)
          notes.push({ title: `⚠️ ${EMERGENCY_LABEL[sq]}${sq === '7500' ? ' (7500)' : ''}`, body: bits.join(' · '), url: `${APP_URL}?plane=${a.hex}`, tag: key, priority: sq === '7500' ? 2 : 1 })
        }
      }, check.errors, 'emergencies')
    })

  // 3. Rare planes anywhere: a few types per run, taking turns.
  if (config.notify?.rare && (config.rareTypes || []).length)
    await step('rare', async () => {
      const types = config.rareTypes
      const per = 4
      const start = (state.rareOffset || 0) % types.length
      const batch = [...types, ...types].slice(start, start + Math.min(per, types.length))
      state.rareOffset = (start + per) % types.length
      await each(batch, async (t) => {
        const data = await getJson(`/v2/type/${t.code}`)
        for (const a of data.ac || []) {
          if (a.alt_baro === 'ground' || typeof a.lat !== 'number') continue
          if (state.rare[a.hex] && now - state.rare[a.hex] < 12 * 3600e3) continue
          state.rare[a.hex] = now
          const where = home ? ` · ${Math.round(distNm(home.lat, home.lon, a.lat, a.lon) * 1.15).toLocaleString()} mi away` : ''
          notes.push({ title: `✨ Rare plane in the air`, body: `${t.name}${a.flight ? ` (${a.flight.trim()})` : ''}${where}`, url: `${APP_URL}?plane=${a.hex}`, tag: `rare-${a.hex}` })
        }
      }, check.errors, 'rare')
    })

  // 4. Military arrivals at watched airports: a small 40 nm lookup per airport.
  const watched = (config.milAirports || []).slice(0, 8)
  if (watched.length)
    await step('military', async () => {
      await each(watched, async (ap) => {
        const data = await getJson(`/v2/lat/${ap.lat.toFixed(3)}/lon/${ap.lon.toFixed(3)}/dist/40`)
        for (const a of data.ac || []) {
          const cs = (a.flight || '').trim()
          const mil = (a.dbFlags & 1) === 1 || MIL_HEX(a.hex) || MIL_CALLSIGN.test(cs)
          if (!mil || typeof a.lat !== 'number') continue
          const onGround = a.alt_baro === 'ground'
          const alt = typeof a.alt_baro === 'number' ? a.alt_baro : null
          const vr = a.baro_rate ?? a.geom_rate ?? 0
          const d = distNm(a.lat, a.lon, ap.lat, ap.lon)
          const agl = onGround ? 0 : (alt ?? 99999) - (ap.elevation || 0)
          let status = null
          if (d <= 4 && (onGround || agl < 400)) status = 'landed'
          else if (!onGround && agl < 12000 && vr < -250) status = 'arriving'
          if (!status) continue
          const key = `${a.hex}-${ap.code}-${status}`
          if (state.milSeen[key] && now - state.milSeen[key] < 3 * 3600e3) continue
          state.milSeen[key] = now
          const callsign = cs || (a.r || a.hex).trim()
          state.milLog.unshift({ id: `${key}-${now}`, hex: a.hex, callsign, model: a.t, airport: ap.code, status, at: now, distanceNm: d, altitude: alt })
          if (config.notify?.mil)
            notes.push({
              title: status === 'landed' ? `🎖️🛬 Military landed at ${ap.code}` : `🎖️ Military arriving at ${ap.code}`,
              body: `${callsign}${a.t ? ` (${a.t})` : ''}${status === 'arriving' ? ` · ${Math.round(d * 1.15)} mi out${alt != null ? `, ${alt.toLocaleString()} ft` : ''}` : ''}`,
              url: `${APP_URL}?plane=${a.hex}`,
              tag: key,
            })
        }
      }, check.errors, 'military')
      state.milLog = state.milLog.filter((e) => now - e.at < 7 * 86400e3).slice(0, 100)
    })

  // forget old de-duplication entries
  for (const m of [state.emerg, state.rare, state.milSeen]) for (const k of Object.keys(m)) if (now - m[k] > 24 * 3600e3) delete m[k]

  check.alerts = notes.length
  if (notes.length && subs?.length) {
    // never flood the phone: send the first few, then a summary
    notes.sort((x, y) => (y.priority || 0) - (x.priority || 0))
    const send = notes.length > 4 ? [...notes.slice(0, 3), { title: 'SkyWatch', body: `${notes.length - 3} more alerts. Open SkyWatch to see them.`, url: APP_URL, tag: 'more' }] : notes
    const r = await notifyAll(kv, send)
    check.sent = r.sent
    check.pushErrors = r.errors
  } else if (notes.length) check.errors.push('Alerts found but no phone is linked: turn notifications on in SkyWatch.')
  const day = new Date(now).toDateString()
  state.today = state.today?.day === day ? state.today : { day, alerts: 0, sent: 0, runs: 0 }
  state.today.alerts += check.alerts
  state.today.sent += check.sent
  state.today.runs += 1
  state.lastCheck = check
  state.lastRun = now
  await kv.put('state', JSON.stringify(state))
}

async function notifyAll(kv, notes) {
  const subs = (await kv.get('subs', 'json')) || []
  if (!subs.length) return { sent: 0, errors: ['no linked phone'] }
  const vapid = await getVapid(kv)
  const dead = new Set()
  const errors = []
  let sent = 0
  for (const sub of subs)
    for (const n of notes) {
      try {
        const res = await sendPush(sub, JSON.stringify(n), vapid)
        if (res.status === 404 || res.status === 410) dead.add(sub.endpoint)
        else if (res.ok) sent++
        else errors.push(`${new URL(sub.endpoint).host} ${res.status} ${(await res.text()).slice(0, 80)}`)
      } catch (err) {
        errors.push(String(err).slice(0, 80))
      }
    }
  if (dead.size) await kv.put('subs', JSON.stringify(subs.filter((s) => !dead.has(s.endpoint))))
  return { sent, errors: errors.slice(0, 5) }
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
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: new URL(APP_URL).origin })))
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
