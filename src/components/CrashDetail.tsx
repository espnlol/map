import { useEffect, useState } from 'react'
import type { Crash } from '../types'
import { CAUSE_COLORS, formatDate } from '../styles'
import { articleUrl, wikiSummary, youtubeId, youtubeSearchUrl, type WikiSummary } from '../links'
import { aircraftFamily, familiesOf } from '../stats'
import type { GroupRef } from './Stats'

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-white">{children}</dd>
    </div>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-slate-800 px-4 py-4 ${className}`}>{children}</div>
}

const LinkBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="text-left text-cyan-300 hover:underline">{children}</button>
)

export function CrashDetail({ crash: c, customLink, onCustomLink, onClose, onOpenGroup }: {
  crash: Crash
  customLink?: string
  onCustomLink: (url: string | null) => void
  onClose: () => void
  onOpenGroup: (g: GroupRef) => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [wiki, setWiki] = useState<WikiSummary | null>(null)
  useEffect(() => {
    setDraft('')
    setEditing(false)
    setWiki(null)
    let live = true
    if (c.wiki) wikiSummary(c.wiki).then((w) => { if (live) setWiki(w) })
    return () => { live = false }
  }, [c.id, c.wiki])

  const videoUrl = customLink || c.video
  const videoId = videoUrl ? youtubeId(videoUrl) : null
  const draftValid = youtubeId(draft) !== null
  // Big heading like "4805": the flight number if there is one, else the year.
  const flightNo = c.flight?.split('/')[0].trim()
  const headline = flightNo ? flightNo.replace(/^[A-Z]{2,3}\s*(?=\d)|^[A-Z]\d\s*(?=\d)|^\d[A-Z]\s*(?=\d)/, '') || flightNo : c.date.slice(0, 4)
  const operators = c.operators ?? (c.operator ? [c.operator] : [])
  const types = c.aircraftTypes ?? (c.aircraft ? [c.aircraft] : [])
  const families = familiesOf(c)
  // the family each listed type belongs to (same order when the infobox gave one link per type)
  const familyFor = (t: string, i: number) => (families.length === types.length ? families[i] : families.find((f) => aircraftFamily(t) === f) ?? families[0] ?? aircraftFamily(t))
  const atSea = !!c.region
  const longText = c.curated ? c.summary : wiki?.extract
  const oneLiner = c.curated ? undefined : c.summary

  return (
    <div className="flex h-full flex-col">
      {wiki?.image && (
        <a href={articleUrl(c)} target="_blank" rel="noopener noreferrer" className="block bg-black">
          <img src={wiki.image} alt="" className="max-h-44 w-full object-cover opacity-90" loading="lazy" />
        </a>
      )}
      <Section className="relative pr-12">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="text-2xl font-bold tracking-tight text-white">{headline}</div>
        <a href={articleUrl(c)} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold text-cyan-400 hover:underline">
          {c.name}{c.flight && !c.name.includes(c.flight) ? ` — ${c.flight}` : ''}
        </a>
        {operators.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-1 text-sm text-slate-300">
            {operators.map((o, i) => (
              <span key={o}>
                <LinkBtn onClick={() => onOpenGroup({ kind: 'airline', name: o })}>{o}</LinkBtn>{i < operators.length - 1 ? ' &' : ''}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 text-xs text-slate-400">{c.date.slice(0, 4)}{c.kind ? ` · ${c.kind}` : ''}</div>
      </Section>

      <Section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Fact label="Date">{c.date.length === 10 ? formatDate(c.date) : c.date}</Fact>
          <Fact label={atSea && c.country === c.region ? 'Ocean / sea' : 'Incident country'}>
            <LinkBtn onClick={() => onOpenGroup({ kind: 'place', name: c.region ?? c.country })}>{c.region && c.region !== c.country ? `${c.country} (${c.region})` : c.country}</LinkBtn>
          </Fact>
          <Fact label="Aircraft">
            {types.length ? types.map((t, i) => (
              <span key={t}>
                <LinkBtn onClick={() => onOpenGroup({ kind: 'aircraft', name: familyFor(t, i) })}>{t}</LinkBtn>{i < types.length - 1 ? ', ' : ''}
              </span>
            )) : '—'}
          </Fact>
          <Fact label="Registration">{c.registration ?? '—'}</Fact>
          <Fact label="Flight phase">{c.phase ?? '—'}</Fact>
          <Fact label="Flight type">{c.category}</Fact>
          <Fact label="Fatalities"><span className="text-red-400">{c.fatalities?.toLocaleString() ?? 'Not recorded'}</span></Fact>
          <Fact label="Survivors"><span className="text-emerald-400">{c.survivors?.toLocaleString() ?? '—'}</span></Fact>
          {c.aboard != null && <Fact label="Aboard">{c.aboard.toLocaleString()}</Fact>}
          {c.injured != null && c.injured > 0 && <Fact label="Injured">{c.injured.toLocaleString()}</Fact>}
          {(c.from || c.to) && (
            <Fact label="Route" wide>
              {c.from?.name ?? '?'} <span className="text-slate-500">→</span> {c.to?.name ?? '?'}
            </Fact>
          )}
          {c.location && <Fact label="Crash site" wide>{c.location}</Fact>}
          {c.approx && (
            <p className="col-span-2 -mt-2 text-[11px] text-amber-300/80">
              📍 Approximate position: Wikipedia has no exact coordinates for this crash, so it’s shown at the place its crash site names.
            </p>
          )}
        </dl>
      </Section>

      <Section>
        <div className="text-xs text-slate-400">Cause</div>
        <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
          {c.cause}
        </div>
        {oneLiner && <p className="mt-2 text-sm font-medium text-slate-200">{oneLiner}</p>}
        {longText && <p className="mt-2 text-sm leading-relaxed text-slate-300">{longText}</p>}
        {!c.curated && wiki?.extract && <p className="mt-2 text-[11px] text-slate-500">From Wikipedia (CC BY-SA).</p>}
      </Section>

      <Section>
        <button onClick={() => setSourcesOpen(!sourcesOpen)} className="flex items-center gap-1.5 text-sm text-cyan-400">
          <span className={`inline-block text-[10px] transition-transform ${sourcesOpen ? '' : '-rotate-90'}`}>▼</span>
          Sources for this crash
        </button>
        {sourcesOpen && (
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><a className="text-cyan-400 hover:underline" href={articleUrl(c)} target="_blank" rel="noopener noreferrer">📰 Wikipedia article</a></li>
            <li><a className="text-cyan-400 hover:underline" href={youtubeSearchUrl(c)} target="_blank" rel="noopener noreferrer">▶ YouTube videos about it</a></li>
            {videoUrl && <li><a className="text-cyan-400 hover:underline" href={videoUrl} target="_blank" rel="noopener noreferrer">📌 Your pinned video</a></li>}
          </ul>
        )}
      </Section>

      {videoId && (
        <Section>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={`${c.name} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Section>
      )}

      <div className="space-y-3 px-4 py-4">
        <a
          href={videoUrl || youtubeSearchUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>
          {videoUrl ? 'Watch the video' : 'Watch on YouTube'}
        </a>
        <a
          href={articleUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
        >
          📰 Read the full article
        </a>
        {operators.length > 0 && (
          <button
            onClick={() => onOpenGroup({ kind: 'airline', name: operators[0] })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            📊 {operators[0]} crash stats
          </button>
        )}

        <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
          {customLink && !editing ? (
            <div className="flex items-center justify-between gap-2">
              <span>📌 Your video is pinned to this crash.</span>
              <span className="flex shrink-0 gap-3">
                <button className="text-cyan-400 hover:underline" onClick={() => { setDraft(customLink); setEditing(true) }}>Change</button>
                <button className="text-red-400 hover:underline" onClick={() => onCustomLink(null)}>Remove</button>
              </span>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (draftValid) { onCustomLink(draft.trim()); setEditing(false); setDraft('') } }}
              className="space-y-2"
            >
              <label className="block">Found a good video? Paste its YouTube link to pin it here (saved in this browser).</label>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <button disabled={!draftValid} className="rounded-md bg-blue-600 px-3 font-medium text-white disabled:opacity-40">Pin</button>
              </div>
              {draft && !draftValid && <p className="text-amber-400">That doesn't look like a YouTube video link.</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
