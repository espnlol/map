import type { Aircraft, TimeValue } from '../types'
import { categoryInfo } from '../lib/categories'
import { SPECIAL_GROUPS } from '../lib/special'
import { squawkInfo } from '../lib/squawks'
import { fetchPhoto, lookupLinks, type FlightPath, type PlanePhoto } from '../lib/history'
import { useEffect, useState } from 'react'
import { PHASE_LABEL, airportCode, airportName, fmtAltFull, fmtMph, fmtSpeed, fmtTime, fmtVr } from '../lib/format'
import { distanceNm } from '../lib/geo'

interface Props {
  aircraft: Aircraft
  onClose: () => void
  path: FlightPath | null
  pathLoading: boolean
  demo: boolean
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

export default function DetailPanel({ aircraft: a, onClose, path, pathLoading, demo }: Props) {
  const info = categoryInfo(a.category)
  const r = a.route
  const o = r?.origin
  const d = r?.destination
  const total = o?.lat != null && d?.lat != null ? distanceNm(o.lat, o.lon!, d.lat, d.lon!) : null
  const left = d?.lat != null ? distanceNm(a.lat, a.lon, d.lat, d.lon!) : null
  const progress = total && left != null ? Math.max(0, Math.min(1, 1 - left / total)) : null

  return (
    <div className="flex flex-col gap-3 p-4">
      <Photo hex={a.hex} registration={a.registration} demo={demo} model={a.model} />
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

      <div className="grid grid-cols-2 gap-2 [&>*:last-child]:col-span-2">
        <Stat label="Altitude" value={fmtAltFull(a.altitude, a.onGround)} sub={a.altitude != null ? `${Math.round(a.altitude * 0.3048).toLocaleString()} m` : undefined} />
        <Stat label="Ground speed" value={fmtSpeed(a.groundSpeed)} sub={fmtMph(a.groundSpeed)} />
        <Stat label="Vertical rate" value={fmtVr(a.verticalRate)} />
        <Stat label="Heading" value={a.track != null ? `${Math.round(a.track)}°` : '—'} />
        <Stat label="Type code" value={a.typeCode ?? '—'} sub={a.hex.startsWith("~") ? `Non-ICAO ${a.hex.slice(1).toUpperCase()}` : `ICAO ${a.hex.toUpperCase()}`} />
      </div>

      <SquawkBox code={a.squawk} />

      <PathInfo path={path} loading={pathLoading} demo={demo} trailPoints={a.trail.length} />

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Find this plane</div>
        <div className="grid grid-cols-2 gap-1.5">
          {lookupLinks(a).map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              title={l.hint}
              className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-sky-300 ring-1 ring-slate-700 hover:bg-slate-800 hover:text-sky-200"
            >
              {l.label} ↗<div className="truncate text-[10px] text-slate-500">{l.hint}</div>
            </a>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        <span className="text-emerald-400">Observed</span> times were seen live by this app (ground → air or air → ground).{' '}
        <span className="text-amber-300">Estimated</span> times come from distance to/from the airports at current speed — not
        airline schedules.
      </p>
    </div>
  )
}

function SquawkBox({ code }: { code?: string }) {
  const info = squawkInfo(code)
  const tone =
    info?.level === 'emergency'
      ? 'bg-red-500/15 ring-red-500/60'
      : info?.level === 'special'
        ? 'bg-amber-400/10 ring-amber-400/50'
        : 'bg-slate-800/60 ring-transparent'
  return (
    <div className={`flex gap-3 rounded-lg px-3 py-2 ring-1 ${tone}`}>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Squawk</div>
        <div className="font-mono text-lg text-slate-100">{code ?? '—'}</div>
      </div>
      <div className="min-w-0 flex-1 border-l border-slate-700 pl-3">
        {info ? (
          <>
            <div className="text-sm font-semibold text-slate-100">
              {info.title}
              {info.where && <span className="ml-1.5 text-xs font-normal text-slate-500">{info.where}</span>}
            </div>
            <div className="text-xs text-slate-400">{info.meaning}</div>
          </>
        ) : (
          <div className="text-xs text-slate-400">This aircraft isn't sending a squawk code.</div>
        )}
      </div>
    </div>
  )
}

function Photo({ hex, registration, demo, model }: { hex: string; registration?: string; demo: boolean; model?: string }) {
  const [photo, setPhoto] = useState<PlanePhoto | null | undefined>(undefined)
  useEffect(() => {
    if (demo) return setPhoto(null)
    let stop = false
    setPhoto(undefined)
    fetchPhoto(hex, registration).then((p) => !stop && setPhoto(p))
    return () => {
      stop = true
    }
  }, [hex, registration, demo])

  if (photo === undefined)
    return <div className="aspect-[16/9] w-full animate-pulse rounded-lg bg-slate-800" aria-label="Loading photo" />
  if (photo === null)
    return (
      <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 rounded-lg bg-slate-800/60 text-center text-xs text-slate-500">
        <span className="text-3xl opacity-40">✈</span>
        {demo ? 'Photos appear for real aircraft in LIVE mode' : `No photo of this exact aircraft yet${model ? ` (${model})` : ''}`}
      </div>
    )
  return (
    <figure className="overflow-hidden rounded-lg bg-slate-800">
      <a href={photo.link} target="_blank" rel="noreferrer">
        <img src={photo.large} alt={`Photo of ${registration ?? hex}`} className="aspect-[16/9] w-full object-cover" />
      </a>
      <figcaption className="px-2 py-1 text-[10px] text-slate-400">
        Photo © {photo.photographer} ·{' '}
        <a href={photo.link} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
          Planespotters.net
        </a>
      </figcaption>
    </figure>
  )
}

function PathInfo({ path, loading, demo, trailPoints }: { path: FlightPath | null; loading: boolean; demo: boolean; trailPoints: number }) {
  let text: string
  if (path && path.points.length > 1) {
    const mins = Math.round((Date.now() - path.points[0][3]) / 60000)
    const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    text = `${path.fromTakeoff ? 'Full path since takeoff' : 'Path for the last'} ${path.fromTakeoff ? `(${dur} ago)` : dur}, from ${path.source} history.`
  } else if (loading) text = 'Loading where this plane has been…'
  else if (demo) text = 'Demo mode shows the path since SkyWatch opened.'
  else text = trailPoints > 1 ? 'No history found, so the path shows only what SkyWatch has seen since it opened.' : 'No path history found for this aircraft yet.'
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
      <span className="h-0.5 w-6 shrink-0 rounded-full" style={{ background: 'linear-gradient(90deg,#fb923c,#facc15,#4ade80,#38bdf8,#a78bfa)' }} />
      {text}
    </div>
  )
}
