import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import CategoryFilter from './components/CategoryFilter'
import FlightList from './components/FlightList'
import DetailPanel from './components/DetailPanel'
import SquawkGuide from './components/SquawkGuide'
import PhoneGuide from './components/PhoneGuide'
import { fetchFlightPath, type FlightPath } from './lib/history'
import EmergencyHistory from './components/EmergencyHistory'
import Logbook from './components/Logbook'
import TeamsPanel from './components/TeamsPanel'
import BottomSheet, { type SheetSize } from './components/BottomSheet'
import { useIsMobile } from './lib/useIsMobile'
import { emergencyLog } from './lib/emergencyLog'
import { refreshTeams, teams } from './lib/teams'
import type { Highlight } from './components/MapView'
import { useTraffic, type Mode } from './lib/useTraffic'
import { PRESETS } from './lib/presets'
import { categoryKey } from './lib/categories'
import { fmtClock } from './lib/format'
import type { Aircraft, Center } from './types'

type SortKey = 'callsign' | 'altitude' | 'speed' | 'emergency'
type Tab = 'flights' | 'events' | 'emergencies' | 'logbook' | 'teams'

const RADII = [25, 50, 100, 150, 250, 400, 500]

// Set when building the sandboxed web preview, which can't reach outside APIs.
const PREVIEW = import.meta.env.VITE_PREVIEW === '1'

