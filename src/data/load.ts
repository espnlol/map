import type { Crash } from '../types'
import { CRASHES as CURATED } from './crashes'

export interface Dataset {
  crashes: Crash[]
  /** Date the Wikipedia data was last refreshed */
  updated?: string
  /** True when the Wikipedia download failed and only the hand-written entries are shown */
  fallback?: boolean
}

const norm = (t: string) => t.replace(/_/g, ' ').trim().toLowerCase()

/**
 * Hand-written entries win for the things Wikipedia's data doesn't carry well
 * (a readable summary, a reviewed cause, flight phase, a tidy name and place);
 * Wikipedia wins for dates, casualty numbers, aircraft, airlines and routes.
 */
function merge(wiki: Crash, mine: Crash): Crash {
  return {
    ...mine,
    ...Object.fromEntries(Object.entries(wiki).filter(([, v]) => v !== undefined && v !== '')),
    id: mine.id,
    // keep the Wikipedia/Wikidata id too, so links that use it still open this crash
    wikiId: wiki.id,
    // my coordinates are exact; Wikipedia's are sometimes only the place the crash site links to
    ...(wiki.approx ? { lat: mine.lat, lng: mine.lng, approx: undefined } : {}),
    name: mine.name,
    summary: mine.summary,
    cause: mine.cause,
    phase: mine.phase ?? wiki.phase,
    category: mine.category,
    // Wikipedia's country uses the same naming as every other crash (today's
    // country names), so the stats group correctly; mine is only a fallback.
    country: wiki.country && wiki.country !== 'Unknown' ? wiki.country : mine.country,
    location: mine.location,
    region: wiki.region,
    video: mine.video,
    curated: true,
  }
}

export async function loadCrashes(): Promise<Dataset> {
  const curated = CURATED.map((c) => ({ ...c, curated: true }))
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/crashes.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { updated?: string; crashes: Crash[] }
    const byTitle = new Map(curated.map((c) => [norm(c.wiki ?? c.name), c]))
    const used = new Set<string>()
    const crashes = data.crashes.map((w) => {
      const mine = w.wiki ? byTitle.get(norm(w.wiki)) : undefined
      if (!mine) return w
      used.add(mine.id)
      return merge(w, mine)
    })
    for (const c of curated) if (!used.has(c.id)) crashes.push(c)
    return { crashes, updated: data.updated }
  } catch (err) {
    console.warn('Could not load the Wikipedia crash data; showing the hand-written list only.', err)
    return { crashes: curated, fallback: true }
  }
}
