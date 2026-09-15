import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAllDispensaries, useAllProducts } from '../store/useCombinedData'
import { effectiveDispensaryIds, filterProducts, type FilterState } from '../utils/filters'
import { DispensaryPicker } from '../components/filters/DispensaryPicker'
import { FilterPanel } from '../components/filters/FilterPanel'
import { ProductGrid } from '../components/products/ProductGrid'

export function MenuPage() {
  const dispensaries = useAllDispensaries()
  const products = useAllProducts()
  const selectedDispensaryIds = useAppStore((s) => s.selectedDispensaryIds)
  const categories = useAppStore((s) => s.categories)
  const accessorySubtypes = useAppStore((s) => s.accessorySubtypes)
  const sizesG = useAppStore((s) => s.sizesG)
  const priceRange = useAppStore((s) => s.priceRange)
  const sort = useAppStore((s) => s.sort)
  const strainIds = useAppStore((s) => s.strainIds)
  const brandIds = useAppStore((s) => s.brandIds)
  const lineages = useAppStore((s) => s.lineages)
  const thcRange = useAppStore((s) => s.thcRange)
  const terpeneRange = useAppStore((s) => s.terpeneRange)

  const scoped = useMemo(
    () => effectiveDispensaryIds(dispensaries, selectedDispensaryIds),
    [dispensaries, selectedDispensaryIds],
  )

  const filtered = useMemo(() => {
    const filters: FilterState = {
      selectedDispensaryIds,
      categories,
      accessorySubtypes,
      sizesG,
      priceRange,
      sort,
      strainIds,
      brandIds,
      lineages,
      thcRange,
      terpeneRange,
    }
    return filterProducts(products, scoped, filters)
  }, [
    products,
    scoped,
    selectedDispensaryIds,
    categories,
    accessorySubtypes,
    sizesG,
    priceRange,
    sort,
    strainIds,
    brandIds,
    lineages,
    thcRange,
    terpeneRange,
  ])

  const scopedDispensaryNames = useMemo(
    () => dispensaries.filter((d) => scoped.includes(d.id)).map((d) => d.name),
    [dispensaries, scoped],
  )

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:flex-row">
      <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
        <DispensaryPicker />
        <FilterPanel />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm dark:border-stone-700 dark:bg-stone-900">
          <span className="text-stone-600 dark:text-stone-300">
            <strong className="text-stone-900 dark:text-stone-50">{filtered.length}</strong> products
            across <strong className="text-stone-900 dark:text-stone-50">{scoped.length}</strong>{' '}
            {scoped.length === 1 ? 'dispensary' : 'dispensaries'}
          </span>
          {scoped.length > 0 && scoped.length <= 5 && (
            <span
              className="max-w-[280px] truncate text-xs text-stone-400"
              title={scopedDispensaryNames.join(', ')}
            >
              {scopedDispensaryNames.join(' · ')}
            </span>
          )}
        </div>
        <ProductGrid
          products={filtered}
          emptyTitle={scoped.length === 0 ? 'No dispensaries selected' : 'No products match your filters'}
          emptyHint={
            scoped.length === 0
              ? 'Check off a dispensary on the left to see its menu.'
              : 'Try widening the price range or clearing a filter.'
          }
        />
      </div>
    </div>
  )
}
