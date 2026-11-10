/**
 * Fallback names for common ICAO type designators, used when the live feed
 * sends only the code (e.g. "B738") and no long description.
 */
const TYPES: Record<string, string> = {
  A19N: 'Airbus A319neo', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo',
  A318: 'Airbus A318', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321',
  A332: 'Airbus A330-200', A333: 'Airbus A330-300', A338: 'Airbus A330-800neo', A339: 'Airbus A330-900neo',
  A343: 'Airbus A340-300', A346: 'Airbus A340-600', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000',
  A388: 'Airbus A380-800', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  B712: 'Boeing 717', B733: 'Boeing 737-300', B734: 'Boeing 737-400', B737: 'Boeing 737-700',
  B738: 'Boeing 737-800', B739: 'Boeing 737-900', B37M: 'Boeing 737 MAX 7', B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9', B3XM: 'Boeing 737 MAX 10', B744: 'Boeing 747-400', B748: 'Boeing 747-8',
  B74F: 'Boeing 747 Freighter', B752: 'Boeing 757-200', B753: 'Boeing 757-300', B762: 'Boeing 767-200',
  B763: 'Boeing 767-300', B764: 'Boeing 767-400', B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR',
  B773: 'Boeing 777-300', B77W: 'Boeing 777-300ER', B778: 'Boeing 777-8', B779: 'Boeing 777-9',
  B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  CRJ2: 'Bombardier CRJ200', CRJ7: 'Bombardier CRJ700', CRJ9: 'Bombardier CRJ900', CRJX: 'Bombardier CRJ1000',
  E135: 'Embraer ERJ-135', E145: 'Embraer ERJ-145', E170: 'Embraer E170', E75L: 'Embraer E175',
  E75S: 'Embraer E175', E190: 'Embraer E190', E195: 'Embraer E195', E290: 'Embraer E190-E2', E295: 'Embraer E195-E2',
  AT43: 'ATR 42-300', AT45: 'ATR 42-500', AT72: 'ATR 72', AT75: 'ATR 72-500', AT76: 'ATR 72-600',
  DH8A: 'Dash 8-100', DH8B: 'Dash 8-200', DH8C: 'Dash 8-300', DH8D: 'Dash 8 Q400',
  MD11: 'McDonnell Douglas MD-11', MD82: 'McDonnell Douglas MD-82', MD88: 'McDonnell Douglas MD-88',
  C172: 'Cessna 172 Skyhawk', C182: 'Cessna 182 Skylane', C152: 'Cessna 152', C150: 'Cessna 150',
  C208: 'Cessna 208 Caravan', C25A: 'Cessna Citation CJ2', C25B: 'Cessna Citation CJ3', C56X: 'Cessna Citation Excel',
  C68A: 'Cessna Citation Latitude', C700: 'Cessna Citation Longitude', C750: 'Cessna Citation X',
  PA28: 'Piper PA-28 Cherokee', PA32: 'Piper PA-32', PA34: 'Piper Seneca', PA44: 'Piper Seminole', P28A: 'Piper PA-28 Archer',
  SR20: 'Cirrus SR20', SR22: 'Cirrus SR22', SF50: 'Cirrus Vision Jet', BE20: 'Beechcraft King Air 200',
  BE35: 'Beechcraft Bonanza', BE36: 'Beechcraft Bonanza A36', BE58: 'Beechcraft Baron', B350: 'Beechcraft King Air 350',
  PC12: 'Pilatus PC-12', PC24: 'Pilatus PC-24', TBM9: 'Daher TBM 900', DA40: 'Diamond DA40', DA42: 'Diamond DA42',
  GLF4: 'Gulfstream IV', GLF5: 'Gulfstream V', GLF6: 'Gulfstream G650', GL5T: 'Bombardier Global 5000',
  GLEX: 'Bombardier Global Express', GL7T: 'Bombardier Global 7500', CL35: 'Bombardier Challenger 350',
  CL60: 'Bombardier Challenger 600', LJ45: 'Learjet 45', LJ75: 'Learjet 75', E55P: 'Embraer Phenom 300',
  E50P: 'Embraer Phenom 100', FA7X: 'Dassault Falcon 7X', F900: 'Dassault Falcon 900', F2TH: 'Dassault Falcon 2000',
  H25B: 'Hawker 800', R44: 'Robinson R44', R22: 'Robinson R22', R66: 'Robinson R66', EC35: 'Airbus H135',
  EC45: 'Airbus H145', EC30: 'Airbus H130', AS50: 'Airbus AS350 Écureuil', B06: 'Bell 206', B407: 'Bell 407',
  B429: 'Bell 429', S76: 'Sikorsky S-76', H60: 'Sikorsky UH-60 Black Hawk', A139: 'Leonardo AW139',
  C17: 'Boeing C-17 Globemaster III', C130: 'Lockheed C-130 Hercules', C30J: 'Lockheed C-130J',
  K35R: 'Boeing KC-135 Stratotanker', F16: 'General Dynamics F-16', F18S: 'Boeing F/A-18 Super Hornet',
  F35: 'Lockheed F-35', V22: 'Bell Boeing V-22 Osprey', BALL: 'Balloon', GLID: 'Glider',
  VC25: 'Boeing VC-25 (Air Force One)', E4: 'Boeing E-4B Nightwatch', B52: 'Boeing B-52 Stratofortress', B1: 'Rockwell B-1 Lancer',
  A124: 'Antonov An-124 Ruslan', A3ST: 'Airbus Beluga', A337: 'Airbus BelugaXL', SGUP: 'Aero Spacelines Super Guppy',
  B17: 'Boeing B-17 Flying Fortress', B29: 'Boeing B-29 Superfortress', CONI: 'Lockheed Constellation', ER2: 'NASA ER-2',
  WB57: 'Martin WB-57', B74S: 'Boeing 747SP', BLCF: 'Boeing 747 Dreamlifter', C5M: 'Lockheed C-5M Galaxy',
  E3TF: 'Boeing E-3 Sentry', E3CF: 'Boeing E-3 Sentry', E6: 'Boeing E-6 Mercury', U2: 'Lockheed U-2', R135: 'Boeing RC-135',
  DC3: 'Douglas DC-3', DC6: 'Douglas DC-6', P51: 'North American P-51 Mustang', SPIT: 'Supermarine Spitfire',
  L101: 'Lockheed L-1011 TriStar', DC10: 'McDonnell Douglas DC-10', IL76: 'Ilyushin Il-76',
  A400: 'Airbus A400M Atlas', KODI: 'Daher Kodiak 100', K100: 'Daher Kodiak 100', TBM7: 'Daher TBM 700', TBM8: 'Daher TBM 850', EA50: 'Eclipse 500', PC21: 'Pilatus PC-21', DA62: 'Diamond DA62', C25M: 'Cessna Citation M2', AS3B: 'Airbus H175',
}

