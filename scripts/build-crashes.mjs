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
import { classifyCause, classifyCategory, countryFromSite, oceanFor, waterBodyIn } from './crash-classify.mjs'
import { fetchWikitext, parseInfobox, phaseFrom } from './infobox.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/crashes.json')
const UA = 'BlackBoxAtlas/1.0 (https://github.com/espnlol/map; weekly data refresh)'
const ENDPOINT = 'https://query.wikidata.org/sparql'

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

// Articles Wikidata calls aviation accidents that would double-count crashes
// already on the map.
const EXCLUDE = new Set(['Collapse of the World Trade Center'])

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

  /** @type {Map<string, any>} */
  const byId = new Map()
  for (const r of core) {
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

  for (const r of links) {
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

  // Wikipedia infoboxes for every crash that has an article.
  const titles = uniq([...byId.values()].map((e) => e.title))
  let wikitext = readCache('wikitext')
  if (wikitext) console.log('Using cached Wikipedia articles')
  else {
    console.log(`Reading ${titles.length} Wikipedia articles...`)
    const map = await fetchWikitext(titles, {
      userAgent: UA,
      onProgress: (n, total) => { if (n % 500 === 0 || n === total) console.log(`  ${n}/${total}`) },
    })
    wikitext = Object.fromEntries(map)
    writeCache('wikitext', wikitext)
  }

  // Every country name Wikidata uses, to recognise them in crash-site text.
  const knownCountries = new Set(
    [...byId.values()].flatMap((e) => (e.links.country ?? []).map((c) => c.label)).filter((x) => x && !/^Q\d+$/.test(x)),
  )

  const out = []
  let skipped = 0
  let withInfobox = 0
  for (const e of byId.values()) {
    const L = (k) => (e.links[k] ?? []).filter((x) => x.label && !/^Q\d+$/.test(x.label))
    const box = e.title && wikitext[e.title] ? parseInfobox(wikitext[e.title]) : null
    if (box) withInfobox++
    const location = L('location')[0]
    const coord = box?.coord ?? e.coord ?? location?.coord ?? null
    if (!e.date || !coord || !(e.title || e.label)) { skipped++; continue }
    const [lat, lng] = coord

    // Aircraft types: the infobox names them; otherwise Wikidata's "vehicle" is
    // either a model (Boeing 747) or one airframe whose class is the model.
    let types = uniq((box?.planes ?? []).flatMap((p) => splitList(p.type)))
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

    const wdOperators = L('operator')
    const operators = uniq([...(box?.planes ?? []).flatMap((p) => splitList(p.operator)), ...(box?.planes?.length ? [] : wdOperators.map((o) => o.label))])
    const countries = L('country').map((c) => c.label)
    const classes = L('class').map((c) => c.label)
    const causes = L('cause').map((c) => c.label)
    const summary = box?.summary || undefined
    const site = box?.site || location?.label
    const water = waterBodyIn(site) ?? (countries.length ? null : waterBodyIn(location?.label))
    // Country: the accident's own, else the country of its location or
    // administrative area, else one named in the crash-site text.
    const country =
      countries[0] ??
      L('location').find((x) => x.country)?.country ??
      L('admin').find((x) => x.country)?.country ??
      countryFromSite(site, knownCountries)
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
      location: site || undefined,
      // At sea: the ocean/sea name. No country recorded: a best guess from the
      // coordinates, flagged as such.
      country: country ?? water ?? (oceanFor(lat, lng, site) ?? 'Unknown'),
      region: water ?? (!country ? oceanFor(lat, lng, site) ?? undefined : undefined),
      operator: operators.join(' & ') || undefined,
      operators: operators.length ? operators : undefined,
      aircraft: types.join(' & ') || undefined,
      aircraftTypes: types.length ? types : undefined,
      flight: cleanFlight(plane1?.flight) ?? e.flight,
      registration: reg || undefined,
      fatalities: box?.fatalities ?? e.deaths,
      survivors: box?.survivors ?? e.survivors,
      injured: box?.injuries ?? e.injured,
      aboard: box?.occupants,
      category: classifyCategory(wdOperators.flatMap((o) => o.classes), classes, operators),
      cause: classifyCause([summary ?? '', ...causes, ...classes]),
      summary,
      phase: phaseFrom(summary),
      kind: classes.filter((c) => !/^aviation (accident|incident|occurrence)$/i.test(c)).join(', ') || undefined,
      from: routeEnd(fromWd, plane1?.origin),
      to: routeEnd(toWd, plane1?.destination),
      wiki: e.title,
    })
  }

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
  const deduped = out.filter((c) => {
    if (c.wiki && EXCLUDE.has(c.wiki)) return false
    if (c.wiki) return true
    return !(byDate.get(c.date) ?? []).some((o) => o !== c && o.wiki && km(o, c) < 100)
  })
  console.log(`Dropped ${out.length - deduped.length} duplicates`)
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
