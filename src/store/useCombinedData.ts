import { useMemo } from 'react'
import { dispensaries, products, dispensaryById, brandById, minMaxPrice } from '../data'
import { useAppStore } from './useAppStore'
import type { Brand, Dispensary, Product } from '../types'

/** The built-in demo/imported catalog plus whatever's been added through
 * the Manage tab (saved in this browser only — see useAppStore's
 * userDispensaries/userProducts). Every screen that lists/filters/maps
 * dispensaries or products should read through these instead of
 * importing straight from `../data`, so anything added shows up
 * everywhere the built-in catalog already does. */
export function useAllDispensaries(): Dispensary[] {
  const userDispensaries = useAppStore((s) => s.userDispensaries)
  return useMemo(() => [...dispensaries, ...userDispensaries], [userDispensaries])
}

export function useAllProducts(): Product[] {
  const userProducts = useAppStore((s) => s.userProducts)
  return useMemo(() => [...products, ...userProducts], [userProducts])
}

/** Same idea as dispensaryById/brandById in src/data, but also covering
 * whatever's been added through the Manage tab. Products added there
 * store a plain brand-name string in `brandId` rather than a real Brand
 * record's id (there's no "add a brand" step — see ManagePage) — looking
 * it up here just falls back to displaying that string directly, via
 * nameFromBrandLookup below. */
export function useDispensaryById(): Map<string, Dispensary> {
  const userDispensaries = useAppStore((s) => s.userDispensaries)
  return useMemo(() => {
    const map = new Map(dispensaryById)
    for (const d of userDispensaries) map.set(d.id, d)
    return map
  }, [userDispensaries])
}

export function nameFromBrandLookup(brandId: string, lookup: Map<string, Brand> = brandById): string {
  return lookup.get(brandId)?.name ?? brandId
}

/** The price slider's true min/max, including anything added via Manage
 * — not just the static FULL_PRICE_RANGE_CONST the store seeds its
 * default filter value from. Used for the slider's own min/max bounds;
 * the store separately widens the *current filter value* when a product
 * priced outside it gets added, so a newly-added item is never silently
 * hidden by a stale price ceiling (see addUserProduct/updateUserProduct
 * in useAppStore.ts). */
export function useFullPriceRange(): [number, number] {
  const allProducts = useAllProducts()
  return useMemo(() => minMaxPrice(allProducts), [allProducts])
}
