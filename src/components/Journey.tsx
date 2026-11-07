import { useEffect, useState } from 'react'
import type { Aircraft, Airport } from '../types'
import { fetchTodaysLegs, type Leg } from '../lib/history'
import { loadAirports, nearestAirport, type AirportInfo } from '../lib/airports'
import { fmtClock } from '../lib/format'

const code = (a?: Airport) => a?.iata || a?.icao || '???'

function mins(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}

/** The plane's whole journey: multi-stop flight numbers, its earlier flights today, and turnarounds. */
export default function Journey({ a, demo }: { a: Aircraft; demo: boolean }) {
  const r = a.route
  const [legs, setLegs] = useState<Leg[] | null | undefined>(undefined)
  const [airports, setAirports] = useState<AirportInfo[]>([])
  useEffect(() => {
    loadAirports().then(setAirports)
  }, [])
  useEffect(() => {
    if (demo) return setLegs(null)
    let stop = false
    setLegs(undefined)
    fetchTodaysLegs(a.hex).then((l) => !stop && setLegs(l))
    return () => {
      stop = true
    }
  }, [a.hex, demo])

  const place = (lat: number, lon: number) => {
    const n = nearestAirport(lat, lon, airports)
    return n ? n.ap.iata || n.ap.ident : '—'
  }

  // earlier flights today = every finished leg before the one in progress
  const done = (legs ?? []).filter((l) => !l.ongoing && l.landed)
  const current = (legs ?? []).find((l) => l.ongoing)
  const stops = r?.stops
  const airline = /^[A-Z]{3}\d/.test(a.callsign)
  if (!stops && done.length === 0 && !current && legs !== undefined) return null

  return (
    <div className="rounded-lg bg-slate-800/60 p-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Journey</div>

      {stops && r?.leg != null && (
        <div className="mb-2">
          <div className="flex flex-wrap items-center gap-1 font-mono text-sm">
            {stops.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className={i === r.leg! + 1 ? 'text-amber-300' : 'text-slate-600'}>{i === r.leg! + 1 ? '✈' : '→'}</span>}
                <span className={`rounded px-1.5 ${i === r.leg || i === r.leg! + 1 ? 'bg-amber-300/20 font-bold text-amber-200' : 'text-slate-400'}`}>{code(s)}</span>
              </span>
            ))}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            Flight {a.callsign} makes {stops.length - 1} legs. This is leg {r.leg + 1} of {stops.length - 1}
            {r.leg + 1 < stops.length - 1 ? `; after ${code(stops[r.leg + 1])} it continues to ${stops.slice(r.leg + 2).map(code).join(' → ')}.` : '.'}
            {r.leg > 0 ? ` It started at ${code(stops[0])}.` : ''}
          </div>
        </div>
      )}

      {legs === undefined ? (
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-700" />
      ) : done.length === 0 && current ? (
        <div className="text-xs text-slate-300">
          {current.fromGround ? (
            <>
              Took off from <b className="font-mono">{place(current.departLat, current.departLon)}</b> at {fmtClock(current.departedAt)}
              {r ? <>, heading for <b className="font-mono">{code(r.destination)}</b></> : null}. First flight today.
            </>
          ) : (
            <>
              First seen today at {fmtClock(current.departedAt)} near <b className="font-mono">{place(current.departLat, current.departLon)}</b> (it took off
              somewhere out of receiver range).
            </>
          )}
        </div>
      ) : done.length > 0 ? (
        <>
          <div className="mb-1 text-xs text-slate-300">This plane earlier today</div>
          <ol className="space-y-0.5 text-xs">
            {done.map((l, i) => {
              const next = (legs ?? [])[(legs ?? []).indexOf(l) + 1]
              return (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-mono font-semibold text-slate-200">
                      {place(l.departLat, l.departLon)} → {place(l.arriveLat, l.arriveLon)}
                    </span>
                    <span className="text-slate-500">
                      {fmtClock(l.departedAt)}–{fmtClock(l.arrivedAt)}
                    </span>
                  </div>
                  {next && next.fromGround && (
                    <div className="pl-2 text-[11px] text-slate-500">
                      ⏱ on the ground {mins(next.departedAt - l.arrivedAt)} at {place(l.arriveLat, l.arriveLon)}
                    </div>
                  )}
                </li>
              )
            })}
            {current && (
              <li className="font-mono font-semibold text-amber-200">
                {place(current.departLat, current.departLon)} → {r ? code(r.destination) : '…'} <span className="font-sans font-normal text-amber-200/70">now</span>
              </li>
            )}
          </ol>
        </>
      ) : null}

      {airline && (
        <a href={`https://www.flightaware.com/live/flight/${a.callsign}`} target="_blank" rel="noreferrer" className="mt-2 block text-[11px] text-sky-400">
          Where it flies next, and connections at {r ? code(r.destination) : 'its destination'}: FlightAware ↗
        </a>
      )}
    </div>
  )
}
