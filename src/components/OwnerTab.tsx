import { useEffect, useState } from 'react'
import type { Aircraft } from '../types'
import { fetchOwner, registrationCountry, registryLinks, type OwnerRecord } from '../lib/owner'
import { classifyOwner, guessOperator, typeHint } from '../lib/operator'
import { fetchTodaysLegs, type Leg } from '../lib/history'
import { loadAirports, type AirportInfo } from '../lib/airports'
import { distanceNm } from '../lib/geo'
import { fmtClock } from '../lib/format'
import { fmtDist } from '../lib/format'
import { myLabels, myLabelFrom, setMyLabel, clearMyLabel } from '../lib/myLabels'
import { SPECIAL_GROUPS, type SpecialTag } from '../lib/special'
import { CATEGORIES, categoryInfo } from '../lib/categories'
import { searchTypes } from '../lib/aircraftTypes'

const BASIS_LABEL = {
  callsign: 'From the callsign',
  owner: 'From the registered owner',
  type: 'Best guess from the aircraft type',
  military: 'Military / government flag',
  none: '',
} as const

function placeName(lat: number, lon: number, airports: AirportInfo[]): string {
  let best: AirportInfo | null = null
  let bd = Infinity
  for (const p of airports) {
    if (Math.abs(p.lat - lat) > 1 || Math.abs(p.lon - lon) > 1.4) continue
    const d = distanceNm(lat, lon, p.lat, p.lon)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  if (!best) return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  const code = best.iata || best.ident
  const city = best.city || best.name
  return bd < 4 ? `${city} (${code})` : `${fmtDist(bd)} from ${city} (${code})`
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-100">{value ?? '—'}</span>
    </div>
  )
}

