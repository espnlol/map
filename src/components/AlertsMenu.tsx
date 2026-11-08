import { useEffect, useState } from 'react'
import { markRareViewed, rareStore, type RareSighting } from '../lib/rare'
import type { Hotspot } from '../lib/happening'
import type { MilitaryPattern } from '../lib/patterns'
import { fmtAlt, fmtClock, fmtRelative } from '../lib/format'
import { fmtDist } from '../lib/format'
import { TFR_KINDS, explainTfr, fetchTfrDetail, liveContext, quickCauses, tfrsNear, type Tfr, type TfrDetail } from '../lib/tfr'
import { SPECIAL_GROUPS } from '../lib/special'
import type { Aircraft, Center } from '../types'

const TIER_STYLE = {
  legendary: 'bg-amber-400 text-slate-950',
  rare: 'bg-violet-400 text-slate-950',
  uncommon: 'bg-slate-600 text-slate-100',
} as const

interface Props {
  onClose: () => void
  hotspots: Hotspot[]
  placeOf: (lat: number, lon: number) => string | null
  onOpenRare: (r: RareSighting) => void
  onOpenHotspot: (h: Hotspot) => void
  onScan: () => void
  scanning: boolean
  rareOn: boolean
  happeningOn: boolean
  military: MilitaryPattern[]
  onOpenHex: (hex: string) => void
  onRareList: () => void
  onMilWatch: () => void
  tfrs: Tfr[] | null
  tfrOn: boolean
  center: Center
  radiusNm: number
  onOpenTfr: (id: string) => void
  aircraft: Aircraft[]
}

