import { useEffect, useState } from 'react'
import type { Crash } from '../types'
import { CAUSE_COLORS, formatDate } from '../styles'
import { articleUrl, youtubeId, youtubeSearchUrl } from '../links'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-white">{children}</dd>
    </div>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-slate-800 px-4 py-4 ${className}`}>{children}</div>
}

export function CrashDetail({ crash: c, customLink, onCustomLink, onClose }: {
  crash: Crash
  customLink?: string
  onCustomLink: (url: string | null) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  useEffect(() => { setDraft(''); setEditing(false) }, [c.id])

  const videoUrl = customLink || c.video
  const videoId = videoUrl ? youtubeId(videoUrl) : null
  const draftValid = youtubeId(draft) !== null
  // Big heading like "4805": the flight number if there is one, else the year.
  const headline = c.flight ? c.flight.split('/')[0].replace(/^[A-Z0-9]{2,3}\s+/, '').trim() : c.date.slice(0, 4)

  return (
    <div className="flex h-full flex-col">
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
          {c.name}{c.flight ? ` — ${c.flight}` : ''}
        </a>
        <div className="mt-1 text-sm text-slate-300">{c.operator}</div>
        <div className="mt-2 text-xs text-slate-400">{c.date.slice(0, 4)}</div>
      </Section>

      <Section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Fact label="Date">{formatDate(c.date)}</Fact>
          <Fact label="Incident country">{c.country}</Fact>
          <Fact label="Aircraft">{c.aircraft}</Fact>
          <Fact label="Operator">{c.operator}</Fact>
          <Fact label="Flight phase">{c.phase}</Fact>
          <Fact label="Flight type">{c.category}</Fact>
          <Fact label="Fatalities"><span className="text-red-400">{c.fatalities.toLocaleString()}</span></Fact>
          <Fact label="Survivors"><span className="text-emerald-400">{c.survivors ?? '—'}</span></Fact>
          <div className="col-span-2"><Fact label="Location">{c.location}</Fact></div>
        </dl>
      </Section>

      <Section>
        <div className="text-xs text-slate-400">Cause</div>
        <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAUSE_COLORS[c.cause] }} />
          {c.cause}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.summary}</p>
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
