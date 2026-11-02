import type { Aircraft } from '../types'
import { categoryInfo } from '../lib/categories'
import { SPECIAL_GROUPS } from '../lib/special'
import { airportCode, fmtAlt, fmtSpeed } from '../lib/format'

interface Props {
  aircraft: Aircraft[]
  selected: string | null
  onSelect: (hex: string) => void
}

export default function FlightList({ aircraft, selected, onSelect }: Props) {
  if (aircraft.length === 0)
    return <p className="px-4 py-8 text-center text-sm text-slate-500">No aircraft match these filters.</p>
  return (
    <ul className="divide-y divide-slate-800">
      {aircraft.map((a) => {
        const info = categoryInfo(a.category)
        const isSel = a.hex === selected
        return (
          <li key={a.hex}>
            <button
              onClick={() => onSelect(a.hex)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                isSel ? 'bg-sky-500/15' : a.emergency ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-slate-800/60'
              }`}
            >
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: a.emergency ? '#ef4444' : info.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold tracking-wide">{a.callsign}</span>
                  {a.special.map((sp) => {
                    const g = SPECIAL_GROUPS.find((x) => x.tag === sp.tag)!
                    return (
                      <span key={sp.tag} className="rounded px-1.5 text-[10px] font-bold uppercase text-slate-950" style={{ background: g.color }}>
                        {g.label}
                      </span>
                    )
                  })}
                  {a.emergency && (
                    <span className="rounded bg-red-500 px-1.5 text-[10px] font-bold uppercase text-white">{a.emergency.label}</span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {a.model ?? 'Unknown type'}
                  {a.route ? ` · ${airportCode(a.route.origin)} → ${airportCode(a.route.destination)}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs text-slate-200">{fmtAlt(a.altitude, a.onGround)}</div>
                <div className="font-mono text-xs text-slate-500">{fmtSpeed(a.groundSpeed)}</div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
