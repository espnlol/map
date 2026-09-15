import { useMemo, useState } from 'react'
import { useAppStore, FULL_PRICE_RANGE_CONST } from '../../store/useAppStore'
import { dispensaries, brands, strains } from '../../data'
import {
  ACCESSORY_SUBTYPES,
  LINEAGE_LABEL,
  PRODUCT_CATEGORIES,
  SORT_OPTIONS,
  type StrainLineage,
} from '../../types'
import { DETAIL_UNLOCK_THRESHOLD, detailFiltersUnlocked, effectiveDispensaryIds } from '../../utils/filters'
import { Card, Chip, DualRangeSlider, SectionHeading } from '../ui'
import { LockIcon } from '../Icons'
import { formatPrice } from '../../utils/format'

const ALL_SIZES_G = [0.5, 1, 2, 3, 3.5, 4, 7, 14, 28]

export function FilterPanel() {
  const categories = useAppStore((s) => s.categories)
  const toggleCategory = useAppStore((s) => s.toggleCategory)
  const accessorySubtypes = useAppStore((s) => s.accessorySubtypes)
  const toggleAccessorySubtype = useAppStore((s) => s.toggleAccessorySubtype)
  const sizesG = useAppStore((s) => s.sizesG)
  const toggleSize = useAppStore((s) => s.toggleSize)
  const priceRange = useAppStore((s) => s.priceRange)
  const setPriceRange = useAppStore((s) => s.setPriceRange)
  const sort = useAppStore((s) => s.sort)
  const setSort = useAppStore((s) => s.setSort)

  const strainIds = useAppStore((s) => s.strainIds)
  const toggleStrain = useAppStore((s) => s.toggleStrain)
  const brandIds = useAppStore((s) => s.brandIds)
  const toggleBrand = useAppStore((s) => s.toggleBrand)
  const lineages = useAppStore((s) => s.lineages)
  const toggleLineage = useAppStore((s) => s.toggleLineage)
  const thcRange = useAppStore((s) => s.thcRange)
  const setThcRange = useAppStore((s) => s.setThcRange)
  const terpeneRange = useAppStore((s) => s.terpeneRange)
  const setTerpeneRange = useAppStore((s) => s.setTerpeneRange)
  const resetDetailFilters = useAppStore((s) => s.resetDetailFilters)
  const resetProductFilters = useAppStore((s) => s.resetProductFilters)

  const boundary = useAppStore((s) => s.boundary)
  const selectedDispensaryIds = useAppStore((s) => s.selectedDispensaryIds)
  const scoped = useMemo(
    () => effectiveDispensaryIds(dispensaries, boundary, selectedDispensaryIds),
    [boundary, selectedDispensaryIds],
  )
  const unlocked = detailFiltersUnlocked(scoped.length)

  const [strainSearch, setStrainSearch] = useState('')
  const visibleStrains = useMemo(
    () => strains.filter((s) => s.name.toLowerCase().includes(strainSearch.trim().toLowerCase())),
    [strainSearch],
  )

  const relevantBrands = useMemo(() => {
    if (categories.length === 0) return brands
    return brands.filter((b) => b.categories.some((c) => categories.includes(c)))
  }, [categories])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionHeading
          action={
            <button
              onClick={resetProductFilters}
              className="text-xs text-stone-400 underline hover:text-stone-600 dark:hover:text-stone-200"
            >
              Reset all
            </button>
          }
        >
          Product type
        </SectionHeading>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((c) => (
            <Chip key={c.id} active={categories.includes(c.id)} onClick={() => toggleCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>

        {(categories.length === 0 || categories.includes('accessory')) && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Accessory type</p>
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_SUBTYPES.map((a) => (
                <Chip
                  key={a.id}
                  active={accessorySubtypes.includes(a.id)}
                  onClick={() => toggleAccessorySubtype(a.id)}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">
            Size (applies to flower, cartridges & concentrates)
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_SIZES_G.map((g) => (
              <Chip key={g} active={sizesG.includes(g)} onClick={() => toggleSize(g)}>
                {g}g
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Price</p>
          <DualRangeSlider
            min={FULL_PRICE_RANGE_CONST[0]}
            max={FULL_PRICE_RANGE_CONST[1]}
            step={1}
            value={priceRange}
            onChange={setPriceRange}
            formatValue={formatPrice}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Sort by</p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="relative p-4">
        <SectionHeading
          action={
            unlocked && (
              <button
                onClick={resetDetailFilters}
                className="text-xs text-stone-400 underline hover:text-stone-600 dark:hover:text-stone-200"
              >
                Reset
              </button>
            )
          }
        >
          Strain, brand &amp; potency
        </SectionHeading>

        {!unlocked ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <LockIcon className="text-stone-400" />
            <p className="max-w-[220px] text-sm text-stone-500 dark:text-stone-400">
              Narrow your search to {DETAIL_UNLOCK_THRESHOLD} or fewer dispensaries on the Map tab to
              unlock strain, brand, THC% &amp; terpene% filters.
            </p>
            <p className="text-xs text-stone-400">Currently searching {scoped.length} dispensaries.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Lineage</p>
              <div className="flex flex-wrap gap-2">
                {(['indica', 'sativa', 'hybrid'] as StrainLineage[]).map((l) => (
                  <Chip key={l} active={lineages.includes(l)} onClick={() => toggleLineage(l)}>
                    {LINEAGE_LABEL[l]}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Strain</p>
              <input
                value={strainSearch}
                onChange={(e) => setStrainSearch(e.target.value)}
                placeholder="Search strains…"
                className="mb-2 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
              />
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {visibleStrains.map((s) => (
                  <Chip key={s.id} active={strainIds.includes(s.id)} onClick={() => toggleStrain(s.id)}>
                    {s.name}
                  </Chip>
                ))}
                {visibleStrains.length === 0 && (
                  <p className="text-xs text-stone-400">No strains match “{strainSearch}”.</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Brand</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {relevantBrands.map((b) => (
                  <Chip key={b.id} active={brandIds.includes(b.id)} onClick={() => toggleBrand(b.id)}>
                    {b.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">THC %</p>
              <DualRangeSlider
                min={0}
                max={100}
                step={1}
                value={thcRange}
                onChange={setThcRange}
                formatValue={(n) => `${n}%`}
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">Terpene %</p>
              <DualRangeSlider
                min={0}
                max={10}
                step={0.5}
                value={terpeneRange}
                onChange={setTerpeneRange}
                formatValue={(n) => `${n}%`}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