// The full ICAO type list (public/aircraft-types.json, built by scripts/build-types.py):
// code -> [name, ICAO class like "L2J", wake category L/M/H/J]
let DB: Record<string, [string, string, string]> = {}
export const typeDbReady = fetch(`${import.meta.env.BASE_URL}aircraft-types.json`)
  .then((r) => (r.ok ? r.json() : {}))
  .then((d) => {
    DB = d
  })
  .catch(() => {})

const ENGINE: Record<string, string> = { J: 'jet', T: 'turboprop', P: 'piston', E: 'electric', R: 'rocket' }
const COUNT: Record<string, string> = { '1': 'Single', '2': 'Twin', '3': 'Three-engine', '4': 'Four-engine', '6': 'Six-engine', '8': 'Eight-engine' }

/** "Twin-turboprop plane", "Single-engine helicopter" … from an ICAO class like L2T. */
function describeClass(cls?: string): string | undefined {
  if (!cls || cls.length < 3) return undefined
  const [kind, n, e] = cls
  if (kind === 'H') return `${COUNT[n] ? `${COUNT[n]}-engine ` : ''}helicopter`.replace(/^./, (c) => c.toUpperCase())
  if (kind === 'G') return 'Gyrocopter'
  if (kind === 'T') return 'Tilt-rotor aircraft'
  if (kind === 'B') return 'Balloon or airship'
  if (kind === 'A') return 'Amphibious plane'
  if (kind === 'S') return 'Seaplane'
  if (n === '0') return 'Glider'
  const eng = ENGINE[e]
  if (!eng) return undefined
  return n === '1' ? `Single-engine ${eng} plane` : `${COUNT[n] ?? `${n}-engine`} ${eng} plane`
}

