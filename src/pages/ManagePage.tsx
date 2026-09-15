import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_SWATCH } from '../data/generateProducts'
import { DispensaryForm, type DispensaryFormValues } from '../components/manage/DispensaryForm'
import { ProductForm, type ProductFormValues } from '../components/manage/ProductForm'
import { Card, PrimaryButton, GhostButton, SectionHeading, EmptyState } from '../components/ui'
import { MapPinIcon } from '../components/Icons'
import { formatPrice } from '../utils/format'
import { representativePrice } from '../utils/filters'
import type { AccessorySubtype, ConcentrateSubtype, Dispensary, Product } from '../types'

type View =
  | { mode: 'list' }
  | { mode: 'add-dispensary' }
  | { mode: 'edit-dispensary'; id: string }
  | { mode: 'menu'; dispensaryId: string }
  | { mode: 'add-product'; dispensaryId: string }
  | { mode: 'edit-product'; dispensaryId: string; productId: string }

function dispensaryToFormValues(d: Dispensary): DispensaryFormValues {
  return {
    name: d.name,
    address: d.address,
    city: d.city,
    state: d.state,
    zip: d.zip,
    hours: d.hours,
    phone: d.phone,
    website: d.website ?? '',
    licenseNumber: d.licenseNumber,
    coords: d.coords,
  }
}

function formValuesToDispensaryPayload(v: DispensaryFormValues): Omit<Dispensary, 'id' | 'source'> {
  return {
    name: v.name.trim(),
    address: v.address.trim(),
    city: v.city.trim(),
    state: v.state.trim(),
    zip: v.zip.trim(),
    // validated non-null by DispensaryForm before onSubmit fires
    coords: v.coords!,
    hours: v.hours.trim() || 'Hours not listed',
    phone: v.phone.trim() || 'Not listed',
    licenseNumber: v.licenseNumber.trim() || 'Not provided',
    ...(v.website.trim() ? { website: v.website.trim() } : {}),
  }
}

function productToFormValues(p: Product): ProductFormValues {
  return {
    name: p.name,
    category: p.category,
    subtype: p.subtype ?? '',
    brandName: p.brandId,
    strainId: p.strainId ?? '',
    sizes: p.sizes,
    thcPercent: p.thcPercent === undefined ? '' : String(p.thcPercent),
    terpenePercent: p.terpenePercent === undefined ? '' : String(p.terpenePercent),
    description: p.description,
  }
}

function formValuesToProductPayload(dispensaryId: string, v: ProductFormValues): Omit<Product, 'id'> {
  return {
    dispensaryId,
    category: v.category,
    subtype: (v.subtype || undefined) as ConcentrateSubtype | AccessorySubtype | undefined,
    name: v.name.trim(),
    // No separate "add a brand" step for user-added products — the brand
    // name IS the id here; ProductCard etc. fall back to displaying it
    // directly when it doesn't match a built-in Brand record (see
    // useCombinedData.ts's nameFromBrandLookup).
    brandId: v.brandName.trim(),
    ...(v.strainId ? { strainId: v.strainId } : {}),
    sizes: v.sizes,
    ...(v.thcPercent !== '' ? { thcPercent: Number(v.thcPercent) } : {}),
    ...(v.terpenePercent !== '' ? { terpenePercent: Number(v.terpenePercent) } : {}),
    swatch: CATEGORY_SWATCH[v.category],
    description: v.description.trim() || 'Added via Manage.',
  }
}

