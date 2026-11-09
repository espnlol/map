// Turns Wikidata labels into Black Box Atlas's categories.

// Checked in order; the first match wins.
const CAUSE_RULES = [
  ['Terrorism', /terror|\bbomb|hijack|sabotage|explosive device|suicide attack/i],
  ['Shootdown', /shoot ?down|shot down|\bmissile|anti-aircraft|surface-to-air|air-to-air|friendly fire|intercepted/i],
  ['Deliberate', /pilot suicide|murder|deliberate|intentional/i],
  ['Collision', /collision|collided/i],
  ['Bird strike', /\bbird/i],
  ['Fire', /\bfires?\b|\bsmoke\b|\bblaze\b/i],
  ['Human error', /pilot error|human error|crew error|controlled flight into terrain|\bcfit\b|spatial disorientation|fuel (exhaustion|starvation)|ran out of fuel|navigation(al)? error|air traffic control error|\batc error/i],
  ['Weather', /weather|\bicing\b|\bice\b|wind ?shear|microburst|thunderstorm|turbulence|\bfog\b|lightning|\bsnow|\bstorm|downdraft|volcanic ash|\brain\b|\bheavy rain|poor visibility|low visibility|whiteout|crosswind|tailwind/i],
  ['Mechanical', /mechanical|engine failure|engine fire|structural|fatigue|\bfailure|malfunction|decompression|maintenance|design flaw|hydraulic|uncontained|flutter|corrosion|defect|separation|explosion of|fuel tank|cargo door|\bfaulty/i],
  ['Human error', /pilot|crew|\bstall|runway excursion|overran|overrun|undershoot|flew into|into terrain|into a mountain|into the sea|navigation|disoriented|descended below|premature descent|misread|confusion/i],
]

/** @param {string[]} labels cause labels and accident-class labels */
export function classifyCause(labels) {
  const text = labels.join(' | ')
  for (const [cause, re] of CAUSE_RULES) if (re.test(text)) return cause
  return 'Unknown'
}

/**
 * @param {string[]} operatorClasses what the operator is ("airline", "air force", ...)
 * @param {string[]} accidentClasses what the accident is
 * @param {string[]} operatorNames
 */
export function classifyCategory(operatorClasses, accidentClasses, operatorNames) {
  const ops = operatorClasses.join(' | ')
  const names = operatorNames.join(' | ')
  if (/cargo|freight/i.test(ops) || /cargo|freight|fedex|\bups\b|dhl/i.test(names)) return 'Cargo'
  if (/air force|military|navy|army|armed forces|naval|marine corps|government|ministry|space agency|coast guard|police/i.test(ops + ' | ' + names)) {
    return 'Military / State'
  }
  if (/airline|air carrier|charter|regional|airway|air transport|aviation company|flag carrier|low-cost/i.test(ops)) return 'Commercial'
  if (/air(lines?|ways)\b|\bair\b|aero|aviation|express/i.test(names)) return 'Commercial'
  if (/airliner/i.test(accidentClasses.join(' | '))) return 'Commercial'
  return 'General aviation'
}

/**
 * Names the ocean, sea, gulf, strait or channel mentioned in a crash-site
 * description ("Atlantic Ocean, off south-west Ireland" -> "Atlantic Ocean").
 * Rivers, lakes and bays are left alone: those crashes count for their country.
 */
