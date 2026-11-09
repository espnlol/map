// Reads the "aircraft occurrence" infobox from English Wikipedia articles and
// turns it into plain values (summary, site, coordinates, aircraft, operators,
// route, people aboard, deaths, survivors, ...).

const API = 'https://en.wikipedia.org/w/api.php'
const INFOBOX = /\{\{\s*Infobox[ _](aircraft[ _]occurrence|airliner[ _]accident|aircraft[ _]accident|aviation[ _]accident|airliner[ _]incident)/i

/**
 * Fetches wikitext for many titles, 50 per request (the API's limit).
 * @returns {Promise<Map<string, string>>} requested title -> wikitext
 */
export async function fetchWikitext(titles, { userAgent, onProgress } = {}) {
  const out = new Map()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const params = new URLSearchParams({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1',
      format: 'json', formatversion: '2', maxlag: '5', titles: batch.join('|'),
    })
    let data
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': userAgent } })
      if (res.ok) {
        data = await res.json()
        if (!data.error) break
      }
      if (attempt >= 6) throw new Error(`Wikipedia API kept failing (HTTP ${res.status})`)
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    }
    // Map normalized/redirected titles back to the ones we asked for.
    const back = new Map()
    for (const n of data.query.normalized ?? []) back.set(n.to, n.from)
    for (const r of data.query.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from)
    for (const p of data.query.pages ?? []) {
      const text = p.revisions?.[0]?.slots?.main?.content
      if (text) out.set(back.get(p.title) ?? p.title, text)
    }
    onProgress?.(Math.min(i + 50, titles.length), titles.length)
    await new Promise((r) => setTimeout(r, 250))
  }
  return out
}

/** Returns the text between the braces of the first template matching `re`. */
function extractTemplate(text, re) {
  const m = re.exec(text)
  if (!m) return null
  let depth = 0
  for (let i = m.index; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++ }
    else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return text.slice(m.index + 2, i - 1)
    }
  }
  return null
}

/** Splits template parameters on top-level "|" (not inside {{ }} or [[ ]]). */
function splitParams(body) {
  const parts = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue }
    if ((two === '}}' || two === ']]') && depth > 0) { depth--; cur += two; i++; continue }
    if (body[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += body[i]
  }
  parts.push(cur)
  const params = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const key = p.slice(0, eq).trim().toLowerCase().replace(/\s+/g, '_')
    params[key] = p.slice(eq + 1).trim()
  }
  return params
}

function parseCoord(text) {
  const m = /\{\{\s*coord\s*\|([^{}]*)\}\}/i.exec(text ?? '')
  if (!m) return null
  const args = m[1].split('|').map((s) => s.trim()).filter((s) => s && !s.includes('='))
  const hemi = args.findIndex((a) => /^[NS]$/i.test(a))
  let lat, lng
  if (hemi >= 0) {
    const dms = (xs) => xs.reduce((sum, x, k) => sum + (+x || 0) / 60 ** k, 0)
    lat = dms(args.slice(0, hemi)) * (/^S$/i.test(args[hemi]) ? -1 : 1)
    const ew = args.findIndex((a, k) => k > hemi && /^[EW]$/i.test(a))
    if (ew < 0) return null
    lng = dms(args.slice(hemi + 1, ew)) * (/^W$/i.test(args[ew]) ? -1 : 1)
  } else {
    lat = +args[0]
    lng = +args[1]
  }
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}

