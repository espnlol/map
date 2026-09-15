import type {
  AccessorySubtype,
  Dispensary,
  Product,
  ProductCategory,
  SortOption,
  StrainLineage,
} from '../types'
import { strainById } from '../data'

/** How many dispensaries the user must be narrowed down to before the
 * strain / brand / THC% / terpene% "detail" filters unlock. */
export const DETAIL_UNLOCK_THRESHOLD = 5

export const DEFAULT_THC_RANGE: [number, number] = [0, 100]
export const DEFAULT_TERPENE_RANGE: [number, number] = [0, 10]

export interface FilterState {
  selectedDispensaryIds: string[]
  categories: ProductCategory[]
  accessorySubtypes: AccessorySubtype[]
  sizesG: number[]
  priceRange: [number, number]
  sort: SortOption
  strainIds: string[]
  brandIds: string[]
  lineages: StrainLineage[]
  thcRange: [number, number]
  terpeneRange: [number, number]
}

/** The dispensary set actually "in scope" for product search: explicit
 * checkbox picks in the dispensary list narrow the field; with nothing
 * checked, every known dispensary is in scope. Filters out any stale id
 * (e.g. a since-deleted Manage-added dispensary) against the real list. */
export function effectiveDispensaryIds(
  dispensaries: Dispensary[],
  selectedDispensaryIds: string[],
): string[] {
  if (selectedDispensaryIds.length === 0) return dispensaries.map((d) => d.id)
  const knownSet = new Set(dispensaries.map((d) => d.id))
  return selectedDispensaryIds.filter((id) => knownSet.has(id))
}

/** Whether the strain/brand/THC%/terpene% detail filters should be unlocked. */
export function detailFiltersUnlocked(scopedDispensaryCount: number): boolean {
  return scopedDispensaryCount > 0 && scopedDispensaryCount <= DETAIL_UNLOCK_THRESHOLD
}

/** The price shown on a card / used for price sort: the lowest price among
 * sizes that pass the current size filter (or the lowest of all sizes, i.e.
 * a "starting at" price, when no size filter is engaged). */
export function representativePrice(product: Product, sizesG: number[]): number | null {
  const candidates =
    sizesG.length === 0
      ? product.sizes
      : product.sizes.filter((s) => s.grams !== undefined && sizesG.includes(s.grams))
  if (candidates.length === 0) return null
  return Math.min(...candidates.map((s) => s.price))
}

function isFullRange(range: [number, number], full: [number, number]): boolean {
  return range[0] <= full[0] && range[1] >= full[1]
}

export function filterProducts(
  products: Product[],
  dispensaryScope: string[],
  filters: FilterState,
): Product[] {
  const scopeSet = new Set(dispensaryScope)
  const detailUnlocked = detailFiltersUnlocked(dispensaryScope.length)

  const strainSet = detailUnlocked ? new Set(filters.strainIds) : new Set<string>()
  const brandSet = detailUnlocked ? new Set(filters.brandIds) : new Set<string>()
  const lineageSet = detailUnlocked ? new Set(filters.lineages) : new Set<StrainLineage>()
  const thcEngaged = detailUnlocked && !isFullRange(filters.thcRange, DEFAULT_THC_RANGE)
  const terpEngaged = detailUnlocked && !isFullRange(filters.terpeneRange, DEFAULT_TERPENE_RANGE)

  const categorySet = new Set(filters.categories)
  const accessorySet = new Set(filters.accessorySubtypes)

  const result: Product[] = []

  for (const p of products) {
    if (!scopeSet.has(p.dispensaryId)) continue
    if (categorySet.size > 0 && !categorySet.has(p.category)) continue
    if (
      p.category === 'accessory' &&
      accessorySet.size > 0 &&
      !(p.subtype && accessorySet.has(p.subtype as AccessorySubtype))
    ) {
      continue
    }

    const price = representativePrice(p, filters.sizesG)
    if (price === null) continue // product has no size matching an active size filter
    if (price < filters.priceRange[0] || price > filters.priceRange[1]) continue

    if (strainSet.size > 0 && (!p.strainId || !strainSet.has(p.strainId))) continue
    if (brandSet.size > 0 && !brandSet.has(p.brandId)) continue
    if (lineageSet.size > 0) {
      const lineage = p.strainId ? strainById.get(p.strainId)?.lineage : undefined
      if (!lineage || !lineageSet.has(lineage)) continue
    }
    if (thcEngaged) {
      if (p.thcPercent === undefined) continue
      if (p.thcPercent < filters.thcRange[0] || p.thcPercent > filters.thcRange[1]) continue
    }
    if (terpEngaged) {
      if (p.terpenePercent === undefined) continue
      if (p.terpenePercent < filters.terpeneRange[0] || p.terpenePercent > filters.terpeneRange[1])
        continue
    }

    result.push(p)
  }

  return sortProducts(result, filters.sort, filters.sizesG)
}

export function sortProducts(products: Product[], sort: SortOption, sizesG: number[]): Product[] {
  const withPrice = products.map((p) => ({ p, price: representativePrice(p, sizesG) ?? 0 }))
  withPrice.sort((a, b) => {
    switch (sort) {
      case 'price-desc':
        return b.price - a.price
      case 'price-asc':
        return a.price - b.price
      case 'thc-desc':
        return (b.p.thcPercent ?? -1) - (a.p.thcPercent ?? -1)
      case 'terpene-desc':
        return (b.p.terpenePercent ?? -1) - (a.p.terpenePercent ?? -1)
      case 'name-asc':
        return a.p.name.localeCompare(b.p.name)
      default:
        return 0
    }
  })
  return withPrice.map((x) => x.p)
}