export default function AlertsMenu({ onClose, hotspots, placeOf, onOpenRare, onOpenHotspot, onScan, scanning, rareOn, happeningOn, military, onOpenHex, onRareList, onMilWatch, tfrs, tfrOn, center, radiusNm, onOpenTfr, aircraft }: Props) {
  const rare = rareStore.use()
  useEffect(() => markRareViewed, [])
  const near = rare.current.filter((r) => r.nearby)
  const far = rare.current.filter((r) => !r.nearby)

  const nearTfrs = tfrs ? tfrsNear(tfrs, center.lat, center.lon, Math.max(radiusNm, 60) * 1.3) : []
  const vipElsewhere = tfrs ? tfrs.filter((t) => t.kind === 'vip' && !nearTfrs.includes(t)) : []
  const [details, setDetails] = useState<Record<string, TfrDetail | null>>({})
  const shownIds = [...nearTfrs, ...vipElsewhere].slice(0, 12).map((t) => t.id).join()
  useEffect(() => {
    for (const t of [...nearTfrs, ...vipElsewhere].slice(0, 12)) fetchTfrDetail(t).then((d) => setDetails((m) => ({ ...m, [t.id]: d })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownIds])

  const tfrRow = (t: Tfr) => {
    const k = TFR_KINDS[t.kind]
    const x = explainTfr(t)
    const d = details[t.id]
    const live = liveContext(t, aircraft)
    const inside = live.inside
    const causes = d?.causes.length ? d.causes : quickCauses(t)
    const tagOf = (a: Aircraft) => {
      const sp = a.special[0]
      return sp ? ` (${SPECIAL_GROUPS.find((g) => g.tag === sp.tag)?.label})` : ''
    }
    return (
      <li key={t.id}>
        <button
          onClick={() => (t.polygons.length ? onOpenTfr(t.id) : window.open(t.url, '_blank', 'noreferrer'))}
          className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-slate-800/60"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-1.5 text-[10px] font-bold uppercase text-slate-950" style={{ background: k.color }}>
              {x.what}
            </span>
            <span className="text-xs text-slate-400">
              {[t.state, t.facility].filter(Boolean).join(' · ')} · NOTAM {t.id}
            </span>
          </div>
          {t.title && <div className="line-clamp-2 text-xs text-slate-300">{t.title}</div>}
          {causes.length > 0 && <div className="text-xs font-semibold text-slate-100">{causes.join(' · ')}</div>}
          {d?.purpose && <div className="line-clamp-2 text-[11px] text-slate-300">{d.purpose}</div>}
          {d?.inCharge && <div className="text-[11px] text-slate-400">Run by {d.inCharge}</div>}
          {live.notes.map((n) => (
            <div key={n} className="text-[11px] text-amber-200">● {n}</div>
          ))}
          <div className="text-[11px] text-slate-400">{x.who.split('. ')[0]}.</div>
          {(d?.upper ?? t.upper ?? d?.end ?? t.end) && (
            <div className="text-[11px] text-slate-500">
              {(d?.upper ?? t.upper) && `Up to ${d?.upper ?? t.upper}`}
              {(d?.upper ?? t.upper) && (d?.end ?? t.end) && ' · '}
              {(d?.end ?? t.end) && `until ${d?.end ?? t.end}`}
            </div>
          )}
          {inside.length > 0 && (
            <div className="text-[11px] text-amber-200">
              {inside.length === 1 ? '1 aircraft' : `${inside.length} aircraft`} inside now: {inside.slice(0, 4).map((a) => a.callsign + tagOf(a)).join(', ')}
              {inside.length > 4 ? '…' : ''}
            </div>
          )}
        </button>
      </li>
    )
  }

  const row = (r: RareSighting) => (
    <li key={r.hex}>
      <button onClick={() => onOpenRare(r)} className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-slate-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 text-[10px] font-bold uppercase ${TIER_STYLE[r.type.tier]}`}>{r.type.tier}</span>
          <span className="text-sm font-semibold">{r.type.name}</span>
          {r.firstSeen > rare.lastViewed && <span className="rounded bg-red-500 px-1.5 text-[10px] font-bold uppercase text-white">new</span>}
        </div>
        <div className="text-xs text-slate-400">
          <span className="font-mono text-slate-200">{r.callsign}</span> · {fmtAlt(r.altitude, false)}
          {r.distance != null && ` · ${fmtDist(r.distance)} away`}
          {placeOf(r.lat, r.lon) && ` · ${placeOf(r.lat, r.lon)}`}
        </div>
        <div className="text-[11px] text-slate-500">{r.type.why}</div>
      </button>
    </li>
  )

  return (
    <div className="safe-overlay fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 md:items-start md:justify-end md:p-4 md:pt-14" onClick={onClose}>
      <div
        className="flex max-h-[85%] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-slate-900 ring-1 ring-slate-700 md:max-h-[80vh] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Alerts"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-bold">Alerts</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-sky-300 hover:bg-slate-800">
            Done
          </button>
        </div>
        <div className="overflow-y-auto">
          <section>
            <h3 className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-orange-300">Something's happening</h3>
            {!happeningOn ? (
              <p className="px-4 pb-3 text-xs text-slate-500">Turned off in Settings.</p>
            ) : hotspots.length === 0 ? (
              <p className="px-4 pb-3 text-xs text-slate-500">Nothing circling in your area right now.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {hotspots.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => onOpenHotspot(h)} className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-slate-800/60">
                      <div className="text-sm font-semibold">
                        {h.aircraft.length > 1 ? `${h.aircraft.length} aircraft circling` : `${h.aircraft[0].heli ? 'Helicopter' : 'Aircraft'} circling`}
                        {placeOf(h.lat, h.lon) && <span className="font-normal text-slate-400"> · {placeOf(h.lat, h.lon)}</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {h.aircraft.map((a) => `${a.callsign}${a.model ? ` (${a.model})` : ''}${a.milgov ? ' · military/gov' : ''}${a.police ? ' · police' : ''}${a.medical ? ' · medical' : ''}${a.news ? ' · TV news' : ''}`).join(', ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Since {fmtClock(h.since)} ({fmtRelative(h.since)}) · {h.aircraft.reduce((n, a) => Math.max(n, a.turns), 0)} turns
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button onClick={onMilWatch} className="flex w-full items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-left text-sm text-lime-200 hover:bg-slate-800/60">
            🎖️ <span className="flex-1">Military arrival watch</span>
            <span className="text-xs text-slate-400">Pick airports ›</span>
          </button>

          {military.length > 0 && (
            <section className="border-t border-slate-800">
              <h3 className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-lime-300">Military activity</h3>
              <ul className="divide-y divide-slate-800">
                {military.map((m) => (
                  <li key={m.hex}>
                    <button onClick={() => onOpenHex(m.hex)} className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-slate-800/60">
                      <div className="text-sm font-semibold">
                        {m.kind}
                        {placeOf(m.lat, m.lon) && <span className="font-normal text-slate-400"> · {placeOf(m.lat, m.lon)}</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="font-mono text-slate-200">{m.callsign}</span>
                        {m.model ? ` (${m.model})` : ''} · {fmtAlt(m.altitude, false)} · {Math.round(m.minutes)} min, {m.turns} loops over {fmtDist(m.spreadNm * 2)}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.why}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tfrOn && (
            <section className="border-t border-slate-800">
              <h3 className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-red-300">Restricted airspace</h3>
              {tfrs === null ? (
                <p className="px-4 pb-3 text-xs text-slate-500">Couldn't reach the FAA right now. If this keeps happening, the relay needs its latest update.</p>
              ) : nearTfrs.length === 0 && vipElsewhere.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-slate-500">{tfrs.length ? `No flight restrictions near you. ${tfrs.length} elsewhere in the US, outlined on the map.` : 'No flight restrictions found.'}</p>
              ) : (
                <>
                  {nearTfrs.length > 0 && <div className="px-4 pt-1 text-[11px] font-semibold text-sky-300">Near you</div>}
                  <ul className="divide-y divide-slate-800">{nearTfrs.map(tfrRow)}</ul>
                  {vipElsewhere.length > 0 && <div className="px-4 pt-2 text-[11px] font-semibold text-slate-400">VIP movements elsewhere</div>}
                  <ul className="divide-y divide-slate-800">{vipElsewhere.map(tfrRow)}</ul>
                  <p className="px-4 py-2 text-[11px] text-slate-500">VIP zones usually mean the President or Vice President is visiting.</p>
                </>
              )}
            </section>
          )}

          <section className="border-t border-slate-800">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Rare planes in the air</h3>
              <button onClick={onRareList} className="text-xs text-slate-400 underline">
                full list
              </button>
              {rareOn && (
                <button onClick={onScan} disabled={scanning} className="ml-auto text-xs text-sky-300 disabled:opacity-50">
                  {scanning ? 'Checking…' : 'Check now'}
                </button>
              )}
            </div>
            {!rareOn ? (
              <p className="px-4 pb-3 text-xs text-slate-500">Turned off in Settings.</p>
            ) : rare.current.length === 0 ? (
              <p className="px-4 pb-3 text-xs text-slate-500">
                {rare.checkedAt ? `None right now (checked ${fmtRelative(rare.checkedAt)}).` : 'Checking…'}
              </p>
            ) : (
              <>
                {near.length > 0 && <div className="px-4 pt-1 text-[11px] font-semibold text-sky-300">In your area</div>}
                <ul className="divide-y divide-slate-800">{near.map(row)}</ul>
                {far.length > 0 && <div className="px-4 pt-2 text-[11px] font-semibold text-slate-400">Elsewhere in the world</div>}
                <ul className="divide-y divide-slate-800">{far.map(row)}</ul>
                <p className="px-4 py-2 text-[11px] text-slate-500">Checked {fmtRelative(rare.checkedAt)}. Rarity levels are set in Settings.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
