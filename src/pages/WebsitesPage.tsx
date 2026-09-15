import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ProductGrid } from '../components/products/ProductGrid'
import { Card, EmptyState, PrimaryButton, SectionHeading } from '../components/ui'
import { SearchIcon } from '../components/Icons'

/** The primary tab: every dispensary you've added in Manage, grouped with
 * its website link (when you've set one) and the prices you've logged for
 * it — a real price tracker over data you typed in yourself. There's no
 * automated pull from a dispensary's actual site here: most run a
 * third-party menu platform (Dutchie/Jane/Tymber) whose terms explicitly
 * prohibit scraping, so "porting in a website" means linking it and
 * logging what you see there by hand, the same honest, no-fabrication
 * approach the rest of this app uses (see README). */
export function WebsitesPage() {
  const dispensaries = useAppStore((s) => s.userDispensaries)
  const products = useAppStore((s) => s.userProducts)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? dispensaries.filter((d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q))
      : dispensaries
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [dispensaries, search])

  if (dispensaries.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <EmptyState
          title="No dispensaries yet"
          hint="Add one in Manage — including its website — then log the prices you see there."
        />
        <div className="mt-3 text-center">
          <PrimaryButton onClick={() => setActiveTab('manage')}>Go to Manage</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      <div className="relative">
        <SearchIcon
          width={14}
          height={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your dispensaries by name or city…"
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-8 pr-2 text-sm dark:border-stone-600 dark:bg-stone-800"
        />
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-400">No dispensaries match "{search}".</p>
      )}

      {filtered.map((d) => {
        const items = products.filter((p) => p.dispensaryId === d.id)
        return (
          <Card key={d.id} className="p-4">
            <SectionHeading
              action={
                <button
                  onClick={() => setActiveTab('manage')}
                  className="text-xs text-leaf-700 hover:underline dark:text-leaf-400"
                >
                  Edit in Manage
                </button>
              }
            >
              {d.name}
            </SectionHeading>
            <p className="mb-1 text-xs text-stone-500 dark:text-stone-400">
              {d.address}, {d.city}
            </p>
            {d.website ? (
              <a
                href={d.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-leaf-700 hover:underline dark:text-leaf-400"
              >
                {d.website} ↗
              </a>
            ) : (
              <p className="text-xs italic text-stone-400">
                No website added yet — add one by editing this dispensary in Manage.
              </p>
            )}

            <div className="mt-3">
              {items.length === 0 ? (
                <p className="text-xs text-stone-400">
                  No prices logged yet for this dispensary — add products in Manage.
                </p>
              ) : (
                <ProductGrid products={items} showDispensary={false} />
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
