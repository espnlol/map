import { useEffect } from 'react'
import { strains, terpenes } from '../data'
import { Card, Dropdown } from '../components/ui'

export function TerpenesPage({
  focusTerpeneId,
  jumpToStrain,
}: {
  focusTerpeneId: string | null
  jumpToStrain: (id: string) => void
}) {
  useEffect(() => {
    if (!focusTerpeneId) return
    document.getElementById(focusTerpeneId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusTerpeneId])

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Card className="p-4">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Terpenes are the aroma compounds behind a strain's smell and taste — and, alongside cannabinoids
          like THC, a big part of what people describe as a strain's overall "vibe." General reference
          info below, not a lab assay of any specific product.
        </p>
        <p className="mt-1.5 text-[11px] text-stone-400">
          Boiling points are approximate — vaporization guides vary by a few degrees between sources.
        </p>
      </Card>

      <div className="space-y-2.5">
        {terpenes.map((t) => {
          const strainsHigh = strains.filter((s) => s.dominantTerpenes.includes(t.id))
          return (
            <div key={t.id} id={t.id}>
              <Dropdown
                defaultOpen={t.id === focusTerpeneId}
                label={
                  <span className="flex items-baseline gap-2">
                    <span>{t.name}</span>
                    <span className="text-xs font-normal text-stone-400">{t.aroma.slice(0, 2).join(', ')}</span>
                  </span>
                }
              >
                <div className="space-y-3">
                  <p className="text-stone-600 dark:text-stone-300">{t.description}</p>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Aroma</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.aroma.map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Commonly reported effects
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-stone-600 dark:text-stone-300">
                      {t.effects.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                      <strong className="font-medium text-stone-700 dark:text-stone-200">Boiling point:</strong>{' '}
                      {t.boilingPoint}
                    </span>
                    <span>
                      <strong className="font-medium text-stone-700 dark:text-stone-200">Also in:</strong>{' '}
                      {t.alsoFoundIn.join(', ')}
                    </span>
                  </div>

                  {strainsHigh.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        Strains commonly high in {t.name.toLowerCase()}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {strainsHigh.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => jumpToStrain(s.id)}
                            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 transition-colors hover:border-leaf-400 hover:text-leaf-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Dropdown>
            </div>
          )
        })}
      </div>
    </div>
  )
}