export default function OwnerTab({ a, demo }: { a: Aircraft; demo: boolean }) {
  const [rec, setRec] = useState<OwnerRecord | null | undefined>(undefined)

  useEffect(() => {
    if (demo) return setRec(null)
    let stop = false
    setRec(undefined)
    fetchOwner(a.hex).then((r) => !stop && setRec(r))
    return () => {
      stop = true
    }
  }, [a.hex, demo])

  const loading = rec === undefined
  const registration = rec?.registration ?? a.registration
  const owner = rec?.owner ?? a.operator
  const ownerSource = rec?.owner ? 'Public aircraft registry data via hexdb.io' : a.operator ? 'Reported by the ADS-B network' : undefined

  const guess = guessOperator(a, owner, rec?.operatorCode)
  const ownerClass = classifyOwner(owner)
  const hint = typeHint(a.typeCode)
  const differs = guess.basis === 'callsign' && owner && !owner.toLowerCase().includes(guess.headline.split(' ')[0].toLowerCase())

  // Today's flights for this airframe
  const [legs, setLegs] = useState<Leg[] | null | undefined>(undefined)
  const [airports, setAirports] = useState<AirportInfo[]>([])
  useEffect(() => {
    loadAirports().then(setAirports)
  }, [])
  useEffect(() => {
    if (demo) return
    let stop = false
    setLegs(undefined)
    fetchTodaysLegs(a.hex).then((l) => !stop && setLegs(l))
    return () => {
      stop = true
    }
  }, [a.hex, demo])

  if (demo)
    return (
      <div className="rounded-lg bg-slate-800/60 p-3 text-sm text-slate-400">
        Demo planes are made up, so they have no real owner. Switch to <b className="text-slate-200">LIVE</b> to see who real
        aircraft are registered to.
        <div className="mt-2 text-slate-300">
          Best guess: <b>{guess.headline}</b>
          <div className="text-xs text-slate-500">{guess.detail}</div>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-lg bg-slate-800/60 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Registered owner</div>
        {loading ? (
          <div className="mt-1 h-5 w-2/3 animate-pulse rounded bg-slate-700" />
        ) : owner ? (
          <>
            <div className="mt-0.5 text-lg font-semibold text-slate-100">{owner}</div>
            <div className="text-[11px] text-slate-500">{ownerSource}</div>
          </>
        ) : (
          <div className="mt-0.5 text-sm text-slate-300">Not listed in the public database.</div>
        )}
      </section>

      {ownerClass && owner && guess.headline !== ownerClass.role && (
        <div className="-mt-1 px-1 text-xs text-slate-400">
          <b className="text-slate-300">What that means:</b> {ownerClass.role}. {ownerClass.detail}
        </div>
      )}

      <section className="rounded-lg bg-slate-800/60 p-3">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Usually flown by</div>
          {BASIS_LABEL[guess.basis] && <span className="rounded bg-slate-700 px-1.5 text-[10px] text-slate-300">{BASIS_LABEL[guess.basis]}</span>}
        </div>
        {loading && guess.basis !== 'callsign' ? (
          <div className="mt-1 h-5 w-1/2 animate-pulse rounded bg-slate-700" />
        ) : (
          <>
            <div className="mt-0.5 text-lg font-semibold text-slate-100">{guess.headline}</div>
            <div className="text-xs text-slate-400">{guess.detail}</div>
          </>
        )}
        {hint && guess.basis !== 'type' && !guess.detail.includes(hint) && <div className="mt-1.5 text-xs text-slate-500">{hint}</div>}
        {differs && (
          <div className="mt-2 text-xs text-slate-500">
            The owner and the airline are different. Airlines lease many of their planes, so the registered owner is often a
            leasing company, bank or trust.
          </div>
        )}
      </section>

      <LabelPicker a={a} />

      <section className="rounded-lg bg-slate-800/60 p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">This plane today</div>
        {legs === undefined ? (
          <div className="h-5 w-2/3 animate-pulse rounded bg-slate-700" />
        ) : !legs || legs.length === 0 ? (
          <p className="text-xs text-slate-500">No flight history for today yet.</p>
        ) : (
          <>
            <p className="mb-1.5 text-xs text-slate-300">
              {legs.length === 1 ? '1 flight' : `${legs.length} flights`} so far today
              {legs.length >= 4 ? ', a busy schedule typical of airlines, charters or training' : ''}.
            </p>
            <ol className="space-y-1.5">
              {legs.map((l, i) => (
                <li key={i} className="rounded-md bg-slate-900/60 px-2.5 py-1.5 text-xs">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-mono text-slate-300">{fmtClock(l.departedAt)}</span>
                    <span className="text-slate-200">{l.fromGround ? placeName(l.departLat, l.departLon, airports) : `first seen ${placeName(l.departLat, l.departLon, airports)}`}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-mono text-slate-300">{l.ongoing ? 'now' : fmtClock(l.arrivedAt)}</span>
                    <span className="text-slate-200">
                      → {l.ongoing ? 'in the air' : l.landed ? placeName(l.arriveLat, l.arriveLon, airports) : `last seen ${placeName(l.arriveLat, l.arriveLon, airports)}`}
                    </span>
                    {l.maxAltitude > 0 && <span className="text-slate-500">· up to {Math.round(l.maxAltitude / 100) * 100} ft</span>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="rounded-lg bg-slate-800/60 px-3 py-1.5">
        <div className="divide-y divide-slate-700/60">
          <Row label="Registration" value={registration} />
          <Row label="Registered in" value={registrationCountry(registration)} />
          <Row label="Manufacturer" value={rec?.manufacturer} />
          <Row label="Aircraft type" value={rec?.type ?? a.model} />
          <Row label="Transponder (ICAO)" value={a.hex.replace(/^~/, '').toUpperCase()} />
        </div>
      </section>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Check the records</div>
        <div className="grid grid-cols-2 gap-1.5">
          {registryLinks(registration, a.hex).map((l) => (
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
        Ownership comes from public registry records and can be out of date. Many private planes are registered to a company or
        trust instead of a person, and some owners ask the FAA to keep their aircraft off public tracking. SkyWatch doesn't
        show who the pilot is; that isn't broadcast.
      </p>
    </div>
  )
}

/** Fix any of SkyWatch's guesses: groups, size category and exact type. */
function LabelPicker({ a }: { a: Aircraft }) {
  const mine = myLabelFrom(myLabels.use(), a.hex, a.registration)
  const [typeQuery, setTypeQuery] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])
  const set = (patch: Parameters<typeof setMyLabel>[2]) => (setMyLabel(a.hex, a.registration, patch), setSaved(true))

  const groupsNow = a.special.map((s) => s.tag)
  const toggleGroup = (tag: SpecialTag) => {
    const base = mine?.groups ?? groupsNow
    set({ groups: base.includes(tag) ? base.filter((t) => t !== tag) : [...base, tag] })
  }
  const matches = searchTypes(typeQuery, 6)
  const cat = categoryInfo(a.category)
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-semibold ring-1 ${on ? 'text-slate-950 ring-transparent' : 'bg-slate-900/60 text-slate-200 ring-slate-700'}`
  const yours = <span className="ml-1 rounded bg-amber-400/20 px-1 text-[9px] font-bold uppercase text-amber-200">yours</span>

  return (
    <section className="rounded-lg bg-slate-800/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fix the labels</div>
        {mine && (
          <button onClick={() => (clearMyLabel(a.hex, a.registration), setSaved(true))} className="text-[11px] text-slate-400 underline">
            Undo all my changes
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-400">Something wrong or missing? Your choices beat SkyWatch's guesses and sync to your profile.</p>

      <div className="mt-2.5 text-[11px] font-semibold text-slate-300">
        Who flies it{mine?.groups && yours}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {SPECIAL_GROUPS.map((g) => {
          const on = (mine?.groups ?? groupsNow).includes(g.tag)
          return (
            <button key={g.tag} onClick={() => toggleGroup(g.tag)} aria-pressed={on} className={chip(on)} style={on ? { background: g.color } : undefined}>
              {g.label}
            </button>
          )
        })}
        {mine?.groups && (
          <button onClick={() => set({ groups: undefined })} className="px-1 text-[11px] text-slate-400 underline">
            automatic
          </button>
        )}
      </div>

      <div className="mt-3 text-[11px] font-semibold text-slate-300">
        Size / kind{mine?.category && yours}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {CATEGORIES.filter((c) => c.code !== '?').map((c) => {
          const on = cat.code === c.code
          return (
            <button
              key={c.code}
              onClick={() => set({ category: mine?.category === c.code ? undefined : c.code })}
              aria-pressed={on}
              title={c.description}
              className={chip(on)}
              style={on ? { background: c.color } : undefined}
            >
              {c.short}
            </button>
          )
        })}
        {mine?.category && (
          <button onClick={() => set({ category: undefined })} className="px-1 text-[11px] text-slate-400 underline">
            automatic
          </button>
        )}
      </div>

      <div className="mt-3 text-[11px] font-semibold text-slate-300">
        Aircraft type{mine?.typeCode && yours}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">
        Now: <span className="text-slate-200">{a.model ?? 'unknown'}</span>
        {a.typeCode && <span className="font-mono text-slate-500"> ({a.typeCode})</span>}
        {mine?.typeCode && (
          <button onClick={() => set({ typeCode: undefined })} className="ml-2 text-[11px] text-slate-400 underline">
            automatic
          </button>
        )}
      </div>
      <input
        id="fix-type"
        value={typeQuery}
        onChange={(e) => setTypeQuery(e.target.value)}
        placeholder="Search a type: 747, Black Hawk, C172…"
        className="mt-1.5 w-full rounded-md bg-slate-900/70 px-2.5 py-1.5 text-base text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-500 md:text-sm"
      />
      {matches.length > 0 && (
        <ul className="mt-1 divide-y divide-slate-800 rounded-md bg-slate-900/70 ring-1 ring-slate-700">
          {matches.map((m) => (
            <li key={m.code}>
              <button
                onClick={() => (set({ typeCode: m.code }), setTypeQuery(''))}
                className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-slate-800"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-slate-400">{m.code}</span>
                <span className="text-slate-100">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {saved && <p className="mt-2 text-[11px] text-emerald-300">Saved. The map updates within a few seconds.</p>}
    </section>
  )
}