export function waterBodyIn(text) {
  if (!text) return null
  const m =
    /\b((?:Gulf|Sea|Strait|Straits|Bay) of (?:the )?[A-Z][\w'-]*(?: [A-Z][\w'-]*)?)/.exec(text) ??
    /\b((?:[A-Z][\w'-]*\s){1,3}(?:Ocean|Sea|Strait|Channel|Gulf))\b/.exec(text)
  if (!m) return null
  let name = m[1].trim()
  if (/^(North|South|Northern|Southern|Western|Eastern|Central|the)\s+(Atlantic|Pacific|Indian)/i.test(name)) {
    name = name.replace(/^.*?(Atlantic|Pacific|Indian).*$/i, '$1 Ocean')
  }
  return name
}

// Rough ocean/sea lookup by coordinates, used only when the site text says the
// crash was at sea but doesn't name the water. Seas are checked before the big
// oceans so the Mediterranean doesn't count as the Atlantic.
const SEAS = [
  ['Mediterranean Sea', 30, 46, -6, 36.5],
  ['Black Sea', 40.5, 47, 27.5, 42],
  ['Caribbean Sea', 9, 22, -88, -60],
  ['Gulf of Mexico', 18, 31, -98, -81],
  ['North Sea', 51, 61, -4, 9],
  ['Baltic Sea', 53.5, 66, 9, 30],
  ['Red Sea', 12, 30, 32, 44],
  ['Persian Gulf', 23, 30.5, 47.5, 57],
  ['Sea of Japan', 33, 52, 127, 142],
  ['South China Sea', 0, 23, 99, 121],
  ['Java Sea', -8, -2, 105, 120],
  ['Bay of Bengal', 5, 23, 80, 95],
  ['Arabian Sea', 5, 25, 51, 77],
]

const AT_SEA = /\b(off|offshore|ocean|sea|gulf|strait|channel|coast|waters|ditched)\b/i

export function oceanFor(lat, lng, siteText) {
  if (!siteText || !AT_SEA.test(siteText)) return null
  for (const [name, la1, la2, lo1, lo2] of SEAS) if (lat >= la1 && lat <= la2 && lng >= lo1 && lng <= lo2) return name
  if (lat >= 66) return 'Arctic Ocean'
  if (lat <= -60) return 'Southern Ocean'
  if (lng >= -80 && lng <= 20) return 'Atlantic Ocean'
  if (lng > -100 && lng < -80 && lat > 10) return 'Atlantic Ocean'
  if (lng > 20 && lng < 147 && lat < 30) return 'Indian Ocean'
  return 'Pacific Ocean'
}

const US_STATES = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia|Washington, D.C.'.split('|')
const CA_PROVINCES = 'Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland|Newfoundland and Labrador|Nova Scotia|Ontario|Quebec|Québec|Saskatchewan|Yukon|Northwest Territories|Nunavut|Prince Edward Island'.split('|')
const ALIASES = new Map([
  ['U.S.', 'United States'], ['US', 'United States'], ['USA', 'United States'], ['U.S.A.', 'United States'], ['United States of America', 'United States'],
  ['UK', 'United Kingdom'], ['U.K.', 'United Kingdom'], ['England', 'United Kingdom'], ['Scotland', 'United Kingdom'], ['Wales', 'United Kingdom'],
  ['Northern Ireland', 'United Kingdom'], ['Great Britain', 'United Kingdom'], ['USSR', 'Soviet Union'], ['U.S.S.R.', 'Soviet Union'],
  ['Russian SFSR', 'Soviet Union'], ['Ukrainian SSR', 'Soviet Union'], ['People\'s Republic of China', 'China'], ['PRC', 'China'],
  ['Republic of China', 'Taiwan'], ['South Korea', 'South Korea'], ['Republic of Korea', 'South Korea'], ['DR Congo', 'Democratic Republic of the Congo'],
  ['Democratic Republic of Congo', 'Democratic Republic of the Congo'], ['Zaire', 'Democratic Republic of the Congo'], ['Burma', 'Myanmar'],
  ['Czech Republic', 'Czech Republic'], ['Czechia', 'Czech Republic'], ['The Netherlands', 'Netherlands'], ['Holland', 'Netherlands'],
  ...US_STATES.map((st) => [st, 'United States']),
  ...CA_PROVINCES.map((p) => [p, 'Canada']),
])

/**
 * Finds the country in a crash-site description such as
 * "near Clear Lake, Iowa" or "Los Rodeos Airport, Tenerife, Spain".
 * @param {string | undefined} site
 * @param {Set<string>} known country names seen elsewhere in the data
 */
export function countryFromSite(site, known) {
  if (!site) return null
  const parts = site.split(/,|\(|\)/).map((x) => x.replace(/^(near|off|over|in|outside)\s+/i, '').trim()).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].replace(/^the\s+/i, '')
    if (ALIASES.has(part)) return ALIASES.get(part)
    if (known.has(part)) return part
  }
  return null
}
