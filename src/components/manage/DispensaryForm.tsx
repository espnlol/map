import { useState, type FormEvent } from 'react'
import { LocationPickerMap } from '../map/LocationPickerMap'
import { PrimaryButton, GhostButton } from '../ui'
import type { Coordinates } from '../../types'

export interface DispensaryFormValues {
  name: string
  address: string
  city: string
  state: string
  zip: string
  hours: string
  phone: string
  website: string
  licenseNumber: string
  coords: Coordinates | null
}

const EMPTY_VALUES: DispensaryFormValues = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  hours: '',
  phone: '',
  website: '',
  licenseNumber: '',
  coords: null,
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-800"
      />
    </label>
  )
}

export function DispensaryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save dispensary',
}: {
  initial?: Partial<DispensaryFormValues>
  onSubmit: (values: DispensaryFormValues) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [values, setValues] = useState<DispensaryFormValues>({ ...EMPTY_VALUES, ...initial })
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof DispensaryFormValues>(key: K, value: DispensaryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.name.trim() || !values.address.trim() || !values.city.trim()) {
      setError('Name, address, and city are required.')
      return
    }
    if (!values.coords) {
      setError('Click the map below to set this location.')
      return
    }
    setError(null)
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name *" value={values.name} onChange={(v) => set('name', v)} />
        <Field label="Phone" value={values.phone} onChange={(v) => set('phone', v)} />
        <Field
          label="Address *"
          value={values.address}
          onChange={(v) => set('address', v)}
          className="sm:col-span-2"
        />
        <Field label="City *" value={values.city} onChange={(v) => set('city', v)} />
        <Field label="State" value={values.state} onChange={(v) => set('state', v)} placeholder="e.g. CO" />
        <Field label="ZIP" value={values.zip} onChange={(v) => set('zip', v)} />
        <Field
          label="Hours"
          value={values.hours}
          onChange={(v) => set('hours', v)}
          placeholder="e.g. 9am – 9pm daily"
        />
        <Field
          label="Website"
          value={values.website}
          onChange={(v) => set('website', v)}
          placeholder="https://…"
        />
        <Field
          label="License #"
          value={values.licenseNumber}
          onChange={(v) => set('licenseNumber', v)}
          placeholder="Optional"
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
          Location * — click the map to place it, drag the pin to fine-tune
        </p>
        <div className="h-64 overflow-hidden rounded-xl border border-stone-300 dark:border-stone-600">
          <LocationPickerMap value={values.coords} onChange={(c) => set('coords', c)} />
        </div>
        {values.coords && (
          <p className="mt-1 text-xs text-stone-400">
            {values.coords.lat.toFixed(5)}, {values.coords.lng.toFixed(5)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </form>
  )
}
