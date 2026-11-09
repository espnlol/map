// Turns Wikidata labels into Black Box Atlas's categories.

// Checked in order; the first match wins.
const CAUSE_RULES = [
  ['Terrorism', /terror|\bbomb|hijack|sabotage|explosive device|suicide attack|suicide bomb/i],
  ['Shootdown', /shoot ?down|shot down|\bmissile|anti-aircraft|surface-to-air|air-to-air|friendly fire|intercepted/i],
  ['Deliberate', /suicide|murder|deliberate|intentional/i],
  ['Collision', /collision|collided/i],
  ['Bird strike', /\bbird/i],
  ['Fire', /\bfires?\b|\bsmoke\b|\bblaze\b/i],
  ['Human error', /pilot error|human error|crew error|controlled flight into terrain|\bcfit\b|spatial disorientation|fuel (exhaustion|starvation)|ran out of fuel|navigation(al)? error|air traffic control error|\batc error/i],
  ['Weather', /weather|\bicing\b|\bice\b|wind ?shear|microburst|thunderstorm|turbulence|\bfog\b|lightning|\bsnow|\bstorm|downdraft|volcanic ash|\brain\b|\bheavy rain|poor visibility|low visibility|whiteout|crosswind|tailwind/i],
  ['Mechanical', /mechanical|engine failure|engine fire|structural|fatigue|\bfailure|malfunction|decompression|maintenance|design flaw|hydraulic|uncontained|flutter|corrosion|defect|separation|explosion of|fuel tank|cargo door|\bfaulty/i],
  // Summaries that say the cause isn't known shouldn't fall through to the
  // weak "human error" guesses below.
  ['Unknown', /unknown (reason|cause)s?|undetermined|not (been )?determined|unexplained|not confirmed|under investigation|disputed|mystery|disappear/i],
  ['Human error', /pilot|crew|\bstall|runway excursion|overran|overrun|undershoot|flew into|into terrain|into a mountain|into the sea|navigation|disoriented|descended below|premature descent|misread|confusion/i],
]

/** @param {string[]} labels cause labels and accident-class labels */
export function classifyCause(labels) {
  // Wikipedia's own summary (the first label) wins; Wikidata's labels are a fallback.
  const [summary, ...rest] = labels
  for (const raw of [summary ?? '', rest.join(' | ')]) {
    if (!raw) continue
    // "collision with terrain/a mountain" is flying into the ground, not two aircraft colliding
    const text = raw.replace(/collision with (?:the |a |an )?(terrain|ground|mountain|mountainside|hill|hillside|trees?|water|sea|ocean|power ?lines?|cables?|tower|mast|building|obstacles?|cliff|ridge|volcano|glacier|runway)/gi, 'impact with $1')
    for (const [cause, re] of CAUSE_RULES) if (re.test(text)) return cause
  }
  return 'Unknown'
}

/**
 * @param {string[]} operatorClasses what the operator is ("airline", "air force", ...)
 * @param {string[]} accidentClasses what the accident is
 * @param {string[]} operatorNames
 */
const MILITARY_TYPE = /\b(?:F|B|C|KC|EC|RC|P|A|E|U|T|AH|UH|CH|MH|HH|SH|OH|V|MV|CV|S)-\d|\b(?:MiG|Su|Yak-(?:9|28|38))-?\d|fighter|bomber|stratofortress|stratotanker|hercules|globemaster|galaxy|starlifter|thunder(?:jet|streak|chief|bolt)|sabre|phantom|tornado|harrier|stuka|spitfire|hurricane|mosquito|lancaster|halifax|liberator|flying fortress|black hawk|chinook|apache|osprey|super cobra|seahawk|sea king|warplane|military/i

