import { dispensaries } from './dispensaries'
import { brands } from './brands'
import { strains } from './strains'
import { terpenes } from './terpenes'
import { generateProducts } from './generateProducts'
import type { Brand, Dispensary, Product, Strain } from '../types'

// Generated once at module load — this is the in-memory "database" for the
// demo. Swap this module out for real API calls (e.g. to a POS/menu
// aggregator like Dutchie, Jane, Treez or Blaze) without touching any
// component, since everything downstream consumes these same exports.
export const products: Product[] = generateProducts(dispensaries)

export { dispensaries, brands, strains, terpenes }

export const dispensaryById = new Map<string, Dispensary>(dispensaries.map((d) => [d.id, d]))
export const brandById = new Map<string, Brand>(brands.map((b) => [b.id, b]))
export const strainById = new Map<string, Strain>(strains.map((s) => [s.id, s]))

export function minMaxPrice(list: Product[]): [number, number] {
  let min = Infinity
  let max = 0
  for (const p of list) {
    for (const s of p.sizes) {
      if (s.price < min) min = s.price
      if (s.price > max) max = s.price
    }
  }
  if (!isFinite(min)) min = 0
  return [Math.floor(min), Math.ceil(max)]
}
