import { getMenuForDispensary, type HandlerResult } from './_menuData'

/** Parses `?dispensaryId=...` off a request URL and looks up its menu.
 * Framework-agnostic (just takes a URL string) so both api/menu.ts
 * (Vercel) and the local dev-server middleware in vite.config.ts can
 * share the exact same behavior instead of two copies drifting apart. */
export function handleMenuRequest(requestUrl: string | undefined): HandlerResult {
  const url = new URL(requestUrl ?? '', 'http://localhost')
  return getMenuForDispensary(url.searchParams.get('dispensaryId'))
}

/** Minimal structural type covering exactly what both Vercel's response
 * object and Vite/Connect's Node http ServerResponse expose — avoids
 * depending on either framework's exact response type. */
export interface JsonWritableResponse {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(chunk: string): unknown
}

export function writeJsonResult(res: JsonWritableResponse, result: HandlerResult): void {
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result.body))
}
