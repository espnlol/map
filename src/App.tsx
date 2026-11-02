import { useMemo, useState } from 'react'
import MapView from './components/MapView'
import CategoryFilter from './components/CategoryFilter'
import FlightList from './components/FlightList'
import DetailPanel from './components/DetailPanel'
import { useTraffic, type Mode } from './lib/useTraffic'
import { PRESETS } from './lib/presets'
import { categoryKey } from './lib/categories'
import { fmtClock } from './lib/format'
import type { Aircraft, Center } from './types'

type SortKey = 'callsign' | 'altitude' | 'speed' | 'emergency'

const RADII = [25, 50, 100, 150, 250]

// Set when building the sandboxed web preview, which can't reach outside APIs.
const PREVIEW = import.meta.env.VITE_PREVIEW === '1'

export default function App() {
  const [center, setCenter] = useState<Center>(PRESETS[0])
  const [radius, setRadius] = useState(50)
  const [mode, setMode] = useState<Mode>(PREVIEW ? 'demo' : 'live')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('emergency')
  const [emergOnly, setEmergOnly] = useState(false)
  const [hideGround, setHideGround] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'flights' | 'events'>('flights')

  const traffic = useTraffic(center, radius, mode)
  const emergencies = traffic.aircraft.filter((a) => a.emergency)

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase()
    const list = traffic.aircraft.filter((a) => {
      if (cats.size && !cats.has(categoryKey(a.category))) return false
      if (emergOnly && !a.emergency) return false
      if (hideGround && a.onGround) return false
      if (q) {
        const hay = [a.callsign, a.registration, a.typeCode, a.model, a.route?.origin?.iata, a.route?.destination?.iata, a.route?.origin?.icao, a.route?.destination?.icao]
          .filter(Boolean)
          .join(' ')
          .toUpperCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const alt = (a: Aircraft) => (a.onGround ? -1 : a.altitude ?? -1)
    list.sort((a, b) => {
      switch (sort) {
        case 'altitude':
          return alt(b) - alt(a)
        case 'speed':
          return (b.groundSpeed ?? 0) - (a.groundSpeed ?? 0)
        case 'emergency':
          if (!!a.emergency !== !!b.emergency) return a.emergency ? -1 : 1
          return a.callsign.localeCompare(b.callsign)
        default:
          return a.callsign.localeCompare(b.callsign)
      }
    })
    return list
  }, [traffic.aircraft, cats, query, sort, emergOnly, hideGround])

  const selectedAc = traffic.aircraft.find((a) => a.hex === selected) ?? null

  const changeCenter = (c: Center) => {
    setSelected(null)
    setCenter(c)
  }

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => changeCenter({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'My location' }),
      () => alert('Could not get your location.'),
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <div className="mr-2 flex items-center gap-2">
          <span className="text-xl">✈</span>
          <h1 className="text-lg font-bold tracking-tight">SkyWatch</h1>
        </div>
        <select
          className="rounded-md bg-slate-800 px-2 py-1.5 text-sm ring-1 ring-slate-700"
          value={PRESETS.some((p) => p.label === center.label) ? center.label : ''}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.label === e.target.value)
            if (p) changeCenter(p)
          }}
        >
          {!PRESETS.some((p) => p.label === center.label) && <option value="">{center.label}</option>}
          {PRESETS.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
        </select>
        <select
          className="rounded-md bg-slate-800 px-2 py-1.5 text-sm ring-1 ring-slate-700"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} nm radius
            </option>
          ))}
        </select>
        <button onClick={useMyLocation} className="rounded-md bg-slate-800 px-2.5 py-1.5 text-sm ring-1 ring-slate-700 hover:bg-slate-700">
          📍 Near me
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex overflow-hidden rounded-md ring-1 ring-slate-700">
            {(['live', 'demo'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setSelected(null)
                  setMode(m)
                }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase ${mode === m ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <StatusDot traffic={traffic} />
        </div>
      </header>

      {mode === 'demo' && (
        <div className="bg-amber-500/15 px-4 py-1 text-center text-xs text-amber-200">
          DEMO MODE — simulated traffic, not real aircraft.{' '}
          {PREVIEW ? 'This web preview cannot reach live flight data; run the app from GitHub for real planes.' : 'Switch to LIVE for real ADS-B data.'}
        </div>
      )}

      {traffic.status === 'error' && mode === 'live' && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-red-500/15 px-4 py-1.5 text-xs text-red-200">
          Couldn't reach the live ADS-B feeds ({traffic.error}). Retrying…
          <button className="rounded bg-red-500/30 px-2 py-0.5 font-semibold hover:bg-red-500/50" onClick={() => setMode('demo')}>
            Use demo data instead
          </button>
        </div>
      )}

      {emergencies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white">
          <span className="animate-pulse">⚠ {emergencies.length} active emergenc{emergencies.length === 1 ? 'y' : 'ies'}:</span>
          {emergencies.map((a) => (
            <button key={a.hex} onClick={() => setSelected(a.hex)} className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs hover:bg-white/30">
              {a.callsign} — {a.emergency!.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Sidebar */}
        <aside className="flex min-h-0 flex-1 flex-col border-slate-800 bg-slate-900 md:w-[400px] md:flex-none md:border-r">
          {selectedAc ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DetailPanel aircraft={selectedAc} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <>
              <div className="space-y-2 border-b border-slate-800 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Aircraft category</div>
                <CategoryFilter aircraft={traffic.aircraft} active={cats} onChange={setCats} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search callsign, type, airport…"
                  className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-sky-500"
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={emergOnly} onChange={(e) => setEmergOnly(e.target.checked)} /> Emergencies only
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={hideGround} onChange={(e) => setHideGround(e.target.checked)} /> Hide on ground
                  </label>
                  <select className="ml-auto rounded bg-slate-800 px-1.5 py-1 ring-1 ring-slate-700" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="emergency">Sort: emergencies first</option>
                    <option value="callsign">Sort: callsign</option>
                    <option value="altitude">Sort: altitude</option>
                    <option value="speed">Sort: speed</option>
                  </select>
                </div>
              </div>
              <div className="flex border-b border-slate-800 text-xs font-semibold">
                {(['flights', 'events'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2 uppercase tracking-wider ${tab === t ? 'border-b-2 border-sky-400 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {t === 'flights' ? `Flights (${visible.length})` : `Takeoffs & landings (${traffic.events.filter((e) => e.kind !== 'emergency').length})`}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === 'flights' ? (
                  traffic.status === 'loading' ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">Loading aircraft…</p>
                  ) : (
                    <FlightList aircraft={visible} selected={selected} onSelect={setSelected} />
                  )
                ) : (
                  <EventLog traffic={traffic} onSelect={setSelected} />
                )}
              </div>
            </>
          )}
        </aside>

        {/* Map */}
        <main className="h-[45vh] shrink-0 md:h-auto md:flex-1">
          <MapView
            aircraft={visible}
            selected={selected}
            onSelect={setSelected}
            center={center}
            radiusNm={radius}
            onSearchHere={(lat, lon) => changeCenter({ lat, lon, label: `${lat.toFixed(2)}, ${lon.toFixed(2)}` })}
          />
        </main>
      </div>
    </div>
  )
}

function StatusDot({ traffic }: { traffic: ReturnType<typeof useTraffic> }) {
  const color = traffic.status === 'ok' ? 'bg-emerald-400' : traffic.status === 'error' ? 'bg-red-500' : 'bg-amber-400'
  return (
    <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {traffic.status === 'ok' ? `${traffic.source} · ${traffic.updatedAt ? fmtClock(traffic.updatedAt) : ''}` : traffic.status === 'error' ? 'Offline' : 'Connecting'}
    </div>
  )
}

function EventLog({ traffic, onSelect }: { traffic: ReturnType<typeof useTraffic>; onSelect: (hex: string) => void }) {
  if (traffic.events.length === 0)
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500">
        No takeoffs or landings seen yet. They appear here the moment an aircraft in range leaves or touches the ground.
      </p>
    )
  const icon = { takeoff: '🛫', landing: '🛬', emergency: '⚠️' }
  return (
    <ul className="divide-y divide-slate-800">
      {traffic.events.map((e) => (
        <li key={e.id}>
          <button onClick={() => onSelect(e.hex)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-800/60">
            <span>{icon[e.kind]}</span>
            <span className="font-mono text-sm font-semibold">{e.callsign}</span>
            <span className={`flex-1 text-xs ${e.kind === 'emergency' ? 'text-red-300' : 'text-slate-400'}`}>{e.text}</span>
            <span className="font-mono text-xs text-slate-500">{fmtClock(e.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
