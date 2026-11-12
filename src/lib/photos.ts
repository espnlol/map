/**
 * Photos of an aircraft from several free sources, best first:
 *  - Planespotters.net (by transponder code, then registration)
 *  - airport-data.com (by transponder code and registration)
 *  - Wikimedia Commons (free-licensed photos whose title has the registration)
 *  - Wikipedia's lead photo of the model, as a "same model" fallback
 * Each photo keeps its credit and a link to where it came from.
 */
import { upstream } from './upstream'
import { createStore } from './store'

/** Photos you marked as wrong (by link), never shown again on this device. */
export const hiddenPhotos = createStore<string[]>('skywatch.hiddenPhotos', [])
export const hidePhoto = (link: string) => hiddenPhotos.set((h) => (h.includes(link) ? h : [...h, link].slice(-500)))

/** Words that show a picture or article is about aviation. */
const AVIATION =
  /aircraft|airplane|aeroplane|airliner|airline|airport|airfield|aviation|helicopter|rotorcraft|jet\b|jetliner|airship|glider|biplane|seaplane|turboprop|fighter|bomber|tanker|air force|navy|boeing|airbus|cessna|piper|embraer|bombardier|gulfstream|beechcraft|cirrus|dassault|lockheed|sikorsky|bell \d|eurocopter|leonardo|agusta|robinson|pilatus|de havilland|mcdonnell|douglas|antonov|tupolev|ilyushin|sukhoi|mitsubishi|atr\b|saab|fokker|learjet|diamond|mooney|daher|textron|spotting|registration|\bflight\b|cockpit|runway|tail number/i

export interface Photo {
  src: string // best size to show
  thumb: string
  fallback?: string // smaller version if the big one fails to load
  link: string
  credit: string
  source: 'Planespotters' | 'airport-data.com' | 'Wikimedia Commons' | 'Wikipedia'
  exact: boolean // a photo of this very airframe, not just the model
  /** Roughly how many pixels wide the image is, to show the sharpest first. */
  width: number
}

const cache = new Map<string, Promise<Photo[]>>()

const normReg = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, '')

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

async function planespotters(hex: string, reg?: string): Promise<Photo[]> {
  type R = { photos?: { thumbnail?: { src: string }; thumbnail_large?: { src: string }; link: string; photographer: string }[] }
  const base = upstream('planespotters')
  const out: Photo[] = []
  for (const url of [`${base}/pub/photos/hex/${hex}`, reg ? `${base}/pub/photos/reg/${encodeURIComponent(reg)}` : null]) {
    if (!url) continue
    const j = await getJson<R>(url)
    for (const p of j?.photos ?? []) {
      const big = p.thumbnail_large ?? p.thumbnail
      if (!big || out.some((o) => o.link === p.link)) continue
      // Planespotters only lets apps show its preview size; the full photo is on their site.
      out.push({ src: big.src, thumb: (p.thumbnail ?? big).src, link: p.link, credit: p.photographer, source: 'Planespotters', exact: true, width: p.thumbnail_large ? 420 : 200 })
    }
    if (out.length) break
  }
  return out
}

async function airportData(hex: string, reg?: string): Promise<Photo[]> {
  type R = { data?: { image: string; link: string; photographer?: string }[] }
  const base = upstream('airportdata')
  const out: Photo[] = []
  for (const q of [`m=${hex.toUpperCase()}`, reg ? `r=${encodeURIComponent(reg)}` : null]) {
    if (!q) continue
    const j = await getJson<R>(`${base}/api/ac_thumb.json?${q}&n=6`)
    for (const p of j?.data ?? []) {
      if (!p.image || out.some((o) => o.thumb === p.image)) continue
      // The API only gives a ~150px thumbnail; the full photo (about 1500px wide)
      // is image.airport-data.com/aircraft/<photo id>.jpg.
      const id = p.link?.match(/(\d{6,})/)?.[1] ?? p.image.match(/(\d{6,})\.jpg/)?.[1]
      out.push({
        src: id ? `https://image.airport-data.com/aircraft/${id}.jpg` : p.image,
        fallback: p.image,
        thumb: p.image,
        link: p.link,
        credit: p.photographer || 'airport-data.com',
        source: 'airport-data.com',
        exact: true,
        width: 1000,
      })
    }
  }
  return out
}

