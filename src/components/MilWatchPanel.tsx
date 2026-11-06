import { useMemo, useState } from 'react'
import type { Aircraft } from '../types'
import type { AirportInfo } from '../lib/airports'
import { milArrivals, milWatch, nearWatched, scanMilitary } from '../lib/milwatch'
import { settingsChangedAt } from '../lib/settings'
import { fmtAlt, fmtClock, fmtDist, fmtRelative } from '../lib/format'

interface Props {
  airports: AirportInfo[]
  aircraft: Aircraft[]
  onOpen: (hex: string) => void
}

export default function MilWatchPanel({ airports, aircraft, onOpen }: Props) {
  const w = milWatch.use()
  const log = milArrivals.use()
  const [q, setQ] = useState('')
  const [checking, setChecking] = useState(false)
  const touch = () => settingsChangedAt.set(Date.now())

  const matches = useMemo(() => {
    const t = q.trim().toUpperCase()
    if (t.length < 2) return []
    return airports
      .filter((a) => a.iata === t || a.ident === t || a.ident === `K${t}` || (t.length >= 3 && (a.city.toUpperCase().includes(t) || a.name.toUpperCase().includes(t))))
      .sort((a, b) => Number(b.iata === t || b.ident === t) - Number(a.iata === t || a.ident === t) || Number(b.large) - Number(a.large))
      .slice(0, 6)
  }, [q, airports])

  const add = (a: AirportInfo) => {
    const code = a.iata || a.ident
    if (!w.airports.some((x) => x.code === code))
      milWatch.set((s) => ({ ...s, airports: [...s.airports, { code, name: a.city || a.name, lat: a.lat, lon: a.lon, elevation: a.elevation ?? 0 }] }))
    touch()
    setQ('')
  }
  const remove = (code: string) => {
    milWatch.set((s) => ({ ...s, airports: s.airports.filter((x) => x.code !== code) }))
    touch()
  }
  const now = nearWatched(aircraft)

  return (
    <div className="space-y-4 px-4 py-3">
      <p className="text-xs text-slate-400">
        Pick airports and SkyWatch tells you when a military-labelled aircraft is <b className="text-slate-200">arriving</b> (descending toward it, within
        about {fmtDist(40)}) or has <b className="text-slate-200">landed</b>. Works for airports anywhere in the world.
      </p>

      <section>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Watched airports</h3>
        <div className="flex flex-wrap gap-1.5">
          {w.airports.length === 0 && <span className="text-xs text-slate-500">None yet. Add one below.</span>}
          {w.airports.map((a) => (
            <span key={a.code} className="flex items-center gap-1.5 rounded-full bg-lime-400/15 py-1 pl-2.5 pr-1 text-xs text-lime-200 ring-1 ring-lime-400/30">
              <b>{a.code}</b> {a.name}
              <button onClick={() => remove(a.code)} className="rounded-full px-1.5 text-lime-200/70 hover:text-red-300" aria-label={`Stop watching ${a.code}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="relative mt-2">
          <input
            id="milwatch-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add an airport: code or city (e.g. MCF, Homestead, Dover)"
            autoCapitalize="characters"
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-700 placeholder:text-slate-500"
          />
          {matches.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md bg-slate-800 text-sm shadow-xl ring-1 ring-slate-700">
              {matches.map((a) => (
                <li key={a.ident}>
                  <button onClick={() => add(a)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-700">
                    <span className="w-12 font-mono font-bold">{a.iata || a.ident}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{a.name}</span>
                    <span className="text-xs text-slate-500">{a.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="mt-2 flex items-center justify-between text-sm">
          Notify me when the app is closed
          <input
            id="milwatch-notify"
            type="checkbox"
            className="h-5 w-5 accent-sky-500"
            checked={w.notify}
            onChange={(e) => (milWatch.set((s) => ({ ...s, notify: e.target.checked })), touch())}
          />
        </label>
        <p className="text-[11px] text-slate-500">Needs notifications turned on in ⚙ Settings. The relay checks every 5 minutes.</p>
      </section>

      {now.length > 0 && (
        <section>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-lime-300">Near your airports right now</h3>
          <ul className="divide-y divide-slate-800">
            {now.map(({ a, airport, d }) => (
              <li key={a.hex + airport}>
                <button onClick={() => onOpen(a.hex)} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-semibold">{a.callsign}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {a.model ?? 'Unknown type'} · {fmtDist(d)} from {airport}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs text-slate-400">{fmtAlt(a.altitude, a.onGround)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-center">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent military arrivals</h3>
          {w.airports.length > 0 && (
            <button
              onClick={() => {
                setChecking(true)
                scanMilitary().finally(() => setChecking(false))
              }}
              disabled={checking}
              className="ml-auto text-xs text-sky-300 disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Check now'}
            </button>
          )}
        </div>
        {log.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing yet. Arrivals show up here (and as pop-ups) as they happen.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {log.slice(0, 40).map((e) => (
              <li key={e.id}>
                <button onClick={() => onOpen(e.hex)} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="text-lg">{e.status === 'landed' ? '🛬' : '🎖️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">
                      <b className="font-mono">{e.callsign}</b> {e.status === 'landed' ? 'landed at' : 'arriving at'} <b>{e.airport}</b>
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {e.model ?? 'Unknown type'}
                      {e.status === 'arriving' && ` · ${fmtDist(e.distanceNm)} out${e.altitude != null ? `, ${fmtAlt(e.altitude, false)}` : ''}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-slate-500">
                    {fmtClock(e.at)}
                    <br />
                    {fmtRelative(e.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
