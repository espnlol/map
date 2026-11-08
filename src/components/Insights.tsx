import { useEffect, useMemo, useState } from 'react'
import type { Aircraft } from '../types'
import { RECORD_DEFS, opens, records, topOf } from '../lib/records'
import { RARE_TYPES, rareInfo, rareStore, type RareTier } from '../lib/rare'
import { logbook } from '../lib/logbook'
import { emergencyLog } from '../lib/emergencyLog'
import { fetchFaaDisruptions, type FaaItem } from '../lib/disruptions'
import { goArounds, type Holding, type MilitaryPattern } from '../lib/patterns'
import type { Hotspot } from '../lib/happening'
import type { AirportInfo } from '../lib/airports'
import { placeInfo, weatherTrouble } from '../lib/weather'
import { distanceNm } from '../lib/geo'
import { fmtAlt, fmtClock, fmtRelative } from '../lib/format'
import { fmtDist } from '../lib/format'
import { scanWorld, world, type WorldFlight } from '../lib/world'
import MilWatchPanel from './MilWatchPanel'
import type { MilArrival } from '../lib/milwatch'

export type InsightTab = 'records' | 'tracked' | 'milwatch' | 'disruptions' | 'rare'

interface Props {
  initialTab?: InsightTab
  onClose: () => void
  aircraft: Aircraft[]
  hotspots: Hotspot[]
  military: MilitaryPattern[]
  holding: Holding[]
  airports: AirportInfo[]
  center: { lat: number; lon: number }
  radiusNm: number
  live: boolean
  onOpen: (hex: string, lat?: number, lon?: number, callsign?: string) => void
  onOpenArrival: (e: MilArrival) => void
}

const TABS: [InsightTab, string][] = [
  ['records', '🏆 Records'],
  ['tracked', '🔥 Most tracked'],
  ['milwatch', '🎖️ Military arrivals'],
  ['disruptions', '🛑 Disruptions'],
  ['rare', '✨ Rare list'],
]

const TIER_STYLE: Record<RareTier, string> = {
  legendary: 'bg-amber-400 text-slate-950',
  rare: 'bg-violet-400 text-slate-950',
  uncommon: 'bg-slate-600 text-slate-100',
}

function interest(a: Aircraft): { score: number; why: string } | null {
  const why: string[] = []
  let score = 0
  if (a.emergency) (score += 100), why.push(a.emergency.label)
  const r = rareInfo(a.typeCode, a.callsign)
  if (r) (score += r.tier === 'legendary' ? 80 : r.tier === 'rare' ? 60 : 25), why.push(`${r.tier} ${r.name}`)
  if (a.special.some((s) => s.tag === 'milgov')) (score += 40), why.push('military / gov')
  if (a.special.some((s) => s.tag === 'sports')) (score += 35), why.push('sports')
  if (a.special.some((s) => s.tag === 'news')) (score += 20), why.push('TV news')
  if (a.special.some((s) => s.tag === 'police')) (score += 20), why.push('police')
  if (a.special.some((s) => s.tag === 'medical')) (score += 15), why.push('air ambulance')
  if (a.category === 'A5') (score += 8), why.push('heavy')
  if (['7500', '7600', '7700', '1255', '1277'].includes(a.squawk ?? '')) (score += 15), why.push(`squawk ${a.squawk}`)
  return score ? { score, why: why.join(' · ') } : null
}

