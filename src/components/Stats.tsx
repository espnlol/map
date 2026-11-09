import { useMemo, useState } from 'react'
import type { Crash } from '../types'
import { CAUSE_COLORS, formatDate } from '../styles'
import { Bars, Modal } from './Modals'
import {
  byAircraft, byAirline, byPlace, countBy, deaths, familiesOf, hasDeaths, isOcean, place, topFives,
  type Group,
} from '../stats'

export type GroupKind = 'airline' | 'aircraft' | 'place'
export interface GroupRef { kind: GroupKind; name: string }
type Tab = 'overview' | 'airlines' | 'aircraft' | 'places' | 'top5'

const fmt = (n: number) => n.toLocaleString()
const decade = (c: Crash) => `${c.date.slice(0, 3)}0s`

/** Crashes that belong to an airline / aircraft family / place. */
export function crashesIn(crashes: Crash[], g: GroupRef): Crash[] {
  if (g.kind === 'airline') return crashes.filter((c) => (c.operators ?? (c.operator ? [c.operator] : [])).includes(g.name))
  if (g.kind === 'aircraft') return crashes.filter((c) => familiesOf(c).includes(g.name))
  return crashes.filter((c) => place(c) === g.name)
}

function Tile({ label, value, tone = 'text-white', sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-900 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`truncate text-xl font-bold tabular-nums sm:text-2xl ${tone}`}>{value}</div>
      {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  )
}

function CrashList({ crashes, onSelect, limit = 50 }: { crashes: Crash[]; onSelect: (id: string) => void; limit?: number }) {
  const [shown, setShown] = useState(limit)
  return (
    <>
      <ol className="divide-y divide-slate-800 rounded-xl bg-slate-900">
        {crashes.slice(0, shown).map((c) => (
          <li key={c.id}>
            <button onClick={() => onSelect(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{c.name}</span>
                <span className="block truncate text-xs text-slate-500">{formatDate(c.date)} · {c.aircraft ?? 'Unknown aircraft'} · {c.country}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-red-400" title={c.fatalities == null ? 'Death toll not recorded' : undefined}>{c.fatalities ?? '?'}</span>
            </button>
          </li>
        ))}
      </ol>
      {crashes.length > shown && (
        <button onClick={() => setShown(shown + 100)} className="mt-2 w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:bg-slate-800">
          Show more ({fmt(crashes.length - shown)} left)
        </button>
      )}
    </>
  )
}

function GroupTable({ groups, noun, plural, onOpen }: { groups: Group[]; noun: string; plural: string; onOpen: (name: string) => void }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'count' | 'deaths' | 'name'>('count')
  const [shown, setShown] = useState(100)
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return groups
      .filter((g) => !needle || g.name.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'deaths' ? b.deaths - a.deaths : b.count - a.count || b.deaths - a.deaths))
  }, [groups, q, sort])
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setShown(100) }}
          placeholder={`Search ${fmt(groups.length)} ${plural}…`}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200">
          <option value="count">Most crashes</option>
          <option value="deaths">Most deaths</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-xl bg-slate-900">
        <div className="grid grid-cols-[1fr_4rem_4.5rem] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 sm:grid-cols-[1fr_4rem_5rem_6rem]">
          <span>{noun}</span><span className="text-right">Crashes</span><span className="text-right">Deaths</span><span className="hidden text-right sm:block">Years</span>
        </div>
        {rows.slice(0, shown).map((g) => {
          const years = g.crashes.map((c) => +c.date.slice(0, 4))
          return (
            <button key={g.name} onClick={() => onOpen(g.name)}
              className="grid w-full grid-cols-[1fr_4rem_4.5rem] gap-2 border-b border-slate-800/60 px-3 py-2 text-left text-sm hover:bg-slate-800 sm:grid-cols-[1fr_4rem_5rem_6rem]">
              <span className="truncate text-white">{g.name}</span>
              <span className="text-right tabular-nums text-slate-200">{g.count}</span>
              <span className="text-right tabular-nums text-red-400">{fmt(g.deaths)}</span>
              <span className="hidden text-right tabular-nums text-slate-500 sm:block">{Math.min(...years)}{years.length > 1 && Math.max(...years) !== Math.min(...years) ? `–${String(Math.max(...years)).slice(2)}` : ''}</span>
            </button>
          )
        })}
        {!rows.length && <div className="p-6 text-center text-sm text-slate-500">Nothing matches “{q}”.</div>}
      </div>
      {rows.length > shown && (
        <button onClick={() => setShown(shown + 200)} className="mt-2 w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:bg-slate-800">
          Show more ({fmt(rows.length - shown)} left)
        </button>
      )}
    </div>
  )
}