interface WikiPage {
  title: string
  imageinfo?: { url: string; thumburl?: string; thumbwidth?: number; width?: number; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[]
}

const stripHtml = (s?: string) => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** Matches the registration as its own word in a title (N123AB, N-123AB, N_123AB), not inside other text like "DSCN1234". */
function regPattern(reg: string): RegExp {
  const chars = normReg(reg).split('').map((c) => c.replace(/[^A-Z0-9]/g, ''))
  return new RegExp(`(^|[^A-Z0-9])${chars.join('[-_ ]?')}($|[^A-Z0-9])`)
}

async function commons(reg?: string): Promise<Photo[]> {
  // Very short registrations match too many unrelated files.
  if (!reg || normReg(reg).length < 4) return []
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `"${reg}"`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600',
  })
  const j = await getJson<{ query?: { pages?: Record<string, WikiPage> } }>(`https://commons.wikimedia.org/w/api.php?${params}`)
  const re = regPattern(reg)
  return Object.values(j?.query?.pages ?? {})
    .filter((p) => {
      if (!/\.(jpe?g|png|webp)$/i.test(p.title)) return false
      const name = p.title.replace(/^File:/i, '').replace(/\.[a-z]+$/i, '').toUpperCase()
      if (!re.test(name)) return false
      // The file must also look like an aviation photo (title, description or categories).
      const meta = p.imageinfo?.[0]?.extmetadata
      const about = `${p.title} ${stripHtml(meta?.ImageDescription?.value)} ${stripHtml(meta?.Categories?.value)} ${stripHtml(meta?.ObjectName?.value)}`
      return AVIATION.test(about)
    })
    .slice(0, 6)
    .map((p) => {
      const ii = p.imageinfo![0]
      const artist = stripHtml(ii.extmetadata?.Artist?.value) || 'Wikimedia Commons'
      const lic = stripHtml(ii.extmetadata?.LicenseShortName?.value)
      return {
        src: ii.thumburl ?? ii.url,
        thumb: ii.thumburl ?? ii.url,
        link: ii.descriptionurl,
        credit: lic ? `${artist} (${lic})` : artist,
        source: 'Wikimedia Commons' as const,
        exact: true,
        width: ii.thumbwidth ?? ii.width ?? 960,
      }
    })
}

async function modelPhoto(model?: string): Promise<Photo[]> {
  if (!model) return []
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${model} aircraft`,
    gsrlimit: '5',
    prop: 'pageimages|info|description',
    piprop: 'thumbnail',
    pithumbsize: '1600',
    inprop: 'url',
  })
  type Page = { title: string; fullurl: string; index?: number; description?: string; thumbnail?: { source: string } }
  const j = await getJson<{ query?: { pages?: Record<string, Page> } }>(`https://en.wikipedia.org/w/api.php?${params}`)
  // Take the best-ranked result that is actually about an aircraft, not a person or place.
  const maker = model.split(' ')[0].toLowerCase()
  const page = Object.values(j?.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .find((p) => p.thumbnail && (AVIATION.test(p.description ?? '') || (!p.description && p.title.toLowerCase().includes(maker) && AVIATION.test(p.title))))
  if (!page?.thumbnail) return []
  return [{ src: page.thumbnail.source, thumb: page.thumbnail.source, link: page.fullurl, credit: `Wikipedia: ${page.title}`, source: 'Wikipedia', exact: false, width: 1600 }]
}

/** Load a photo to learn its real width (and switch to the fallback if the big one is missing). */
function measure(p: Photo): Promise<Photo | null> {
  const tryLoad = (src: string) =>
    new Promise<number>((resolve, reject) => {
      const img = new Image()
      const timer = setTimeout(() => reject(new Error('slow')), 4000)
      img.onload = () => (clearTimeout(timer), resolve(img.naturalWidth))
      img.onerror = () => (clearTimeout(timer), reject(new Error('failed')))
      img.src = src
    })
  return tryLoad(p.src)
    .then((w) => ({ ...p, width: w }))
    .catch((e) => {
      if (e.message === 'slow') return p // keep it, just unmeasured
      if (!p.fallback) return null // broken image: drop it
      return tryLoad(p.fallback).then((w) => ({ ...p, src: p.fallback!, width: w }), () => null)
    })
}

/** Every photo we can find, exact-airframe photos first. */
export function findPhotos(hexRaw: string, registration?: string, model?: string): Promise<Photo[]> {
  const hex = hexRaw.toLowerCase().replace(/^~/, '')
  const key = `${hex}|${registration ?? ''}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const lists = await Promise.all([planespotters(hex, registration), airportData(hex, registration), commons(registration)])
      // Measure the real sizes, drop broken ones, and show the sharpest first.
      const exact = (await Promise.all(lists.flat().slice(0, 12).map(measure)))
        .filter((x): x is Photo => !!x)
        .sort((a, b) => b.width - a.width)
      if (exact.length) return exact
      return modelPhoto(model)
    })()
    cache.set(key, p)
  }
  return p
}

/** Places to look for more photos yourself. */
export function morePhotoLinks(registration?: string, hex?: string, model?: string) {
  const q = registration || model || hex || ''
  const links: { label: string; href: string }[] = [
    { label: '🔍 Google Images', href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(registration ? `${registration} aircraft` : `${q} aircraft`)}` },
  ]
  if (registration) links.push({ label: 'JetPhotos', href: `https://www.jetphotos.com/registration/${encodeURIComponent(registration)}` })
  if (hex) links.push({ label: 'Planespotters', href: `https://www.planespotters.net/hex/${hex.replace(/^~/, '').toUpperCase()}` })
  return links
}
