import type { Airport, RawAircraft, Route } from '../types'
import { bearingDeg, destinationPoint, distanceNm } from './geo'

/**
 * A small traffic simulator so the app is fully usable when the live ADS-B
 * APIs can't be reached (offline, blocked network, rate-limited). Everything
 * it produces is clearly labelled DEMO in the UI.
 */

const AIRPORTS: Airport[] = [
  { iata: 'JFK', icao: 'KJFK', name: 'John F Kennedy Intl', location: 'New York', lat: 40.6413, lon: -73.7781 },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles Intl', location: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
  { iata: 'ORD', icao: 'KORD', name: "Chicago O'Hare Intl", location: 'Chicago', lat: 41.9742, lon: -87.9073 },
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield-Jackson Atlanta Intl', location: 'Atlanta', lat: 33.6407, lon: -84.4277 },
  { iata: 'DFW', icao: 'KDFW', name: 'Dallas/Fort Worth Intl', location: 'Dallas', lat: 32.8998, lon: -97.0403 },
  { iata: 'DEN', icao: 'KDEN', name: 'Denver Intl', location: 'Denver', lat: 39.8561, lon: -104.6737 },
  { iata: 'SFO', icao: 'KSFO', name: 'San Francisco Intl', location: 'San Francisco', lat: 37.6213, lon: -122.379 },
  { iata: 'SEA', icao: 'KSEA', name: 'Seattle-Tacoma Intl', location: 'Seattle', lat: 47.4502, lon: -122.3088 },
  { iata: 'MIA', icao: 'KMIA', name: 'Miami Intl', location: 'Miami', lat: 25.7959, lon: -80.287 },
  { iata: 'BOS', icao: 'KBOS', name: 'Boston Logan Intl', location: 'Boston', lat: 42.3656, lon: -71.0096 },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson Intl', location: 'Toronto', lat: 43.6777, lon: -79.6248 },
  { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow', location: 'London', lat: 51.47, lon: -0.4543 },
  { iata: 'CDG', icao: 'LFPG', name: 'Paris Charles de Gaulle', location: 'Paris', lat: 49.0097, lon: 2.5479 },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt am Main', location: 'Frankfurt', lat: 50.0379, lon: 8.5622 },
  { iata: 'AMS', icao: 'EHAM', name: 'Amsterdam Schiphol', location: 'Amsterdam', lat: 52.3105, lon: 4.7683 },
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai Intl', location: 'Dubai', lat: 25.2532, lon: 55.3657 },
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi', location: 'Singapore', lat: 1.3644, lon: 103.9915 },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda', location: 'Tokyo', lat: 35.5494, lon: 139.7798 },
  { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', location: 'Sydney', lat: -33.9399, lon: 151.1753 },
  { iata: 'MEX', icao: 'MMMX', name: 'Mexico City Intl', location: 'Mexico City', lat: 19.4361, lon: -99.0719 },
]

interface Template {
  t: string
  category: string
  airline?: boolean
}

const AIRLINE_TYPES: Template[] = [
  { t: 'B738', category: 'A3' }, { t: 'A320', category: 'A3' }, { t: 'A21N', category: 'A3' },
  { t: 'B38M', category: 'A3' }, { t: 'A321', category: 'A3' }, { t: 'B739', category: 'A3' },
  { t: 'E75L', category: 'A2' }, { t: 'CRJ9', category: 'A2' }, { t: 'DH8D', category: 'A2' },
  { t: 'B752', category: 'A4' }, { t: 'B789', category: 'A5' }, { t: 'B77W', category: 'A5' },
  { t: 'A359', category: 'A5' }, { t: 'A333', category: 'A5' }, { t: 'B748', category: 'A5' },
]
const AIRLINES = ['AAL', 'DAL', 'UAL', 'SWA', 'JBU', 'ASA', 'BAW', 'AFR', 'DLH', 'KLM', 'UAE', 'ACA', 'FDX', 'UPS', 'NKS']
const BIZJETS: Template[] = [
  { t: 'C68A', category: 'A2' }, { t: 'GLF6', category: 'A2' }, { t: 'E55P', category: 'A2' }, { t: 'CL35', category: 'A2' },
]
const LIGHT: Template[] = [
  { t: 'C172', category: 'A1' }, { t: 'SR22', category: 'A1' }, { t: 'PA28', category: 'A1' }, { t: 'C182', category: 'A1' },
  { t: 'PC12', category: 'A1' }, { t: 'BE36', category: 'A1' },
]
const HELIS: Template[] = [
  { t: 'EC35', category: 'A7' }, { t: 'R44', category: 'A7' }, { t: 'B407', category: 'A7' }, { t: 'A139', category: 'A7' },
]

type Kind = 'departure' | 'arrival' | 'overflight' | 'heli' | 'light' | 'glider' | 'military'

interface SimPlane {
  hex: string
  flight: string
  reg: string
  t: string
  category: string
  kind: Kind
  lat: number
  lon: number
  alt: number // ft; 0 = on ground
  onGround: boolean
  gs: number
  track: number
  vr: number
  squawk: string
  emergency?: string
  ownOp?: string
  route?: Route
  // behaviour state
  timer: number
  targetAlt: number
  targetGs: number
  orbit?: { lat: number; lon: number; r: number; dir: number }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const hex = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
const squawk = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 8)).join('')
const reg = () => 'N' + Math.floor(rand(100, 999)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26))