function GroupDetail({ crashes, group, onBack, onSelect, onShowOnMap, onOpen }: {
  crashes: Crash[]
  group: GroupRef
  onBack: () => void
  onSelect: (id: string) => void
  onShowOnMap: (g: GroupRef) => void
  onOpen: (g: GroupRef) => void
}) {
  const list = useMemo(() => crashesIn(crashes, group).sort((a, b) => b.date.localeCompare(a.date)), [crashes, group])
  if (!list.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        No crashes for {group.name} match your current filters.
        <button onClick={onBack} className="mt-3 block w-full text-blue-400 hover:underline">← Back</button>
      </div>
    )
  }
  const total = list.reduce((n, c) => n + deaths(c), 0)
  const known = list.filter(hasDeaths).length
  const surv = list.reduce((n, c) => n + (c.survivors ?? 0), 0)
  const years = list.map((c) => +c.date.slice(0, 4))
  const worst = [...list].sort((a, b) => deaths(b) - deaths(a))[0]
  const byCause = [...countBy(list, (c) => c.cause)].sort((a, b) => b[1] - a[1])
  const byDecade = [...countBy(list, decade)].sort((a, b) => a[0].localeCompare(b[0]))
  const second = group.kind === 'airline' ? byAircraft(list) : byAirline(list)
  const third = group.kind === 'place' ? byAircraft(list) : byPlace(list)
  const backLabel = { airline: 'airlines', aircraft: 'aircraft', place: 'places' }[group.kind]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">← All {backLabel}</button>
        <button onClick={() => onShowOnMap(group)} className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Show these on the map</button>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{group.kind === 'place' ? (isOcean(group.name) ? 'Ocean / sea' : 'Country') : group.kind}</div>
        <h3 className="text-2xl font-bold text-white">{group.name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Crashes" value={fmt(list.length)} />
        <Tile label="Deaths" value={fmt(total)} tone="text-red-400"
          sub={known < list.length ? `${list.length - known} crash${list.length - known > 1 ? 'es' : ''} with no recorded toll` : `${(total / Math.max(known, 1)).toFixed(0)} per crash on average`} />
        <Tile label="Survivors" value={fmt(surv)} tone="text-emerald-400" />
        <Tile label="Years" value={`${Math.min(...years)}${Math.max(...years) !== Math.min(...years) ? `–${Math.max(...years)}` : ''}`} />
      </div>
      <button onClick={() => onSelect(worst.id)} className="block w-full rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-left hover:bg-red-950/50">
        <div className="text-xs text-red-300">Deadliest</div>
        <div className="font-semibold text-white">{worst.name}</div>
        <div className="text-xs text-slate-400">{formatDate(worst.date)} · {fmt(deaths(worst))} deaths</div>
      </button>
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Causes">
          <Bars rows={byCause.map(([k, v]) => ({ label: k, value: v, color: CAUSE_COLORS[k] }))} />
        </Section>
        <Section title="Crashes by decade">
          <Bars rows={byDecade.map(([k, v]) => ({ label: k, value: v }))} />
        </Section>
        {second.length > 0 && (
          <Section title={group.kind === 'airline' ? 'Aircraft involved' : 'Airlines involved'}>
            <Bars
              rows={second.sort((a, b) => b.count - a.count).slice(0, 8).map((g) => ({ label: g.name, value: g.count, color: '#a855f7' }))}
              onClick={(name) => onOpen({ kind: group.kind === 'airline' ? 'aircraft' : 'airline', name })}
            />
          </Section>
        )}
        {third.length > 0 && (
          <Section title={group.kind === 'place' ? 'Aircraft involved' : 'Where they happened'}>
            <Bars
              rows={third.sort((a, b) => b.count - a.count).slice(0, 8).map((g) => ({ label: g.name, value: g.count, color: '#06b6d4' }))}
              onClick={(name) => onOpen({ kind: group.kind === 'place' ? 'aircraft' : 'place', name })}
            />
          </Section>
        )}
      </div>
      <Section title={`All ${fmt(list.length)} crashes`}>
        <CrashList crashes={list} onSelect={onSelect} />
      </Section>
    </div>
  )
}

