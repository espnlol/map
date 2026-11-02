import { CATEGORIES, categoryKey } from '../lib/categories'
import { SPECIAL_GROUPS } from '../lib/special'
import type { Aircraft } from '../types'

interface Props {
  aircraft: Aircraft[]
  active: Set<string>
  onChange: (next: Set<string>) => void
}

export default function CategoryFilter({ aircraft, active, onChange }: Props) {
  const counts = new Map<string, number>()
  for (const a of aircraft) {
    const k = categoryKey(a.category)
    counts.set(k, (counts.get(k) ?? 0) + 1)
    for (const s of a.special) counts.set(s.tag, (counts.get(s.tag) ?? 0) + 1)
  }
  const all = active.size === 0
  const toggle = (code: string) => {
    const next = new Set(active)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange(next)
  }
  return (
    <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(new Set())}
        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
          all ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
        }`}
      >
        All <span className="opacity-70">{aircraft.length}</span>
      </button>
      {CATEGORIES.map((c) => {
        const n = counts.get(c.code) ?? 0
        if (n === 0 && !active.has(c.code)) return null
        const on = active.has(c.code)
        return (
          <button
            key={c.code}
            title={c.description}
            onClick={() => toggle(c.code)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
              on ? 'bg-slate-100 text-slate-900 ring-white' : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.short} <span className="opacity-60">{n}</span>
          </button>
        )
      })}
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Who's flying</span>
      {SPECIAL_GROUPS.map((g) => {
        const n = counts.get(g.tag) ?? 0
        const on = active.has(g.tag)
        return (
          <button
            key={g.tag}
            title={g.description}
            onClick={() => toggle(g.tag)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
              on ? 'bg-slate-100 text-slate-900 ring-white' : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
            }`}
          >
            <span className="h-2 w-2 rotate-45" style={{ background: g.color }} />
            {g.label} <span className="opacity-60">{n}</span>
          </button>
        )
      })}
    </div>
    </div>
  )
}
