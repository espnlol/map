import { useMemo } from 'react'
import { products } from '../data'
import { useAppStore } from '../store/useAppStore'
import { ProductGrid } from '../components/products/ProductGrid'

export function FavoritesPage() {
  const favorites = useAppStore((s) => s.favorites)
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const favoriteOrder = useMemo(() => new Map(favorites.map((id, i) => [id, i])), [favorites])
  const favoriteProducts = useMemo(
    () =>
      products
        .filter((p) => favoriteSet.has(p.id))
        .sort((a, b) => (favoriteOrder.get(b.id) ?? 0) - (favoriteOrder.get(a.id) ?? 0)),
    [favoriteSet, favoriteOrder],
  )

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Favorites</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Saved products across all dispensaries, most recently added first. Tap the heart on any
          product to remove it.
        </p>
      </div>
      <ProductGrid
        products={favoriteProducts}
        emptyTitle="No favorites yet"
        emptyHint="Tap the heart icon on any product in the Menu tab to save it here."
      />
    </div>
  )
}