export function StatsModal({ crashes, total, initial, onSelect, onShowOnMap, onClose }: {
  crashes: Crash[]
  total: number
  initial?: GroupRef | null
  onSelect: (id: string) => void
  onShowOnMap: (g: GroupRef) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>(initial ? (initial.kind === 'airline' ? 'airlines' : initial.kind === 'aircraft' ? 'aircraft' : 'places') : 'overview')
  const [group, setGroup] = useState<GroupRef | null>(initial ?? null)
  const [placeMode, setPlaceMode] = useState<'land' | 'water'>('land')

  const airlines = useMemo(() => byAirline(crashes), [crashes])
  const aircraft = useMemo(() => byAircraft(crashes), [crashes])
  const places = useMemo(() => byPlace(crashes), [crashes])
  const tops = useMemo(() => (tab === 'top5' ? topFives(crashes) : []), [crashes, tab])

  const open = (g: GroupRef) => {
    setGroup(g)
    setTab(g.kind === 'airline' ? 'airlines' : g.kind === 'aircraft' ? 'aircraft' : 'places')
  }

  const totalDeaths = crashes.reduce((n, c) => n + deaths(c), 0)
  const unknownTolls = crashes.filter((c) => !hasDeaths(c)).length
  const totalSurvivors = crashes.reduce((n, c) => n + (c.survivors ?? 0), 0)
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'airlines', label: 'Airlines' },
    { id: 'aircraft', label: 'Aircraft' },
    { id: 'places', label: 'Places' },
    { id: 'top5', label: 'Top 5s' },
  ]
  const top = (gs: Group[], n = 8) => [...gs].sort((a, b) => b.count - a.count).slice(0, n)

  return (
    <Modal title="Statistics" onClose={onClose} wide>
      <div className="-mx-5 -mt-4 mb-4 flex gap-1 overflow-x-auto border-b border-slate-800 px-5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setGroup(null) }}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {crashes.length < total && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Counting the {fmt(crashes.length)} of {fmt(total)} crashes that match your current search and filters.
        </p>
      )}

      {group ? (
        <GroupDetail crashes={crashes} group={group} onBack={() => setGroup(null)} onSelect={onSelect} onShowOnMap={onShowOnMap} onOpen={open} />
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Crashes" value={fmt(crashes.length)} />
            <Tile label="Deaths" value={fmt(totalDeaths)} tone="text-red-400" sub={unknownTolls ? `${fmt(unknownTolls)} tolls unknown` : undefined} />
            <Tile label="Survivors" value={fmt(totalSurvivors)} tone="text-emerald-400" />
            <Tile label="Airlines" value={fmt(airlines.length)} />
            <Tile label="Aircraft types" value={fmt(aircraft.length)} />
            <Tile label="Countries & seas" value={fmt(places.length)} />
          </div>
          <details className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
            <summary className="cursor-pointer font-semibold text-slate-200">How accurate are these numbers?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li><b className="text-slate-200">Only crashes on Wikipedia.</b> Wikipedia covers notable accidents (most airliner crashes, few small-plane ones), so this is a big sample, not every crash ever. Specialist databases list tens of thousands more.</li>
              <li><b className="text-slate-200">Counts aren’t risk.</b> Airlines and aircraft that flew more, or that Wikipedia covers in more detail (e.g. Aeroflot, US carriers), show more crashes. Nothing here is adjusted for number of flights.</li>
              <li><b className="text-slate-200">Causes and flight phases are sorted automatically</b> from Wikipedia’s one-line summary, so some are “Unknown” or simplified. Flight type (commercial, military, …) is a best guess from the operator.</li>
              <li><b className="text-slate-200">Unknown death tolls</b> ({fmt(unknownTolls)} crashes here) are left out of death totals rather than counted as zero. Some tolls include people killed on the ground.</li>
              <li><b className="text-slate-200">Positions</b> for crashes without their own coordinates use the place their crash site links to (marked approximate).</li>
            </ul>
          </details>
          <div className="grid gap-6 sm:grid-cols-2">
            <Section title="Airlines with the most crashes">
              <Bars rows={top(airlines).map((g) => ({ label: g.name, value: g.count, color: '#a855f7' }))} onClick={(name) => open({ kind: 'airline', name })} />
            </Section>
            <Section title="Most crashed aircraft">
              <Bars rows={top(aircraft).map((g) => ({ label: g.name, value: g.count, color: '#f59e0b' }))} onClick={(name) => open({ kind: 'aircraft', name })} />
            </Section>
            <Section title="Countries with the most crashes">
              <Bars rows={top(places.filter((g) => !isOcean(g.name))).map((g) => ({ label: g.name, value: g.count, color: '#22c55e' }))} onClick={(name) => open({ kind: 'place', name })} />
            </Section>
            <Section title="Oceans & seas with the most crashes">
              <Bars rows={top(places.filter((g) => isOcean(g.name))).map((g) => ({ label: g.name, value: g.count, color: '#06b6d4' }))} onClick={(name) => open({ kind: 'place', name })} />
            </Section>
            <Section title="Crashes by decade">
              <Bars rows={[...countBy(crashes, decade)].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: v }))} />
            </Section>
            <Section title="Deaths by decade">
              <Bars rows={[...countBy(crashes, decade, deaths)].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: v, color: '#ef4444' }))} />
            </Section>
            <Section title="Causes">
              <Bars rows={[...countBy(crashes, (c) => c.cause)].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: CAUSE_COLORS[k] }))} />
            </Section>
            <Section title="Phase of flight (where known)">
              <Bars rows={[...countBy(crashes, (c) => c.phase)].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: '#06b6d4' }))} />
              <h3 className="mb-2 mt-5 text-sm font-semibold text-white">Type of flight</h3>
              <Bars rows={[...countBy(crashes, (c) => c.category)].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: '#64748b' }))} />
            </Section>
          </div>
        </div>
      ) : tab === 'airlines' ? (
        <GroupTable groups={airlines} noun="Airline" plural="airlines" onOpen={(name) => open({ kind: 'airline', name })} />
      ) : tab === 'aircraft' ? (
        <GroupTable groups={aircraft} noun="Aircraft" plural="aircraft families" onOpen={(name) => open({ kind: 'aircraft', name })} />
      ) : tab === 'places' ? (
        <div>
          <div className="mb-3 inline-flex rounded-lg border border-slate-700 p-0.5 text-sm">
            {(['land', 'water'] as const).map((m) => (
              <button key={m} onClick={() => setPlaceMode(m)}
                className={`rounded-md px-3 py-1 font-semibold ${placeMode === m ? 'bg-blue-500/20 text-white' : 'text-slate-400'}`}>
                {m === 'land' ? 'Countries' : 'Oceans & seas'}
              </button>
            ))}
          </div>
          <GroupTable key={placeMode} groups={places.filter((g) => (placeMode === 'water') === isOcean(g.name))}
            noun={placeMode === 'land' ? 'Country' : 'Ocean or sea'} plural={placeMode === 'land' ? 'countries' : 'oceans & seas'} onOpen={(name) => open({ kind: 'place', name })} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tops.map((l) => (
            <section key={l.id} className="rounded-xl bg-slate-900 p-4">
              <h3 className="font-semibold text-white"><span className="mr-1.5">{l.emoji}</span>{l.title}</h3>
              <p className="mb-2 text-xs text-slate-500">{l.blurb}</p>
              <ol className="space-y-0.5">
                {l.items.map((it, i) => (
                  <li key={i}>
                    <button
                      disabled={!it.crash && !it.group}
                      onClick={() => (it.crash ? onSelect(it.crash.id) : it.group && open(it.group))}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left enabled:hover:bg-slate-800"
                    >
                      <span className="w-4 shrink-0 text-xs font-bold text-slate-500">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-100">{it.label}</span>
                        {it.sub && <span className="block truncate text-[11px] text-slate-500">{it.sub}</span>}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-300">{it.value}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}
