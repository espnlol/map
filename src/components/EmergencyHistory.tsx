import { emergencyLog, type EmergencyRecord } from '../lib/emergencyLog'
import { fmtClock } from '../lib/format'

const OUTCOME_STYLE: Record<EmergencyRecord['outcome'], string> = {
  ongoing: 'bg-red-500 text-white animate-pulse',
  landed: 'bg-emerald-500 text-slate-950',
  cleared: 'bg-sky-400 text-slate-950',
  'out of range': 'bg-slate-600 text-slate-100',
}

function duration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}

function day(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  const yest = new Date(Date.now() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

interface Props {
  liveHexes: Set<string>
  onOpen: (r: EmergencyRecord) => void
  demo: boolean
}

export default function EmergencyHistory({ liveHexes, onOpen, demo }: Props) {
  const records = emergencyLog.use()
  if (records.length === 0)
    return (
      <div className="space-y-2 px-4 py-8 text-center text-sm text-slate-500">
        <p>No emergencies recorded yet.</p>
        <p>
          Every real emergency SkyWatch sees (squawk 7500, 7600, 7700, or an ADS-B emergency status) is saved here with its
          path and how it ended, even after it clears.
        </p>
        {demo && <p className="text-amber-300">Demo emergencies aren't saved. Switch to LIVE.</p>}
      </div>
    )

  let lastDay = ''
  return (
    <div>
      <ul className="divide-y divide-slate-800">
        {records.map((r) => {
          const d = day(r.startedAt)
          const header = d !== lastDay ? d : null
          lastDay = d
          const end = r.endedAt ?? r.lastSeenAt
          return (
            <li key={r.id}>
              {header && <div className="bg-slate-900/80 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{header}</div>}
              <button onClick={() => onOpen(r)} className="flex w-full flex-col gap-1 px-4 py-2.5 text-left hover:bg-slate-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{r.callsign}</span>
                  <span className={`rounded px-1.5 text-[10px] font-bold uppercase ${OUTCOME_STYLE[r.outcome]}`}>{r.outcome}</span>
                  {liveHexes.has(r.hex) && <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-semibold uppercase text-sky-300">on map</span>}
                  <span className="ml-auto font-mono text-xs text-slate-500">{fmtClock(r.startedAt)}</span>
                </div>
                <div className="text-xs text-red-300">{r.codes.map((c) => `${c.label} (${c.code})`).join(' → ')}</div>
                <div className="text-xs text-slate-400">
                  {r.model ?? 'Unknown type'}
                  {r.registration ? ` · ${r.registration}` : ''}
                  {r.origin || r.destination ? ` · ${r.origin ?? '?'} → ${r.destination ?? '?'}` : ''}
                </div>
                <div className="text-[11px] text-slate-500">
                  {r.outcome === 'ongoing' ? `Going on for ${duration(Date.now() - r.startedAt)}` : `Lasted ${duration(end - r.startedAt)}`}
                  {r.outcome === 'landed' && ` · landed ${fmtClock(end)}${r.destination ? ` (heading for ${r.destination})` : ''}`}
                  {r.outcome !== 'landed' && r.lastAltitude != null && ` · last at ${r.lastAltitude.toLocaleString()} ft`}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="p-4 text-center">
        <button
          onClick={() => emergencyLog.set([])}
          className="rounded-md px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-700 hover:text-slate-300"
        >
          Clear emergency history
        </button>
      </div>
    </div>
  )
}