export default function Insights(p: Props) {
  const [tab, setTab] = useState<InsightTab>(p.initialTab ?? 'records')
  return (
    <div className="safe-overlay fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 md:items-center md:p-4" onClick={p.onClose}>
      <div
        className="flex h-[88%] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-slate-900 ring-1 ring-slate-700 md:h-[85vh] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Insights"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-bold">Insights</h2>
          <button onClick={p.onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-sky-300 hover:bg-slate-800">
            Done
          </button>
        </div>
        <div className="no-scrollbar flex shrink-0 overflow-x-auto border-b border-slate-800 text-xs font-semibold" role="tablist">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 ${tab === t ? 'border-b-2 border-sky-400 text-sky-300' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'records' && <Records {...p} />}
          {tab === 'tracked' && <Tracked {...p} />}
          {tab === 'milwatch' && <MilWatchPanel airports={p.airports} aircraft={p.aircraft} onOpen={(hex) => p.onOpen(hex)} onOpenArrival={p.onOpenArrival} />}
          {tab === 'disruptions' && <Disruptions {...p} />}
          {tab === 'rare' && <RareList {...p} />}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="px-4 py-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {note && <p className="mb-1 text-[11px] text-slate-500">{note}</p>}
      <div className="mt-1">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Records({ onOpen, live }: Props) {
  const r = records.use()
  const emerg = emergencyLog.use().filter((e) => new Date(e.startedAt).toDateString() === new Date().toDateString()).length
  const ga = goArounds.use().filter((g) => new Date(g.at).toDateString() === new Date().toDateString()).length
  const rareSeen = Object.values(rareStore.use().seen).filter((t) => new Date(t).toDateString() === new Date().toDateString()).length
  const isToday = r.day === new Date().toDateString()
  if (!live) return <p className="px-4 py-8 text-center text-sm text-slate-500">Records are kept from real planes. Switch to LIVE.</p>
  if (!isToday || Object.keys(r.holders).length === 0)
    return <p className="px-4 py-8 text-center text-sm text-slate-500">No records yet today. They build up as SkyWatch watches live traffic.</p>
  const counters: [string, string, number | string][] = [
    ['👀', 'Planes seen', r.seen.length.toLocaleString()],
    ['🛫', 'Most in the air at once', `${r.peak.value}${r.peak.at ? ` at ${fmtClock(r.peak.at)}` : ''}`],
    ['🐘', 'Heavies seen', r.heavies],
    ['🚁', 'Helicopters seen', r.helicopters],
    ['🎖️', 'Military / gov seen', r.military],
    ['✨', 'Rare planes spotted', rareSeen],
    ['⚠️', 'Emergencies', emerg],
    ['🔁', 'Go-arounds', ga],
  ]
  return (
    <>
      <Section title="Today's records" note="From live traffic in the areas you've watched today. Resets at midnight.">
        <ul className="divide-y divide-slate-800">
          {RECORD_DEFS.filter((d) => r.holders[d.key]).map((d) => {
            const h = r.holders[d.key]
            return (
              <li key={d.key}>
                <button onClick={() => onOpen(h.hex)} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="text-xl">{d.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{d.title}</span>
                    <span className="block truncate text-xs text-slate-400">
                      <span className="font-mono text-slate-200">{h.callsign}</span>
                      {h.model ? ` · ${h.model}` : ''} · {fmtClock(h.at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-sm text-amber-200">{d.fmt(h.value)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title="Today in numbers">
        <div className="grid grid-cols-2 gap-1.5">
          {counters.map(([icon, label, v]) => (
            <div key={label} className="rounded-lg bg-slate-800/60 px-3 py-2">
              <div className="text-[11px] text-slate-400">
                {icon} {label}
              </div>
              <div className="font-mono text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Most common today">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['Airlines', topOf(r.airlines)],
            ['Aircraft types', topOf(r.types)],
          ].map(([label, list]) => (
            <div key={label as string}>
              <div className="mb-1 text-xs font-semibold text-slate-300">{label as string}</div>
              <ol className="space-y-0.5 text-xs">
                {(list as [string, number][]).map(([name, n], i) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate text-slate-300">
                      {i + 1}. {name}
                    </span>
                    <span className="font-mono text-slate-500">{n}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------

function Tracked(p: Props) {
  const [scope, setScope] = useState<'near' | 'world'>('near')
  return (
    <>
      <div className="flex gap-1.5 px-4 pt-3">
        {(['near', 'world'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${scope === s ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700'}`}
          >
            {s === 'near' ? '📍 Near you' : '🌍 Around the world'}
          </button>
        ))}
      </div>
      {scope === 'near' ? <TrackedNear {...p} /> : <TrackedWorld {...p} />}
    </>
  )
}

const KIND_STYLE: Record<WorldFlight['kind'], [string, string]> = {
  emergency: ['Emergency', 'bg-red-500 text-white'],
  vip: ['VIP', 'bg-amber-400 text-slate-950'],
  legendary: ['Legendary', 'bg-amber-400 text-slate-950'],
  bomber: ['Bomber', 'bg-lime-400 text-slate-950'],
  rare: ['Rare', 'bg-violet-400 text-slate-950'],
  surveillance: ['Surveillance', 'bg-lime-400 text-slate-950'],
  tanker: ['Tanker', 'bg-lime-400 text-slate-950'],
  military: ['Military', 'bg-lime-400 text-slate-950'],
  uncommon: ['Uncommon', 'bg-slate-600 text-slate-100'],
}

function worldPlace(lat: number, lon: number, airports: AirportInfo[]) {
  let best: AirportInfo | null = null
  let bd = Infinity
  for (const a of airports) {
    if (!a.large || Math.abs(a.lat - lat) > 8) continue
    const d = distanceNm(lat, lon, a.lat, a.lon)
    if (d < bd) {
      bd = d
      best = a
    }
  }
  if (!best || bd > 600) return 'over open ocean or remote land'
  const where = `${best.city || best.name}${best.country ? `, ${best.country}` : ''}`
  return bd < 15 ? `near ${where}` : `${fmtDist(bd)} from ${where}`
}

function TrackedWorld({ airports, center, onOpen }: Props) {
  const w = world.use()
  const [loading, setLoading] = useState(false)
  const refresh = () => {
    setLoading(true)
    scanWorld().finally(() => setLoading(false))
  }
  useEffect(() => {
    if (Date.now() - w.checkedAt > 2 * 60 * 1000) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const counts = w.flights.reduce<Record<string, number>>((m, f) => ((m[f.kind] = (m[f.kind] ?? 0) + 1), m), {})
  return (
    <Section
      title="Most interesting in the world right now"
      note="Emergencies anywhere, notable military (VIP transports, bombers, surveillance, tankers) and rare planes, ranked by SkyWatch."
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-200">⚠️ {w.emergencyCount} emergenc{w.emergencyCount === 1 ? 'y' : 'ies'}</span>
        <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-lime-200">🎖️ {w.militaryCount.toLocaleString()} military in the air</span>
        {counts.legendary || counts.rare ? (
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">✨ {(counts.legendary ?? 0) + (counts.rare ?? 0)} rare</span>
        ) : null}
        <button onClick={refresh} disabled={loading} className="ml-auto text-sky-300 disabled:opacity-50">
          {loading ? 'Checking…' : w.checkedAt ? `Updated ${fmtRelative(w.checkedAt)} · refresh` : 'Check now'}
        </button>
      </div>
      {w.error && <p className="mb-2 text-xs text-red-300">{w.error}</p>}
      {w.flights.length === 0 ? (
        <p className="text-xs text-slate-500">{loading ? 'Looking around the world…' : 'Nothing found yet.'}</p>
      ) : (
        <ol className="divide-y divide-slate-800">
          {w.flights.map((f, i) => {
            const [label, style] = KIND_STYLE[f.kind]
            const far = distanceNm(center.lat, center.lon, f.lat, f.lon)
            return (
              <li key={f.hex}>
                <button onClick={() => onOpen(f.hex, f.lat, f.lon, f.callsign)} className="flex w-full items-start gap-3 py-2 text-left">
                  <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-sm text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold">{f.callsign}</span>
                      <span className={`rounded px-1.5 text-[10px] font-bold uppercase ${style}`}>{label}</span>
                    </span>
                    <span className="block truncate text-xs text-slate-300">{f.tags.join(' · ')}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {f.model ?? f.typeCode ?? 'Unknown type'} · {worldPlace(f.lat, f.lon, airports)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11px] text-slate-400">
                    {fmtAlt(f.altitude, false)}
                    <br />
                    <span className="text-slate-500">{fmtDist(far)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}

function TrackedNear({ aircraft, onOpen, hotspots, military }: Props) {
  const mine = Object.values(opens.use())
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, 10)
  const live = new Set(aircraft.map((a) => a.hex))
  const hot = useMemo(() => {
    const circling = new Set(hotspots.flatMap((h) => h.aircraft.map((x) => x.hex)))
    const looping = new Set(military.map((m) => m.hex))
    return aircraft
      .map((a) => {
        const i = interest(a)
        let score = i?.score ?? 0
        const why = i ? [i.why] : []
        if (circling.has(a.hex)) (score += 30), why.push('circling')
        if (looping.has(a.hex)) (score += 30), why.push('military pattern')
        return { a, score, why: why.join(' · ') }
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 15)
  }, [aircraft, hotspots, military])
  return (
    <>
      <Section title="Hot right now near you" note="The most interesting flights in your area, ranked by SkyWatch: emergencies, rare and military first.">
        {hot.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing special in your area right now.</p>
        ) : (
          <ol className="divide-y divide-slate-800">
            {hot.map(({ a, why }, i) => (
              <li key={a.hex}>
                <button onClick={() => onOpen(a.hex)} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="w-5 shrink-0 text-right font-mono text-sm text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-semibold">{a.callsign}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {a.model ?? 'Unknown type'} · {why}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{fmtAlt(a.altitude, a.onGround)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Your most tracked" note="The planes you've opened the most.">
        {mine.length === 0 ? (
          <p className="text-xs text-slate-500">Open some planes and they'll show up here.</p>
        ) : (
          <ol className="divide-y divide-slate-800">
            {mine.map((m, i) => (
              <li key={m.key} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-right font-mono text-sm text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-semibold">{m.callsign}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {m.model ?? ''} · last opened {fmtRelative(m.lastAt)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 text-xs tabular-nums text-slate-300">{m.count}×</span>
                {live.has(m.key) && <span className="text-[10px] text-sky-300">on map</span>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------

interface LocalDisruption {
  code: string
  name: string
  lat: number
  lon: number
  items: string[]
  score: number
}

function Disruptions({ aircraft, holding, airports, center, radiusNm, onOpen, live }: Props) {
  const [faa, setFaa] = useState<FaaItem[] | null | undefined>(undefined)
  const [weather, setWeather] = useState<Record<string, string | null>>({})
  const gas = goArounds.use()
  useEffect(() => {
    fetchFaaDisruptions().then(setFaa)
  }, [])

  // big airports in your area, with what SkyWatch sees there
  const nearby = useMemo(
    () => airports.filter((a) => a.large && distanceNm(center.lat, center.lon, a.lat, a.lon) <= Math.max(radiusNm, 30)).slice(0, 12),
    [airports, center.lat, center.lon, radiusNm],
  )
  useEffect(() => {
    let stop = false
    Promise.all(nearby.map(async (a) => [a.ident, weatherTrouble(await placeInfo(a.lat, a.lon))] as const)).then((pairs) => {
      if (!stop) setWeather(Object.fromEntries(pairs))
    })
    return () => {
      stop = true
    }
  }, [nearby])

  const local: LocalDisruption[] = nearby
    .map((ap) => {
      const code = ap.iata || ap.ident
      const items: string[] = []
      let score = 0
      const hold = holding.filter((h) => h.airport === code)
      if (hold.length) (score += hold.length * 10), items.push(`${hold.length} plane${hold.length > 1 ? 's' : ''} holding (${hold.map((h) => h.callsign).join(', ')})`)
      const ga = gas.filter((g) => g.airport === code && Date.now() - g.at < 2 * 3600e3)
      if (ga.length) (score += ga.length * 15), items.push(`${ga.length} go-around${ga.length > 1 ? 's' : ''} in the last 2 hours`)
      const em = aircraft.filter((x) => x.emergency && distanceNm(x.lat, x.lon, ap.lat, ap.lon) < 40)
      if (em.length) (score += 20), items.push(`${em.length} emergency nearby (${em.map((x) => x.callsign).join(', ')})`)
      const w = weather[ap.ident]
      if (w) (score += 10), items.push(`Weather: ${w}`)
      return { code, name: ap.city || ap.name, lat: ap.lat, lon: ap.lon, items, score }
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)

  return (
    <>
      <Section title="Around you" note="What SkyWatch sees at the big airports in your area: holding, go-arounds, emergencies and bad weather.">
        {!live ? (
          <p className="text-xs text-slate-500">Switch to LIVE to check real airports.</p>
        ) : local.length === 0 ? (
          <p className="text-xs text-slate-500">No signs of trouble at {nearby.length ? nearby.map((n) => n.iata || n.ident).join(', ') : 'airports in your area'} right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {local.map((d) => (
              <li key={d.code} className="rounded-lg bg-slate-800/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${d.score >= 30 ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="font-mono text-sm font-bold">{d.code}</span>
                  <span className="truncate text-xs text-slate-400">{d.name}</span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-300">
                  {d.items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {gas.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-slate-300">Recent go-arounds</div>
            <ul className="space-y-0.5 text-xs text-slate-400">
              {gas.slice(0, 8).map((g) => (
                <li key={g.id}>
                  <button className="text-left hover:text-slate-200" onClick={() => onOpen(g.hex)}>
                    🔁 <span className="font-mono text-slate-200">{g.callsign}</span> at {g.airport}, {fmtClock(g.at)} (down to {Math.round(g.lowest).toLocaleString()} ft)
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      <Section title="US airports (FAA)" note="Official delay programs from the FAA's National Airspace System status.">
        {faa === undefined ? (
          <p className="text-xs text-slate-500">Checking the FAA…</p>
        ) : faa === null ? (
          <p className="text-xs text-slate-500">Couldn't reach the FAA status feed. If this keeps happening, the relay may need its latest code.</p>
        ) : faa.length === 0 ? (
          <p className="text-xs text-emerald-300">No delays, ground stops or closures reported right now. 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {faa.map((f, i) => (
              <li key={i} className="rounded-lg bg-slate-800/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{f.airport}</span>
                  <span className={`rounded px-1.5 text-[10px] font-bold uppercase ${/stop|closure/i.test(f.kind) ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-950'}`}>{f.kind}</span>
                </div>
                {f.reason && <div className="text-xs text-slate-300">{f.reason}</div>}
                {f.detail && <div className="text-[11px] text-slate-500">{f.detail}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------

function RareList({ onOpen }: Props) {
  const logged = new Set(logbook.use().map((e) => e.typeCode))
  const airborne = rareStore.use().current
  const tiers: [RareTier, string, string][] = [
    ['legendary', 'Legendary', 'A handful exist, or they are famous. Seeing one is a big deal.'],
    ['rare', 'Rare', 'Unusual types that most people never notice overhead.'],
    ['uncommon', 'Uncommon', 'Special, but there are quite a few flying.'],
  ]
  const total = RARE_TYPES.length
  const got = RARE_TYPES.filter((t) => logged.has(t.code)).length
  return (
    <>
      <div className="px-4 pt-3 text-xs text-slate-400">
        You've logged <b className="text-slate-100">{got}</b> of {total} rare types. Ranked from rarest to most common.
      </div>
      {tiers.map(([tier, label, blurb]) => {
        const list = RARE_TYPES.filter((t) => t.tier === tier)
        return (
          <Section key={tier} title={`${label} · ${list.length}`} note={blurb}>
            <ol className="divide-y divide-slate-800">
              {list.map((t, i) => {
                const up = airborne.filter((r) => r.type.code === t.code)
                return (
                  <li key={t.code} className="flex items-start gap-3 py-2">
                    <span className={`mt-0.5 w-7 shrink-0 rounded text-center text-[10px] font-bold ${TIER_STYLE[tier]}`}>#{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{t.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{t.code}</span>
                        {logged.has(t.code) && <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-semibold text-emerald-300">✓ logged</span>}
                      </span>
                      <span className="block text-xs text-slate-400">{t.why}</span>
                      {up.length > 0 && (
                        <button onClick={() => onOpen(up[0].hex, up[0].lat, up[0].lon, up[0].callsign)} className="mt-0.5 text-xs font-semibold text-sky-300">
                          ✈ {up.length} in the air now · show
                        </button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </Section>
        )
      })}
    </>
  )
}
