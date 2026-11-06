import { logbook, logStats, removeLogEntry, type LogEntry } from '../lib/logbook'
import { categoryInfo } from '../lib/categories'
import { fmtClock } from '../lib/format'

interface Props {
  liveHexes: Set<string>
  onOpen: (e: LogEntry) => void
}

export default function Logbook({ liveHexes, onOpen }: Props) {
  const entries = logbook.use()
  const stats = logStats(entries)

  if (entries.length === 0)
    return (
      <div className="space-y-2 px-4 py-8 text-center text-sm text-slate-500">
        <p>Your logbook is empty.</p>
        <p>
          Open any plane and tap <b className="text-slate-300">📒 I saw this</b> to save it here with its photo, owner, route and
          the time you saw it. SkyWatch tells you when it's a type or airline you've never logged before.
        </p>
      </div>
    )

  // first sighting of each type, for the "first" badge
  const firstOfType = new Map<string, string>()
  for (const e of [...entries].reverse()) if (e.typeCode && !firstOfType.has(e.typeCode)) firstOfType.set(e.typeCode, e.id)

  return (
    <div>
      <div className="grid grid-cols-4 gap-1 border-b border-slate-800 p-3 text-center">
        {[
          ['Sightings', stats.sightings],
          ['Planes', stats.planes],
          ['Types', stats.types],
          ['Airlines', stats.airlines],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg bg-slate-800/60 py-2">
            <div className="font-mono text-lg font-semibold tabular-nums">{n}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-800">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => onOpen(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {e.photo ? (
                <img src={e.photo} alt="" className="h-12 w-16 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-slate-800 text-lg" style={{ color: categoryInfo(e.category).color }}>
                  ✈
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-semibold">{e.callsign}</span>
                  {firstOfType.get(e.typeCode ?? '') === e.id && (
                    <span className="rounded bg-amber-400 px-1.5 text-[10px] font-bold uppercase text-slate-950">first {e.typeCode}</span>
                  )}
                  {liveHexes.has(e.hex) && <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-semibold uppercase text-sky-300">on map</span>}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {e.model ?? e.typeCode ?? 'Unknown type'}
                  {e.airline ? ` · ${e.airline}` : e.owner ? ` · ${e.owner}` : ''}
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(e.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} {fmtClock(e.at)}
                  {e.from || e.to ? ` · ${e.from ?? '?'} → ${e.to ?? '?'}` : ''}
                  {e.registration ? ` · ${e.registration}` : ''}
                </div>
              </div>
            </button>
            <button onClick={() => removeLogEntry(e.id)} className="rounded p-1 text-slate-600 hover:text-red-400" aria-label={`Remove ${e.callsign}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