export function classifyCategory(operatorClasses, accidentClasses, operatorNames, hasFlightNumber = false, aircraftTypes = [], crashName = '') {
  const ops = operatorClasses.join(' | ')
  // the crash's own name often says it ("2019 Indian Air Force An-32 crash", "... Cargo Flight 1045")
  const names = [...operatorNames, crashName].join(' | ')
  if (/cargo|freight/i.test(ops) || /cargo|freight|fedex|\bups\b|dhl/i.test(names)) return 'Cargo'
  if (/air force|military|navy|army|armed forces|naval|marine corps|government|ministry|space agency|coast guard|police/i.test(ops + ' | ' + names)) {
    return 'Military / State'
  }
  if (/airline|air carrier|charter|regional|airway|air transport|aviation company|flag carrier|low-cost/i.test(ops)) return 'Commercial'
  // no operator known: a military aircraft type gives it away
  if (!operatorNames.length && MILITARY_TYPE.test(aircraftTypes.join(' | '))) return 'Military / State'
  if (/air(lines?|ways)\b|\bair\b|aero|aviation|express/i.test(names)) return 'Commercial'
  if (/airliner/i.test(accidentClasses.join(' | '))) return 'Commercial'
  // a scheduled/charter flight number means an airline flight
  if (hasFlightNumber) return 'Commercial'
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

// Historical names -> today's country, where that's unambiguous.
const COUNTRY_RENAMES = new Map(Object.entries({
  "People's Republic of China": 'China',
  'Kingdom of Denmark': 'Denmark',
  'Empire of Japan': 'Japan',
  'Occupation of Japan': 'Japan',
  'United States occupation of the Ryukyu Islands': 'Japan',
  'German Reich': 'Germany',
  'Nazi Germany': 'Germany',
  'Weimar Republic': 'Germany',
  'German Empire': 'Germany',
  'West Germany': 'Germany',
  'East Germany': 'Germany',
  "Polish People's Republic": 'Poland',
  'Second Polish Republic': 'Poland',
  'Azerbaijan Soviet Socialist Republic': 'Azerbaijan',
  'Kazakh Soviet Socialist Republic': 'Kazakhstan',
  'Latvian Soviet Socialist Republic': 'Latvia',
  'Lithuanian Soviet Socialist Republic': 'Lithuania',
  'Estonian Soviet Socialist Republic': 'Estonia',
  'Ukrainian Soviet Socialist Republic': 'Ukraine',
  'Byelorussian Soviet Socialist Republic': 'Belarus',
  'Georgian Soviet Socialist Republic': 'Georgia',
  'Armenian Soviet Socialist Republic': 'Armenia',
  'Uzbek Soviet Socialist Republic': 'Uzbekistan',
  'Russian Socialist Federative Soviet Republic': 'Russia',
  'Russian Soviet Federative Socialist Republic': 'Russia',
  'Russian Empire': 'Russia',
  'Rhodesia': 'Zimbabwe',
  'Southern Rhodesia': 'Zimbabwe',
  'South Yemen': 'Yemen',
  'North Yemen': 'Yemen',
  'Zaire': 'Democratic Republic of the Congo',
  'Burma': 'Myanmar',
  'Ceylon': 'Sri Lanka',
  'Dahomey': 'Benin',
  'Upper Volta': 'Burkina Faso',
  'Kingdom of Italy': 'Italy',
  'Kingdom of Egypt': 'Egypt',
  'Kingdom of Afghanistan': 'Afghanistan',
  'Kingdom of Iraq': 'Iraq',
  'Kingdom of Greece': 'Greece',
  'Kingdom of Romania': 'Romania',
  'Kingdom of Hungary': 'Hungary',
  'Kingdom of Yugoslavia': 'Yugoslavia',
  'Federal Republic of Yugoslavia': 'Serbia',
  'Serbia and Montenegro': 'Serbia',
  'Kingdom of the Netherlands': 'Netherlands',
  'Union of South Africa': 'South Africa',
  'Dominion of Newfoundland': 'Canada',
  'Newfoundland': 'Canada',
  'British Raj': 'India',
  'Dominion of India': 'India',
  'Dominion of Pakistan': 'Pakistan',
  'Mandatory Palestine': 'Israel',
  'French Algeria': 'Algeria',
  'Belgian Congo': 'Democratic Republic of the Congo',
  'Republic of the Congo (Léopoldville)': 'Democratic Republic of the Congo',
  'Tanganyika': 'Tanzania',
  'Federation of Rhodesia and Nyasaland': 'Zimbabwe',
  'Ottoman Empire': 'Turkey',
  'Persia': 'Iran',
  'Siam': 'Thailand',
  'South Vietnam': 'Vietnam',
  'North Vietnam': 'Vietnam',
  'Khmer Republic': 'Cambodia',
  'Kingdom of Laos': 'Laos',
  'Czech Republic': 'Czechia',
  'The Bahamas': 'Bahamas',
}))
// States that split up: only the crash site can say which country it is today.
export const DEFUNCT_STATES = new Set(['Soviet Union', 'Czechoslovakia', 'Yugoslavia', 'Kingdom of Yugoslavia', 'Socialist Federal Republic of Yugoslavia', 'Austria-Hungary', 'United Arab Republic', 'British Mandate'])

/** Today's name for a country (the date decides "Republic of China": China before 1950, Taiwan after). */
export function modernCountry(name, date) {
  if (!name) return name
  if (name === 'Republic of China') return date && date < '1950' ? 'China' : 'Taiwan'
  return COUNTRY_RENAMES.get(name) ?? name
}
