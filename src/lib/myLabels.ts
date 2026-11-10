import { createStore } from './store'

/** Labels you set yourself, which beat SkyWatch's own guesses. Keyed by tail number (or transponder code). */
export type MyLabel = 'news' | 'police' | 'medical' | 'none'

export const myLabels = createStore<Record<string, MyLabel>>('skywatch.myLabels', {})

export const labelKey = (hex: string, registration?: string) =>
  registration ? `reg:${registration.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : `hex:${hex.replace(/^~/, '').toLowerCase()}`

export const myLabelFor = (hex: string, registration?: string): MyLabel | undefined =>
  myLabels.get()[labelKey(hex, registration)] ?? myLabels.get()[labelKey(hex)]

/** Set a label, or pass null to go back to SkyWatch's own guess. */
export function setMyLabel(hex: string, registration: string | undefined, label: MyLabel | null) {
  const key = labelKey(hex, registration)
  myLabels.set((all) => {
    const next = { ...all }
    if (label) next[key] = label
    else delete next[key]
    return next
  })
}
