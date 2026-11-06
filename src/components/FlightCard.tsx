import { useEffect, useState } from 'react'
import type { Aircraft, Airport, TimeValue } from '../types'
import { distanceNm } from '../lib/geo'
import { fmtOffset, fmtTemp, placeInfo, weatherLabel, type PlaceInfo } from '../lib/weather'
import { settings } from '../lib/settings'
import { fmtClock } from '../lib/format'
import { fmtDist } from '../lib/format'

function usePlace(ap?: Airport) {
  const [p, setP] = useState<PlaceInfo | null>(null)
  useEffect(() => {
    setP(null)
    if (ap?.lat == null || ap.lon == null) return
    let stop = false
    placeInfo(ap.lat, ap.lon).then((x) => !stop && setP(x))
    return () => {
      stop = true
    }
  }, [ap?.lat, ap?.lon])
  return p
}

/** Time in the airport's own time zone, like airline boards show it. */
function localTime(ms: number, tz?: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: !settings.get().clock24 }
  try {
    const parts = new Intl.DateTimeFormat([], { ...opts, timeZone: tz }).formatToParts(new Date(ms))
    const time = parts.filter((x) => x.type !== 'dayPeriod' && x.type !== 'literal' || x.value === ':').map((x) => x.value).join('').trim()
    const period = parts.find((x) => x.type === 'dayPeriod')?.value ?? ''
    return { time, period }
  } catch {
    return { time: fmtClock(ms), period: '' }
  }
}

function End({ ap, place, align }: { ap?: Airport; place: PlaceInfo | null; align: 'left' | 'right' }) {
  const w = weatherLabel(place?.code ?? null)
  const city = (ap?.location || ap?.name || '').split(',')[0]
  return (
    <div className={`min-w-0 flex-1 ${align === 'right' ? 'text-right' : ''}`}>
      <div className="font-sans text-4xl font-bold tracking-tight text-slate-100">{ap?.iata || ap?.icao || '???'}</div>
      <div className="truncate text-xs font-bold uppercase tracking-wide text-slate-300">{city}</div>
      <div className="text-[11px] text-slate-500">{place ? fmtOffset(place.offsetSec) : ' '}</div>
      {place && w.icon && (
        <div className="text-[11px] text-slate-400">
          {w.icon} {fmtTemp(place.tempC)} {w.text}
        </div>
      )}
    </div>
  )
}

function Row({ label, t, tz, dot, extra }: { label: string; t: TimeValue | null; tz?: string; dot?: boolean; extra?: string }) {
  if (!t)
    return (
      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs text-slate-500">{extra ?? '—'}</span>
      </div>
    )
  const { time, period } = localTime(t.at, tz)
  const yours = tz && Intl.DateTimeFormat().resolvedOptions().timeZone !== tz ? fmtClock(t.at) : null
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="flex items-baseline gap-1 text-slate-100">
          {dot && <span className="mb-0.5 h-2 w-2 self-center rounded-full bg-red-500" />}
          <span className="text-2xl font-semibold tabular-nums">{time}</span>
          <span className="text-[11px] font-semibold">{period}</span>
        </span>
      </div>
      {yours && <div className="text-right text-[10px] text-slate-500">{yours} your time</div>}
    </div>
  )
}

export default function FlightCard({ a }: { a: Aircraft }) {
  const r = a.route!
  const o = r.origin
  const d = r.destination
  const op = usePlace(o)
  const dp = usePlace(d)
  const total = o?.lat != null && d?.lat != null ? distanceNm(o.lat, o.lon!, d.lat, d.lon!) : null
  const left = d?.lat != null ? distanceNm(a.lat, a.lon, d.lat, d.lon!) : null
  const progress = total && left != null ? Math.max(0, Math.min(1, 1 - left / total)) : null
  const airline = /^[A-Z]{3}\d/.test(a.callsign)
  // a late landing compared with our earlier estimate gets the red dot
  const depLabel = a.takeoff?.kind === 'observed' ? 'Took off' : a.onGround && !a.takeoff ? 'Departs' : 'Departed (est.)'
  const arrLabel = a.touchdown?.kind === 'observed' ? 'Landed' : 'Estimated'

  return (
    <div className="overflow-hidden rounded-lg bg-slate-800/60">
      <div className="flex items-center gap-2 p-3">
        <End ap={o} place={op} align="left" />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl text-amber-300">✈</div>
        <End ap={d} place={dp} align="right" />
      </div>
      {progress != null && (
        <div className="px-3 pb-2">
          <div className="h-1 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-amber-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>{fmtDist(total! - left!)} flown</span>
            <span>{fmtDist(left!)} to go</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-slate-700/70 border-t border-slate-700/70">
        <div className="divide-y divide-slate-700/70">
          <Row label="Scheduled" t={null} extra={airline ? 'see below' : 'n/a'} />
          <Row label={depLabel} t={a.takeoff} tz={op?.timezone} extra={a.onGround ? 'not yet' : 'unknown'} />
        </div>
        <div className="divide-y divide-slate-700/70">
          <Row label="Scheduled" t={null} extra={airline ? 'see below' : 'n/a'} />
          <Row label={arrLabel} t={a.touchdown} tz={dp?.timezone} dot={!!a.emergency} extra="unknown" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/70 px-3 py-1.5 text-[10px] text-slate-500">
        <span>
          Times in each airport's local time.{' '}
          <span className={a.takeoff?.kind === 'observed' ? 'text-emerald-400' : 'text-amber-300'}>{a.takeoff?.kind === 'observed' ? 'Takeoff seen live.' : 'Estimated from position and speed.'}</span>
        </span>
        {airline && (
          <a href={`https://www.flightaware.com/live/flight/${a.callsign}`} target="_blank" rel="noreferrer" className="text-sky-400">
            Scheduled times on FlightAware ↗
          </a>
        )}
      </div>
      {!r.plausible && <div className="px-3 pb-2 text-[11px] text-amber-300">Route match looks unreliable for this callsign.</div>}
    </div>
  )
}
