import { strains, terpeneById } from '../../data'
import { relatedStrains } from '../../utils/related'
import { LINEAGE_LABEL, type Strain } from '../../types'
import { Card, Dropdown, GhostButton } from '../ui'
import { ChevronLeftIcon } from '../Icons'
import { LINEAGE_BADGE } from './lineageStyle'

export function StrainDetail({
  strain,
  onBack,
  onSelectStrain,
  jumpToTerpene,
}: {
  strain: Strain
  onBack: () => void
  onSelectStrain: (id: string) => void
  jumpToTerpene: (id: string) => void
}) {
  const related = relatedStrains(strain, strains, 4)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <GhostButton onClick={onBack} className="inline-flex items-center gap-1">
        <ChevronLeftIcon width={14} height={14} /> All strains
      </GhostButton>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">{strain.name}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LINEAGE_BADGE[strain.lineage]}`}>
            {LINEAGE_LABEL[strain.lineage]}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{strain.description}</p>
      </Card>

      <div className="space-y-2.5">
        <Dropdown label="Effects" defaultOpen>
          <div className="flex flex-wrap gap-1.5">
            {strain.effects.map((e) => (
              <span
                key={e}
                className="rounded-full bg-leaf-50 px-2.5 py-1 text-xs text-leaf-800 dark:bg-leaf-950 dark:text-leaf-200"
              >
                {e}
              </span>
            ))}
          </div>
        </Dropdown>

        <Dropdown label="Flavor & aroma">
          <div className="flex flex-wrap gap-1.5">
            {strain.flavors.map((f) => (
              <span
                key={f}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {f}
              </span>
            ))}
          </div>
        </Dropdown>

        <Dropdown label="Terpene breakdown" defaultOpen>
          <div className="space-y-3">
            {strain.dominantTerpenes.map((tid) => {
              const t = terpeneById.get(tid)
              if (!t) return null
              return (
                <div key={tid} className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-700">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-stone-800 dark:text-stone-100">{t.name}</p>
                    <span className="text-[11px] text-stone-400">{t.boilingPoint}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t.aroma.join(', ')}</p>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{t.effects[0]}</p>
                  <button
                    onClick={() => jumpToTerpene(tid)}
                    className="mt-1.5 text-xs text-leaf-700 underline hover:text-leaf-800 dark:text-leaf-400"
                  >
                    Full breakdown →
                  </button>
                </div>
              )
            })}
          </div>
        </Dropdown>

        <Dropdown label="Commonly reported to help with">
          <div className="flex flex-wrap gap-1.5">
            {strain.helpsWith.map((h) => (
              <span
                key={h}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 dark:bg-stone-800 dark:text-stone-200"
              >
                {h}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            What users commonly report, not medical advice or a guarantee of effect.
          </p>
        </Dropdown>
      </div>

      {related.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Related strains
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {related.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectStrain(r.id)}
                className="rounded-xl border border-stone-200 bg-white p-2.5 text-left transition-colors hover:border-leaf-400 dark:border-stone-700 dark:bg-stone-900"
              >
                <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">{r.name}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${LINEAGE_BADGE[r.lineage]}`}>
                  {LINEAGE_LABEL[r.lineage]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            Based on shared lineage, effects, flavors & dominant terpenes — not a claim about actual genetic
            relation.
          </p>
        </div>
      )}
    </div>
  )
}
