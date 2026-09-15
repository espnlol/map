import { useMemo, useState } from 'react'
import { strains, strainById } from '../data'
import { LINEAGE_LABEL, LINEAGES, type Strain, type StrainLineage } from '../types'
import { Card, Chip } from '../components/ui'
import { SearchIcon } from '../components/Icons'
import { LINEAGE_BADGE } from '../components/strains/lineageStyle'
import { StrainDetail } from '../components/strains/StrainDetail'

function searchText(s: Strain): string {
  return [s.name, ...s.effects, ...s.flavors].join(' ').toLowerCase()
}

function StrainCard({ strain, onClick }: { strain: Strain; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-leaf-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900"
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-stone-900 dark:text-stone-50">{strain.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${LINEAGE_BADGE[strain.lineage]}`}>
          {LINEAGE_LABEL[strain.lineage]}
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs text-stone-500 dark:text-stone-400">{strain.effects.join(' · ')}</p>
      <p className="truncate text-xs text-stone-400">{strain.flavors.join(' · ')}</p>
    </button>
  )
}

export function StrainsPage({
  focusStrainId,
  jumpToTerpene,
}: {
  focusStrainId: string | null
  jumpToTerpene: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(focusStrainId)
  const [search, setSearch] = useState('')
  const [lineages, setLineages] = useState<StrainLineage[]>([])

  const selected = selectedId ? strainById.get(selectedId) : undefined

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = strains
    if (lineages.length > 0) list = list.filter((s) => lineages.includes(s.lineage))
    if (q) list = list.filter((s) => searchText(s).includes(q))
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [search, lineages])

  function toggleLineage(l: StrainLineage) {
    setLineages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))
  }

  if (selected) {
    return (
      <StrainDetail
        strain={selected}
        onBack={() => setSelectedId(null)}
        onSelectStrain={setSelectedId}
        jumpToTerpene={jumpToTerpene}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Card className="p-4">
        <div className="relative mb-3">
          <SearchIcon
            width={14}
            height={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by name, effect ("relaxed"), or flavor ("citrus")…'
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-8 pr-2 text-sm dark:border-stone-600 dark:bg-stone-800"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-400">Lineage:</span>
          {LINEAGES.map((l) => (
            <Chip key={l} active={lineages.includes(l)} onClick={() => toggleLineage(l)}>
              {LINEAGE_LABEL[l]}
            </Chip>
          ))}
          {lineages.length > 0 && (
            <button
              onClick={() => setLineages([])}
              className="text-xs text-stone-400 underline hover:text-stone-600 dark:hover:text-stone-200"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      <p className="text-xs text-stone-400">
        {visible.length} of {strains.length} strains
      </p>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">No strains match your search/filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <StrainCard key={s.id} strain={s} onClick={() => setSelectedId(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