export class DemoTraffic {
  private planes = new Map<string, SimPlane>()
  private home: Airport
  private lastTick = Date.now()
  private emergencyIssued = false

  constructor(private center: { lat: number; lon: number; label: string }, private radiusNm: number) {
    const code = /\(([A-Z]{3})\)/.exec(center.label)?.[1]
    const known = AIRPORTS.find((a) => a.iata === code)
    this.home = known ?? { iata: code ?? 'HOME', name: center.label, location: center.label, lat: center.lat, lon: center.lon }
    this.home = { ...this.home, lat: center.lat, lon: center.lon }
    this.seed()
  }

  private otherAirports() {
    return AIRPORTS.filter((a) => distanceNm(a.lat!, a.lon!, this.home.lat!, this.home.lon!) > 150)
  }

  private seed() {
    for (let i = 0; i < 7; i++) this.spawn('departure', true)
    for (let i = 0; i < 9; i++) this.spawn('arrival', true)
    for (let i = 0; i < 10; i++) this.spawn('overflight', true)
    for (let i = 0; i < 3; i++) this.spawn('heli', true)
    for (let i = 0; i < 6; i++) this.spawn('light', true)
    this.spawn('glider', true)
    this.spawn('military', true)
  }

  private spawn(kind: Kind, initial = false) {
    const R = this.radiusNm
    const c = this.home
    const others = this.otherAirports()
    let tpl: Template
    let flight: string
    let special: 'mil' | 'sports' | null = null
    if (kind === 'departure' || kind === 'arrival' || kind === 'overflight') {
      const roll = Math.random()
      if (roll < 0.04 || (initial && kind === 'overflight' && !this.planes.size)) {
        special = 'mil'
        tpl = pick([{ t: 'C17', category: 'A5' }, { t: 'K35R', category: 'A5' }, { t: 'C30J', category: 'A3' }])
        flight = 'RCH' + Math.floor(rand(100, 999))
      } else if (roll < 0.08 || (initial && kind === 'arrival' && this.planes.size === 7)) {
        special = 'sports'
        tpl = pick([{ t: 'A320', category: 'A3' }, { t: 'B763', category: 'A5' }])
        flight = 'GXA' + Math.floor(rand(100, 999))
      } else {
        tpl = Math.random() < 0.12 ? pick(BIZJETS) : pick(AIRLINE_TYPES)
        flight = tpl.category === 'A2' && BIZJETS.includes(tpl) ? reg() : pick(AIRLINES) + Math.floor(rand(10, 2999))
      }
    } else if (kind === 'heli') {
      tpl = pick(HELIS)
      flight = reg()
    } else if (kind === 'glider') {
      tpl = { t: 'GLID', category: 'B1' }
      flight = reg()
    } else if (kind === 'military') {
      tpl = pick([{ t: 'F16', category: 'A6' }, { t: 'F35', category: 'A6' }])
      flight = pick(['VIPER', 'RAGE', 'HAWK']) + Math.floor(rand(10, 99))
    } else {
      tpl = pick(LIGHT)
      flight = reg()
    }

    const p: SimPlane = {
      hex: special === 'mil' ? 'ae' + Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0') : hex(),
      flight,
      reg: reg(),
      t: tpl.t,
      category: tpl.category,
      kind,
      lat: c.lat!,
      lon: c.lon!,
      alt: 0,
      onGround: false,
      gs: 0,
      track: rand(0, 360),
      vr: 0,
      squawk: squawk(),
      timer: 0,
      targetAlt: 0,
      targetGs: 0,
    }

    if (kind === 'departure') {
      const dest = pick(others)
      p.route = { origin: this.home, destination: dest, plausible: true }
      const brg = bearingDeg(c.lat!, c.lon!, dest.lat!, dest.lon!)
      if (initial && Math.random() < 0.5) {
        // already airborne and climbing out
        const d = rand(5, R * 0.6)
        ;[p.lat, p.lon] = destinationPoint(c.lat!, c.lon!, brg, d)
        p.alt = Math.min(36000, 1500 + d * 400)
        p.gs = Math.min(460, 180 + d * 6)
        p.track = brg
        p.vr = p.alt < 34000 ? 2200 : 0
      } else {
        ;[p.lat, p.lon] = destinationPoint(c.lat!, c.lon!, rand(0, 360), rand(0.3, 1.2))
        p.onGround = true
        p.gs = rand(8, 18)
        p.timer = rand(15, initial ? 240 : 120) // seconds until takeoff roll
      }
      p.targetAlt = Math.round(rand(31, 39)) * 1000
    } else if (kind === 'arrival') {
      const orig = pick(others)
      p.route = { origin: orig, destination: this.home, plausible: true }
      const brgFrom = bearingDeg(c.lat!, c.lon!, orig.lat!, orig.lon!) + rand(-25, 25)
      const d = initial ? rand(8, R * 0.95) : R * 0.95
      ;[p.lat, p.lon] = destinationPoint(c.lat!, c.lon!, brgFrom, d)
      p.alt = Math.min(37000, Math.round(d * 320))
      p.gs = Math.min(470, 150 + p.alt / 100)
      p.track = bearingDeg(p.lat, p.lon, c.lat!, c.lon!)
      if (!this.emergencyIssued && (initial ? d > R * 0.5 : true)) {
        this.emergencyIssued = true
        p.squawk = '7700'
        p.emergency = 'general'
      }
    } else if (kind === 'overflight') {
      const a = pick(others)
      let b = pick(others)
      while (b === a) b = pick(others)
      p.route = { origin: a, destination: b, plausible: true }
      const entry = rand(0, 360)
      const d = initial ? rand(0, R * 0.9) : R * 0.95
      ;[p.lat, p.lon] = destinationPoint(c.lat!, c.lon!, entry, d)
      p.track = (entry + 180 + rand(-40, 40)) % 360
      p.alt = Math.round(rand(30, 41)) * 1000
      p.gs = rand(420, 520)
      if (Math.random() < 0.05) p.emergency = 'minfuel'
    } else if (kind === 'heli') {
      const oc = destinationPoint(c.lat!, c.lon!, rand(0, 360), rand(4, R * 0.4))
      p.orbit = { lat: oc[0], lon: oc[1], r: rand(1.5, 4), dir: Math.random() < 0.5 ? 1 : -1 }
      ;[p.lat, p.lon] = destinationPoint(oc[0], oc[1], rand(0, 360), p.orbit.r)
      p.alt = Math.round(rand(8, 20)) * 100
      p.gs = rand(80, 130)
      if (Math.random() < 0.3) p.emergency = 'lifeguard'
      else if (Math.random() < 0.5) p.ownOp = pick(['COUNTY OF SUFFOLK POLICE', 'STATE POLICE AVIATION', 'COUNTY SHERIFF OFFICE'])
    } else if (kind === 'glider') {
      const oc = destinationPoint(c.lat!, c.lon!, rand(0, 360), rand(10, R * 0.5))
      p.orbit = { lat: oc[0], lon: oc[1], r: 0.6, dir: 1 }
      ;[p.lat, p.lon] = oc
      p.alt = rand(3000, 7000)
      p.gs = rand(45, 60)
    } else if (kind === 'military') {
      const oc = destinationPoint(c.lat!, c.lon!, rand(0, 360), rand(15, R * 0.6))
      p.orbit = { lat: oc[0], lon: oc[1], r: 12, dir: 1 }
      ;[p.lat, p.lon] = destinationPoint(oc[0], oc[1], 0, 12)
      p.alt = rand(18000, 26000)
      p.gs = rand(400, 480)
    } else {
      ;[p.lat, p.lon] = destinationPoint(c.lat!, c.lon!, rand(0, 360), rand(5, R * 0.8))
      p.alt = Math.round(rand(25, 75)) * 100
      p.gs = rand(95, 140)
      p.targetAlt = p.alt
    }
    this.planes.set(p.hex, p)
  }

