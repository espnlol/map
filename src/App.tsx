import { useEffect, useMemo, useState } from 'react'
import { CRASHES } from './data/crashes'
import type { Category, Cause, Crash } from './types'
import { CAUSE_COLORS, formatDate } from './styles'
import { CrashMap } from './components/CrashMap'
import { CrashDetail } from './components/CrashDetail'
import { loadCustomLinks, saveCustomLinks } from './links'

const ALL_CAUSES = Object.keys(CAUSE_COLORS) as Cause[]
const ALL_CATEGORIES: Category[] = ['Commercial', 'Cargo', 'Military / State', 'General aviation']
const YEARS = CRASHES.map((c) => +c.date.slice(0, 4))
const MIN_YEAR = Math.min(...YEARS)
const MAX_YEAR = Math.max(...YEARS)

type Sort = 'newest' | 'oldest' | 'deadliest'

function Chip({ on, color, children, onClick }: { on: boolean; color?: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        on
          ? 'border-slate-500 bg-slate-700 text-white'
          : 'border-slate-700 bg-transparent text-slate-500 hover:text-slate-300'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: on ? color : '#475569' }} />}
      {children}
    </button>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [causes, setCauses] = useState<Set<Cause>>(new Set(ALL_CAUSES))
  const [categories, setCategories] = useState<Set<Category>>(new Set(ALL_CATEGORIES))
  const [fromYear, setFromYear] = useState(MIN_YEAR)
  const [toYear, setToYear] = useState(MAX_YEAR)
  const [minDeaths, setMinDeaths] = useState(0)
  const [sort, setSort] = useState<Sort>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(() => location.hash.slice(1) || null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [customLinks, setCustomLinks] = useState<Record<string, string>>(loadCustomLinks)

  // Keep the URL hash in sync so a crash can be shared/bookmarked.
  useEffect(() => {
    const target = selectedId ? `#${selectedId}` : ' '
    if (location.hash !== target) history.replaceState(null, '', selectedId ? target : location.pathname)
  }, [selectedId])
  useEffect(() => {
    const onHash = () => setSelectedId(location.hash.slice(1) || null)
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = CRASHES.filter((c) => {
      const y = +c.date.slice(0, 4)
      if (y < fromYear || y > toYear) return false
      if (!causes.has(c.cause) || !categories.has(c.category)) return false
      if (c.fatalities < minDeaths) return false
      if (!q) return true
      return [c.name, c.location, c.operator, c.aircraft, c.flight ?? '', c.date].some((s) => s.toLowerCase().includes(q))
    })
    list.sort((a, b) =>
      sort === 'deadliest' ? b.fatalities - a.fatalities : sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
    )
    return list
  }, [query, causes, categories, fromYear, toYear, minDeaths, sort])

  const selected = CRASHES.find((c) => c.id === selectedId) ?? null
  const totalDeaths = filtered.reduce((n, c) => n + c.fatalities, 0)

  function toggle<T>(set: Set<T>, v: T, update: (s: Set<T>) => void) {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    update(next)
  }

  function select(c: Crash | null) {
    setSelectedId(c?.id ?? null)
    if (c) setMobileView('map')
  }

  function setCustomLink(id: string, url: string | null) {
    const next = { ...customLinks }
    if (url) next[id] = url
    else delete next[id]
    setCustomLinks(next)
    saveCustomLinks(next)
  }

  function reset() {
    setQuery('')
    setCauses(new Set(ALL_CAUSES))
    setCategories(new Set(ALL_CATEGORIES))
    setFromYear(MIN_YEAR)
    setToYear(MAX_YEAR)
    setMinDeaths(0)
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">✈️</span>
          <div>
            <div className="font-semibold leading-tight">Black Box Atlas</div>
            <div className="hidden text-[11px] text-slate-500 sm:block">A map of notable aviation accidents</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => select(filtered[Math.floor(Math.random() * filtered.length)] ?? null)}
            disabled={!filtered.length}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            🎲 Random
          </button>
          <button
            onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 md:hidden"
          >
            {mobileView === 'map' ? '☰ List' : '🗺 Map'}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar: filters + list */}
        <aside
          className={`${mobileView === 'list' ? 'flex' : 'hidden'} absolute inset-0 z-[1100] w-full flex-col border-r border-slate-800 bg-slate-950 md:static md:flex md:w-96 md:shrink-0`}
        >
          <div className="space-y-3 border-b border-slate-800 p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flight, airline, aircraft, place…"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />

            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Years</span>
                <span className="tabular-nums">{fromYear} – {toYear}</span>
              </div>
              <div className="flex gap-2">
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={fromYear} aria-label="From year"
                  onChange={(e) => setFromYear(Math.min(+e.target.value, toYear))} className="w-full accent-sky-500" />
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={toYear} aria-label="To year"
                  onChange={(e) => setToYear(Math.max(+e.target.value, fromYear))} className="w-full accent-sky-500" />
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-400">Cause</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CAUSES.map((c) => (
                  <Chip key={c} on={causes.has(c)} color={CAUSE_COLORS[c]} onClick={() => toggle(causes, c, setCauses)}>{c}</Chip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-400">Type</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => (
                  <Chip key={c} on={categories.has(c)} onClick={() => toggle(categories, c, setCategories)}>{c}</Chip>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <label className="flex items-center gap-1.5">
                Min. deaths
                <select value={minDeaths} onChange={(e) => setMinDeaths(+e.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200">
                  {[0, 1, 50, 100, 200, 300].map((n) => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="deadliest">Deadliest</option>
                </select>
              </label>
              <button onClick={reset} className="ml-auto text-sky-400 hover:underline">Reset</button>
            </div>
          </div>

          <div className="flex justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
            <span><b className="text-slate-200">{filtered.length}</b> of {CRASHES.length} accidents</span>
            <span><b className="text-slate-200">{totalDeaths.toLocaleString()}</b> fatalities</span>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => select(c)}
                  className={`flex w-full gap-3 border-b border-slate-900 px-4 py-2.5 text-left hover:bg-slate-900 ${
                    c.id === selectedId ? 'bg-slate-900' : ''
                  }`}
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-slate-500">{formatDate(c.date)} · {c.location}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-slate-400">
                    {c.fatalities}
                    <span className="block text-[10px] text-slate-600">deaths</span>
                  </span>
                </button>
              </li>
            ))}
            {!filtered.length && <li className="p-6 text-center text-sm text-slate-500">No accidents match these filters.</li>}
          </ul>
          <p className="border-t border-slate-800 px-4 py-2 text-[10px] leading-snug text-slate-600">
            {CRASHES.length} hand-picked, well-documented accidents. Map positions are approximate.
          </p>
        </aside>

        {/* Map */}
        <main className="relative min-w-0 flex-1">
          <CrashMap crashes={filtered} selected={selected} onSelect={select} />
          {selected && (
            <CrashDetail
              crash={selected}
              customLink={customLinks[selected.id]}
              onCustomLink={(url) => setCustomLink(selected.id, url)}
              onClose={() => select(null)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