/** Types matching a search (code or name), for picking the right type by hand. */
export function searchTypes(query: string, limit = 8): { code: string; name: string }[] {
  const q = query.trim().toUpperCase()
  if (q.length < 2) return []
  const out: { code: string; name: string; score: number }[] = []
  const seen = new Set<string>()
  for (const code of new Set([...Object.keys(TYPES), ...Object.keys(DB)])) {
    const name = modelName(code) ?? code
    const n = name.toUpperCase()
    const score = code === q ? 100 : code.startsWith(q) ? 80 : n.includes(q) ? 60 - n.indexOf(q) / 10 : n.replace(/[^A-Z0-9]/g, '').includes(q.replace(/[^A-Z0-9]/g, '')) ? 40 : 0
    if (score && !seen.has(code)) {
      seen.add(code)
      out.push({ code, name, score })
    }
  }
  return out.sort((a, b) => b.score - a.score || a.name.length - b.name.length).slice(0, limit)
}

export function modelName(typeCode?: string, desc?: string): string | undefined {
  if (desc && desc.trim()) return titleCase(desc.trim())
  if (!typeCode) return undefined
  const code = typeCode.toUpperCase()
  return TYPES[code] ?? (DB[code]?.[0] || describeClass(DB[code]?.[1])) ?? typeCode
}

// Size info for a few common types the type list doesn't have yet.
const EXTRA_CLASS: Record<string, [string, string, string]> = {
  KODI: ['', 'L1T', 'L'],
  K100: ['', 'L1T', 'L'],
  AS3B: ['', 'H2T', 'M'],
}

// Airliner families that count as "Large" (75,000–300,000 lb) even though their wake category is Medium.
const LARGE_FAMILIES = /^(A3[12]\d|A2[01]N|A31[89]|B73\d|B3[789X]M|B7[0-2]\d|MD[89]\d|B712|BCS[13]|E19\d|E29\d|C130|C30J|A400|P8|IL76|T204|A148|SU95|C919|E75[LS]|CRJ[79X])$/

/**
 * A size category for aircraft that don't broadcast one, worked out from the
 * type's ICAO class and wake category. Returns '' if it can't tell.
 */
export function inferCategory(typeCode?: string): string {
  if (!typeCode) return ''
  const code = typeCode.toUpperCase()
  const t = DB[code] ?? EXTRA_CLASS[code]
  if (!t) return ''
  const [, cls, wtc] = t
  const kind = cls[0]
  if (code === 'B752' || code === 'B753') return 'A4'
  if (kind === 'H' || kind === 'G') return 'A7'
  if (kind === 'B') return 'B2'
  if (cls[1] === '0' || code === 'GLID') return 'B1'
  if (wtc === 'H' || wtc === 'J') return 'A5'
  if (wtc === 'M') return LARGE_FAMILIES.test(code) ? 'A3' : 'A2'
  if (wtc === 'L') return 'A1'
  return ''
}

function titleCase(s: string): string {
  // Feeds often send "BOEING 737-800" — make it read nicely.
  if (s !== s.toUpperCase()) return s
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Ii|Iii|Iv|Er|Lr|Neo|Max)\b/g, (m) => (m === 'Neo' ? 'neo' : m.toUpperCase()))
}

export const isKnownType = (code: string) => code.toUpperCase() in TYPES
