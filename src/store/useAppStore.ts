import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AccessorySubtype,
  AppTab,
  BoundaryShape,
  Coordinates,
  ProductCategory,
  SortOption,
  StrainLineage,
} from '../types'
import {
  DEFAULT_THC_RANGE,
  DEFAULT_TERPENE_RANGE,
  dispensariesInBoundary,
  type FilterState,
} from '../utils/filters'
import { dispensaries, minMaxPrice, products } from '../data'

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

const FULL_PRICE_RANGE = minMaxPrice(products)

export interface AppState extends FilterState {
  boundary: BoundaryShape
  userLocation: Coordinates | null
  favorites: string[]
  activeTab: AppTab
  /** Whether the user has explicitly confirmed their map search area/
   * dispensary picks. The Menu tab's filters + results stay gated behind
   * this until they hit "Continue" on the Map tab — see confirmSelection. */
  boundaryConfirmed: boolean

  setActiveTab: (t: AppTab) => void
  confirmSelection: () => void
  toggleDispensary: (id: string) => void
  setSelectedDispensaries: (ids: string[]) => void
  clearDispensarySelection: () => void
  setBoundary: (b: BoundaryShape) => void
  setUserLocation: (c: Coordinates | null) => void

  toggleCategory: (c: ProductCategory) => void
  setCategories: (c: ProductCategory[]) => void
  toggleAccessorySubtype: (s: AccessorySubtype) => void
  toggleSize: (g: number) => void
  setPriceRange: (r: [number, number]) => void
  setSort: (s: SortOption) => void

  toggleStrain: (id: string) => void
  toggleBrand: (id: string) => void
  toggleLineage: (l: StrainLineage) => void
  setThcRange: (r: [number, number]) => void
  setTerpeneRange: (r: [number, number]) => void
  resetDetailFilters: () => void
  resetProductFilters: () => void

  toggleFavorite: (productId: string) => void
}

export const FULL_PRICE_RANGE_CONST = FULL_PRICE_RANGE

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedDispensaryIds: [],
      categories: [],
      accessorySubtypes: [],
      sizesG: [],
      priceRange: FULL_PRICE_RANGE,
      sort: 'price-desc',
      strainIds: [],
      brandIds: [],
      lineages: [],
      thcRange: DEFAULT_THC_RANGE,
      terpeneRange: DEFAULT_TERPENE_RANGE,

      boundary: null,
      userLocation: null,
      favorites: [],
      activeTab: 'map',
      boundaryConfirmed: false,

      setActiveTab: (t) => set({ activeTab: t }),
      confirmSelection: () => set({ boundaryConfirmed: true }),
      toggleDispensary: (id) =>
        set((s) => ({
          selectedDispensaryIds: toggleInArray(s.selectedDispensaryIds, id),
          boundaryConfirmed: false,
        })),
      setSelectedDispensaries: (ids) => set({ selectedDispensaryIds: ids, boundaryConfirmed: false }),
      clearDispensarySelection: () => set({ selectedDispensaryIds: [], boundaryConfirmed: false }),
      setBoundary: (b) =>
        set((s) => {
          const allowed = new Set(dispensariesInBoundary(dispensaries, b).map((d) => d.id))
          return {
            boundary: b,
            selectedDispensaryIds: s.selectedDispensaryIds.filter((id) => allowed.has(id)),
            boundaryConfirmed: false,
          }
        }),
      setUserLocation: (c) => set({ userLocation: c }),

      toggleCategory: (c) => {
        set((s) => ({
          categories: toggleInArray(s.categories, c),
          // clear accessory subtype picks when accessories is deselected
          accessorySubtypes: c === 'accessory' && s.categories.includes(c) ? [] : s.accessorySubtypes,
        }))
      },
      setCategories: (c) => set({ categories: c }),
      toggleAccessorySubtype: (subtype) =>
        set((s) => ({ accessorySubtypes: toggleInArray(s.accessorySubtypes, subtype) })),
      toggleSize: (g) => set((s) => ({ sizesG: toggleInArray(s.sizesG, g) })),
      setPriceRange: (r) => set({ priceRange: r }),
      setSort: (sort) => set({ sort }),

      toggleStrain: (id) => set((s) => ({ strainIds: toggleInArray(s.strainIds, id) })),
      toggleBrand: (id) => set((s) => ({ brandIds: toggleInArray(s.brandIds, id) })),
      toggleLineage: (l) => set((s) => ({ lineages: toggleInArray(s.lineages, l) })),
      setThcRange: (r) => set({ thcRange: r }),
      setTerpeneRange: (r) => set({ terpeneRange: r }),
      resetDetailFilters: () =>
        set({
          strainIds: [],
          brandIds: [],
          lineages: [],
          thcRange: DEFAULT_THC_RANGE,
          terpeneRange: DEFAULT_TERPENE_RANGE,
        }),
      resetProductFilters: () =>
        set({
          categories: [],
          accessorySubtypes: [],
          sizesG: [],
          priceRange: FULL_PRICE_RANGE,
          strainIds: [],
          brandIds: [],
          lineages: [],
          thcRange: DEFAULT_THC_RANGE,
          terpeneRange: DEFAULT_TERPENE_RANGE,
        }),

      toggleFavorite: (productId) =>
        set((s) => ({ favorites: toggleInArray(s.favorites, productId) })),
    }),
    {
      name: 'leafmap-storage',
      partialize: (state) => ({
        favorites: state.favorites,
        selectedDispensaryIds: state.selectedDispensaryIds,
        boundary: state.boundary,
      }),
    },
  ),
)

export function useIsFavorite(productId: string): boolean {
  return useAppStore((s) => s.favorites.includes(productId))
}
