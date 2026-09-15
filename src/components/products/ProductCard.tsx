import { brandById, strainById, dispensaryById } from '../../data'
import { useAppStore } from '../../store/useAppStore'
import { HeartIcon, MapPinIcon } from '../Icons'
import { formatPrice } from '../../utils/format'
import { ACCESSORY_SUBTYPES, LINEAGE_LABEL, type Product } from '../../types'
import { representativePrice } from '../../utils/filters'

export function ProductCard({
  product,
  showDispensary = true,
}: {
  product: Product
  showDispensary?: boolean
}) {
  const isFavorite = useAppStore((s) => s.favorites.includes(product.id))
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const sizesG = useAppStore((s) => s.sizesG)

  const brand = brandById.get(product.brandId)
  const strain = product.strainId ? strainById.get(product.strainId) : undefined
  const dispensary = dispensaryById.get(product.dispensaryId)
  const price = representativePrice(product, sizesG)
  const accessoryLabel =
    product.category === 'accessory'
      ? ACCESSORY_SUBTYPES.find((s) => s.id === product.subtype)?.label
      : undefined

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-stone-700 dark:bg-stone-900">
      <div
        className="flex h-20 items-center justify-center text-2xl font-bold text-white/90"
        style={{ backgroundColor: product.swatch }}
        aria-hidden
      >
        {product.name.slice(0, 1)}
      </div>
      <button
        onClick={() => toggleFavorite(product.id)}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
        className={`absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow transition-colors dark:bg-stone-900/90 ${
          isFavorite ? 'text-red-500' : 'text-stone-400 hover:text-red-400'
        }`}
      >
        <HeartIcon filled={isFavorite} width={16} height={16} />
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight text-stone-800 dark:text-stone-100">
            {product.name}
          </h4>
          {price !== null && (
            <span className="whitespace-nowrap text-sm font-semibold text-leaf-700 dark:text-leaf-400">
              {formatPrice(price)}
            </span>
          )}
        </div>
        {brand && <p className="text-xs text-stone-500 dark:text-stone-400">{brand.name}</p>}

        <div className="flex flex-wrap gap-1">
          {strain && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {LINEAGE_LABEL[strain.lineage]}
            </span>
          )}
          {accessoryLabel && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {accessoryLabel}
            </span>
          )}
          {product.thcPercent !== undefined && (
            <span className="rounded bg-leaf-50 px-1.5 py-0.5 text-[11px] text-leaf-800 dark:bg-leaf-950 dark:text-leaf-300">
              THC {product.thcPercent}%
            </span>
          )}
          {product.terpenePercent !== undefined && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Terp {product.terpenePercent}%
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-[11px] text-stone-400">{product.description}</p>

        <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[11px] text-stone-500 dark:text-stone-400">
          {product.sizes.map((s) => (
            <span key={s.label}>
              {s.label} · {formatPrice(s.price)}
            </span>
          ))}
        </div>

        {showDispensary && dispensary && (
          <p className="mt-1 flex items-center gap-1 truncate border-t border-stone-100 pt-1.5 text-[11px] font-medium text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <MapPinIcon width={11} height={11} className="shrink-0" />
            <span className="truncate">{dispensary.name}</span>
          </p>
        )}
      </div>
    </div>
  )
}
