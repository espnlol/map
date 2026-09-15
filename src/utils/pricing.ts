import type { Product } from '../types'

/** The price shown on a card: the lowest price among a product's sizes
 * (a "starting at" price when it has more than one). */
export function representativePrice(product: Product): number | null {
  if (product.sizes.length === 0) return null
  return Math.min(...product.sizes.map((s) => s.price))
}
