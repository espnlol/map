import { useEffect, useState } from 'react'
import type { Aircraft } from '../types'
import { fetchOwner, airlineName, operatorFromCallsign, registrationCountry, registryLinks, type OwnerRecord } from '../lib/owner'

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

  // Who flies it: the airline in this flight's callsign, else the operator on file.
  const fromCallsign = operatorFromCallsign(a.callsign)
  const fileCode = rec?.operatorCode
  const milgov = a.special.find((s) => s.tag === 'milgov')
  let flownBy: string | undefined
  let flownHow: string
  if (fromCallsign) {
    flownBy = fromCallsign.name ?? `Operator code ${fromCallsign.code}`
    flownHow = `This flight's callsign (${a.callsign}) starts with ${fromCallsign.code}, the code for this operator.`
  } else if (fileCode && airlineName(fileCode)) {
    flownBy = airlineName(fileCode)
    flownHow = `The aircraft database lists ${fileCode} as its usual operator.`
  } else if (milgov) {
    flownBy = 'Military / government'
    flownHow = milgov.reason
  } else {
    flownHow =
      'No airline is linked to this aircraft. Private planes are usually flown by their owner, or by a management or charter company the owner hires.'
  }

  const differs = owner && flownBy && !owner.toLowerCase().includes(flownBy.split(' ')[0].toLowerCase())

  if (demo)
    return (
      <div className="rounded-lg bg-slate-800/60 p-3 text-sm text-slate-400">
        Demo planes are made up, so they have no real owner. Switch to <b className="text-slate-200">LIVE</b> to see who real
        aircraft are registered to.
        {flownBy && (
          <div className="mt-2 text-slate-300">
            Callsign airline: <b>{flownBy}</b>
          </div>
        )}
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

      <section className="rounded-lg bg-slate-800/60 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Usually flown by</div>
        <div className="mt-0.5 text-lg font-semibold text-slate-100">{flownBy ?? 'Owner or a private operator'}</div>
        <div className="text-xs text-slate-400">{flownHow}</div>
        {differs && (
          <div className="mt-2 text-xs text-slate-500">
            The owner and the operator are often different. Airlines lease many of their planes, so the registered owner can
            be a leasing company, bank or trust.
          </div>
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
