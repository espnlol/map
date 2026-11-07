import { useEffect, useState } from 'react'
import { fetchOwner, registrationCountry, type OwnerRecord } from '../lib/owner'
import { logbook, planeKey } from '../lib/logbook'
import { sightings, findSightings } from '../lib/sightings'
import { opens } from '../lib/records'
import { emergencyLog } from '../lib/emergencyLog'
import { milArrivals } from '../lib/milwatch'
import { fetchTodaysLegs, type Leg } from '../lib/history'
import { fmtClock, fmtRelative } from '../lib/format'

export interface ProfileTarget {
  hex: string
  registration?: string
  callsign?: string
  model?: string
  typeCode?: string
}

const day = (ms: number) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-slate-800/60 p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      {children}
    </section>
  )
}

/** Everything SkyWatch knows about one airframe: who has it, when you've seen it, and what it's been up to. */
export default function PlaneProfile({ plane: p, demo = false }: { plane: ProfileTarget; demo?: boolean }) {
  const hex = p.hex.replace(/^~/, '').toLowerCase()
  const [owner, setOwner] = useState<OwnerRecord | null | undefined>(undefined)
  const [legs, setLegs] = useState<Leg[] | null | undefined>(undefined)
  useEffect(() => {
    if (demo) return setOwner(null), setLegs(null)
    let stop = false
    setOwner(undefined)
    setLegs(undefined)
    fetchOwner(hex).then((o) => !stop && setOwner(o))
    fetchTodaysLegs(p.hex).then((l) => !stop && setLegs(l))
    return () => {
      stop = true
    }
  }, [hex, p.hex, demo])

  const registration = p.registration ?? owner?.registration
  const logged = logbook.use().find((e) => planeKey(e) === planeKey({ hex, registration }) || e.hex.toLowerCase() === hex)
  const rec = findSightings(sightings.use(), { hex, registration })
  const opened = opens.use()[registration || p.hex] ?? opens.get()[p.hex]
  const emergencies = emergencyLog.use().filter((e) => e.hex.toLowerCase() === hex)
  const arrivals = milArrivals.use().filter((m) => m.hex.toLowerCase() === hex)

  const callsigns = Object.entries(rec?.callsigns ?? {}).sort((a, b) => b[1] - a[1])
  const routes = new Map<string, number>()
  for (const s of rec?.recent ?? []) if (s.from || s.to) routes.set(`${s.from ?? '?'} → ${s.to ?? '?'}`, (routes.get(`${s.from ?? '?'} → ${s.to ?? '?'}`) ?? 0) + 1)
  const model = p.model ?? rec?.model ?? owner?.type
  const reg = registration?.toUpperCase()

  const links = [
    reg && { label: 'FlightAware history', href: `https://www.flightaware.com/resources/registration/${encodeURIComponent(reg)}` },
    { label: 'Planespotters', href: `https://www.planespotters.net/hex/${hex.toUpperCase()}` },
    reg && { label: 'JetPhotos', href: `https://www.jetphotos.com/registration/${encodeURIComponent(reg)}` },
    { label: 'Replay on adsb.lol', href: `https://globe.adsb.lol/?icao=${hex}` },
  ].filter(Boolean) as { label: string; href: string }[]

  const firstAt = Math.min(rec?.firstAt ?? Infinity, logged?.at ?? Infinity)

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-lg bg-slate-800/60 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-mono text-xl font-bold">{reg ?? hex.toUpperCase()}</div>
          {logged && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">in logbook</span>}
        </div>
        <div className="text-sm text-slate-300">{model ?? 'Unknown type'}</div>
        <div className="mt-1 text-xs text-slate-400">
          {owner === undefined ? 'Looking up the owner…' : owner?.owner ? `Registered to ${owner.owner}` : 'Owner not in the public database'}
          {registrationCountry(reg) && ` · ${registrationCountry(reg)}`}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat value={rec?.count ?? (logged ? 1 : 0)} label={rec?.count === 1 ? 'sighting' : 'sightings'} />
          <Stat value={opened?.count ?? 0} label="times opened" />
          <Stat value={Number.isFinite(firstAt) ? day(firstAt) : '—'} label="first seen" />
        </div>
      </section>

      {logged?.note && (
        <Section title="Your note">
          <p className="text-sm text-slate-200">{logged.note}</p>
        </Section>
      )}

      {(callsigns.length > 0 || routes.size > 0) && (
        <Section title="Flies as">
          <div className="flex flex-wrap gap-1.5">
            {callsigns.map(([c, n]) => (
              <span key={c} className="rounded bg-slate-900/70 px-2 py-0.5 font-mono text-xs text-slate-200">
                {c}
                {n > 1 && <span className="text-slate-500"> ×{n}</span>}
              </span>
            ))}
          </div>
          {routes.size > 0 && (
            <div className="mt-2 text-xs text-slate-400">
              Routes you've seen: {[...routes.entries()].map(([r, n]) => (n > 1 ? `${r} (×${n})` : r)).join(', ')}
            </div>
          )}
        </Section>
      )}

      <Section title="Your sightings">
        {!rec || rec.recent.length === 0 ? (
          <p className="text-xs text-slate-500">{logged ? `Logged ${day(logged.at)} at ${fmtClock(logged.at)}.` : 'Open this plane on the map and it shows up here.'}</p>
        ) : (
          <ol className="space-y-1">
            {rec.recent.map((s) => (
              <li key={s.at} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                <span className="w-16 shrink-0 text-slate-400">{day(s.at)}</span>
                <span className="font-mono text-slate-300">{fmtClock(s.at)}</span>
                <span className="font-mono text-slate-100">{s.callsign}</span>
                {(s.from || s.to) && <span className="text-slate-400">{`${s.from ?? '?'} → ${s.to ?? '?'}`}</span>}
                {s.altitude === 0 && <span className="text-slate-500">on the ground</span>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Today">
        {legs === undefined ? (
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-700" />
        ) : !legs || legs.length === 0 ? (
          <p className="text-xs text-slate-500">No flights recorded today.</p>
        ) : (
          <p className="text-xs text-slate-300">
            {legs.length === 1 ? '1 flight' : `${legs.length} flights`} today, first at {fmtClock(legs[0].departedAt)}
            {legs[legs.length - 1].ongoing ? ', in the air now.' : `, last seen ${fmtRelative(legs[legs.length - 1].arrivedAt)}.`}{' '}
            <span className="text-slate-500">Details in the Owner tab.</span>
          </p>
        )}
      </Section>

      {emergencies.length > 0 && (
        <Section title="Emergencies you caught">
          <ul className="space-y-1 text-xs">
            {emergencies.map((e) => (
              <li key={e.id} className="text-slate-300">
                <span className="text-slate-400">{day(e.startedAt)}</span> {e.callsign}: {e.codes.map((c) => c.label).join(', ')}{' '}
                <span className="text-slate-500">({e.outcome})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {arrivals.length > 0 && (
        <Section title="Military arrivals">
          <ul className="space-y-1 text-xs">
            {arrivals.map((m) => (
              <li key={m.id} className="text-slate-300">
                <span className="text-slate-400">{day(m.at)}</span> {m.status === 'landed' ? 'Landed at' : 'Arriving at'} {m.airport} as {m.callsign}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-sky-300 ring-1 ring-slate-700 hover:bg-slate-800">
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-md bg-slate-900/60 py-1.5">
      <div className="text-base font-bold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
