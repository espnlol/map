import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAllDispensaries } from '../../store/useCombinedData'
import { DETAIL_UNLOCK_THRESHOLD, effectiveDispensaryIds } from '../../utils/filters'
import { Card, SectionHeading } from '../ui'
import { SearchIcon, StarIcon } from '../Icons'

type DispensarySort = 'name' | 'rating'

/** Multi-dispensary picker: search + checkbox list. This is the whole
 * "which locations am I browsing" scope control now that there's no map —
 * checking dispensaries here is what narrows `effectiveDispensaryIds`
 * (see utils/filters.ts) and, once narrowed to a handful, unlocks the
 * strain/brand/THC%/terpene% filters in FilterPanel below it. */
export function DispensaryPicker() {
  const dispensaries = useAllDispensaries()
  const selectedDispensaryIds = useAppStore((s) => s.selectedDispensaryIds)
  const toggleDispensary = useAppStore((s) => s.toggleDispensary)
  const setSelectedDispensaries = useAppStore((s) => s.setSelectedDispensaries)
  const clearDispensarySelection = useAppStore((s) => s.clearDispensarySelection)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DispensarySort>('name')

  const selectedSet = useMemo(() => new Set(selectedDispensaryIds), [selectedDispensaryIds])
  const scoped = useMemo(
    () => effectiveDispensaryIds(dispensaries, selectedDispensaryIds),
    [dispensaries, selectedDispensaryIds],
  )
  const unlocked = scoped.length > 0 && scoped.length <= DETAIL_UNLOCK_THRESHOLD

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? dispensaries.filter((d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q))
      : dispensaries
    return [...list].sort((a, b) =>
      sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) : a.name.localeCompare(b.name),
    )
  }, [dispensaries, search, sort])

  return (
    <Card className="flex max-h-[560px] min-h-0 flex-col p-4">
      <SectionHeading
        action={
          <div className="flex gap-2 text-xs">
            <button
              className="text-leaf-700 hover:underline dark:text-leaf-400"
              onClick={() => setSelectedDispensaries(filteredList.map((d) => d.id))}
            >
              Select all
            </button>
            <button className="text-stone-400 hover:underline" onClick={clearDispensarySelection}>
              Clear
            </button>
          </div>
        }
      >
        Dispensaries ({scoped.length}/{dispensaries.length})
      </SectionHeading>

      <div className="relative mb-2">
        <SearchIcon
          width={14}
          height={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-8 pr-2 text-sm dark:border-stone-600 dark:bg-stone-800"
        />
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
        <label htmlFor="disp-sort">Sort:</label>
        <select
          id="disp-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as DispensarySort)}
          className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs dark:border-stone-600 dark:bg-stone-800"
        >
          <option value="name">Company name (A–Z)</option>
          <option value="rating">Rating (high–low)</option>
        </select>
      </div>

      <div
        className={`mb-2 rounded-lg px-2.5 py-2 text-xs ${
          unlocked
            ? 'bg-leaf-50 text-leaf-800 dark:bg-leaf-950 dark:text-leaf-200'
            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
        }`}
      >
        {unlocked
          ? `Detail filters unlocked below — filter by strain, brand, THC% & terpene%.`
          : `Check ${DETAIL_UNLOCK_THRESHOLD} or fewer dispensaries to unlock strain, brand, THC% & terpene% filters.`}
      </div>

      <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filteredList.map((d) => {
          const selected = selectedSet.has(d.id)
          return (
            <li key={d.id}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-leaf-500 bg-leaf-50 dark:bg-leaf-950/40'
                    : 'border-stone-200 hover:border-leaf-300 dark:border-stone-700'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-leaf-600"
                  checked={selected}
                  onChange={() => toggleDispensary(d.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-stone-800 dark:text-stone-100">
                    {d.name}
                  </span>
                  <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                    {d.address}, {d.city}
                  </span>
                  {d.rating !== undefined && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-xs text-stone-500 dark:text-stone-400">
                      <StarIcon filled width={11} height={11} className="text-amber-500" />
                      {d.rating.toFixed(1)}
                    </span>
                  )}
                  {d.source === 'openstreetmap' && (
                    <span className="mt-0.5 block text-[10px] italic text-amber-600 dark:text-amber-400">
                      Real location (OSM) — sample menu, not live inventory
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
        {filteredList.length === 0 && (
          <p className="py-6 text-center text-xs text-stone-400">No dispensaries match "{search}".</p>
        )}
      </ul>
    </Card>
  )
}