  tick(): RawAircraft[] {
    const now = Date.now()
    const dt = Math.min(30, (now - this.lastTick) / 1000)
    this.lastTick = now
    const c = this.home
    const R = this.radiusNm
    const counts: Record<Kind, number> = { departure: 0, arrival: 0, overflight: 0, heli: 0, light: 0, glider: 0, military: 0 }

    for (const p of [...this.planes.values()]) {
      this.step(p, dt)
      const d = distanceNm(c.lat!, c.lon!, p.lat, p.lon)
      const gone = d > R * 1.05 || (p.kind === 'arrival' && p.onGround && p.timer > 75)
      if (gone) {
        if (p.emergency === 'general') this.emergencyIssued = false
        this.planes.delete(p.hex)
      } else counts[p.kind]++
    }
    if (counts.departure < 7 && Math.random() < 0.3) this.spawn('departure')
    if (counts.arrival < 9 && Math.random() < 0.3) this.spawn('arrival')
    if (counts.overflight < 10 && Math.random() < 0.3) this.spawn('overflight')
    if (counts.light < 6 && Math.random() < 0.2) this.spawn('light')

    return [...this.planes.values()].map((p) => ({
      hex: p.hex,
      flight: p.flight.padEnd(8, ' '),
      r: p.reg,
      t: p.t,
      category: p.category,
      alt_baro: p.onGround ? 'ground' : Math.round(p.alt / 25) * 25,
      gs: Math.round(p.gs * 10) / 10,
      track: Math.round(p.track * 10) / 10,
      baro_rate: p.onGround ? 0 : Math.round(p.vr / 64) * 64,
      squawk: p.squawk,
      emergency: p.emergency ?? 'none',
      ownOp: p.ownOp,
      lat: p.lat,
      lon: p.lon,
      seen: 0,
    }))
  }

