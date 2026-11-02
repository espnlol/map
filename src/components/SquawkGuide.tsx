import { SQUAWKS, type SquawkLevel } from '../lib/squawks'

const LEVEL_STYLE: Record<SquawkLevel, string> = {
  emergency: 'bg-red-500 text-white',
  special: 'bg-amber-400 text-slate-950',
  normal: 'bg-slate-700 text-slate-100',
}

export default function SquawkGuide({ onClose, current }: { onClose: () => void; current: Set<string> }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Squawk codes"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 className="text-lg font-bold">Squawk codes</h2>
            <p className="text-sm text-slate-400">
              A squawk is the 4-digit code a plane's transponder sends to radar. Most are random numbers that air traffic
              control assigns one flight at a time. These are the ones that mean something.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="divide-y divide-slate-800 overflow-y-auto">
          {SQUAWKS.map((s) => (
            <li key={s.code} className="flex gap-3 px-4 py-3">
              <span className={`h-fit rounded px-2 py-0.5 font-mono text-sm font-bold ${LEVEL_STYLE[s.level]}`}>{s.code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-xs text-slate-500">{s.where}</span>
                  {current.has(s.code) && (
                    <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-semibold uppercase text-sky-300">On the map now</span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{s.meaning}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-3 px-4 py-3">
            <span className={`h-fit rounded px-2 py-0.5 font-mono text-sm font-bold ${LEVEL_STYLE.normal}`}>other</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Assigned by ATC</div>
              <p className="text-sm text-slate-400">
                Any other code is a one-off number given to that flight. It has no special meaning by itself.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}
