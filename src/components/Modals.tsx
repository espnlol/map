import type { Crash } from '../types'
import { CAUSE_COLORS, formatDate } from '../styles'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-[#0f172a] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Bars({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-slate-400">{r.label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded bg-slate-800">
            <span className="block h-full rounded" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? '#3b82f6' }} />
          </span>
          <span className="w-12 shrink-0 text-right tabular-nums text-slate-200">{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function countBy<K extends string>(crashes: Crash[], key: (c: Crash) => K, value: (c: Crash) => number = () => 1) {
  const m = new Map<K, number>()
  for (const c of crashes) m.set(key(c), (m.get(key(c)) ?? 0) + value(c))
  return m
}

export function StatsModal({ crashes, total, onSelect, onClose }: {
  crashes: Crash[]
  total: number
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const deaths = crashes.reduce((n, c) => n + c.fatalities, 0)
  const survivors = crashes.reduce((n, c) => n + (c.survivors ?? 0), 0)
  const byCause = [...countBy(crashes, (c) => c.cause)].sort((a, b) => b[1] - a[1])
  const deathsByCause = countBy(crashes, (c) => c.cause, (c) => c.fatalities)
  const byDecade = [...countBy(crashes, (c) => `${c.date.slice(0, 3)}0s`)].sort((a, b) => a[0].localeCompare(b[0]))
  const byCountry = [...countBy(crashes, (c) => c.country.replace(/ \(.*\)$/, ''))].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const byPhase = [...countBy(crashes, (c) => c.phase)].sort((a, b) => b[1] - a[1])
  const deadliest = [...crashes].sort((a, b) => b.fatalities - a.fatalities).slice(0, 5)

  const tile = (label: string, value: string, tone = 'text-white') => (
    <div className="rounded-xl bg-slate-900 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )

  return (
    <Modal title="Statistics" onClose={onClose}>
      {crashes.length < total && <p className="mb-3 text-xs text-amber-400">Showing stats for the {crashes.length} accidents that match your current search and filters.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile('Accidents', crashes.length.toString())}
        {tile('Fatalities', deaths.toLocaleString(), 'text-red-400')}
        {tile('Survivors', survivors.toLocaleString(), 'text-emerald-400')}
        {tile('Countries', new Set(crashes.map((c) => c.country.replace(/ \(.*\)$/, ''))).size.toString())}
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Accidents by cause</h3>
          <Bars rows={byCause.map(([k, v]) => ({ label: k, value: v, color: CAUSE_COLORS[k] }))} />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Deaths by cause</h3>
          <Bars rows={byCause.map(([k]) => ({ label: k, value: deathsByCause.get(k) ?? 0, color: CAUSE_COLORS[k] }))} />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Accidents by decade</h3>
          <Bars rows={byDecade.map(([k, v]) => ({ label: k, value: v }))} />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-white">Phase of flight</h3>
          <Bars rows={byPhase.map(([k, v]) => ({ label: k, value: v, color: '#06b6d4' }))} />
          <h3 className="mb-2 mt-5 text-sm font-semibold text-white">Top countries</h3>
          <Bars rows={byCountry.map(([k, v]) => ({ label: k, value: v, color: '#a855f7' }))} />
        </section>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-white">Deadliest</h3>
        <ol className="divide-y divide-slate-800 rounded-xl bg-slate-900">
          {deadliest.map((c, i) => (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800">
                <span className="w-4 text-xs text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{c.name}</span>
                  <span className="block text-xs text-slate-500">{formatDate(c.date)}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-red-400">{c.fatalities}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </Modal>
  )
}

export function AboutModal({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <Modal title="About Black Box Atlas" onClose={onClose}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        <p>
          Black Box Atlas maps {count} of the most notable and well-documented aviation accidents, from the Hindenburg in 1937
          to 2025. Every detail is free: date, place, aircraft, airline, phase of flight, cause and what happened.
        </p>
        <p>
          Each crash has a <b className="text-white">Watch on YouTube</b> button and a <b className="text-white">Read the full article</b> button.
          If you find a video you like, pin it to the crash and it plays right in the panel (saved in your browser).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-white">Markers / Heatmap</b>: individual planes, or where accidents cluster.</li>
          <li><b className="text-white">Globe / Flat</b>: spin a 3D globe or use a flat map.</li>
          <li>Use the layers button (top right of the map) for satellite, terrain or dark maps.</li>
          <li>Press <kbd className="rounded bg-slate-800 px-1">/</kbd> to search and <kbd className="rounded bg-slate-800 px-1">Esc</kbd> to close.</li>
        </ul>
        <p className="text-xs text-slate-500">
          Map positions are approximate. Summaries are short overviews; follow the article link for the full investigation findings.
          Map tiles &copy; Esri and its data providers.
        </p>
      </div>
    </Modal>
  )
}

export function GetAppModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Get the app" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300">
        <p>Black Box Atlas installs straight from your browser. It's free, with no app store needed.</p>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">iPhone / iPad</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the <b>Share</b> button.</li>
            <li>Tap <b>Add to Home Screen</b>.</li>
          </ol>
        </div>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">Android</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Open this page in <b>Chrome</b>.</li>
            <li>Tap the <b>⋮</b> menu.</li>
            <li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li>
          </ol>
        </div>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">Computer</div>
          <p className="mt-1">In Chrome or Edge, click the install icon at the right end of the address bar.</p>
        </div>
      </div>
    </Modal>
  )
}
