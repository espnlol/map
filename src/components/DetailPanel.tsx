import type { Aircraft, TimeValue } from '../types'
import { categoryInfo } from '../lib/categories'
import { SPECIAL_GROUPS } from '../lib/special'
import { PHASE_LABEL, airportCode, airportName, fmtAltFull, fmtMph, fmtSpeed, fmtTime, fmtVr } from '../lib/format'
import { distanceNm } from '../lib/geo'

interface Props {
  aircraft: Aircraft
  onClose: () => void
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="font-mono text-sm text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function TimeBlock({ label, t, fallback }: { label: string; t: TimeValue | null; fallback: string }) {
  const f = fmtTime(t)
  return (
    <div className="flex-1 rounded-lg bg-slate-800/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      {f ? (
        <>
          <div className="font-mono text-lg text-slate-100">{f.clock}</div>
          <div className="text-[11px] text-slate-400">
            {f.rel} ·{' '}
            <span className={f.kind === 'observed' ? 'text-emerald-400' : 'text-amber-300'}>
              {f.kind === 'observed' ? 'observed' : 'estimated'}
            </span>
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-500">{fallback}</div>
      )}
    </div>
  )
}

export default function DetailPanel({ aircraft: a, onClose }: Props) {
  const info = categoryInfo(a.category)
  const r = a.route
  const o = r?.origin
  const d = r?.destination
  const total = o?.lat != null && d?.lat != null ? distanceNm(o.lat, o.lon!, d.lat, d.lon!) : null
  const left = d?.lat != null ? distanceNm(a.lat, a.lon, d.lat, d.lon!) : null
  const progress = total && left != null ? Math.max(0, Math.min(1, 1 - left / total)) : null

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-2xl font-bold tracking-wide">{a.callsign}</div>
          <div className="text-sm text-slate-300">{a.model ?? 'Unknown aircraft type'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full" style={{ background: info.color }} />
              {info.label}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5">{PHASE_LABEL[a.phase]}</span>
            {a.registration && <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono">{a.registration}</span>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>

      {a.special.map((sp) => {
        const g = SPECIAL_GROUPS.find((x) => x.tag === sp.tag)!
        return (
          <div key={sp.tag} className="rounded-lg px-3 py-2 ring-1" style={{ background: `${g.color}1f`, borderColor: g.color, boxShadow: `inset 0 0 0 1px ${g.color}66` }}>
            <div className="text-sm font-bold" style={{ color: g.color }}>{g.label}</div>
            <div className="text-xs text-slate-300">{sp.reason}</div>
          </div>
        )
      })}

      {a.operator && <div className="text-xs text-slate-400">Operator: <span className="text-slate-200">{a.operator}</span></div>}

      {a.emergency ? (
        <div className="rounded-lg border border-red-500/60 bg-red-500/15 px-3 py-2">
          <div className="text-sm font-bold text-red-300">⚠ {a.emergency.label}</div>
          <div className="text-xs text-red-200/80">{a.emergency.detail}</div>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">No emergency declared</div>
      )}

      <div className="rounded-lg bg-slate-800/60 p-3">
        {r ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">From</div>
                <div className="font-mono text-xl font-semibold">{airportCode(o)}</div>
                <div className="truncate text-[11px] text-slate-400">{airportName(o)}</div>
              </div>
              <div className="text-slate-500">✈</div>
              <div className="min-w-0 text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">To</div>
                <div className="font-mono text-xl font-semibold">{airportCode(d)}</div>
                <div className="truncate text-[11px] text-slate-400">{airportName(d)}</div>
              </div>
            </div>
            {progress != null && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full bg-sky-400" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>{Math.round(total! - left!)} nm flown</span>
                  <span>{Math.round(left!)} nm to go</span>
                </div>
              </div>
            )}
            {!r.plausible && <div className="mt-2 text-[11px] text-amber-300">Route match looks unreliable for this callsign.</div>}
          </>
        ) : (
          <div className="text-xs text-slate-400">Origin and destination aren't known for this callsign (common for private, military and some cargo flights).</div>
        )}
      </div>

      <div className="flex gap-2">
        <TimeBlock label="Takeoff" t={a.takeoff} fallback={a.onGround ? 'Not departed yet' : 'Unknown'} />
        <TimeBlock label="Touchdown" t={a.touchdown} fallback={a.onGround ? 'On the ground' : 'Unknown'} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Altitude" value={fmtAltFull(a.altitude, a.onGround)} sub={a.altitude != null ? `${Math.round(a.altitude * 0.3048).toLocaleString()} m` : undefined} />
        <Stat label="Ground speed" value={fmtSpeed(a.groundSpeed)} sub={fmtMph(a.groundSpeed)} />
        <Stat label="Vertical rate" value={fmtVr(a.verticalRate)} />
        <Stat label="Heading" value={a.track != null ? `${Math.round(a.track)}°` : '—'} />
        <Stat label="Squawk" value={a.squawk ?? '—'} />
        <Stat label="Type code" value={a.typeCode ?? '—'} sub={a.hex.startsWith("~") ? `Non-ICAO ${a.hex.slice(1).toUpperCase()}` : `ICAO ${a.hex.toUpperCase()}`} />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        <span className="text-emerald-400">Observed</span> times were seen live by this app (ground → air or air → ground).{' '}
        <span className="text-amber-300">Estimated</span> times come from distance to/from the airports at current speed — not
        airline schedules.
      </p>
    </div>
  )
}