export function ManagePage() {
  const userDispensaries = useAppStore((s) => s.userDispensaries)
  const userProducts = useAppStore((s) => s.userProducts)
  const addUserDispensary = useAppStore((s) => s.addUserDispensary)
  const updateUserDispensary = useAppStore((s) => s.updateUserDispensary)
  const removeUserDispensary = useAppStore((s) => s.removeUserDispensary)
  const addUserProduct = useAppStore((s) => s.addUserProduct)
  const updateUserProduct = useAppStore((s) => s.updateUserProduct)
  const removeUserProduct = useAppStore((s) => s.removeUserProduct)

  const [view, setView] = useState<View>({ mode: 'list' })

  if (view.mode === 'add-dispensary' || view.mode === 'edit-dispensary') {
    const editing = view.mode === 'edit-dispensary' ? userDispensaries.find((d) => d.id === view.id) : undefined
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-stone-800 dark:text-stone-100">
            {editing ? `Edit ${editing.name}` : 'Add a dispensary'}
          </h2>
          <DispensaryForm
            initial={editing ? dispensaryToFormValues(editing) : undefined}
            submitLabel={editing ? 'Save changes' : 'Add dispensary'}
            onCancel={() => setView(editing ? { mode: 'menu', dispensaryId: editing.id } : { mode: 'list' })}
            onSubmit={(values) => {
              const payload = formValuesToDispensaryPayload(values)
              if (editing) {
                updateUserDispensary(editing.id, payload)
                setView({ mode: 'menu', dispensaryId: editing.id })
              } else {
                const id = addUserDispensary(payload)
                // Jump straight into adding its first menu item —
                // a dispensary with zero products isn't very useful yet.
                setView({ mode: 'add-product', dispensaryId: id })
              }
            }}
          />
        </Card>
      </div>
    )
  }

  if (view.mode === 'add-product' || view.mode === 'edit-product') {
    const dispensary = userDispensaries.find((d) => d.id === view.dispensaryId)
    const editing =
      view.mode === 'edit-product' ? userProducts.find((p) => p.id === view.productId) : undefined
    if (!dispensary) {
      return <EmptyStateBackToList onBack={() => setView({ mode: 'list' })} />
    }
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-stone-800 dark:text-stone-100">
            {editing ? 'Edit product' : 'Add a product'}
          </h2>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">at {dispensary.name}</p>
          <ProductForm
            initial={editing ? productToFormValues(editing) : undefined}
            submitLabel={editing ? 'Save changes' : 'Add product'}
            onCancel={() => setView({ mode: 'menu', dispensaryId: dispensary.id })}
            onSubmit={(values) => {
              const payload = formValuesToProductPayload(dispensary.id, values)
              if (editing) updateUserProduct(editing.id, payload)
              else addUserProduct(payload)
              setView({ mode: 'menu', dispensaryId: dispensary.id })
            }}
          />
        </Card>
      </div>
    )
  }

  if (view.mode === 'menu') {
    const dispensary = userDispensaries.find((d) => d.id === view.dispensaryId)
    if (!dispensary) {
      return <EmptyStateBackToList onBack={() => setView({ mode: 'list' })} />
    }
    const items = userProducts.filter((p) => p.dispensaryId === dispensary.id)
    return (
      <div className="mx-auto max-w-3xl p-4">
        <button
          onClick={() => setView({ mode: 'list' })}
          className="mb-3 text-sm text-leaf-700 underline hover:text-leaf-800 dark:text-leaf-400"
        >
          ← Your dispensaries
        </button>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">{dispensary.name}</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {dispensary.address}, {dispensary.city}
            </p>
          </div>
          <div className="flex gap-2">
            <GhostButton onClick={() => setView({ mode: 'edit-dispensary', id: dispensary.id })}>
              Edit details
            </GhostButton>
            <PrimaryButton onClick={() => setView({ mode: 'add-product', dispensaryId: dispensary.id })}>
              + Add a product
            </PrimaryButton>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No products yet"
            hint={`Click "Add a product" above to start building this dispensary's menu.`}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((p) => {
              const price = representativePrice(p, [])
              return (
                <Card key={p.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-stone-400">{p.brandId}</p>
                    </div>
                    {price !== null && (
                      <span className="whitespace-nowrap text-sm font-semibold text-leaf-700 dark:text-leaf-400">
                        {formatPrice(price)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      onClick={() => setView({ mode: 'edit-product', dispensaryId: dispensary.id, productId: p.id })}
                      className="text-leaf-700 underline hover:text-leaf-800 dark:text-leaf-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${p.name}"?`)) removeUserProduct(p.id)
                      }}
                      className="text-stone-400 underline hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // mode === 'list'
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Manage your dispensaries</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Added here, saved only in this browser — shows up on the map, in search, and in Menu
            alongside everything else.
          </p>
        </div>
        <PrimaryButton onClick={() => setView({ mode: 'add-dispensary' })}>+ Add a dispensary</PrimaryButton>
      </div>

      {userDispensaries.length === 0 ? (
        <EmptyState
          title="You haven't added any dispensaries yet"
          hint="Add one to place it on the map and build out its real menu."
        />
      ) : (
        <div className="space-y-3">
          {userDispensaries.map((d) => {
            const count = userProducts.filter((p) => p.dispensaryId === d.id).length
            return (
              <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-2">
                  <MapPinIcon width={16} height={16} className="mt-0.5 shrink-0 text-leaf-600" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800 dark:text-stone-100">{d.name}</p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                      {d.address}, {d.city} · {count} {count === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <GhostButton onClick={() => setView({ mode: 'menu', dispensaryId: d.id })}>
                    Manage menu
                  </GhostButton>
                  <GhostButton onClick={() => setView({ mode: 'edit-dispensary', id: d.id })}>Edit</GhostButton>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${d.name}" and all of its products?`)) removeUserDispensary(d.id)
                    }}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-stone-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyStateBackToList({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <EmptyState title="That dispensary isn't there anymore" />
      <div className="mt-3 text-center">
        <GhostButton onClick={onBack}>Back to your dispensaries</GhostButton>
      </div>
    </div>
  )
}
