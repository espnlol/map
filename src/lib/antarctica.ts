/**
 * Research stations in Antarctica, for the map layer.
 *
 * Positions are approximate (to about a kilometre). "Year-round" stations keep
 * a winter crew; "summer" ones are only open roughly November to February.
 * Planes reach Antarctica mostly from Christchurch (NZ), Hobart (AU), Cape Town
 * (ZA) and Punta Arenas (CL), landing on gravel, compacted-snow, skiway or
 * blue-ice runways.
 */

export interface Station {
  name: string
  country: string
  flag: string
  lat: number
  lon: number
  season: 'year-round' | 'summer'
  /** How aircraft get in, if they can. */
  air?: string
  note?: string
}

export const STATIONS: Station[] = [
  // Ross Sea / Ross Dependency
  { name: 'McMurdo Station', country: 'United States', flag: '🇺🇸', lat: -77.846, lon: 166.676, season: 'year-round', air: 'Phoenix Airfield (compacted snow, wheeled jets like the C-17) and Williams Field skiway (ski-equipped LC-130s)', note: 'The largest station in Antarctica, the hub for US flights from Christchurch.' },
  { name: 'Scott Base', country: 'New Zealand', flag: '🇳🇿', lat: -77.849, lon: 166.768, season: 'year-round', air: 'Shares McMurdo\'s airfields. RNZAF C-130s and 757s fly in from Christchurch.' },
  { name: 'Mario Zucchelli Station', country: 'Italy', flag: '🇮🇹', lat: -74.695, lon: 164.113, season: 'summer', air: 'Boulder Clay runway and a sea-ice runway in early summer' },
  { name: 'Jang Bogo Station', country: 'South Korea', flag: '🇰🇷', lat: -74.624, lon: 164.229, season: 'year-round' },
  { name: 'Qinling Station', country: 'China', flag: '🇨🇳', lat: -74.915, lon: 163.72, season: 'year-round', note: 'China\'s newest station, opened in 2024 on Inexpressible Island.' },
  { name: 'Amundsen–Scott South Pole Station', country: 'United States', flag: '🇺🇸', lat: -89.997, lon: 139.27, season: 'year-round', air: 'Skiway for ski-equipped LC-130s and Twin Otters. Closed to flights from about February to October.', note: 'At the geographic South Pole. This map can\'t show the pole itself, so it sits at the bottom edge.' },
  // East Antarctica
  { name: 'Concordia Station', country: 'France / Italy', flag: '🇫🇷🇮🇹', lat: -75.1, lon: 123.333, season: 'year-round', air: 'Skiway (Twin Otters and Baslers)', note: 'On Dome C, one of the coldest places on Earth.' },
  { name: 'Vostok Station', country: 'Russia', flag: '🇷🇺', lat: -78.464, lon: 106.837, season: 'year-round', air: 'Skiway', note: 'Recorded the lowest natural temperature on Earth: −89.2 °C.' },
  { name: 'Dumont d\'Urville Station', country: 'France', flag: '🇫🇷', lat: -66.663, lon: 140.001, season: 'year-round', air: 'Helicopters only; supplied by ship from Hobart.' },
  { name: 'Casey Station', country: 'Australia', flag: '🇦🇺', lat: -66.282, lon: 110.527, season: 'year-round', air: 'Wilkins Aerodrome nearby, a blue-ice runway where Australia\'s A319 lands from Hobart.' },
  { name: 'Mirny Station', country: 'Russia', flag: '🇷🇺', lat: -66.553, lon: 93.009, season: 'year-round' },
  { name: 'Davis Station', country: 'Australia', flag: '🇦🇺', lat: -68.576, lon: 77.969, season: 'year-round', air: 'Helicopters and ski planes. A paved year-round runway was proposed but shelved in 2022.' },
  { name: 'Zhongshan Station', country: 'China', flag: '🇨🇳', lat: -69.373, lon: 76.372, season: 'year-round', air: 'Skiway used by China\'s Snow Eagle 601 (a Basler BT-67)' },
  { name: 'Progress Station', country: 'Russia', flag: '🇷🇺', lat: -69.379, lon: 76.388, season: 'year-round', air: 'Ski runway on the ice cap above the station' },
  { name: 'Bharati Station', country: 'India', flag: '🇮🇳', lat: -69.408, lon: 76.195, season: 'year-round' },
  { name: 'Taishan Station', country: 'China', flag: '🇨🇳', lat: -73.864, lon: 76.974, season: 'summer' },
  { name: 'Kunlun Station', country: 'China', flag: '🇨🇳', lat: -80.417, lon: 77.117, season: 'summer', note: 'On Dome A, the highest point of the East Antarctic ice sheet.' },
  { name: 'Mawson Station', country: 'Australia', flag: '🇦🇺', lat: -67.603, lon: 62.874, season: 'year-round', note: 'The oldest continuously running station south of the Antarctic Circle (1954).' },
  { name: 'Syowa Station', country: 'Japan', flag: '🇯🇵', lat: -69.004, lon: 39.582, season: 'year-round', air: 'Helicopters from the icebreaker Shirase, and ski planes' },
  { name: 'Dome Fuji Station', country: 'Japan', flag: '🇯🇵', lat: -77.317, lon: 39.7, season: 'summer' },
  // Dronning Maud Land
  { name: 'Princess Elisabeth Station', country: 'Belgium', flag: '🇧🇪', lat: -71.95, lon: 23.347, season: 'summer', note: 'The first zero-emission polar station, run on wind and solar.' },
  { name: 'Novolazarevskaya Station', country: 'Russia', flag: '🇷🇺', lat: -70.777, lon: 11.823, season: 'year-round', air: 'Novo blue-ice runway nearby, a stop for the DROMLAN flights from Cape Town' },
  { name: 'Maitri Station', country: 'India', flag: '🇮🇳', lat: -70.767, lon: 11.731, season: 'year-round' },
  { name: 'Troll Station', country: 'Norway', flag: '🇳🇴', lat: -72.012, lon: 2.535, season: 'year-round', air: 'Troll Airfield, a blue-ice runway used by DROMLAN flights from Cape Town' },
  { name: 'Kohnen Station', country: 'Germany', flag: '🇩🇪', lat: -75.002, lon: 0.067, season: 'summer' },
  { name: 'SANAE IV', country: 'South Africa', flag: '🇿🇦', lat: -71.673, lon: -2.84, season: 'year-round' },
  { name: 'Neumayer Station III', country: 'Germany', flag: '🇩🇪', lat: -70.674, lon: -8.274, season: 'year-round', air: 'Skiway for Germany\'s Polar 5 and Polar 6 research planes' },
  { name: 'Wasa and Aboa Stations', country: 'Sweden / Finland', flag: '🇸🇪🇫🇮', lat: -73.043, lon: -13.41, season: 'summer' },
  { name: 'Halley VI Research Station', country: 'United Kingdom', flag: '🇬🇧', lat: -75.579, lon: -26.659, season: 'summer', note: 'On wheeled legs on a floating ice shelf; where the ozone hole was discovered (from Halley\'s earlier stations).' },
  { name: 'Belgrano II Base', country: 'Argentina', flag: '🇦🇷', lat: -77.874, lon: -34.627, season: 'year-round' },
  // Antarctic Peninsula and nearby islands
  { name: 'Rothera Research Station', country: 'United Kingdom', flag: '🇬🇧', lat: -67.568, lon: -68.124, season: 'year-round', air: 'Gravel runway for the British Antarctic Survey\'s Dash 7 and Twin Otters' },
  { name: 'San Martín Base', country: 'Argentina', flag: '🇦🇷', lat: -68.13, lon: -67.103, season: 'year-round' },
  { name: 'Vernadsky Research Base', country: 'Ukraine', flag: '🇺🇦', lat: -65.246, lon: -64.257, season: 'year-round' },
  { name: 'Palmer Station', country: 'United States', flag: '🇺🇸', lat: -64.774, lon: -64.053, season: 'year-round', air: 'No runway; supplied by ship from Punta Arenas.' },
  { name: 'Marambio Base', country: 'Argentina', flag: '🇦🇷', lat: -64.241, lon: -56.627, season: 'year-round', air: 'Gravel runway, Argentina\'s year-round air link (C-130 Hercules)' },
  { name: 'Esperanza Base', country: 'Argentina', flag: '🇦🇷', lat: -63.398, lon: -56.997, season: 'year-round', note: 'One of only two Antarctic stations with families and a school.' },
  { name: 'Eduardo Frei Station / Villa Las Estrellas', country: 'Chile', flag: '🇨🇱', lat: -62.2, lon: -58.963, season: 'year-round', air: 'Teniente Marsh Airfield, a gravel runway with flights from Punta Arenas (also tourist flights)', note: 'Antarctica\'s main air gateway on King George Island.' },
  { name: 'Bellingshausen Station', country: 'Russia', flag: '🇷🇺', lat: -62.196, lon: -58.961, season: 'year-round', note: 'Next door to Frei; has a Russian Orthodox church.' },
  { name: 'Great Wall Station', country: 'China', flag: '🇨🇳', lat: -62.216, lon: -58.964, season: 'year-round' },
  { name: 'Artigas Base', country: 'Uruguay', flag: '🇺🇾', lat: -62.184, lon: -58.903, season: 'year-round' },
  { name: 'King Sejong Station', country: 'South Korea', flag: '🇰🇷', lat: -62.223, lon: -58.787, season: 'year-round' },
  { name: 'Carlini Base', country: 'Argentina', flag: '🇦🇷', lat: -62.238, lon: -58.667, season: 'year-round' },
  { name: 'Arctowski Station', country: 'Poland', flag: '🇵🇱', lat: -62.16, lon: -58.471, season: 'year-round' },
  { name: 'Comandante Ferraz Station', country: 'Brazil', flag: '🇧🇷', lat: -62.085, lon: -58.392, season: 'year-round' },
  { name: 'Orcadas Base', country: 'Argentina', flag: '🇦🇷', lat: -60.738, lon: -44.737, season: 'year-round', note: 'The oldest station still running in Antarctica, since 1904.' },
  { name: 'Signy Research Station', country: 'United Kingdom', flag: '🇬🇧', lat: -60.708, lon: -45.595, season: 'summer' },
  // West Antarctica
  { name: 'Union Glacier Camp', country: 'Private (ALE)', flag: '⛺', lat: -79.763, lon: -82.858, season: 'summer', air: 'Blue-ice runway for Ilyushin Il-76 and Boeing 757 flights from Punta Arenas', note: 'The base for most tourist expeditions and South Pole trips.' },
]

/** The map can't show latitudes past about 85°S, so pin anything further south to the edge. */
export const mapLat = (lat: number) => Math.max(lat, -84.9)
