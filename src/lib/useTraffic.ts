import { useEffect, useRef, useState } from 'react'
import type { Aircraft, Center, FlightEvent, Phase, RawAircraft, Route, TimeValue } from '../types'
import { cachedRoute, fetchLiveAircraft, fetchLiveRoutes } from './api'
import { modelName } from './aircraftTypes'
import { DemoTraffic } from './demo'
import { detectEmergency } from './emergency'
import { distanceNm } from './geo'
import { detectSpecial } from './special'

export type Mode = 'live' | 'demo'

export interface TrafficState {
  aircraft: Aircraft[]
  events: FlightEvent[]
  status: 'loading' | 'ok' | 'error'
  error?: string
  source?: string
  updatedAt?: number
  mode: Mode
}

const POLL_MS = { live: 6000, demo: 2000 }
const STALE_MS = 60_000
const TRAIL_LEN = 400

function phaseOf(onGround: boolean, alt: number | null, vr: number | null): Phase {
  if (onGround) return 'ground'
  if (alt == null) return 'unknown'
  const v = vr ?? 0
  if (alt < 2500 && v > 300) return 'takeoff'
  if (alt < 4000 && v < -300) return 'approach'
  if (v > 400) return 'climb'
  if (v < -400) return 'descent'
  return 'cruise'
}

/** Typical cruise ground speed (kt) per category, used for long legs. */
const CRUISE_KT: Record<string, number> = { A1: 140, A2: 400, A3: 440, A4: 450, A5: 480, A6: 480, A7: 120 }

/**
 * Rough flight-time estimates from great-circle distances. Near an airport the
 * current speed is a good guide; over long distances the aircraft spends most
 * of its time at cruise, so we use the faster of current and typical cruise.
 */
function avgSpeed(a: Aircraft, distance: number, nearFactor: number): number {
  const gs = a.groundSpeed ?? 0
  if (distance < 150) return Math.max(150, gs * nearFactor)
  const cruise = CRUISE_KT[a.category] ?? 420
  return Math.max(gs, cruise) * 0.95
}

function estimateTimes(a: Aircraft, now: number): { takeoff: TimeValue | null; touchdown: TimeValue | null } {
  const r = a.route
  let takeoff: TimeValue | null = null
  let touchdown: TimeValue | null = null
  if (!r || a.onGround || (a.groundSpeed ?? 0) < 60) return { takeoff, touchdown }
  if (r.origin?.lat != null && r.origin.lon != null) {
    const flown = distanceNm(r.origin.lat, r.origin.lon, a.lat, a.lon)
    takeoff = { at: now - (flown / avgSpeed(a, flown, 0.7)) * 3600_000, kind: 'estimated' }
  }
  if (r.destination?.lat != null && r.destination.lon != null) {
    const left = distanceNm(a.lat, a.lon, r.destination.lat, r.destination.lon)
    const approachPad = left > 60 ? 8 : 2 // minutes for descent & approach pattern
    touchdown = { at: now + ((left / avgSpeed(a, left, 0.75)) * 60 + approachPad) * 60_000, kind: 'estimated' }
  }
  return { takeoff, touchdown }
}

/** Feeds sometimes send junk callsigns: padding, stray punctuation, all zeros. */
function cleanCallsign(raw?: string): string {
  const s = (raw ?? '').trim().toUpperCase().replace(/^[^A-Z0-9]+/, '').replace(/[^A-Z0-9-]/g, '')
  if (!s || /^0+$/.test(s) || /^@+$/.test(s)) return ''
  return s
}

/** "~abc123" is a non-ICAO (TIS-B/MLAT) address; show it plainly. */
function hexLabel(hex: string): string {
  return hex.replace(/^~/, '').toUpperCase()
}

