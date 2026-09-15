import type { Product } from '../../types'
import { ProductCard } from './ProductCard'
import { EmptyState } from '../ui'

export function ProductGrid({
  products,
  showDispensary = true,
  emptyTitle = 'No products match your filters',
  emptyHint = 'Try widening the price range or clearing a filter.',
}: {
  products: Product[]
  showDispensary?: boolean
  emptyTitle?: string
  emptyHint?: string
}) {
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} showDispensary={showDispensary} />
      ))}
    </div>
  )
}