/** Wikitext -> readable plain text. */
export function plain(v) {
  if (!v) return ''
  let s = v
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    // Links first: their "|" would otherwise be read as template separators.
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
  // Templates, innermost first.
  for (let k = 0; k < 8 && /\{\{/.test(s); k++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const args = inner.split('|').map((a) => a.trim())
      const name = args[0].toLowerCase()
      const pos = args.slice(1).filter((a) => !/^\w+\s*=/.test(a))
      if (/^(efn|sfn|refn|cn|citation needed|ref|r|notetag|clarify|dead link|when|which|by whom|coord|flagicon|flag icon|nbsp|snd|spaced ndash)/.test(name)) {
        return name === 'nbsp' ? ' ' : name === 'snd' || name === 'spaced ndash' ? ' – ' : ''
      }
      if (name === '·' || name === 'middot' || name === 'dot') return ' · '
      if (/^(flag|flagcountry|flagu|country)$/.test(name)) return pos[0] ?? ''
      if (/^(start date|start date and age|date)$/.test(name)) return pos.slice(0, 3).join('-')
      if (name === 'convert' || name === 'cvt') return [pos[0], pos[1]].filter(Boolean).join(' ')
      if (/^(lang|transl)$/.test(name)) return pos[pos.length - 1] ?? ''
      if (/^(ubl|unbulleted list|plainlist|flatlist|hlist|bulleted list)$/.test(name)) return pos.join(', ')
      // small, nowrap, nobold, longitem, abbr, ... -> their (last) text argument
      return pos.length ? (/^abbr$/.test(name) ? pos[0] : pos[pos.length - 1]) : ''
    })
  }
  s = s
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/^\s*[*#]\s*/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/\s*\n\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[,\s·]+|[,\s·]+$/g, '')
  return s
}

const num = (v) => {
  const m = /\d[\d,]*/.exec(plain(v))
  return m ? +m[0].replace(/,/g, '') : undefined
}

/** Pulls the useful fields out of an article's infobox, or null if it has none. */
export function parseInfobox(wikitext) {
  const body = extractTemplate(wikitext, INFOBOX)
  if (!body) return null
  const p = splitParams(body)
  const planes = []
  for (const prefix of ['', 'plane1_', 'plane2_', 'plane3_', 'aircraft1_', 'aircraft2_']) {
    const type = p[`${prefix}aircraft_type`] ?? p[`${prefix}type`]
    if (prefix === '' && !type && !p.operator) continue
    if (prefix !== '' && !type && !p[`${prefix}operator`]) continue
    planes.push({
      type: plain(type),
      operator: plain(p[`${prefix}operator`]),
      registration: plain(p[`${prefix}tail_number`] ?? p[`${prefix}tailnum`] ?? p[`${prefix}registration`]),
      flight: plain(p[`${prefix}iata_flight_number`] ?? p[`${prefix}iata`] ?? p[`${prefix}callsign`]),
      origin: plain(p[`${prefix}origin`]),
      destination: plain(p[`${prefix}destination`]),
    })
  }
  const deaths = num(p.total_fatalities) ?? num(p.fatalities)
  const ground = num(p.ground_fatalities)
  return {
    summary: plain(p.summary),
    site: plain(p.site),
    coord: parseCoord(p.coordinates) ?? parseCoord(p.coords) ?? parseCoord(p.site),
    planes: planes.filter((x) => x.type || x.operator),
    occupants: num(p.total_occupants) ?? num(p.occupants),
    fatalities: deaths != null && p.total_fatalities == null && ground ? deaths + ground : deaths,
    survivors: num(p.total_survivors) ?? num(p.survivors),
    injuries: num(p.total_injuries) ?? num(p.injuries),
    occurrence: plain(p.occurrence_type),
  }
}

const PHASES = [
  ['Taxi', /\btaxi(ing)?\b|on the ground|parked|on the ramp|during refuel/i],
  ['Climb', /\bclimb|after take-?off|after departure|initial climb/i],
  ['Takeoff', /take-?off|taking off|departure roll|rejected take|lift-?off/i],
  ['Approach', /approach|go-around|on final|descent|descending|landing approach/i],
  ['Landing', /landing|touchdown|overran|overrun|runway excursion|touched down/i],
  ['Cruise', /cruis|en route|in-flight|in flight|mid-?air|disappear|cruising altitude/i],
]

/** Best guess at the phase of flight from a summary sentence. */
export function phaseFrom(text) {
  if (!text) return undefined
  for (const [phase, re] of PHASES) if (re.test(text)) return phase
  return undefined
}
