import { useState } from 'react'
import { TEAM_PRESETS, normalizeIdent, refreshTeams, removeTeam, teamHistory, teamStatus, teams, teamsRemoved, type PlaneStatus, type Team } from '../lib/teams'
import { fmtClock, fmtRelative } from '../lib/format'

const STATE_STYLE = {
  airborne: ['In the air', 'bg-emerald-500 text-slate-950'],
  ground: ['On the ground', 'bg-amber-400 text-slate-950'],
  offline: ['Not broadcasting', 'bg-slate-700 text-slate-200'],
} as const

function when(ms?: number) {
  if (!ms) return null
  const d = new Date(ms)
  const sameDay = d.toDateString() === new Date().toDateString()
  return `${sameDay ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' '}${fmtClock(ms)} (${fmtRelative(ms)})`
}

export default function TeamsPanel({ onShow }: { onShow: (s: PlaneStatus) => void }) {
  const list = teams.use()
  const status = teamStatus.use()
  const history = teamHistory.use()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [idents, setIdents] = useState('')

  const add = (t: Omit<Team, 'id'>) => {
    teams.set((all) => [...all, { ...t, id: `${Date.now()}` }])
    teamsRemoved.set((r) => {
      const { [t.name.toLowerCase()]: _, ...rest } = r
      return rest
    })
    setTimeout(refreshTeams, 0)
  }
  const remove = removeTeam
  const presets = TEAM_PRESETS.filter((p) => !list.some((t) => t.name === p.name))

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-slate-400">
        Follow a team's plane anywhere in the world by its <b className="text-slate-200">tail number</b> (like N36NE) or{' '}
        <b className="text-slate-200">callsign</b>. SkyWatch checks every minute while it's open and records takeoffs and landings.
      </p>

      {list.map((t) => (
        <section key={t.id} className="rounded-lg bg-slate-800/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-semibold">{t.name}</h3>
            {t.league && <span className="rounded bg-slate-700 px-1.5 text-[10px] font-semibold uppercase">{t.league}</span>}
            <button onClick={() => remove(t.id)} className="ml-auto text-xs text-slate-500 hover:text-red-400">
              Remove
            </button>
          </div>
          <ul className="space-y-2">
            {t.idents.map((id) => {
              const s = status[id]
              const h = history[id] ?? {}
              const [label, style] = STATE_STYLE[s?.state ?? 'offline']
              return (
                <li key={id} className="rounded-md bg-slate-900/60 p-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{id}</span>
                    {s ? <span className={`rounded px-1.5 text-[10px] font-bold uppercase ${style}`}>{label}</span> : <span className="text-slate-500">checking…</span>}
                    {s?.callsign && s.callsign !== id && <span className="font-mono text-slate-300">as {s.callsign}</span>}
                    {s?.lat != null && (
                      <button onClick={() => onShow(s)} className="ml-auto rounded bg-sky-500 px-2 py-0.5 font-semibold text-slate-950">
                        Show on map
                      </button>
                    )}
                  </div>
                  {s?.model && <div className="mt-1 text-slate-400">{s.model}</div>}
                  {s?.state === 'airborne' && (
                    <div className="mt-1 text-slate-300">
                      {s.altitude != null ? `${s.altitude.toLocaleString()} ft` : ''}
                      {s.speed ? ` · ${Math.round(s.speed)} kt` : ''}
                      {s.from || s.to ? ` · ${s.from ?? '?'} → ${s.to ?? '?'}` : ''}
                    </div>
                  )}
                  <div className="mt-1 space-y-0.5 text-slate-500">
                    {h.lastTakeoff && <div>🛫 Took off {when(h.lastTakeoff)}</div>}
                    {h.lastLanding && <div>🛬 Landed {when(h.lastLanding)}</div>}
                    {!h.lastTakeoff && !h.lastLanding && h.lastSeenAt && s?.state === 'offline' && (
                      <div>Last seen {when(h.lastSeenAt)}{h.lastTo ? `, heading for ${h.lastTo}` : ''}</div>
                    )}
                    {s?.state === 'offline' && !h.lastSeenAt && <div>Not seen yet. Probably parked with its transponder off.</div>}
                    {s?.error && <div className="text-red-300">Couldn't check: {s.error}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {presets.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Known team planes</div>
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => add({ name: p.name, league: p.league, idents: p.idents })}
              className="w-full rounded-lg bg-slate-800/60 p-2.5 text-left ring-1 ring-slate-700 hover:bg-slate-800"
            >
              <div className="text-sm font-semibold">+ {p.name}</div>
              <div className="text-xs text-slate-400">
                {p.idents.join(', ')} · {p.note}
              </div>
            </button>
          ))}
        </div>
      )}

      {adding ? (
        <form
          className="space-y-2 rounded-lg bg-slate-800/60 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            const ids = idents.split(/[,\s]+/).map(normalizeIdent).filter(Boolean)
            if (!name.trim() || ids.length === 0) return
            add({ name: name.trim(), idents: ids })
            setName('')
            setIdents('')
            setAdding(false)
          }}
        >
          <input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name, e.g. Dallas Cowboys"
            className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm ring-1 ring-slate-700 placeholder:text-slate-500"
          />
          <input
            id="team-idents"
            value={idents}
            onChange={(e) => setIdents(e.target.value)}
            placeholder="Tail numbers or callsigns, e.g. N123AB, N456CD"
            className="w-full rounded-md bg-slate-900 px-3 py-1.5 font-mono text-sm uppercase ring-1 ring-slate-700 placeholder:normal-case placeholder:text-slate-500"
          />
          <p className="text-[11px] text-slate-500">
            Teams usually fly charters, so fans and news reports are the best source for tail numbers. The Owner tab on any
            plane shows its tail number too.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-md bg-sky-500 py-1.5 text-sm font-semibold text-slate-950">
              Follow
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-400 ring-1 ring-slate-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-lg py-2.5 text-sm font-semibold text-sky-300 ring-1 ring-slate-700 hover:bg-slate-800/60">
          + Follow a team
        </button>
      )}
    </div>
  )
}
