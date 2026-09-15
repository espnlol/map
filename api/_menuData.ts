// Pure request-shape-agnostic logic for the /api/menu endpoint, kept
// separate from any (req, res) framework shape so it can be reused by
// both the real Vercel serverless function (api/menu.ts) and the local
// Vite dev/preview middleware (vite.config.ts) that serves the same
// route when running `npm run dev` / `npm run preview` without a Vercel
// deployment.
//
// IMPORTANT: this serves the SAME synthetic demo catalog the rest of the
// app already uses (src/data/generateProducts.ts) — it's a real, working
// JSON API, but the data behind it isn't live dispensary inventory. See
// README.md's "Wiring up real data" section for what a production
// version would need.
import { dispensaryById, products, brandById, strainById } from '../src/data'
import type { Product } from '../src/types'

export interface MenuApiItem {
  id: string
  name: string
  category: string
  brand: string
  strain: string | null
  thcPercent: number | null
  terpenePercent: number | null
  sizes: { label: string; price: number }[]
}

export interface MenuApiResponse {
  dispensaryId: string
  dispensaryName: string
  totalCount: number
  items: MenuApiItem[]
}

export interface MenuApiError {
  error: string
}

export interface HandlerResult {
  status: number
  body: MenuApiResponse | MenuApiError
}

/** Products added through the Manage tab store a plain brand-name string
 * in `brandId` (there's no separate "add a brand" step — see
 * ManagePage.tsx), so falling back to "Unknown brand" when it doesn't
 * match a built-in Brand record would be wrong for them — it'd hide the
 * actual name they entered. Falling back to the id/string itself is
 * correct for both cases. */
export function productToMenuItem(p: Product): MenuApiItem {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    brand: brandById.get(p.brandId)?.name ?? p.brandId,
    strain: p.strainId ? (strainById.get(p.strainId)?.name ?? null) : null,
    thcPercent: p.thcPercent ?? null,
    terpenePercent: p.terpenePercent ?? null,
    sizes: p.sizes.map((s) => ({ label: s.label, price: s.price })),
  }
}

export function productsToMenuResponse(
  dispensaryId: string,
  dispensaryName: string,
  matching: Product[],
): MenuApiResponse {
  const items = matching.map(productToMenuItem)
  return { dispensaryId, dispensaryName, totalCount: items.length, items }
}

/** Every field here comes straight from data already loaded client-side
 * elsewhere in the app — this endpoint doesn't know anything the app
 * doesn't already know, it just also serves it over HTTP as JSON. Note
 * it only knows about the built-in catalog: products added through the
 * Manage tab live in the browser's localStorage, which a serverless
 * function has no access to — the client fetches this endpoint only for
 * dispensaries it didn't add itself (see DispensaryMap.tsx). */
export function getMenuForDispensary(dispensaryId: string | null | undefined): HandlerResult {
  if (!dispensaryId) {
    return { status: 400, body: { error: 'Missing required "dispensaryId" query parameter' } }
  }

  const dispensary = dispensaryById.get(dispensaryId)
  if (!dispensary) {
    return { status: 404, body: { error: `No dispensary found with id "${dispensaryId}"` } }
  }

  const matching = products.filter((p) => p.dispensaryId === dispensaryId)
  return { status: 200, body: productsToMenuResponse(dispensaryId, dispensary.name, matching) }
}
