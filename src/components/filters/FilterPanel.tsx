import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAllDispensaries, useFullPriceRange } from '../../store/useCombinedData'
import { brands, strains, terpenes } from '../../data'
import {
  ACCESSORY_SUBTYPES,
  LINEAGE_LABEL,
  PRODUCT_CATEGORIES,
  SORT_OPTIONS,
  type Strain,
  type StrainLineage,
} from '../../types'
import { DETAIL_UNLOCK_THRESHOLD, detailFiltersUnlocked, effectiveDispensaryIds } from '../../utils/filters'
import { Card, Chip, DualRangeSlider, SectionHeading } from '../ui'
import { ChevronDownIcon, LockIcon } from '../Icons'
import { formatPrice } from '../../utils/format'

const ALL_SIZES_G = [0.5, 1, 2, 3, 3.5, 4, 7, 14, 28]

const LINEAGE_BADGE: Record<StrainLineage, string> = {
  indica: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  sativa: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  hybrid: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
}

/** Everything a strain search should be able to match on — name, effects,
 * and flavors — so searching "relaxed" or "citrus" surfaces strains the
 * same way a Leafly-style strain search does, not just an exact name. */
function strainSearchText(s: Strain): string {
  return [s.name, ...s.effects, ...s.flavors].join(' ').toLowerCase()
}

function StrainResult({ strain, active, onToggle }: { strain: Strain; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
        active
          ? 'border-leaf-500 bg-leaf-50 dark:bg-leaf-950/40'
          : 'border-stone-200 hover:border-leaf-300 dark:border-stone-700'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-stone-800 dark:text-stone-100">{strain.name}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${LINEAGE_BADGE[strain.lineage]}`}>
          {LINEAGE_LABEL[strain.lineage]}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-stone-500 dark:text-stone-400">
        {strain.effects.slice(0, 3).join(' · ')}
      </span>
      <span className="block truncate text-[11px] text-stone-400 dark:text-stone-500">
        {strain.flavors.slice(0, 3).join(' · ')}
      </span>
    </button>
  )
}

/** "What do terpenes do?" reference — general aroma/flavor/effect info,
 * not tied to any specific product (products only carry a total terpene
 * %, not a breakdown by compound), shown next to the terpene% filter it's
 * most relevant to. */
function TerpeneGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 rounded-lg border border-stone-200 dark:border-stone-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-300"
      >
        What do terpenes do &amp; taste like?
        <ChevronDownIcon
          width={14}
          height={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="max-h-52 space-y-2.5 overflow-y-auto border-t border-stone-200 px-2.5 py-2.5 dark:border-stone-700">
          <p className="text-[11px] text-stone-400">
            General reference — commonly-reported aroma &amp; effects for the terpenes found across
            cannabis, not a breakdown of any specific product.
          </p>
          {terpenes.map((t) => (
            <div key={t.id} className="text-xs">
              <p className="font-semibold text-stone-700 dark:text-stone-200">
                {t.name} <span className="font-normal text-stone-400">· {t.aroma.join(', ')}</span>
              </p>
              <p className="text-stone-500 dark:text-stone-400">{t.effects.join('; ')}</p>
              <p className="text-[10px] text-stone-400">Also in: {t.alsoFoundIn.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FilterPanel() {
  const dispensaries = useAllDispensaries()
  const fullPriceRange = useFullPriceRange()
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

  const selectedDispensaryIds = useAppStore((s) => s.selectedDispensaryIds)
  const scoped = useMemo(
    () => effectiveDispensaryIds(dispensaries, selectedDispensaryIds),
    [dispensaries, selectedDispensaryIds],
  )
  const unlocked = detailFiltersUnlocked(scoped.length)

  const [strainSearch, setStrainSearch] = useState('')
  const visibleStrains = useMemo(() => {
    const q = strainSearch.trim().toLowerCase()
    const list = q ? strains.filter((s) => strainSearchText(s).includes(q)) : strains
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [strainSearch])

  const relevantBrands = useMemo(() => {
    const list =
      categories.length === 0
        ? brands
        : brands.filter((b) => b.categories.some((c) => categories.includes(c)))
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
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
            min={fullPriceRange[0]}
            max={fullPriceRange[1]}
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
              Check {DETAIL_UNLOCK_THRESHOLD} or fewer dispensaries above to unlock strain, brand, THC%
              &amp; terpene% filters.
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
              <p className="mb-1.5 text-xs text-stone-500 dark:text-stone-400">
                Strain search — by name, effect, or flavor
              </p>
              <input
                value={strainSearch}
                onChange={(e) => setStrainSearch(e.target.value)}
                placeholder="Try “relaxed”, “citrus”, or a strain name…"
                className="mb-2 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
              />
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {visibleStrains.map((s) => (
                  <StrainResult
                    key={s.id}
                    strain={s}
                    active={strainIds.includes(s.id)}
                    onToggle={() => toggleStrain(s.id)}
                  />
                ))}
                {visibleStrains.length === 0 && (
                  <p className="text-xs text-stone-400">No strains match "{strainSearch}".</p>
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
              <TerpeneGuide />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
