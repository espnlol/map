import { useEffect, useMemo, useRef, useState } from 'react'
import { loadCrashes, type Dataset } from './data/load'
import type { Category, Cause, Crash } from './types'
import { CAUSE_COLORS, formatDate } from './styles'
import { CrashMap, type BaseMap, type MarkerMode, type Projection } from './components/CrashMap'
import { CrashDetail } from './components/CrashDetail'
import { AboutModal, GetAppModal } from './components/Modals'
import { StatsModal, crashesIn, type GroupRef } from './components/Stats'
import { deaths } from './stats'
import { loadCustomLinks, saveCustomLinks } from './links'

const ALL_CAUSES = Object.keys(CAUSE_COLORS) as Cause[]
const ALL_CATEGORIES: Category[] = ['Commercial', 'Cargo', 'Military / State', 'General aviation']
const LIST_PAGE = 150

type Sort = 'newest' | 'oldest' | 'deadliest'
type Modal = null | 'stats' | 'about' | 'app'

function readPref<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* ignore */ }
}

function matches(c: Crash, q: string) {
  return [c.name, c.nickname, c.location, c.country, c.operator, c.aircraft, c.flight, c.registration, c.date].some((s) => s?.toLowerCase().includes(q))
}

function Chip({ on, color, children, onClick }: { on: boolean; color?: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        on ? 'border-blue-500/60 bg-blue-500/15 text-white' : 'border-slate-700 text-slate-500 hover:text-slate-300'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: on ? color : '#475569' }} />}
      {children}
    </button>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { id: T; label: string; icon: React.ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg border border-slate-700 bg-slate-900/90 p-0.5 sm:rounded-xl sm:p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
            value === o.id ? 'border border-blue-500/70 bg-blue-500/15 text-white' : 'border border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

const Icon = {
  search: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  filter: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
  list: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  stats: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 20V10M12 20V4M18 20v-7" /></svg>,
  info: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  phone: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>,
  dice: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 8h.01M16 16h.01M16 8h.01M8 16h.01M12 12h.01" /></svg>,
  pin: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>,
  heat: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1 1.5 2 1.5 3 1-2 1.5-5 1.5-8z" /></svg>,
  globe: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>,
  flat: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>,
  layers: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>,
}

export default function App() {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [causes, setCauses] = useState<Set<Cause>>(new Set(ALL_CAUSES))
  const [categories, setCategories] = useState<Set<Category>>(new Set(ALL_CATEGORIES))
  const [data, setData] = useState<Dataset | null>(null)
  // null = no limit; the slider shows the data's own first/last year
  const [fromYearRaw, setFromYear] = useState<number | null>(null)
  const [toYearRaw, setToYear] = useState<number | null>(null)
  const [groupFilter, setGroupFilter] = useState<GroupRef | null>(null)
  const [statsGroup, setStatsGroup] = useState<GroupRef | null>(null)
  const [listLimit, setListLimit] = useState(LIST_PAGE)
  const [fitRequest, setFitRequest] = useState(0)
  const [minDeaths, setMinDeaths] = useState(0)
  const [sort, setSort] = useState<Sort>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(() => location.hash.slice(1) || null)
  const [browseOpen, setBrowseOpen] = useState(() => innerWidth >= 768)
  const [modal, setModal] = useState<Modal>(null)
  const [mode, setMode] = useState<MarkerMode>(() => readPref('mode', ['markers', 'heatmap'], 'markers'))
  const [projection, setProjection] = useState<Projection>(() => readPref('projection', ['globe', 'flat'], 'globe'))
  const [baseMap, setBaseMap] = useState<BaseMap>(() => readPref('baseMap', ['satellite', 'terrain', 'dark'], 'satellite'))
  const [layersOpen, setLayersOpen] = useState(false)
  const [customLinks, setCustomLinks] = useState<Record<string, string>>(loadCustomLinks)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadCrashes().then(setData) }, [])
  const all = useMemo(() => data?.crashes ?? [], [data])
  const [MIN_YEAR, MAX_YEAR] = useMemo(() => {
    if (!all.length) return [1900, new Date().getFullYear()]
    const ys = all.map((c) => +c.date.slice(0, 4))
    return [Math.min(...ys), Math.max(...ys)]
  }, [all])
  const fromYear = fromYearRaw ?? MIN_YEAR
  const toYear = toYearRaw ?? MAX_YEAR

  useEffect(() => writePref('mode', mode), [mode])
  useEffect(() => writePref('projection', projection), [projection])
  useEffect(() => writePref('baseMap', baseMap), [baseMap])

  // Keep the URL hash in sync so a crash can be shared/bookmarked.
  useEffect(() => {
    const target = selectedId ? `#${selectedId}` : ''
    if (location.hash !== target) history.replaceState(null, '', selectedId ? target : location.pathname + location.search)
  }, [selectedId])
  useEffect(() => {
    const onHash = () => setSelectedId(location.hash.slice(1) || null)
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  // "/" focuses search, Escape closes things.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (modal) setModal(null)
        else if (filtersOpen) setFiltersOpen(false)
        else if (selectedId) setSelectedId(null)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [modal, filtersOpen, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = groupFilter ? crashesIn(all, groupFilter) : all
    const list = base.filter((c) => {
      const y = +c.date.slice(0, 4)
      if (y < fromYear || y > toYear) return false
      if (!causes.has(c.cause) || !categories.has(c.category)) return false
      if (deaths(c) < minDeaths) return false
      return !q || matches(c, q)
    })
    list.sort((a, b) =>
      sort === 'deadliest' ? deaths(b) - deaths(a) : sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
    )
    return list
  }, [all, groupFilter, query, causes, categories, fromYear, toYear, minDeaths, sort])
  useEffect(() => setListLimit(LIST_PAGE), [filtered])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    // Name matches first, then anything else that mentions the search.
    const byName = all.filter((c) => c.name.toLowerCase().includes(q))
    const rest = byName.length >= 8 ? [] : all.filter((c) => !c.name.toLowerCase().includes(q) && matches(c, q))
    return [...byName, ...rest].slice(0, 8)
  }, [all, query])

  const activeFilters =
    (causes.size < ALL_CAUSES.length ? 1 : 0) +
    (categories.size < ALL_CATEGORIES.length ? 1 : 0) +
    (fromYear > MIN_YEAR || toYear < MAX_YEAR ? 1 : 0) +
    (minDeaths > 0 ? 1 : 0) +
    (groupFilter ? 1 : 0)

  const selected = useMemo(() => all.find((c) => c.id === selectedId || c.wikiId === selectedId) ?? null, [all, selectedId])
  const totalDeaths = filtered.reduce((n, c) => n + deaths(c), 0)
  const panelOpen = !!selected || browseOpen

  function toggle<T>(set: Set<T>, v: T, update: (s: Set<T>) => void) {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    update(next)
  }

  function select(id: string | null) {
    setSelectedId(id)
    setSearchOpen(false)
  }

  function setCustomLink(id: string, url: string | null) {
    const next = { ...customLinks }
    if (url) next[id] = url
    else delete next[id]
    setCustomLinks(next)
    saveCustomLinks(next)
  }

  function resetFilters() {
    setCauses(new Set(ALL_CAUSES))
    setCategories(new Set(ALL_CATEGORIES))
    setFromYear(null)
    setToYear(null)
    setMinDeaths(0)
    setGroupFilter(null)
  }

  function openStats(g: GroupRef | null = null) {
    setStatsGroup(g)
    setModal('stats')
  }

  function showGroupOnMap(g: GroupRef) {
    setGroupFilter(g)
    setModal(null)
    setSelectedId(null)
    setBrowseOpen(true)
    setFitRequest((n) => n + 1)
  }

  const navBtn = 'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800'

  return (
    <div className="flex h-dvh flex-col bg-[#0b1324] text-slate-100">
      {/* ── Top bar ── */}
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0b1324] px-3 sm:px-4">
        <button onClick={() => { select(null); setBrowseOpen(true) }} className="flex shrink-0 items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8 rounded-lg" />
          <span className="hidden leading-tight lg:block">
            <span className="block text-lg font-bold text-white">Black Box Atlas</span>
            <span className="block text-[10px] text-slate-400">Global aviation accident map</span>
          </span>
        </button>

        {/* Search */}
        <div className="relative min-w-0 flex-1 md:max-w-xl">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-400 focus-within:border-blue-500">
            {Icon.search}
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { select(suggestions[0].id); searchRef.current?.blur() } }}
              placeholder="Name, flight, aircraft, airline or place"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="text-slate-500 hover:text-white">✕</button>}
          </div>
          {searchOpen && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-12 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { select(c.id); searchRef.current?.blur() }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">{c.date.slice(0, 4)} · {c.aircraft} · {c.country}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
              filtersOpen || activeFilters ? 'border-blue-500 text-blue-300' : 'border-slate-700 text-blue-400 hover:bg-slate-800'
            }`}
          >
            {Icon.filter}
            <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[11px] text-white">{activeFilters}</span>}
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setFiltersOpen(false)} />
              <div className="fixed left-3 right-3 top-16 z-10 space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Years</span>
                    <span className="tabular-nums text-slate-200">{fromYear} – {toYear}</span>
                  </div>
                  <div className="flex gap-3">
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={fromYear} aria-label="From year"
                      onChange={(e) => setFromYear(Math.min(+e.target.value, toYear))} className="w-full accent-blue-500" />
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={toYear} aria-label="To year"
                      onChange={(e) => setToYear(Math.max(+e.target.value, fromYear))} className="w-full accent-blue-500" />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-slate-400">Cause</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CAUSES.map((c) => (
                      <Chip key={c} on={causes.has(c)} color={CAUSE_COLORS[c]} onClick={() => toggle(causes, c, setCauses)}>{c}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-slate-400">Flight type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CATEGORIES.map((c) => (
                      <Chip key={c} on={categories.has(c)} onClick={() => toggle(categories, c, setCategories)}>{c}</Chip>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <label className="flex items-center gap-1.5">
                    Min. deaths
                    <select value={minDeaths} onChange={(e) => setMinDeaths(+e.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-200">
                      {[0, 1, 50, 100, 200, 300].map((n) => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                    </select>
                  </label>
                  <span className="ml-auto">{filtered.length} shown</span>
                  <button onClick={resetFilters} className="font-semibold text-blue-400 hover:underline">Reset</button>
                </div>
              </div>
            </>
          )}
        </div>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <button className={navBtn} onClick={() => { select(null); setBrowseOpen(!browseOpen || !!selected) }}>{Icon.list} Browse</button>
          <button className={navBtn} onClick={() => openStats()}>{Icon.stats} Statistics</button>
          <button className={navBtn} onClick={() => setModal('about')}>{Icon.info} About</button>
          <button className={navBtn} onClick={() => select(filtered[Math.floor(Math.random() * filtered.length)]?.id ?? null)} disabled={!filtered.length}>
            {Icon.dice} Random
          </button>
          <button onClick={() => setModal('app')} className="ml-1 flex h-10 items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-sm font-semibold text-white hover:bg-slate-800">
            {Icon.phone} Get App
          </button>
        </nav>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* ── Map ── */}
        <div className={`absolute inset-0 ${panelOpen ? 'md:left-80' : ''}`}>
          <CrashMap crashes={filtered} selected={selected} onSelect={select} mode={mode} projection={projection} baseMap={baseMap} fitRequest={fitRequest} />

          {/* Bottom controls */}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3 md:bottom-6 md:top-auto">
            <div className="pointer-events-auto flex gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/80 p-1 shadow-2xl backdrop-blur sm:gap-2 sm:rounded-2xl sm:p-1.5">
              <Segmented value={mode} onChange={setMode} options={[
                { id: 'markers', label: 'Markers', icon: Icon.pin },
                { id: 'heatmap', label: 'Heatmap', icon: Icon.heat },
              ]} />
              <Segmented value={projection} onChange={setProjection} options={[
                { id: 'globe', label: 'Globe', icon: Icon.globe },
                { id: 'flat', label: 'Flat', icon: Icon.flat },
              ]} />
            </div>
          </div>

          {/* Base map picker */}
          <div className="absolute right-[10px] top-[6.75rem]">
            <button
              onClick={() => setLayersOpen(!layersOpen)}
              aria-label="Map style"
              className="flex h-[29px] w-[29px] items-center justify-center rounded-md bg-white text-slate-800 shadow"
            >
              {Icon.layers}
            </button>
            {layersOpen && (
              <div className="absolute right-0 top-9 w-36 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-sm shadow-2xl">
                {(['satellite', 'terrain', 'dark'] as BaseMap[]).map((b) => (
                  <button key={b} onClick={() => { setBaseMap(b); setLayersOpen(false) }}
                    className={`block w-full px-3 py-2 text-left capitalize hover:bg-slate-800 ${b === baseMap ? 'font-semibold text-blue-400' : 'text-slate-200'}`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          {mode === 'markers' && (
            <div className="absolute bottom-6 left-3 hidden rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur xl:block">
              {ALL_CAUSES.map((c) => (
                <div key={c} className="flex items-center gap-2 py-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: CAUSE_COLORS[c] }} />{c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Side panel (bottom sheet on phones) ── */}
        {panelOpen && (
          <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[55%] flex-col overflow-hidden rounded-t-2xl border-t border-slate-700 bg-[#0f172a] shadow-2xl md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-80 md:rounded-none md:border-r md:border-t-0">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-700 md:hidden" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {selected ? (
                <CrashDetail
                  crash={selected}
                  customLink={customLinks[selected.id]}
                  onCustomLink={(url) => setCustomLink(selected.id, url)}
                  onClose={() => select(null)}
                  onOpenGroup={openStats}
                />
              ) : (
                <div>
                  <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#0f172a] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-white">Browse accidents</h2>
                      <button onClick={() => setBrowseOpen(false)} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
                    </div>
                    {groupFilter && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-blue-500/15 px-2.5 py-1.5 text-xs text-blue-200">
                        <span className="min-w-0 flex-1 truncate">
                          {groupFilter.kind === 'airline' ? 'Airline' : groupFilter.kind === 'aircraft' ? 'Aircraft' : 'Place'}: <b className="text-white">{groupFilter.name}</b>
                        </span>
                        <button onClick={() => openStats(groupFilter)} className="shrink-0 font-semibold hover:underline">Stats</button>
                        <button onClick={() => setGroupFilter(null)} aria-label="Clear" className="shrink-0 hover:text-white">✕</button>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span><b className="text-slate-200">{filtered.length.toLocaleString()}</b> accidents · <b className="text-slate-200">{totalDeaths.toLocaleString()}</b> deaths</span>
                      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                        className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="deadliest">Deadliest</option>
                      </select>
                    </div>
                  </div>
                  <ul>
                    {filtered.slice(0, listLimit).map((c) => (
                      <li key={c.id}>
                        <button onClick={() => select(c.id)} className="flex w-full gap-3 border-b border-slate-800/70 px-4 py-2.5 text-left hover:bg-slate-800/60">
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                            <span className="block truncate text-xs text-slate-500">{formatDate(c.date)} · {c.country}</span>
                          </span>
                          <span className="shrink-0 text-right text-xs tabular-nums text-slate-300">
                            {c.fatalities ?? '—'}
                            <span className="block text-[10px] text-slate-600">deaths</span>
                          </span>
                        </button>
                      </li>
                    ))}
                    {filtered.length > listLimit && (
                      <li className="p-3">
                        <button onClick={() => setListLimit(listLimit + LIST_PAGE * 2)} className="w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:bg-slate-800">
                          Show more ({(filtered.length - listLimit).toLocaleString()} left)
                        </button>
                      </li>
                    )}
                    {!filtered.length && data && <li className="p-6 text-center text-sm text-slate-500">No accidents match. Try clearing the search or filters.</li>}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Phone: quick buttons when nothing is open */}
        {!panelOpen && (
          <div className="absolute inset-x-0 bottom-9 z-20 flex justify-center gap-2 px-2 md:hidden">
            {[
              { label: 'Browse', icon: Icon.list, on: () => setBrowseOpen(true) },
              { label: 'Stats', icon: Icon.stats, on: () => openStats() },
              { label: 'Random', icon: Icon.dice, on: () => select(filtered[Math.floor(Math.random() * filtered.length)]?.id ?? null) },
              { label: 'About', icon: Icon.info, on: () => setModal('about') },
            ].map((b) => (
              <button key={b.label} onClick={b.on} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
                {b.icon}{b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {modal === 'stats' && (
        <StatsModal
          crashes={filtered}
          total={all.length}
          initial={statsGroup}
          onSelect={(id) => { setModal(null); select(id) }}
          onShowOnMap={showGroupOnMap}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'about' && <AboutModal count={all.length} updated={data?.updated} onClose={() => setModal(null)} />}

      {!data && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 shadow-xl">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
            Loading crashes from Wikipedia…
          </div>
        </div>
      )}
      {modal === 'app' && <GetAppModal onClose={() => setModal(null)} />}
    </div>
  )
}
