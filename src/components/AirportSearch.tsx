import { useMemo } from 'react'
import type { Aircraft } from '../types'
import { busyness, liveAtcUrl, type AirportInfo } from '../lib/airports'
import { distanceNm } from '../lib/geo'
import { fmtDist } from '../lib/format'

interface Props {
  query: string
  airports: AirportInfo[]
  aircraft: Aircraft[]
  from: { lat: number; lon: number }
  onOpen: (a: AirportInfo) => void
}

/** Airports matching the search box: by code (IATA, ICAO, US code without the K), city or name. */
export function matchAirports(query: string, airports: AirportInfo[], limit = 5): AirportInfo[] {
  const q = query.trim().toUpperCase()
  if (q.length < 3) return []
  const scored: { a: AirportInfo; score: number }[] = []
  for (const a of airports) {
    let score = 0
    if (a.iata === q || a.ident === q) score = 100
    else if (q.length === 3 && a.ident === `K${q}`) score = 95
    else if (q.length >= 3 && a.city.toUpperCase().startsWith(q)) score = 60
    else if (q.length >= 4 && a.name.toUpperCase().includes(q)) score = 40
    else if (q.length >= 4 && a.city.toUpperCase().includes(q)) score = 30
    if (score) scored.push({ a, score: score + (a.large ? 5 : 0) })
  }
  scored.sort((x, y) => y.score - x.score)
  // An exact code match is almost certainly what was meant: don't pad it with look-alike city names.
  const exact = scored.filter((s) => s.score >= 95)
  return (exact.length ? exact : scored).slice(0, limit).map((s) => s.a)
}

export default function AirportSearch({ query, airports, aircraft, from, onOpen }: Props) {
  const matches = useMemo(() => matchAirports(query, airports), [query, airports])
  if (!matches.length) return null
  return (
    <div className="border-b border-slate-800 px-3 py-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Airports</div>
      <ul className="space-y-1">
        {matches.map((a) => {
          const code = a.iata || a.ident
          const b = busyness(a, aircraft)
          const d = distanceNm(from.lat, from.lon, a.lat, a.lon)
          return (
            <li key={a.ident} className="flex items-stretch gap-1">
              <button onClick={() => onOpen(a)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2 text-left hover:bg-slate-800">
                <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded bg-sky-500/15 font-mono leading-tight text-sky-200">
                  <span className="text-sm font-bold">{code}</span>
                  {a.iata && <span className="text-[9px] text-sky-300/70">{a.ident}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {[a.city, a.country].filter(Boolean).join(', ')} · {fmtDist(d)} away
                  </span>
                </span>
                {b.total > 0 && (
                  <span className="shrink-0 text-right text-[11px] text-slate-400">
                    {b.onGround} on ground
                    <br />
                    {b.arriving + b.departing} coming / going
                  </span>
                )}
              </button>
              {liveAtcUrl(a.ident, a.iata) && (
                <a
                  href={liveAtcUrl(a.ident, a.iata)!}
                  target="_blank"
                  rel="noreferrer"
                  title={`Listen to ${code} air traffic control on LiveATC`}
                  className="flex w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-800/60 text-lg hover:bg-slate-800"
                >
                  🎧<span className="text-[9px] text-sky-300">ATC</span>
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
