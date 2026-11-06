/** US airport delays from the FAA's National Airspace System status feed. */
import { upstream } from './upstream'

export interface FaaItem {
  airport: string
  kind: string // Ground stop, Ground delay program, Delay, Closure, ...
  reason: string
  detail: string
}

const KIND: Record<string, string> = {
  Ground_Stop_List: 'Ground stop',
  Ground_Delay_List: 'Ground delay program',
  Arrival_Departure_Delay_List: 'Delays',
  Airport_Closure_List: 'Closure',
  Airspace_Flow_List: 'Airspace flow program',
  Deicing_List: 'De-icing',
}

let cache: { at: number; items: FaaItem[] } | null = null

export async function fetchFaaDisruptions(): Promise<FaaItem[] | null> {
  if (cache && Date.now() - cache.at < 2 * 60 * 1000) return cache.items
  try {
    const res = await fetch(`${upstream('faa')}/api/airport-status-information`, { headers: { Accept: 'application/xml' } })
    if (!res.ok) return null
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
    const items: FaaItem[] = []
    for (const arpt of Array.from(doc.getElementsByTagName('ARPT'))) {
      const entry = arpt.parentElement!
      const list = entry.parentElement
      const kind = (list && KIND[list.tagName]) || list?.tagName?.replace(/_/g, ' ') || 'Notice'
      const get = (tag: string) => entry.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
      const bits: string[] = []
      if (get('Avg')) bits.push(`average delay ${get('Avg')}`)
      if (get('Max')) bits.push(`up to ${get('Max')}`)
      for (const ad of Array.from(entry.getElementsByTagName('Arrival_Departure'))) {
        const type = ad.getAttribute('Type') ?? ''
        const min = ad.getElementsByTagName('Min')[0]?.textContent?.trim()
        const max = ad.getElementsByTagName('Max')[0]?.textContent?.trim()
        const trend = ad.getElementsByTagName('Trend')[0]?.textContent?.trim()
        bits.push(`${type.toLowerCase()} delays ${min ?? ''}${max ? `–${max}` : ''}${trend ? ` (${trend.toLowerCase()})` : ''}`.trim())
      }
      if (get('End_Time')) bits.push(`until ${get('End_Time')}`)
      if (get('Reopen')) bits.push(`reopens ${get('Reopen')}`)
      items.push({ airport: arpt.textContent?.trim() ?? '?', kind, reason: get('Reason'), detail: bits.join(' · ') })
    }
    cache = { at: Date.now(), items }
    return items
  } catch {
    return null
  }
}
