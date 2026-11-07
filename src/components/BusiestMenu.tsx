import { useEffect, useMemo, useState } from 'react'
import type { Aircraft, RawAircraft } from '../types'
import { busyness, type AirportInfo } from '../lib/airports'
import { upstream } from '../lib/upstream'
import { distanceNm } from '../lib/geo'
import { fmtRelative } from '../lib/format'

/** Big hubs checked live for the World tab. */
const HUBS = ['ATL', 'DXB', 'DFW', 'LHR', 'HND', 'DEN', 'IST', 'LAX', 'ORD', 'DEL', 'CDG', 'JFK', 'AMS', 'CAN', 'SIN', 'FRA', 'ICN', 'MAD', 'BKK', 'LAS', 'MCO', 'MIA', 'SEA', 'CLT', 'PEK', 'BCN', 'SFO', 'EWR', 'PHX', 'IAH', 'SYD', 'MEX', 'YYZ', 'DOH']

interface Activity {
  onGround: number
  arriving: number
  departing: number
  total: number
}

// World counts are shared between openings for a few minutes.
let worldCache: { at: number; counts: Record<string, Activity> } | null = null

async function liveActivity(ap: AirportInfo): Promise<Activity> {
  const res = await fetch(`${upstream('adsblol')}/v2/lat/${ap.lat.toFixed(3)}/lon/${ap.lon.toFixed(3)}/dist/15`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(String(res.status))
  const j = (await res.json()) as { ac?: RawAircraft[] }
  const a: Activity = { onGround: 0, arriving: 0, departing: 0, total: 0 }
  for (const x of j.ac ?? []) {
    if (typeof x.lat !== 'number' || typeof x.lon !== 'number') continue
    const d = distanceNm(x.lat, x.lon, ap.lat, ap.lon)
    if (x.alt_baro === 'ground') {
      if (d < 4) a.onGround++
      else continue
    } else if (typeof x.alt_baro === 'number' && x.alt_baro < 6000 + (ap.elevation ?? 0)) {
      if ((x.baro_rate ?? 0) > 200) a.departing++
      else a.arriving++
    } else continue
    a.total++
  }
  return a
}

interface Props {
  airports: AirportInfo[]
  aircraft: Aircraft[]
  center: { lat: number; lon: number }
  radiusNm: number
  live: boolean
  onPick: (a: AirportInfo) => void
  onClose: () => void
}

export default function BusiestMenu({ airports, aircraft, center, radiusNm, live, onPick, onClose }: Props) {
  const [tab, setTab] = useState<'near' | 'world'>('near')
  const [world, setWorld] = useState<Record<string, Activity>>(worldCache?.counts ?? {})
  const [checkedAt, setCheckedAt] = useState(worldCache?.at ?? 0)
  const [loading, setLoading] = useState(false)

  const near = useMemo(
    () =>
      airports
        .filter((a) => distanceNm(center.lat, center.lon, a.lat, a.lon) <= radiusNm)
        .map((a) => ({ a, b: busyness(a, aircraft) }))
        .filter((x) => x.b.total > 0)
        .sort((x, y) => y.b.total - x.b.total)
        .slice(0, 15),
    [airports, aircraft, center.lat, center.lon, radiusNm],
  )

  const hubs = useMemo(() => HUBS.map((code) => airports.find((a) => a.iata === code)).filter(Boolean) as AirportInfo[], [airports])

  useEffect(() => {
    if (tab !== 'world' || !live || !hubs.length) return
    if (worldCache && Date.now() - worldCache.at < 5 * 60 * 1000) return
    let stop = false
    setLoading(true)
    ;(async () => {
      const counts: Record<string, Activity> = {}
      for (const ap of hubs) {
        if (stop) return
        try {
          counts[ap.iata] = await liveActivity(ap)
          setWorld({ ...counts })
        } catch {
          /* skip this one */
        }
        await new Promise((r) => setTimeout(r, 250)) // be gentle with the free API
      }
      worldCache = { at: Date.now(), counts }
      if (!stop) {
        setCheckedAt(worldCache.at)
        setLoading(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [tab, live, hubs])

  const worldRanked = hubs
    .filter((a) => world[a.iata])
    .map((a) => ({ a, b: world[a.iata] }))
    .sort((x, y) => y.b.total - x.b.total)

  const row = (a: AirportInfo, b: Activity, i: number) => (
    <li key={a.ident}>
      <button onClick={() => onPick(a)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-700/60">
        <span className="w-5 shrink-0 text-right font-mono text-xs text-slate-500">{i + 1}</span>
        <span className="w-10 shrink-0 font-mono text-sm font-bold">{a.iata || a.ident}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{a.city || a.name}</span>
        <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-400">
          <b className="text-sm text-amber-200">{b.total}</b> · {b.onGround} gnd · {b.arriving}↓ {b.departing}↑
        </span>
      </button>
    </li>
  )

  return (
    <>
      <div className="fixed inset-0 z-[900]" onClick={onClose} />
      <div className="safe-dropdown fixed inset-x-2 z-[901] overflow-hidden rounded-lg bg-slate-800 text-sm shadow-xl ring-1 ring-slate-700 md:absolute md:inset-x-auto md:left-0 md:top-full md:mt-1 md:w-[380px]">
        <div className="flex border-b border-slate-700 text-xs font-semibold">
          {(
            [
              ['near', '📍 Near you'],
              ['world', '🌍 World'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? 'bg-slate-700 text-sky-300' : 'text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {tab === 'near' ? (
            near.length ? (
              <ol>{near.map((x, i) => row(x.a, x.b, i))}</ol>
            ) : (
              <p className="px-3 py-4 text-center text-xs text-slate-500">No airport activity in your area right now.</p>
            )
          ) : !live ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">Switch to LIVE to check the world's big airports.</p>
          ) : (
            <>
              <ol>{worldRanked.map((x, i) => row(x.a, x.b, i))}</ol>
              <p className="px-3 py-2 text-[11px] text-slate-500">
                {loading ? `Checking ${Object.keys(world).length} of ${hubs.length} big airports…` : `Live now: planes on the ground or below 6,000 ft within 15 nm. Updated ${fmtRelative(checkedAt)}.`}
              </p>
            </>
          )}
        </div>
        <p className="border-t border-slate-700 px-3 py-1.5 text-[10px] text-slate-500">gnd = on the ground · ↓ arriving · ↑ departing</p>
      </div>
    </>
  )
}
