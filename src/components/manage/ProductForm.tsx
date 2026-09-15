import { useState, type FormEvent } from 'react'
import { PrimaryButton, GhostButton, Chip } from '../ui'
import { strains } from '../../data'
import {
  PRODUCT_CATEGORIES,
  CONCENTRATE_SUBTYPES,
  ACCESSORY_SUBTYPES,
  POTENCY_FILTERABLE_CATEGORIES,
  CARTRIDGE_SIZES_G,
  ROSIN_SIZES_G,
  OTHER_CONCENTRATE_SIZES_G,
  FLOWER_SIZES_G,
  CATEGORY_SWATCH,
} from '../../types'
import type { ProductCategory, SizeOption } from '../../types'

export interface ProductFormValues {
  name: string
  category: ProductCategory
  subtype: string
  brandName: string
  strainId: string
  sizes: SizeOption[]
  thcPercent: string
  terpenePercent: string
  description: string
}

const EMPTY_VALUES: ProductFormValues = {
  name: '',
  category: 'flower',
  subtype: '',
  brandName: '',
  strainId: '',
  sizes: [],
  thcPercent: '',
  terpenePercent: '',
  description: '',
}

function quickSizesFor(category: ProductCategory, subtype: string): number[] {
  if (category === 'flower') return [...FLOWER_SIZES_G]
  if (category === 'cartridge') return [...CARTRIDGE_SIZES_G]
  if (category === 'concentrate') return subtype === 'rosin' ? [...ROSIN_SIZES_G] : [...OTHER_CONCENTRATE_SIZES_G]
  return []
}

export function ProductForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save product',
}: {
  initial?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY_VALUES, ...initial })
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setCategory(category: ProductCategory) {
    setValues((v) => ({ ...v, category, subtype: '' }))
  }

  function updateSizeRow(i: number, patch: Partial<SizeOption>) {
    setValues((v) => ({ ...v, sizes: v.sizes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }))
  }
  function removeSizeRow(i: number) {
    setValues((v) => ({ ...v, sizes: v.sizes.filter((_, idx) => idx !== i) }))
  }
  function addBlankSize() {
    setValues((v) => ({ ...v, sizes: [...v.sizes, { label: '', price: 0 }] }))
  }
  function quickAddSize(grams: number) {
    const label = `${grams}g`
    if (values.sizes.some((s) => s.label === label)) return
    setValues((v) => ({ ...v, sizes: [...v.sizes, { label, price: 0, grams }] }))
  }

  const showPotency = POTENCY_FILTERABLE_CATEGORIES.includes(values.category)
  const showStrain = POTENCY_FILTERABLE_CATEGORIES.includes(values.category)
  const quickSizes = quickSizesFor(values.category, values.subtype)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return setError('Name is required.')
    if (!values.brandName.trim()) return setError('Brand is required.')
    if (values.sizes.length === 0) return setError('Add at least one size and price.')
    if (values.sizes.some((s) => !s.label.trim() || s.price <= 0)) {
      return setError('Every size needs a label and a price greater than $0.')
    }
    setError(null)
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">Name *</span>
          <input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">Brand *</span>
          <input
            value={values.brandName}
            onChange={(e) => set('brandName', e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Product type</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((c) => (
            <Chip key={c.id} active={values.category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {values.category === 'concentrate' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
            Concentrate type (rosin gets the 0.5–4g size menu; others get 0.5–2g)
          </p>
          <div className="flex flex-wrap gap-2">
            {CONCENTRATE_SUBTYPES.map((s) => (
              <Chip key={s.id} active={values.subtype === s.id} onClick={() => set('subtype', s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {values.category === 'accessory' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Accessory type</p>
          <div className="flex flex-wrap gap-2">
            {ACCESSORY_SUBTYPES.map((s) => (
              <Chip key={s.id} active={values.subtype === s.id} onClick={() => set('subtype', s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {showStrain && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Strain (optional — pick the closest match to make it filterable by strain/lineage)
          </span>
          <select
            value={values.strainId}
            onChange={(e) => set('strainId', e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
          >
            <option value="">No strain</option>
            {[...strains]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.lineage})
                </option>
              ))}
          </select>
        </label>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Sizes &amp; prices *</p>
        {quickSizes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickSizes.map((g) => (
              <Chip key={g} active={values.sizes.some((s) => s.label === `${g}g`)} onClick={() => quickAddSize(g)}>
                + {g}g
              </Chip>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {values.sizes.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.label}
                onChange={(e) => updateSizeRow(i, { label: e.target.value })}
                placeholder="e.g. 3.5g or 10-pack"
                className="w-40 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
              />
              <span className="text-sm text-stone-400">$</span>
              <input
                type="number"
                min={0}
                step={1}
                value={s.price || ''}
                onChange={(e) => updateSizeRow(i, { price: Number(e.target.value) })}
                className="w-24 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
              />
              <button
                type="button"
                onClick={() => removeSizeRow(i)}
                className="text-xs text-stone-400 underline hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addBlankSize}
          className="mt-2 text-xs text-leaf-700 underline hover:text-leaf-800 dark:text-leaf-400"
        >
          + Add a custom size
        </button>
      </div>

      {showPotency && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">THC %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={values.thcPercent}
              onChange={(e) => set('thcPercent', e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">Terpene %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={values.terpenePercent}
              onChange={(e) => set('terpenePercent', e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
            />
          </label>
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          Description (optional)
        </span>
        <textarea
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
        />
      </label>

      <div className="flex items-center gap-1.5 text-xs text-stone-400">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: CATEGORY_SWATCH[values.category] }}
        />
        Card color for this product type
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </form>
  )
}
