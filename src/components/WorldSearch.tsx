import { useEffect, useState } from 'react'
import { searchPlans, searchWorld, type WorldResult } from '../lib/search'
import { fmtAlt } from '../lib/format'

interface Props {
  query: string
  from: { lat: number; lon: number }
  onOpen: (r: WorldResult) => void
}

/** "Search the whole world" under the local flight list. */
export default function WorldSearch({ query, from, onOpen }: Props) {
  const [results, setResults] = useState<WorldResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const plans = searchPlans(query)

  useEffect(() => {
    setResults(null)
    setSearched('')
  }, [query])

  if (plans.length === 0) return null
  const go = async () => {
    setLoading(true)
    setSearched(query)
    try {
      setResults(await searchWorld(query, from))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-slate-800 p-3">
      {results === null ? (
        <button onClick={go} disabled={loading} className="w-full rounded-lg bg-sky-500/15 py-2.5 text-sm font-semibold text-sky-300 ring-1 ring-sky-500/40 disabled:opacity-60">
          {loading ? 'Searching the world…' : `🌍 Search the whole world for “${query.trim().toUpperCase()}”`}
        </button>
      ) : results.length === 0 ? (
        <p className="text-center text-xs text-slate-500">
          Nothing in the air matching “{searched.toUpperCase()}” right now. It may be parked, or not broadcasting.
        </p>
      ) : (
        <>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Worldwide · {results.length} found</div>
          <ul className="divide-y divide-slate-800 rounded-lg bg-slate-800/40">
            {results.map((r) => (
              <li key={r.hex}>
                <button onClick={() => onOpen(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold">{r.callsign}</div>
                    <div className="truncate text-xs text-slate-400">
                      {r.model ?? 'Unknown type'}
                      {r.registration && r.registration !== r.callsign ? ` · ${r.registration}` : ''} · matched {r.matched}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs">
                    <div>{fmtAlt(r.altitude, r.altitude == null)}</div>
                    <div className="text-slate-500">{Math.round(r.distance).toLocaleString()} nm</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
