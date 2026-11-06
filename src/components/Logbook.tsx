import { useState } from 'react'
import { logbook, logStats, removeLogEntry, type LogEntry } from '../lib/logbook'
import { CATEGORIES, categoryInfo } from '../lib/categories'
import { fmtClock } from '../lib/format'

interface Props {
  liveHexes: Set<string>
  onOpen: (e: LogEntry) => void
}

type GroupBy = 'date' | 'type' | 'airline' | 'size' | 'who'

const GROUPS: [GroupBy, string][] = [
  ['date', 'Date'],
  ['type', 'Type'],
  ['airline', 'Airline'],
  ['size', 'Size'],
  ['who', "Who's flying"],
]

const MIL = /\b(AIR FORCE|NAVY|ARMY|MARINE|COAST GUARD|NATIONAL GUARD|MILITARY|POLICE|SHERIFF|GOVERNMENT|DEPARTMENT|UNITED STATES)\b/i

function dayLabel(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function whoLabel(e: LogEntry): string {
  if (e.category === 'A6') return 'Military & government'
  if (MIL.test(e.owner ?? '') || /^(RCH|SAM|SPAR|CNV|PAT|EVAC|NAVY|ARMY|COAST)/.test(e.callsign) || /^(ae|af)/i.test(e.hex)) return 'Military & government'
  if (/^(GXA|SWQ)/.test(e.callsign)) return 'Sports & team charters'
  if (/^(FDX|UPS|GTI|ABX|ATN|CKS|PAC|AJT|SOO|CLX|GEC|BOX|CAO|MTN|AMF|WGN|CJT)/.test(e.callsign)) return 'Cargo'
  if (/^(EJA|LXJ|XOJ|JTL|TWY|VJT|WUP|EJM)/.test(e.callsign)) return 'Private jets & charters'
  if (e.airline) return 'Airlines'
  if (e.category === 'A7') return 'Helicopters'
  return 'Private & general aviation'
}

function groupKey(e: LogEntry, by: GroupBy): string {
  switch (by) {
    case 'date':
      return dayLabel(e.at)
    case 'type':
      return e.model ?? e.typeCode ?? 'Unknown type'
    case 'airline':
      return e.airline ?? 'No airline (private / other)'
    case 'size':
      return categoryInfo(e.category).label
    case 'who':
      return whoLabel(e)
  }
}

function load(): GroupBy {
  try {
    return (localStorage.getItem('skywatch.logbookGroup') as GroupBy) || 'date'
  } catch {
    return 'date'
  }
}

export default function Logbook({ liveHexes, onOpen }: Props) {
  const entries = logbook.use()
  const stats = logStats(entries)
  const [by, setBy] = useState<GroupBy>(load)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const choose = (g: GroupBy) => {
    setBy(g)
    setClosed(new Set())
    try {
      localStorage.setItem('skywatch.logbookGroup', g)
    } catch {
      /* ignore */
    }
  }

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

  // build groups: date keeps newest-first; others sort biggest group first, then by name
  const groups = new Map<string, LogEntry[]>()
  for (const e of entries) {
    const k = groupKey(e, by)
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  let ordered = [...groups.entries()]
  if (by === 'size') {
    const order = CATEGORIES.map((c) => c.label)
    ordered.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  } else if (by !== 'date') ordered.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  const toggle = (k: string) =>
    setClosed((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

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

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 px-3 py-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Group by</span>
        {GROUPS.map(([g, label]) => (
          <button
            key={g}
            onClick={() => choose(g)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${by === g ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {ordered.map(([k, list]) => {
        const open = !closed.has(k)
        const color = by === 'size' ? CATEGORIES.find((c) => c.label === k)?.color : undefined
        return (
          <section key={k}>
            <button
              onClick={() => toggle(k)}
              className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-2 text-left backdrop-blur"
              aria-expanded={open}
            >
              <span className={`text-xs text-slate-500 transition ${open ? 'rotate-90' : ''}`}>▶</span>
              {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{k}</span>
              <span className="rounded-full bg-slate-800 px-2 text-xs tabular-nums text-slate-300">{list.length}</span>
              {!open && (
                <span className="flex -space-x-2">
                  {list.slice(0, 3).map((e) =>
                    e.photo ? (
                      <img key={e.id} src={e.photo} alt="" className="h-6 w-6 rounded-full object-cover ring-2 ring-slate-900" />
                    ) : (
                      <span key={e.id} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] ring-2 ring-slate-900">
                        ✈
                      </span>
                    ),
                  )}
                </span>
              )}
            </button>
            {open && (
              <ul className="divide-y divide-slate-800">
                {list.map((e) => (
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
                          {firstOfType.get(e.typeCode ?? '') === e.id && by !== 'type' && (
                            <span className="rounded bg-amber-400 px-1.5 text-[10px] font-bold uppercase text-slate-950">first {e.typeCode}</span>
                          )}
                          {liveHexes.has(e.hex) && <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-semibold uppercase text-sky-300">on map</span>}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {by !== 'type' && (e.model ?? e.typeCode ?? 'Unknown type')}
                          {by !== 'airline' && (e.airline ? `${by !== 'type' ? ' · ' : ''}${e.airline}` : e.owner ? `${by !== 'type' ? ' · ' : ''}${e.owner}` : '')}
                          {by === 'airline' && (e.owner && !e.airline ? ` · ${e.owner}` : '')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {by !== 'date' && `${new Date(e.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} `}
                          {fmtClock(e.at)}
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
            )}
          </section>
        )
      })}
    </div>
  )
}
