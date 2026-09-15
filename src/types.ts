// Core domain types for the dispensary price tracker.
// Kept framework-agnostic so this file could back a real API client later.

export type ProductCategory =
  | 'flower'
  | 'cartridge'
  | 'concentrate'
  | 'edible'
  | 'tincture'
  | 'accessory'

export const PRODUCT_CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'flower', label: 'Flower' },
  { id: 'cartridge', label: 'Cartridges' },
  { id: 'concentrate', label: 'Concentrates & Rosin' },
  { id: 'edible', label: 'Edibles' },
  { id: 'tincture', label: 'Tinctures' },
  { id: 'accessory', label: 'Accessories' },
]

/** Categories where THC% / terpene% fields make sense. */
export const POTENCY_FILTERABLE_CATEGORIES: ProductCategory[] = [
  'flower',
  'cartridge',
  'concentrate',
]

/** Accent color used for a product card's placeholder swatch, by category. */
export const CATEGORY_SWATCH: Record<ProductCategory, string> = {
  flower: '#399462',
  cartridge: '#d97706',
  concentrate: '#ea580c',
  edible: '#db2777',
  tincture: '#2563eb',
  accessory: '#64748b',
}

export type ConcentrateSubtype =
  | 'rosin'
  | 'live-resin'
  | 'wax'
  | 'shatter'
  | 'badder'
  | 'diamonds'

export const CONCENTRATE_SUBTYPES: { id: ConcentrateSubtype; label: string }[] = [
  { id: 'rosin', label: 'Rosin' },
  { id: 'live-resin', label: 'Live Resin' },
  { id: 'wax', label: 'Wax' },
  { id: 'shatter', label: 'Shatter' },
  { id: 'badder', label: 'Badder/Budder' },
  { id: 'diamonds', label: 'Diamonds' },
]

export type AccessorySubtype =
  | 'grinder'
  | 'lighter'
  | 'dab-rig'
  | 'bong'
  | 'nectar-collector'
  | 'battery'
  | 'papers'
  | 'cones'
  | 'other'

export const ACCESSORY_SUBTYPES: { id: AccessorySubtype; label: string }[] = [
  { id: 'grinder', label: 'Grinders' },
  { id: 'lighter', label: 'Lighters' },
  { id: 'dab-rig', label: 'Dab Rigs' },
  { id: 'bong', label: 'Bongs' },
  { id: 'nectar-collector', label: 'Nectar Collectors' },
  { id: 'battery', label: 'Batteries' },
  { id: 'papers', label: 'Rolling Papers' },
  { id: 'cones', label: 'Pre-Rolled Cones' },
  { id: 'other', label: 'Other' },
]

/** Fixed unit-size menus per category, as requested (grams). */
export const CARTRIDGE_SIZES_G = [0.5, 1, 2] as const
export const ROSIN_SIZES_G = [0.5, 1, 2, 3, 4] as const
export const OTHER_CONCENTRATE_SIZES_G = [0.5, 1, 2] as const
export const FLOWER_SIZES_G = [1, 3.5, 7, 14, 28] as const

export type StrainLineage = 'indica' | 'sativa' | 'hybrid'

export const LINEAGE_LABEL: Record<StrainLineage, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
}

export interface Coordinates {
  lat: number
  lng: number
}

export interface Dispensary {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  coords: Coordinates
  hours: string
  phone: string
  licenseNumber: string
  /** The dispensary's real website — what the Websites tab links to and
   * groups logged prices under. */
  website?: string
}

export interface Strain {
  id: string
  name: string
  lineage: StrainLineage
}

export interface SizeOption {
  /** Human readable label, e.g. "3.5g" or "10-pack (100mg)" */
  label: string
  price: number
  grams?: number
  /** THC milligrams for this specific size (edibles/tinctures) */
  mg?: number
}

export interface Product {
  id: string
  dispensaryId: string
  category: ProductCategory
  subtype?: ConcentrateSubtype | AccessorySubtype
  name: string
  brandId: string
  strainId?: string
  sizes: SizeOption[]
  thcPercent?: number
  terpenePercent?: number
  /** Accent color used for the placeholder product-art swatch on cards */
  swatch: string
  description: string
}

export type AppTab = 'websites' | 'favorites' | 'manage'
