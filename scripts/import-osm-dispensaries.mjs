#!/usr/bin/env node
/**
 * Import real dispensary listings from OpenStreetMap and write them into
 * src/data/dispensaries.ts, replacing the built-in demo set.
 *
 * Why OpenStreetMap: it's the same free, keyless, open (ODbL-licensed) map
 * data this app's map already renders on. There's no public API for
 * pulling real Google Maps / Apple Maps / Leafly / Weedmaps listings
 * without a paid developer key (Google/Apple) or violating a site's terms
 * of service (Leafly/Weedmaps explicitly prohibit scraping) — OSM is the
 * legitimate free option.
 *
 * This script needs normal internet access, which the sandboxed session
 * that wrote it does not have — run it on your own machine.
 *
 * Usage:
 *   node scripts/import-osm-dispensaries.mjs "Denver, CO"
 *   node scripts/import-osm-dispensaries.mjs --bbox 39.55,-105.3,39.9,-104.6
 *   node scripts/import-osm-dispensaries.mjs --near 26.6771,-80.0370 --radius 10000
 *   node scripts/import-osm-dispensaries.mjs "Portland, OR" --limit 25 --out src/data/dispensaries.ts
 *
 * IMPORTANT — what this does and doesn't get you:
 *   - Real dispensary NAME, ADDRESS, PHONE/HOURS (when mapped) and LOCATION.
 *   - It does NOT get you a real product menu. This app's product catalog
 *     (src/data/generateProducts.ts) is synthetic demo data no matter what
 *     dispensary it's attached to — prices/THC%/strains/stock are made up.
 *     Don't present them as any of these businesses' actual live menu.
 *   - No star rating is invented — OpenStreetMap doesn't have one, so
 *     `rating` is simply left out rather than faked.
 *   - A `shop=cannabis` entry with no `name` tag is DROPPED, not given a
 *     placeholder like "Licensed Retail Location" — a made-up name is
 *     worse than no listing at all.
 *   - Coverage depends on volunteer OSM mapping in your area; a 0-result
 *     run doesn't necessarily mean there are no dispensaries there.
 */

import { writeFile } from 'node:fs/promises'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// A descriptive User-Agent is required by Nominatim's usage policy.
const USER_AGENT = 'leafmap-dispensary-import-script/1.0 (local, one-off run)'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--bbox') args.bbox = argv[++i]
    else if (a === '--near') args.near = argv[++i]
    else if (a === '--radius') args.radius = Number(argv[++i])
    else if (a === '--limit') args.limit = Number(argv[++i])
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--overpass-url') args.overpassUrl = argv[++i]
    else args._.push(a)
  }
  return args
}

async function geocodePlace(place) {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({ q: place, format: 'json', limit: '1' })}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Nominatim request failed: HTTP ${res.status}`)
  const results = await res.json()
  if (!results.length) throw new Error(`Could not find a location for "${place}".`)
  const [south, north, west, east] = results[0].boundingbox.map(Number)
  return { kind: 'bbox', south, west, north, east, label: results[0].display_name }
}

export function parseBboxArg(bbox) {
  const parts = bbox.split(',').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error('--bbox must be "south,west,north,east" (four comma-separated numbers)')
  }
  const [south, west, north, east] = parts
  return { kind: 'bbox', south, west, north, east, label: `bbox(${bbox})` }
}

/** `--near lat,lng` (paired with `--radius <meters>`, default 10000 = 10km) —
 * a plain "search around this point" mode, using Overpass's `around:`
 * filter instead of a bounding box. */
export function parseNearArg(near, radiusMeters) {
  const parts = near.split(',').map(Number)
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    throw new Error('--near must be "lat,lng" (two comma-separated numbers)')
  }
  const [lat, lng] = parts
  const radius = radiusMeters || 10000
  return { kind: 'point', lat, lng, radiusMeters: radius, label: `${radius}m around (${lat}, ${lng})` }
}

export function overpassFilter(area) {
  return area.kind === 'point'
    ? `(around:${area.radiusMeters},${area.lat},${area.lng})`
    : `(${area.south},${area.west},${area.north},${area.east})`
}

async function queryOverpass(overpassUrl, area) {
  const filter = overpassFilter(area)
  const query = `
    [out:json][timeout:60];
    (
      node["shop"="cannabis"]${filter};
      way["shop"="cannabis"]${filter};
      relation["shop"="cannabis"]${filter};
    );
    out center tags;
  `.trim()

  const res = await fetch(overpassUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) {
    throw new Error(
      `Overpass request failed: HTTP ${res.status}. Public instances rate-limit — wait a bit and retry, or pass --overpass-url with a mirror (e.g. https://overpass.kumi.systems/api/interpreter).`,
    )
  }
  const json = await res.json()
  return json.elements ?? []
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

