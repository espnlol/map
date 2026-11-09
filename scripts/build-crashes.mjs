#!/usr/bin/env node
// Builds public/data/crashes.json from Wikipedia and Wikidata (Wikipedia's
// structured-data twin):
//
//  1. Wikidata lists every aviation accident with its date, coordinates,
//     deaths, survivors, operator, country, cause and route airports.
//  2. Each crash's English Wikipedia article is read for its infobox: the
//     summary line, crash site, exact coordinates, aircraft type, operator,
//     tail number, flight number, origin/destination and casualty counts.
//     Wikipedia's values win where both have one.
//
// The app then layers the hand-written entries in src/data/crashes.ts on top
// (they add longer summaries).
//
//   node scripts/build-crashes.mjs            # download everything, write the JSON
//   node scripts/build-crashes.mjs --cache D  # reuse/save raw downloads in folder D
//
// Wikidata's query service is rate-limited, so its queries run a minute apart
// and are retried politely on HTTP 429/5xx.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFUNCT_STATES, classifyCause, classifyCategory, countryFromSite, modernCountry, oceanFor, waterBodyIn } from './crash-classify.mjs'
import { articlesUsingTemplate, fetchWikitext, lookupPages, parseInfobox, phaseFrom } from './infobox.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/crashes.json')
const UA = 'BlackBoxAtlas/1.0 (https://github.com/espnlol/map; weekly data refresh)'
const ENDPOINT = 'https://query.wikidata.org/sparql'

// --offline: never download; anything not in the cache is treated as missing (for local testing)
const OFFLINE = process.argv.includes('--offline')
const cacheIdx = process.argv.indexOf('--cache')
const CACHE = cacheIdx > 0 ? process.argv[cacheIdx + 1] : null

// Everything that is an "aviation accident" (Q744913) or a subclass of it:
// crashes, mid-air collisions, bombings, shootdowns, hijackings, ...
const ACCIDENTS = '?item wdt:P31/wdt:P279* wd:Q744913 .'

const CORE = `
SELECT ?item ?title ?label ?time ?prec ?coord ?deaths ?survivors ?injured ?flight ?reg WHERE {
  ${ACCIDENTS}
  ?item p:P585/psv:P585 [ wikibase:timeValue ?time ; wikibase:timePrecision ?prec ] .
  OPTIONAL { ?art schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . }
  OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = 'en') }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P1120 ?deaths }
  OPTIONAL { ?item wdt:P1561 ?survivors }
  OPTIONAL { ?item wdt:P1339 ?injured }
  OPTIONAL { ?item wdt:P3090 ?flight }
  OPTIONAL { ?item wdt:P426 ?reg }
}`

// Linked items, in three smaller queries (one big UNION times out).
const linkQuery = (values, extra = '') => `
SELECT ?item ?prop ?v ?vLabel ?vCoord ?vClassLabel ?vCountryLabel WHERE {
  ${ACCIDENTS}
  VALUES (?prop ?p) { ${values} }
  ?item ?p ?v .
  OPTIONAL { ?v rdfs:label ?vLabel FILTER(lang(?vLabel) = 'en') }
  ${extra}
}`
const LINKS = {
  places: linkQuery(
    '("location" wdt:P276) ("admin" wdt:P131) ("from" wdt:P1427) ("to" wdt:P1444)',
    `OPTIONAL { ?v wdt:P625 ?vCoord }
  OPTIONAL { ?v wdt:P17 ?vCountry . ?vCountry rdfs:label ?vCountryLabel FILTER(lang(?vCountryLabel) = 'en') }`,
  ),
  things: linkQuery(
    '("operator" wdt:P137) ("vehicle" wdt:P1876) ("operated" wdt:P121)',
    "OPTIONAL { ?v wdt:P31 ?vClass . ?vClass rdfs:label ?vClassLabel FILTER(lang(?vClassLabel) = 'en') }",
  ),
  facts: linkQuery('("cause" wdt:P828) ("country" wdt:P17) ("class" wdt:P31)'),
}