export default function App() {
  const [center, setCenter] = useState<Center>(() => load('skywatch.center', PRESETS[0]))
  const [radius, setRadius] = useState<number>(() => load('skywatch.radius', 50))
  useEffect(() => save('skywatch.center', center), [center])
  useEffect(() => save('skywatch.radius', radius), [radius])
  const [mode, setMode] = useState<Mode>(PREVIEW ? 'demo' : 'live')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('emergency')
  const [emergOnly, setEmergOnly] = useState(false)
  const [hideGround, setHideGround] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('flights')
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [showSquawks, setShowSquawks] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [showTrails, setShowTrails] = useState<boolean>(() => load('skywatch.trails', true))
  useEffect(() => save('skywatch.trails', showTrails), [showTrails])
  const [showAirports, setShowAirports] = useState<boolean>(() => load('skywatch.airports', true))
  useEffect(() => save('skywatch.airports', showAirports), [showAirports])
  const [path, setPath] = useState<FlightPath | null>(null)
  const [pathLoading, setPathLoading] = useState(false)

  const traffic = useTraffic(center, radius, mode)
  const emergencies = traffic.aircraft.filter((a) => a.emergency)

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase()
    const list = traffic.aircraft.filter((a) => {
      if (cats.size && !cats.has(categoryKey(a.category)) && !a.special.some((sp) => cats.has(sp.tag))) return false
      if (emergOnly && !a.emergency) return false
      if (hideGround && a.onGround) return false
      if (q) {
        const hay = [a.callsign, a.registration, a.operator, a.typeCode, a.model, a.route?.origin?.iata, a.route?.destination?.iata, a.route?.origin?.icao, a.route?.destination?.icao]
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

  // Full flight history for the clicked aircraft, refreshed every minute.
  useEffect(() => {
    setPath(null)
    if (!selected || mode === 'demo') return
    let stop = false
    const get = () => {
      setPathLoading(true)
      fetchFlightPath(selected)
        .then((p) => !stop && setPath(p))
        .finally(() => !stop && setPathLoading(false))
    }
    get()
    const t = setInterval(get, 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [selected, mode])

  const changeCenter = (c: Center) => {
    setSelected(null)
    setCenter(c)
  }

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => changeCenter({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'My location' }),
      () =>
        alert(
          window.isSecureContext
            ? 'Could not get your location. Check that location access is allowed for this site.'
            : 'Your phone only shares location with secure websites, so "Near me" can\'t work here. Pick an airport, or pan the map and tap "Track planes here".',
        ),
    )
  }

  // ---- phone layout ----
  const isMobile = useIsMobile()
  const [sheet, setSheet] = useState<SheetSize>('peek')
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    if (selected && isMobile) setSheet((s) => (s === 'peek' ? 'half' : s))
  }, [selected, isMobile])

  const liveHexes = useMemo(() => new Set(traffic.aircraft.map((a) => a.hex)), [traffic.aircraft])
  const ongoing = emergencyLog.use().filter((r) => r.outcome === 'ongoing').length
  const followed = teams.use()

  // Check followed team planes every minute while SkyWatch is open.
  useEffect(() => {
    if (followed.length === 0) return
    refreshTeams()
    const t = setInterval(() => !document.hidden && refreshTeams(), 60_000)
    return () => clearInterval(t)
  }, [followed.length])

  const focusPoint = (hex: string, lat: number, lon: number, label: string, pts?: [number, number, number | null][]) => {
    setHighlight(null)
    if (liveHexes.has(hex)) {
      setSelected(hex)
      return
    }
    if (pts && pts.length) setHighlight({ points: pts, label })
    else setHighlight({ points: [[lat, lon, null]], label })
    if (isMobile) setSheet('peek')
  }

  const activeFilters = cats.size + (emergOnly ? 1 : 0) + (hideGround ? 1 : 0) + (query ? 1 : 0)
  const showFilterBlock = !isMobile || filtersOpen

  const tabs: { id: Tab; label: string }[] = [
    { id: 'flights', label: `Flights ${visible.length}` },
    { id: 'events', label: 'Takeoffs' },
    { id: 'emergencies', label: ongoing ? `Emergencies ${ongoing}` : 'Emergencies' },
    { id: 'logbook', label: 'Logbook' },
    { id: 'teams', label: 'Teams' },
  ]

  const panel = selectedAc ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <DetailPanel aircraft={selectedAc} onClose={() => setSelected(null)} path={path} pathLoading={pathLoading} demo={mode === 'demo'} />
    </div>
  ) : (
    <>
      <div className="no-scrollbar flex shrink-0 overflow-x-auto border-b border-slate-800 text-xs font-semibold" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id)
              if (isMobile && sheet === 'peek') setSheet('half')
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-2 uppercase tracking-wider md:flex-1 md:px-1 ${
              tab === t.id ? 'border-b-2 border-sky-400 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            } ${t.id === 'emergencies' && ongoing ? 'text-red-300' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'flights' && (
          <>
            {isMobile && (
              <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
                <input
                  id="search-mobile"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSheet('full')}
                  placeholder="Search callsign, type, airport…"
                  className="min-w-0 flex-1 rounded-md bg-slate-800 px-3 py-1.5 text-sm ring-1 ring-slate-700 placeholder:text-slate-500"
                />
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ${filtersOpen || activeFilters ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700'}`}
                >
                  Filters{activeFilters ? ` ${activeFilters}` : ''}
                </button>
              </div>
            )}
            {showFilterBlock && (
              <div className="space-y-2 border-b border-slate-800 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Aircraft size &amp; type</div>
                <CategoryFilter aircraft={traffic.aircraft} active={cats} onChange={setCats} />
                {!isMobile && (
                  <input
                    id="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search callsign, type, airport…"
                    className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-sky-500"
                  />
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={emergOnly} onChange={(e) => setEmergOnly(e.target.checked)} /> Emergencies only
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={hideGround} onChange={(e) => setHideGround(e.target.checked)} /> Hide on ground
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={showTrails} onChange={(e) => setShowTrails(e.target.checked)} /> Trails
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} /> Airports
                  </label>
                  <select className="ml-auto rounded bg-slate-800 px-1.5 py-1 ring-1 ring-slate-700" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="emergency">Sort: emergencies first</option>
                    <option value="callsign">Sort: callsign</option>
                    <option value="altitude">Sort: altitude</option>
                    <option value="speed">Sort: speed</option>
                  </select>
                </div>
              </div>
            )}
            {traffic.status === 'loading' ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading aircraft…</p>
            ) : (
              <FlightList aircraft={visible} selected={selected} onSelect={setSelected} />
            )}
          </>
        )}
        {tab === 'events' && <EventLog traffic={traffic} onSelect={setSelected} />}
        {tab === 'emergencies' && (
          <EmergencyHistory
            liveHexes={liveHexes}
            demo={mode === 'demo'}
            onOpen={(r) => {
              const last = r.path[r.path.length - 1]
              focusPoint(r.hex, last?.[0] ?? center.lat, last?.[1] ?? center.lon, `${r.callsign}: ${r.codes[0]?.label ?? 'emergency'}`, r.path.map(([la, lo, al]) => [la, lo, al]))
            }}
          />
        )}
        {tab === 'logbook' && <Logbook liveHexes={liveHexes} onOpen={(e) => focusPoint(e.hex, e.lat, e.lon, `${e.callsign} (logged ${fmtClock(e.at)})`)} />}
        {tab === 'teams' && (
          <TeamsPanel
            onShow={(s) => {
              if (s.lat == null || s.lon == null) return
              if (s.hex && liveHexes.has(s.hex)) {
                setSelected(s.hex)
                return
              }
              setCenter({ lat: s.lat, lon: s.lon, label: s.ident })
              setRadius((r) => Math.min(r, 100))
              setHighlight(null)
              setSelected(s.hex ?? null)
            }}
          />
        )}
      </div>
    </>
  )

  const iconBtn = 'rounded-md bg-slate-800 px-2.5 py-1.5 text-sm ring-1 ring-slate-700 hover:bg-slate-700'

  return (
    <div className="flex h-full flex-col">
      {showPhone && <PhoneGuide onClose={() => setShowPhone(false)} />}
      {showSquawks && (
        <SquawkGuide onClose={() => setShowSquawks(false)} current={new Set(traffic.aircraft.map((a) => a.squawk ?? ''))} />
      )}

      {/* Header */}
      <header className="relative z-[800] flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-2 py-1.5 md:flex-wrap md:gap-2 md:px-4 md:py-2">
        <div className="flex shrink-0 items-center gap-1.5 md:mr-2 md:gap-2">
          <span className="text-lg md:text-xl">✈</span>
          <h1 className="hidden text-lg font-bold tracking-tight sm:block">SkyWatch</h1>
          <StatusDot traffic={traffic} compact={isMobile} />
        </div>
        <select
          id="location"
          className="min-w-0 flex-1 rounded-md bg-slate-800 px-1.5 py-1.5 text-xs ring-1 ring-slate-700 md:max-w-xs md:flex-none md:px-2 md:text-sm"
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
          id="radius"
          className="shrink-0 rounded-md bg-slate-800 px-1.5 py-1.5 text-xs ring-1 ring-slate-700 md:px-2 md:text-sm"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} nm{r > 250 ? ' (slower)' : ''}
            </option>
          ))}
        </select>
        <button onClick={useMyLocation} className={`${iconBtn} shrink-0 px-2 md:px-2.5`} aria-label="Near me">
          📍<span className="hidden md:inline"> Near me</span>
        </button>
        {isMobile ? (
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)} className={`${iconBtn} px-2.5`} aria-label="More">
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[900]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-[901] mt-1 w-52 overflow-hidden rounded-lg bg-slate-800 text-sm shadow-xl ring-1 ring-slate-700">
                  <button className="block w-full px-4 py-2.5 text-left hover:bg-slate-700" onClick={() => (setMenuOpen(false), setShowSquawks(true))}>
                    Squawk codes
                  </button>
                  <button className="block w-full px-4 py-2.5 text-left hover:bg-slate-700" onClick={() => (setMenuOpen(false), setShowPhone(true))}>
                    📱 Add to Home Screen
                  </button>
                  <button className="block w-full px-4 py-2.5 text-left hover:bg-slate-700" onClick={() => setShowAirports((v) => !v)}>
                    {showAirports ? '✓ ' : ''}Airports on map
                  </button>
                  <button className="block w-full px-4 py-2.5 text-left hover:bg-slate-700" onClick={() => setShowTrails((v) => !v)}>
                    {showTrails ? '✓ ' : ''}Trails on map
                  </button>
                  <div className="flex border-t border-slate-700">
                    {(['live', 'demo'] as Mode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setSelected(null)
                          setMode(m)
                          setMenuOpen(false)
                        }}
                        className={`flex-1 py-2.5 text-xs font-semibold uppercase ${mode === m ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <button onClick={() => setShowSquawks(true)} className={iconBtn}>
              Squawk codes
            </button>
            <button onClick={() => setShowPhone(true)} className={iconBtn}>
              📱 Phone
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
            </div>
          </>
        )}
      </header>

      {mode === 'demo' && (
        <div className="bg-amber-500/15 px-3 py-1 text-center text-[11px] text-amber-200 md:text-xs">
          DEMO: simulated planes, not real.{' '}
          {PREVIEW ? 'This preview cannot reach live flight data.' : <span className="hidden md:inline">Switch to LIVE for real ADS-B data.</span>}
        </div>
      )}

      {traffic.status === 'error' && mode === 'live' && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-red-500/15 px-3 py-1.5 text-xs text-red-200">
          Couldn't reach the live ADS-B feeds ({traffic.error}). Retrying…
          <button className="rounded bg-red-500/30 px-2 py-0.5 font-semibold hover:bg-red-500/50" onClick={() => setMode('demo')}>
            Use demo data
          </button>
        </div>
      )}

      {emergencies.length > 0 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto whitespace-nowrap bg-red-600 px-3 py-1.5 text-sm font-semibold text-white md:flex-wrap">
          <span className="shrink-0 animate-pulse">⚠ {emergencies.length}</span>
          {emergencies.map((a) => (
            <button key={a.hex} onClick={() => setSelected(a.hex)} className="shrink-0 rounded bg-white/20 px-2 py-0.5 font-mono text-xs hover:bg-white/30">
              {a.callsign} — {a.emergency!.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* Map: full screen on phones, right-hand side on bigger screens */}
        <main className="absolute inset-0 isolate md:static md:order-2 md:flex-1">
          <MapView
            aircraft={visible}
            selected={selected}
            onSelect={setSelected}
            center={center}
            radiusNm={radius}
            onSearchHere={(lat, lon) => changeCenter({ lat, lon, label: `${lat.toFixed(2)}, ${lon.toFixed(2)}` })}
            showTrails={showTrails}
            showAirports={showAirports}
            path={path}
            highlight={highlight}
            onClearHighlight={() => setHighlight(null)}
            bottomInset={isMobile ? 132 : 0}
          />
        </main>

        {isMobile ? (
          <BottomSheet size={sheet} onSize={setSheet}>
            {panel}
          </BottomSheet>
        ) : (
          <aside className="relative z-10 flex w-[400px] flex-none flex-col border-r border-slate-800 bg-slate-900 md:order-1">{panel}</aside>
        )}
      </div>
    </div>
  )
}

function StatusDot({ traffic, compact }: { traffic: ReturnType<typeof useTraffic>; compact?: boolean }) {
  const color = traffic.status === 'ok' ? 'bg-emerald-400' : traffic.status === 'error' ? 'bg-red-500' : 'bg-amber-400'
  if (compact) return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} title={traffic.source ?? traffic.status} />
  return (
    <div className="hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
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

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
