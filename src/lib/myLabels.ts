import { createStore } from './store'
import type { SpecialTag } from './special'

/**
 * Corrections you make yourself, which beat SkyWatch's own guesses.
 * Keyed by tail number (or transponder code when there isn't one).
 */
export interface MyLabel {
  /** The full set of groups (Military / Gov, Police, Medical, News, Sports). [] = none. */
  groups?: SpecialTag[]
  /** Size / kind category code, like A5 (Heavy) or B2 (Balloon). */
  category?: string
  /** ICAO type code, like B744 (Boeing 747-400). */
  typeCode?: string
}

// Older versions stored just 'news' | 'police' | 'medical' | 'none'.
type Stored = MyLabel | 'news' | 'police' | 'medical' | 'none'

export const myLabels = createStore<Record<string, Stored>>('skywatch.myLabels', {})

export const labelKey = (hex: string, registration?: string) =>
  registration ? `reg:${registration.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : `hex:${hex.replace(/^~/, '').toLowerCase()}`

function normalize(v: Stored | undefined): MyLabel | undefined {
  if (!v) return undefined
  if (typeof v === 'string') return { groups: v === 'none' ? [] : [v] }
  return v
}

export const myLabelFrom = (all: Record<string, Stored>, hex: string, registration?: string): MyLabel | undefined =>
  normalize(all[labelKey(hex, registration)] ?? all[labelKey(hex)])

export const myLabelFor = (hex: string, registration?: string) => myLabelFrom(myLabels.get(), hex, registration)

/** Change part of a label. Pass undefined for a field to go back to SkyWatch's guess for it. */
export function setMyLabel(hex: string, registration: string | undefined, patch: Partial<MyLabel>) {
  const key = labelKey(hex, registration)
  myLabels.set((all) => {
    const next = { ...all }
    const cur: MyLabel = { ...normalize(next[key] ?? next[labelKey(hex)]) }
    delete next[labelKey(hex)]
    for (const [k, v] of Object.entries(patch) as [keyof MyLabel, unknown][]) {
      if (v === undefined) delete cur[k]
      else (cur as Record<string, unknown>)[k] = v
    }
    if (Object.keys(cur).length) next[key] = cur
    else delete next[key]
    return next
  })
}

export function clearMyLabel(hex: string, registration?: string) {
  myLabels.set((all) => {
    const next = { ...all }
    delete next[labelKey(hex, registration)]
    delete next[labelKey(hex)]
    return next
  })
}
