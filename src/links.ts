import type { Crash } from './types'

const STORAGE_KEY = 'crash-video-links'

/** Wikipedia "go" search: lands straight on the article when the title matches, else shows search results. */
export function articleUrl(c: Crash): string {
  return `https://en.wikipedia.org/wiki/Special:Search?go=Go&search=${encodeURIComponent(c.wiki)}`
}

export function youtubeSearchUrl(c: Crash): string {
  const name = c.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const q = `${name} ${c.date.slice(0, 4)} crash`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/** Pulls the 11-char video id out of any common YouTube URL form. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

export function loadCustomLinks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveCustomLinks(links: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
  } catch {
    /* storage unavailable: links just won't persist */
  }
}