// Articles that aren't aircraft accidents (or would double-count one), found
// by reviewing the data by hand. The rules in notAnAircraftAccident() catch
// most others automatically.
const EXCLUDE = new Set([
  'Collapse of the World Trade Center', // the 9/11 flights are already on the map
  'Hindawi affair', // bomb found before boarding
  'Air India Flight 112 plot', // foiled plot
  'Dymshits–Kuznetsov hijacking affair', // stopped before boarding
  '1985 Narita International Airport bombing', // bag exploded in the terminal
  'Slovak Police training explosives incident', // explosives left in luggage
])

const FIRST_YEAR = 1900

/** Why an entry isn't an aircraft accident (ships, spacecraft, drones, ...), or null if it is one. */
function notAnAircraftAccident(c) {
  const name = c.name ?? ''
  const kind = c.kind ?? ''
  const text = `${name} | ${kind}`
  if (c.wiki && EXCLUDE.has(c.wiki)) return 'excluded by hand'
  if (+c.date.slice(0, 4) < FIRST_YEAR) return `before ${FIRST_YEAR}`
  if ((/\b(naval|ship|ships|tanker|ferry|submarine|frigate)\b/i.test(name) || /^navigation accident$/i.test(c.summary ?? '')) && !c.aircraft) return 'a ship'
  if (/space ?shuttle|spacecraft|launch failure|space disaster|rocket launch/i.test(text)) return 'a spacecraft'
  if (/high-altitude object/i.test(text)) return 'an unmanned object'
  if (/\bdrones?\b|\buav\b|unmanned/i.test(name) && !/attack|strike/i.test(name)) return 'a drone'
  if (/\bplot\b/i.test(name) && !c.aircraft) return 'a plot'
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function cachePath(name) {
  return CACHE ? join(CACHE, `${name}.json`) : null
}
function readCache(name) {
  const p = cachePath(name)
  return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}
function writeCache(name, data) {
  const p = cachePath(name)
  if (!p) return
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(p, JSON.stringify(data))
}

let lastQuery = 0
async function sparql(name, query) {
  const cached = readCache(name)
  if (cached) {
    console.log(`Using cached ${name} answers`)
    return cached
  }
  for (let attempt = 1; attempt <= 8; attempt++) {
    const wait = lastQuery + 65_000 - Date.now()
    if (lastQuery && wait > 0) await sleep(wait)
    lastQuery = Date.now()
    console.log(`Querying Wikidata: ${name} (attempt ${attempt})`)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
    })
    if (res.ok) {
      const rows = (await res.json()).results.bindings
      writeCache(name, rows)
      return rows
    }
    console.log(`  HTTP ${res.status}`)
    if (res.status !== 429 && res.status < 500) throw new Error(`Wikidata answered HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const retryAfter = Number(res.headers.get('retry-after')) || 0
    if (retryAfter * 1000 > 65_000) await sleep(retryAfter * 1000 - 65_000)
  }
  throw new Error(`Wikidata kept refusing the ${name} query`)
}

const qid = (uri) => uri.slice(uri.lastIndexOf('/') + 1)
const val = (b) => b?.value

function parsePoint(wkt) {
  // "Point(lng lat)"; ignore points on other globes (a few Moon/Mars entries exist)
  const m = wkt && /^Point\(([-\d.eE]+) ([-\d.eE]+)\)$/.exec(wkt)
  if (!m) return null
  const lng = +m[1]
  const lat = +m[2]
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}

// Wikidata dates carry a precision: 11 = day, 10 = month, 9 = year.
function parseDate(time, prec) {
  const m = /^([+-]?\d+)-(\d\d)-(\d\d)/.exec(time)
  if (!m) return null
  const y = +m[1]
  if (y < 1900 || y > new Date().getUTCFullYear()) return null
  const year = String(y).padStart(4, '0')
  if (+prec >= 11) return `${year}-${m[2]}-${m[3]}`
  if (+prec === 10) return `${year}-${m[2]}`
  return year
}

const uniq = (xs) => [...new Set(xs.filter(Boolean))]
const AIRFRAME_CLASS = /^(individual aircraft|aircraft|airframe|airplane|aeroplane)$/i
const MODEL_CLASS = /model|family|series|variant|airliner|aircraft type|helicopter|airship|jet|bomber|fighter|transport aircraft|trainer|seaplane|flying boat/i

// Infobox text like "Boeing 747-206B · Boeing 747-121" or "Flight 4805, KLM"
const splitList = (s) => (s ? s.split(/\s*(?:·|;| and |, (?=[A-Z][a-z]+ [A-Z0-9]))\s*/).map((x) => x.trim()).filter(Boolean) : [])

/**
 * How precisely a linked place pins down a crash site: an airport or a peak is
 * a point; a town is close; a river, region or country could be far off.
 */
function placePrecision(name) {
  if (/airport|airfield|aerodrome|air ?base|airstrip|heliport/i.test(name)) return 3
  if (/\bmount\b|mountain|peak|\bhill\b|volcano|island|\bisle\b/i.test(name)) return 2
  if (/river|creek|lake|sea\b|ocean|bay\b|gulf|strait|channel|province|state\b|region|district|county|oblast|krai|prefecture|territory|desert|forest|range|valley/i.test(name)) return 0
  return 1 // towns, villages, neighbourhoods
}

/** "Air Florida (1971–1991)" -> "Air Florida"; "Aeroflot (airline)" -> "Aeroflot". */
function cleanTitle(t) {
  return t.replace(/\s*\((?:airline|airlines|air carrier|carrier|company|aviation|aircraft|airliner|helicopter|\d{4}[^)]*)\)$/i, '').trim()
}

// Same airline under different names after redirects are resolved.
const OPERATOR_ALIASES = new Map(Object.entries({
  'Pan American World Airways': 'Pan Am',
  'Pan American Airways': 'Pan Am',
  'United Air Lines': 'United Airlines',
  'Japan Air Lines': 'Japan Airlines',
  'Trans World Airlines': 'Trans World Airlines',
  TWA: 'Trans World Airlines',
  'Eastern Airlines': 'Eastern Air Lines',
  'Northwest Orient': 'Northwest Airlines',
  'Northwest Orient Airlines': 'Northwest Airlines',
  'USAir': 'US Airways',
  'Allegheny Airlines': 'US Airways',
  'Aeroflot – Russian Airlines': 'Aeroflot',
  'Aeroflot Soviet Airlines': 'Aeroflot',
  'Air France–KLM': 'Air France',
  'British Overseas Airways Corporation': 'BOAC',
  'Korean Air Lines': 'Korean Air',
  'USAF': 'United States Air Force',
  'U.S. Air Force': 'United States Air Force',
  'US Air Force': 'United States Air Force',
  'RAF': 'Royal Air Force',
  'U.S. Navy': 'United States Navy',
  'US Navy': 'United States Navy',
  'U.S. Army': 'United States Army',
  'US Army': 'United States Army',
  'U.S. Marine Corps': 'United States Marine Corps',
  'Indian Airlines Corporation': 'Indian Airlines',
  'Garuda Indonesian Airways': 'Garuda Indonesia',
  'Philippine Air Lines': 'Philippine Airlines',
}))
function normOperator(name) {
  const n = cleanTitle(name).replace(/\s+/g, ' ').trim()
  return OPERATOR_ALIASES.get(n) ?? n
}
// Infobox operator cells sometimes hold notes rather than names.
const isOperatorName = (n) =>
  !!n && n.length <= 80 && !/^[A-Z]{2,4}$/.test(n) && // a bare country code from {{air force|IDN}}-style templates
  !/^(unknown|none|n\/a|private|privately owned|various)$/i.test(n) && !/^(on behalf of|leased|wet[- ]lease|for )/i.test(n)

function cleanFlight(f) {
  if (!f) return undefined
  const s = f.replace(/\s+/g, ' ').trim().toUpperCase()
  return s.length <= 12 ? s : undefined
}

async function main() {
  const core = await sparql('core', CORE)
  const links = []
  for (const [name, query] of Object.entries(LINKS)) links.push(...(await sparql(`links-${name}`, query)))
  console.log(`${core.length} core rows, ${links.length} link rows`)

  // Wikidata returns rows in no particular order; sort them so items with
  // several values (two coordinates, two locations) always pick the same one
  // and weekly refreshes only change what really changed.
  const stable = (rows) => rows.map((r) => [JSON.stringify(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((x) => x[1])

  /** @type {Map<string, any>} */
  const byId = new Map()
  for (const r of stable(core)) {
    const id = qid(val(r.item))
    const e = byId.get(id) ?? { id, links: {} }
    e.title ??= val(r.title)
    e.label ??= val(r.label)
    const date = parseDate(val(r.time), val(r.prec))
    // Several dates usually mean a multi-day event; keep the earliest, most precise one.
    if (date && (!e.date || date.length > e.date.length || (date.length === e.date.length && date < e.date))) e.date = date
    e.coord ??= parsePoint(val(r.coord))
    for (const k of ['deaths', 'survivors', 'injured']) {
      const n = val(r[k])
      if (n != null && Number.isFinite(+n)) e[k] = Math.max(e[k] ?? 0, Math.round(+n))
    }
    e.flight ??= cleanFlight(val(r.flight))
    e.reg ??= val(r.reg)
    byId.set(id, e)
  }

  for (const r of stable(links)) {
    const e = byId.get(qid(val(r.item)))
    if (!e) continue
    const id = qid(val(r.v))
    const list = (e.links[val(r.prop)] ??= [])
    let item = list.find((x) => x.id === id)
    if (!item) list.push((item = { id, label: val(r.vLabel), coord: null, classes: [], country: null }))
    item.coord ??= parsePoint(val(r.vCoord))
    item.country ??= val(r.vCountryLabel) ?? null
    const cls = val(r.vClassLabel)
    if (cls && !item.classes.includes(cls)) item.classes.push(cls)
  }

  // 1. Crash articles Wikidata doesn't tag as accidents: every Wikipedia
  //    article that uses the aircraft-occurrence infobox.
  let catTitles = readCache('infobox-articles') ?? (OFFLINE ? [] : null)
  if (catTitles) console.log('Using cached list of infobox articles')
  else {
    console.log('Listing every Wikipedia article with an aircraft-occurrence infobox...')
    catTitles = [...(await articlesUsingTemplate('Template:Infobox aircraft occurrence', { userAgent: UA }))].sort()
    writeCache('infobox-articles', catTitles)
  }
  const knownTitles = new Set([...byId.values()].map((e) => e.title).filter(Boolean))
  const newTitles = catTitles.filter((t) => !knownTitles.has(t))
  console.log(`${catTitles.length} articles use the infobox, ${newTitles.length} not already from Wikidata`)

  // 2. The wikitext of every article (cached between runs while developing).
  const wikitext = readCache('wikitext') ?? {}
  const wanted = uniq([...knownTitles, ...newTitles]).filter((t) => !(t in wikitext))
  if (wanted.length && !OFFLINE) {
    console.log(`Reading ${wanted.length} Wikipedia articles...`)
    const map = await fetchWikitext(wanted, {
      userAgent: UA,
      onProgress: (n, total) => { if (n % 500 === 0 || n === total) console.log(`  ${n}/${total}`) },
    })
    for (const t of wanted) wikitext[t] = map.get(t) ?? ''
    writeCache('wikitext', wikitext)
  }
  const boxes = new Map()
  for (const t of uniq([...knownTitles, ...newTitles])) {
    const box = wikitext[t] ? parseInfobox(wikitext[t]) : null
    if (box) boxes.set(t, box)
  }

  // Infobox-only articles become crashes if the infobox has a date.
  const pendingIds = new Map()
  for (const t of newTitles) {
    const box = boxes.get(t)
    if (!box?.date) continue
    pendingIds.set(t, { id: null, title: t, links: {}, date: box.date, fromCategory: true })
  }

  // 3. Look up, through Wikipedia: what each operator/aircraft link redirects
  //    to (so "United Air Lines" and "United Airlines" are one airline), the
  //    Wikidata id of category-only articles, and coordinates of the places
  //    crash sites link to (for crashes without coordinates of their own).
  const lookups = new Set(pendingIds.keys())
  for (const box of boxes.values()) {
    for (const pl of box.planes) for (const t of [...pl.operatorLinks, ...pl.typeLinks]) lookups.add(t)
    if (!box.coord) for (const t of box.siteLinks) lookups.add(t)
  }
  let pages = readCache('pages') ?? {}
  const missing = [...lookups].filter((t) => !(t in pages))
  if (missing.length && !OFFLINE) {
    console.log(`Looking up ${missing.length} linked Wikipedia pages...`)
    const map = await lookupPages(missing, { userAgent: UA })
    pages = { ...pages }
    for (const t of missing) pages[t] = map.get(t) ?? null
    writeCache('pages', pages)
  }
  const canonical = (t) => pages[t]?.title ?? t

  // What kind of organisation each infobox operator is (airline, cargo airline,
  // air force, ...), asked of Wikidata by the operators' ids.
  // Which country each linked crash-site place is in today (for crashes whose
  // own country is missing or a state that no longer exists).
  const siteQids = uniq([...boxes.values()].flatMap((b) => b.siteLinks.map((t) => pages[t]?.qid))).sort()
  const siteCountry = {}
  for (let i = 0; i < siteQids.length; i += 800) {
    const chunk = siteQids.slice(i, i + 800)
    const rows = await sparql(`site-countries-${i / 800}`, `
SELECT ?place ?countryLabel WHERE {
  VALUES ?place { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  ?place wdt:P17 ?country . ?country rdfs:label ?countryLabel FILTER(lang(?countryLabel) = 'en')
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved }
}`)
    for (const r of rows) siteCountry[qid(val(r.place))] ??= val(r.countryLabel)
  }

  const opQids = uniq([...boxes.values()].flatMap((b) => b.planes.flatMap((p) => p.operatorLinks.map((t) => pages[t]?.qid)))).sort()
  const opClasses = {}
  for (let i = 0; i < opQids.length; i += 800) {
    const chunk = opQids.slice(i, i + 800)
    const rows = await sparql(`operator-classes-${i / 800}`, `
SELECT ?op ?classLabel WHERE {
  VALUES ?op { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  ?op wdt:P31 ?class . ?class rdfs:label ?classLabel FILTER(lang(?classLabel) = 'en')
}`)
    for (const r of rows) (opClasses[qid(val(r.op))] ??= []).push(val(r.classLabel))
  }

  const wikidataIds = new Set(byId.keys())
  for (const [t, e] of pendingIds) {
    const qidOf = pages[t]?.qid
    if (qidOf && wikidataIds.has(qidOf)) continue // same crash, already there under another title
    e.id = qidOf ?? `wp:${t}`
    byId.set(e.id, e)
  }
  console.log(`${[...byId.values()].filter((e) => e.fromCategory).length} extra crashes found through the infobox list`)

  // Every country name Wikidata uses, to recognise them in crash-site text.
  const knownCountries = new Set(
    [...byId.values()].flatMap((e) => (e.links.country ?? []).map((c) => c.label)).filter((x) => x && !/^Q\d+$/.test(x)),
  )

  const out = []
  let skipped = 0
  let withInfobox = 0
  let approximate = 0
  for (const e of byId.values()) {
    const L = (k) => (e.links[k] ?? []).filter((x) => x.label && !/^Q\d+$/.test(x.label))
    const box = e.title ? boxes.get(e.title) ?? null : null
    if (box) withInfobox++
    // Of several locations, use one with coordinates, preferring a specific
    // place (an airport, mountain, sea, ...) over a city or "runway".
    const location = [...L('location')].sort((a, b) => (+!!b.coord - +!!a.coord) || placePrecision(b.label) - placePrecision(a.label))[0]
    // Position: the crash's own coordinates; failing that, the place the
    // crash site links to (first, most specific link), marked approximate.
    // No coordinates of its own: use the most precise place we know of, from
    // Wikidata's location or the places the infobox's crash site links to.
    const candidates = !box?.coord && !e.coord
      ? [
          ...(location?.coord ? [{ name: location.label, coord: location.coord }] : []),
          ...(box?.siteLinks ?? []).filter((t) => pages[t]?.coord).map((t) => ({ name: t, coord: pages[t].coord })),
        ]
      : []
    const bestPlace = candidates.sort((a, b) => placePrecision(b.name) - placePrecision(a.name))[0]
    const coord = box?.coord ?? e.coord ?? bestPlace?.coord ?? null
    const approx = !box?.coord && !e.coord
    if (!e.date || !coord || !(e.title || e.label)) { skipped++; continue }
    if (approx) approximate++
    const [lat, lng] = coord

    // Aircraft: the infobox names the exact variant; its link gives the family
    // ("Boeing 747-206B" links to "Boeing 747"). Otherwise Wikidata's "vehicle"
    // is either a model or one airframe whose class is the model.
    let types = uniq((box?.planes ?? []).flatMap((p) => splitList(p.type)))
    let families = uniq((box?.planes ?? []).flatMap((p) => p.typeLinks.map(canonical).map(cleanTitle)))
    let reg = uniq((box?.planes ?? []).map((p) => p.registration))[0] ?? e.reg
    if (!types.length) {
      for (const v of [...L('vehicle'), ...L('operated')]) {
        const model = v.classes.find((c) => !AIRFRAME_CLASS.test(c) && !MODEL_CLASS.test(c))
        if (v.classes.some((c) => MODEL_CLASS.test(c)) || !v.classes.length) types.push(v.label)
        else if (model) {
          types.push(model)
          reg ??= v.label
        }
      }
      types = uniq(types)
    }
    if (!families.length) families = []

    // Operators: the article the infobox links to (redirects resolved), else
    // its text, else Wikidata's operator.
    const wdOperators = L('operator')
    const boxOperators = (box?.planes ?? []).flatMap((p) => (p.operatorLinks.length ? p.operatorLinks.map(canonical).map(cleanTitle) : splitList(p.operator)))
    let operators = uniq(boxOperators.map(normOperator)).filter(isOperatorName)
    if (!operators.length) operators = uniq(wdOperators.map((o) => normOperator(o.label))).filter(isOperatorName)
    // What each operator is (airline, air force, ...), from Wikidata.
    const operatorClasses = [
      ...wdOperators.flatMap((o) => o.classes),
      ...(box?.planes ?? []).flatMap((p) => p.operatorLinks.flatMap((t) => opClasses[pages[t]?.qid] ?? [])),
    ]
    const countries = L('country').map((c) => c.label)
    const classes = L('class').map((c) => c.label)
    const causes = L('cause').map((c) => c.label)
    const summary = box?.summary || undefined
    const site = box?.site || location?.label
    const water = waterBodyIn(site) ?? (countries.length ? null : waterBodyIn(location?.label))
    // Country: the accident's own, else the country of its location or
    // administrative area, else one named in the crash-site text.
    const placeCountry =
      L('location').find((x) => x.country)?.country ??
      L('admin').find((x) => x.country)?.country ??
      (box?.siteLinks ?? []).map((t) => siteCountry[pages[t]?.qid]).find(Boolean)
    let country = countries.find((c) => !DEFUNCT_STATES.has(c)) ?? placeCountry ?? countries[0] ?? countryFromSite(site, knownCountries)
    if (DEFUNCT_STATES.has(country) && placeCountry) country = placeCountry
    country = modernCountry(country, e.date)
    const plane1 = box?.planes?.[0]
    const fromWd = L('from')[0]
    const toWd = L('to')[0]
    const routeEnd = (wd, text) =>
      wd || text ? { name: text || wd.label, lat: wd?.coord?.[0], lng: wd?.coord?.[1] } : undefined

    out.push({
      id: e.id,
      name: e.title ?? e.label,
      date: e.date,
      lat: +lat.toFixed(4),
      lng: +lng.toFixed(4),
      approx: approx || undefined,
      location: site || undefined,
      // At sea: the ocean/sea name. No country recorded: a best guess from the
      // coordinates, flagged as such.
      country: country ?? water ?? (oceanFor(lat, lng, site) ?? 'Unknown'),
      region: water ?? (!country ? oceanFor(lat, lng, site) ?? undefined : undefined),
      operator: operators.join(' & ') || undefined,
      operators: operators.length ? operators : undefined,
      aircraft: types.join(' & ') || undefined,
      aircraftTypes: types.length ? types : undefined,
      aircraftFamilies: families.length ? families : undefined,
      flight: cleanFlight(plane1?.flight) ?? e.flight,
      registration: reg || undefined,
      fatalities: box?.fatalities ?? e.deaths,
      survivors: box?.survivors ?? e.survivors,
      injured: box?.injuries ?? e.injured,
      aboard: box?.occupants,
      category: classifyCategory(operatorClasses, classes, operators, !!(cleanFlight(plane1?.flight) ?? e.flight), types, e.title ?? e.label),
      cause: classifyCause([summary ?? '', ...causes, ...classes]),
      summary,
      phase: phaseFrom(summary),
      kind: classes.filter((c) => !/^aviation (accident|incident|occurrence)$/i.test(c)).join(', ') || undefined,
      from: routeEnd(fromWd, plane1?.origin),
      to: routeEnd(toWd, plane1?.destination),
      wiki: e.title,
    })
  }
  console.log(`${approximate} placed approximately (at the place their crash site links to)`)

  // Wikidata sometimes files a second item for the same event (e.g. one of the
  // aircraft, with no article of its own). Drop article-less entries that share
  // a date and place with another one; also skip pages that would double-count.
  const km = (a, b) => {
    const r = Math.PI / 180
    const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
    return 12742 * Math.asin(Math.sqrt(h))
  }
  const byDate = new Map()
  for (const c of out) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c])
  const removed = []
  const deduped = out.filter((c) => {
    const why = notAnAircraftAccident(c)
    if (why) { removed.push(`${c.name} (${why})`); return false }
    if (c.wiki) return true
    return !(byDate.get(c.date) ?? []).some((o) => o !== c && o.wiki && km(o, c) < 100)
  })
  console.log(`Left out ${removed.length} entries that aren't aircraft accidents:\n  ${removed.join('\n  ')}`)
  console.log(`Dropped ${out.length - deduped.length - removed.length} duplicates`)
  out.length = 0
  out.push(...deduped)

  out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
  console.log(`${out.length} accidents kept (${withInfobox} with a Wikipedia infobox), ${skipped} skipped (no date, place or name)`)
  if (out.length < 1000) throw new Error('Refusing to save: far fewer accidents than expected, the download looks broken')

  // One crash per line keeps git diffs readable; "updated" sits on its own
  // line so the refresh workflow can ignore it when checking for changes.
  const json =
    '{"source":"Wikipedia & Wikidata (CC BY-SA / CC0)",\n' +
    `"updated":"${new Date().toISOString().slice(0, 10)}",\n` +
    '"crashes":[\n' + out.map((c) => JSON.stringify(c)).join(',\n') + '\n]}\n'
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, json)
  console.log(`Wrote ${OUT} (${(json.length / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