  route(callsign: string): Route | null {
    for (const p of this.planes.values()) if (p.flight === callsign) return p.route ?? null
    return null
  }

  private turnToward(p: SimPlane, target: number, rate: number, dt: number) {
    const diff = ((target - p.track + 540) % 360) - 180
    const step = Math.max(-rate * dt, Math.min(rate * dt, diff))
    p.track = (p.track + step + 360) % 360
  }

  private step(p: SimPlane, dt: number) {
    const c = this.home
    switch (p.kind) {
      case 'departure': {
        if (p.onGround) {
          p.timer -= dt
          if (p.timer > 0) {
            p.gs = rand(8, 18)
            p.track = (p.track + rand(-20, 20) * dt * 0.1 + 360) % 360
          } else {
            p.gs = Math.min(160, p.gs + 5 * dt) // takeoff roll
            if (p.gs >= 150) {
              p.onGround = false
              p.alt = 50
              p.vr = 2500
            }
          }
        } else {
          const brg = bearingDeg(p.lat, p.lon, p.route!.destination!.lat!, p.route!.destination!.lon!)
          this.turnToward(p, brg, 3, dt)
          p.vr = p.alt < p.targetAlt - 200 ? (p.alt < 10000 ? 2600 : 1800) : 0
          p.alt = Math.min(p.targetAlt, p.alt + (p.vr / 60) * dt)
          const targetGs = p.alt < 10000 ? 250 : Math.min(470, 280 + p.alt / 160)
          p.gs += Math.sign(targetGs - p.gs) * Math.min(Math.abs(targetGs - p.gs), 4 * dt)
        }
        break
      }
      case 'arrival': {
        if (p.onGround) {
          p.timer += dt
          p.gs = Math.max(15, p.gs - 6 * dt)
          break
        }
        const d = distanceNm(p.lat, p.lon, c.lat!, c.lon!)
        this.turnToward(p, bearingDeg(p.lat, p.lon, c.lat!, c.lon!), 3, dt)
        const targetGs = Math.max(135, Math.min(470, 130 + d * 4, 150 + p.alt / 90))
        p.gs += Math.sign(targetGs - p.gs) * Math.min(Math.abs(targetGs - p.gs), 3 * dt)
        const minutesLeft = Math.max(0.2, (d / p.gs) * 60)
        p.vr = Math.max(-3500, -p.alt / minutesLeft)
        p.alt = Math.max(0, p.alt + (p.vr / 60) * dt)
        if (d < 0.6 || p.alt < 30) {
          p.onGround = true
          p.alt = 0
          p.vr = 0
          p.timer = 0
        }
        break
      }
      case 'overflight':
        p.vr = 0
        break
      case 'light': {
        p.track = (p.track + rand(-6, 6) * dt * 0.2 + 360) % 360
        p.vr = 0
        break
      }
      default: {
        if (p.orbit) {
          const brgFromCenter = bearingDeg(p.orbit.lat, p.orbit.lon, p.lat, p.lon)
          this.turnToward(p, (brgFromCenter + 90 * p.orbit.dir + 360) % 360, 8, dt)
          if (p.kind === 'glider') {
            p.vr = Math.random() < 0.5 ? 300 : -200
            p.alt = Math.max(1500, p.alt + (p.vr / 60) * dt)
          }
        }
      }
    }
    if (p.gs > 0) [p.lat, p.lon] = destinationPoint(p.lat, p.lon, p.track, (p.gs * dt) / 3600)
  }
}
