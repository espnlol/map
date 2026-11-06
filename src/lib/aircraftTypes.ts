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
}

export function modelName(typeCode?: string, desc?: string): string | undefined {
  if (desc && desc.trim()) return titleCase(desc.trim())
  if (!typeCode) return undefined
  return TYPES[typeCode.toUpperCase()] ?? typeCode
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