export function useTraffic(center: Center, radiusNm: number, mode: Mode): TrafficState {
  const [state, setState] = useState<TrafficState>({ aircraft: [], events: [], status: 'loading', mode })
  const tracked = useRef(new Map<string, Aircraft>())
  const events = useRef<FlightEvent[]>([])

  useEffect(() => {
    tracked.current = new Map()
    events.current = []
    setState({ aircraft: [], events: [], status: 'loading', mode })
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const demo = mode === 'demo' ? new DemoTraffic(center, radiusNm) : null

    const pushEvent = (e: Omit<FlightEvent, 'id'>) => {
      events.current = [{ ...e, id: `${e.hex}-${e.kind}-${e.at}` }, ...events.current].slice(0, 60)
    }

    const ingest = (raw: RawAircraft[], routeFor: (cs: string) => Route | null | undefined) => {
      const now = Date.now()
      const seen = new Set<string>()
      for (const r of raw) {
        if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue
        if ((r.seen_pos ?? r.seen ?? 0) > 60) continue
        seen.add(r.hex)
        const prev = tracked.current.get(r.hex)
        const onGround = r.alt_baro === 'ground'
        const altitude = onGround ? null : typeof r.alt_baro === 'number' ? r.alt_baro : r.alt_geom ?? null
        const callsign = cleanCallsign(r.flight)
        const vr = r.baro_rate ?? r.geom_rate ?? null
        const emergency = detectEmergency(r.squawk, r.emergency)
        const route = callsign ? routeFor(callsign) ?? undefined : undefined
        const label = callsign || r.r || hexLabel(r.hex)

        const a: Aircraft = {
          hex: r.hex,
          callsign: label,
          registration: r.r,
          typeCode: r.t,
          model: modelName(r.t, r.desc),
          operator: r.ownOp,
          category: r.category ?? '',
          lat: r.lat,
          lon: r.lon,
          altitude,
          onGround,
          groundSpeed: r.gs ?? null,
          track: r.track ?? r.true_heading ?? prev?.track ?? null,
          verticalRate: vr,
          squawk: r.squawk,
          emergency,
          lastSeen: now - (r.seen ?? 0) * 1000,
          phase: phaseOf(onGround, altitude, vr),
          takeoff: null,
          touchdown: null,
          route,
          trail: prev ? prev.trail : [],
          special: detectSpecial(r, callsign),
        }

        const last = a.trail[a.trail.length - 1]
        if (!last || last[0] !== a.lat || last[1] !== a.lon)
          a.trail = [...a.trail, [a.lat, a.lon, onGround ? null : altitude] as [number, number, number | null]].slice(-TRAIL_LEN)

        // Observed transitions beat estimates.
        let observedTakeoff = prev?.takeoff?.kind === 'observed' ? prev.takeoff : null
        let observedTouchdown = prev?.touchdown?.kind === 'observed' ? prev.touchdown : null
        if (prev && prev.onGround && !onGround) {
          observedTakeoff = { at: now, kind: 'observed' }
          observedTouchdown = null
          pushEvent({ at: now, hex: a.hex, callsign: a.callsign, kind: 'takeoff', text: `took off${route?.origin?.iata ? ` from ${route.origin.iata}` : ''}` })
        }
        if (prev && !prev.onGround && onGround) {
          observedTouchdown = { at: now, kind: 'observed' }
          pushEvent({ at: now, hex: a.hex, callsign: a.callsign, kind: 'landing', text: `landed${route?.destination?.iata ? ` at ${route.destination.iata}` : ''}` })
        }
        if (emergency && (!prev || prev.emergency?.code !== emergency.code)) {
          pushEvent({ at: now, hex: a.hex, callsign: a.callsign, kind: 'emergency', text: emergency.label })
        }

        const est = estimateTimes(a, now)
        a.takeoff = observedTakeoff ?? est.takeoff
        a.touchdown = observedTouchdown ?? est.touchdown
        tracked.current.set(a.hex, a)
      }
      for (const [hex, a] of tracked.current) {
        if (!seen.has(hex) && now - a.lastSeen > STALE_MS) tracked.current.delete(hex)
      }
    }

    const poll = async () => {
      try {
        if (demo) {
          const raw = demo.tick()
          ingest(raw, (cs) => demo.route(cs))
          if (!cancelled)
            setState({ aircraft: [...tracked.current.values()], events: events.current, status: 'ok', source: 'Simulated traffic', updatedAt: Date.now(), mode })
        } else {
          const { aircraft: raw, source } = await fetchLiveAircraft(center.lat, center.lon, radiusNm)
          if (cancelled) return
          ingest(raw, cachedRoute)
          setState({ aircraft: [...tracked.current.values()], events: events.current, status: 'ok', source, updatedAt: Date.now(), mode })
          // Resolve routes in the background, then fold them in.
          const needRoutes = raw
            .map((r) => ({ callsign: cleanCallsign(r.flight), lat: r.lat!, lon: r.lon!, ground: r.alt_baro === 'ground' }))
            .filter((r) => r.callsign && typeof r.lat === 'number' && !r.ground)
          fetchLiveRoutes(needRoutes).then(() => {
            if (cancelled) return
            const now = Date.now()
            for (const a of tracked.current.values()) {
              const route = cachedRoute(a.callsign)
              if (route && !a.route) {
                a.route = route
                const est = estimateTimes(a, now)
                if (a.takeoff?.kind !== 'observed') a.takeoff = est.takeoff
                if (a.touchdown?.kind !== 'observed') a.touchdown = est.touchdown
              }
            }
            setState((s) => ({ ...s, aircraft: [...tracked.current.values()] }))
          })
        }
      } catch (err) {
        if (!cancelled)
          setState((s) => ({ ...s, status: 'error', error: err instanceof Error ? err.message : String(err) }))
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS[mode])
      }
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [center.lat, center.lon, radiusNm, mode])

  return state
}
