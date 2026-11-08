import { useEffect, useRef, useState } from 'react'
import { findPhotos, hiddenPhotos, hidePhoto, morePhotoLinks, type Photo } from '../lib/photos'

interface Props {
  hex: string
  registration?: string
  model?: string
  demo: boolean
}

export default function PhotoGallery({ hex, registration, model, demo }: Props) {
  const [found, setPhotos] = useState<Photo[] | undefined>(undefined)
  const hidden = hiddenPhotos.use()
  const photos = found?.filter((p) => !hidden.includes(p.link))
  const [index, setIndex] = useState(0)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
    if (demo) return setPhotos([])
    let stop = false
    setPhotos(undefined)
    findPhotos(hex, registration, model).then((p) => !stop && setPhotos(p))
    return () => {
      stop = true
    }
  }, [hex, registration, model, demo])

  const links = morePhotoLinks(registration, hex, model)
  const more = (
    <div className="flex flex-wrap gap-1.5">
      <span className="self-center text-[10px] uppercase tracking-wider text-slate-500">More photos</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-sky-300 ring-1 ring-slate-700">
          {l.label} ↗
        </a>
      ))}
    </div>
  )

  if (photos === undefined)
    return (
      <div className="space-y-1.5">
        <div className="aspect-[16/9] w-full animate-pulse rounded-lg bg-slate-800" aria-label="Looking for photos" />
      </div>
    )

  if (photos.length === 0)
    return (
      <div className="space-y-1.5">
        <div className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-lg bg-slate-800/60 px-3 text-center text-xs text-slate-500">
          <span className="text-3xl opacity-40">✈</span>
          {demo ? 'Photos appear for real aircraft in LIVE mode' : `No photos found${model ? ` of this ${model}` : ''}. Try Google below.`}
        </div>
        {!demo && more}
      </div>
    )

  const onScroll = () => {
    const el = strip.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: 'smooth' })
  const cur = photos[Math.min(index, photos.length - 1)]

  return (
    <div className="space-y-1.5">
      <figure className="relative overflow-hidden rounded-lg bg-slate-800">
        <div ref={strip} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
          {photos.map((p, i) => (
            <a key={p.link + i} href={p.link} target="_blank" rel="noreferrer" className="w-full shrink-0 snap-center">
              <img
                src={p.src}
                alt={`Photo ${i + 1} of ${registration ?? model ?? hex}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="aspect-[16/9] w-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget
                  if (p.fallback && img.src !== p.fallback) img.src = p.fallback
                }}
              />
            </a>
          ))}
        </div>
        {!cur.exact && (
          <span className="absolute left-2 top-2 rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
            Same model, not this exact plane
          </span>
        )}
        {cur.width < (strip.current?.clientWidth ?? 380) * Math.min(window.devicePixelRatio || 1, 2) * 0.9 && (
          <a
            href={cur.link}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-8 right-2 rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200"
          >
            Preview size · tap for full photo ↗
          </a>
        )}
        {photos.length > 1 && (
          <>
            <span className="absolute right-2 top-2 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {index + 1} / {photos.length}
            </span>
            <button
              onClick={() => go(Math.max(0, index - 1))}
              className="absolute left-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-slate-900/70 text-lg md:block"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={() => go(Math.min(photos.length - 1, index + 1))}
              className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-slate-900/70 text-lg md:block"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
        <figcaption className="truncate px-2 py-1 text-[10px] text-slate-400">
          Photo © {cur.credit} ·{' '}
          <a href={cur.link} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            {cur.source}
          </a>
          {photos.length > 1 && <span className="text-slate-500"> · swipe for more</span>}
          {' · '}
          <button onClick={() => (hidePhoto(cur.link), setIndex(0), strip.current?.scrollTo({ left: 0 }))} className="text-slate-400 underline hover:text-red-300">
            Wrong photo?
          </button>
        </figcaption>
      </figure>
      {more}
    </div>
  )
}
