import { useEffect, useState } from 'react'
import type { Crash } from '../types'
import { CAUSE_COLORS, formatDate } from '../styles'
import { articleUrl, youtubeId, youtubeSearchUrl } from '../links'

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200">{value}</dd>
    </div>
  )
}

export function CrashDetail({ crash: c, customLink, onCustomLink, onClose }: {
  crash: Crash
  customLink?: string
  onCustomLink: (url: string | null) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  useEffect(() => { setDraft(''); setEditing(false) }, [c.id])

  const videoUrl = customLink || c.video
  const videoId = videoUrl ? youtubeId(videoUrl) : null
  const draftValid = youtubeId(draft) !== null

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1100] max-h-[70%] overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[26rem] md:rounded-2xl">
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 p-4">
        <div className="min-w-0">
          <span
            className="mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-950"
            style={{ background: CAUSE_COLORS[c.cause] }}
          >
            {c.cause}
          </span>
          <h2 className="text-lg font-semibold leading-snug">{c.name}</h2>
          <p className="text-xs text-slate-400">{formatDate(c.date)} · {c.location}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-900 p-3">
          <Fact label="Fatalities" value={<span className="text-base font-semibold text-red-400">{c.fatalities.toLocaleString()}</span>} />
          <Fact label="Survivors" value={<span className="text-base font-semibold text-emerald-400">{c.survivors ?? '—'}</span>} />
          {c.flight && <Fact label="Flight" value={c.flight} />}
          <Fact label="Operator" value={c.operator} />
          <Fact label="Aircraft" value={c.aircraft} />
          <Fact label="Phase of flight" value={c.phase} />
          <Fact label="Type" value={c.category} />
        </div>

        <p className="text-sm leading-relaxed text-slate-300">{c.summary}</p>

        {videoId && (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={`${c.name} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <a
            href={videoUrl || youtubeSearchUrl(c)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>
            {videoUrl ? 'Watch video' : 'Find on YouTube'}
          </a>
          <a
            href={articleUrl(c)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            📰 Read article
          </a>
        </div>

        <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">
          {customLink && !editing ? (
            <div className="flex items-center justify-between gap-2">
              <span>Using your saved video link.</span>
              <span className="flex gap-3">
                <button className="text-sky-400 hover:underline" onClick={() => { setDraft(customLink); setEditing(true) }}>Change</button>
                <button className="text-red-400 hover:underline" onClick={() => onCustomLink(null)}>Remove</button>
              </span>
            </div>
          ) : editing || !customLink ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (draftValid) { onCustomLink(draft.trim()); setEditing(false); setDraft('') } }}
              className="space-y-2"
            >
              <label className="block">Found a good video? Paste its YouTube link to pin it to this crash (saved in this browser):</label>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                />
                <button disabled={!draftValid} className="rounded bg-sky-600 px-3 font-medium text-white disabled:opacity-40">Save</button>
              </div>
              {draft && !draftValid && <p className="text-amber-400">That doesn't look like a YouTube video link.</p>}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