function elementLatLng(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon }
  return null
}

function buildAddress(tags) {
  const streetParts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean)
  if (streetParts.length) return streetParts.join(' ')
  return tags['addr:full'] || 'Address not listed on OpenStreetMap'
}

/** Pure element -> Dispensary mapper, kept separate from I/O so it can be
 * unit-tested against fixture data without hitting the network. */
export function toDispensary(el) {
  const tags = el.tags || {}
  const name = tags.name
  if (!name) return null
  const latlng = elementLatLng(el)
  if (!latlng) return null
  return {
    id: `disp-osm-${slugify(name)}-${el.id}`,
    name,
    address: buildAddress(tags),
    city: tags['addr:city'] || 'Unknown city',
    state: tags['addr:state'] || '',
    zip: tags['addr:postcode'] || '',
    coords: { lat: latlng.lat, lng: latlng.lng },
    hours: tags.opening_hours || 'Hours not listed on OpenStreetMap',
    phone: tags.phone || tags['contact:phone'] || 'Not listed on OpenStreetMap',
    licenseNumber: 'Not available via OpenStreetMap — check your state licensing board',
    source: 'openstreetmap',
    // Optional and omitted entirely when absent, same reasoning as `rating`:
    // no OSM tag for it means no value, not a guess.
    ...(tags.website || tags['contact:website']
      ? { website: tags.website || tags['contact:website'] }
      : {}),
  }
}

/** Pure elements[] -> deduped, capped Dispensary[] mapper (also
 * independently testable with fixture data). */
export function elementsToDispensaries(elements, limit = 40) {
  const byId = new Map()
  for (const el of elements) {
    const d = toDispensary(el)
    if (d) byId.set(d.id, d)
  }
  return [...byId.values()].slice(0, limit)
}

function renderTsModule({ dispensaries, sourceLabel }) {
  return `import type { Dispensary } from '../types'

// AUTO-GENERATED by scripts/import-osm-dispensaries.mjs on ${new Date().toISOString().slice(0, 10)}
// Source: OpenStreetMap (© OpenStreetMap contributors, data under the ODbL license)
// Query area: ${sourceLabel}
//
// Name / address / location are real. The product catalog generated for
// these dispensaries (see data/generateProducts.ts) is still 100%
// synthetic demo data — do not present prices, THC%/terpene%, brands or
// strains shown for them as any business's actual live menu.
export const dispensaries: Dispensary[] = ${JSON.stringify(dispensaries, null, 2)}
`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const place = args._.join(' ').trim()
  if (!place && !args.bbox && !args.near) {
    console.error('Usage: node scripts/import-osm-dispensaries.mjs "<City, ST>" [--limit N] [--out path]')
    console.error('   or: node scripts/import-osm-dispensaries.mjs --bbox south,west,north,east')
    console.error('   or: node scripts/import-osm-dispensaries.mjs --near lat,lng [--radius meters]')
    process.exitCode = 1
    return
  }

  const area = args.near
    ? parseNearArg(args.near, args.radius)
    : args.bbox
      ? parseBboxArg(args.bbox)
      : await geocodePlace(place)
  console.log(`Searching OpenStreetMap for cannabis dispensaries in: ${area.label}`)

  const elements = await queryOverpass(args.overpassUrl || DEFAULT_OVERPASS_URL, area)
  const dispensaries = elementsToDispensaries(elements, args.limit || 40)

  if (dispensaries.length === 0) {
    console.log(
      '\nFound 0 dispensaries tagged shop=cannabis in that area on OpenStreetMap.\n' +
        'That reflects OSM mapping coverage, not necessarily reality — try a larger\n' +
        'area, double check the place name, or add missing shops to OSM yourself\n' +
        '(https://www.openstreetmap.org) so future queries find them.',
    )
    return
  }

  const outPath = args.out || 'src/data/dispensaries.ts'
  await writeFile(outPath, renderTsModule({ dispensaries, sourceLabel: area.label }))

  console.log(`\nWrote ${dispensaries.length} real dispensaries to ${outPath}:`)
  for (const d of dispensaries) console.log(`  - ${d.name} (${d.city || 'unknown city'})`)
  console.log(
    `\nThis overwrote ${outPath} (git-tracked — revert with: git checkout -- ${outPath}).\n` +
      'Run `npm run dev` or `npm run build` to see it. Remember: the menu items\n' +
      'attached to these are still generated demo data, not real inventory.',
  )
}

// Only auto-run when executed directly (`node import-osm-dispensaries.mjs`),
// not when imported — e.g. by a test that exercises toDispensary/
// elementsToDispensaries against fixture data without touching the network.
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main().catch((err) => {
    console.error('Import failed:', err.message)
    process.exitCode = 1
  })
}
