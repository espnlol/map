import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AccessorySubtype,
  AppTab,
  Dispensary,
  Product,
  ProductCategory,
  SortOption,
  StrainLineage,
} from '../types'
import { DEFAULT_THC_RANGE, DEFAULT_TERPENE_RANGE, type FilterState } from '../utils/filters'
import { minMaxPrice, products } from '../data'

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** So a newly-added (or re-priced) product never gets silently hidden by
 * a price filter ceiling/floor set before it existed — widens (never
 * narrows) the current range to cover it. */
function widenRangeFor(current: [number, number], prices: number[]): [number, number] {
  if (prices.length === 0) return current
  return [Math.min(current[0], ...prices), Math.max(current[1], ...prices)]
}

const FULL_PRICE_RANGE = minMaxPrice(products)

export interface AppState extends FilterState {
  favorites: string[]
  activeTab: AppTab

  /** Dispensaries/products added through the Manage tab. Saved only in
   * this browser (persist middleware -> localStorage) — there's no
   * shared backend, by design (see README). Merged with the built-in
   * demo/imported catalog everywhere via useAllDispensaries/useAllProducts
   * (src/store/useCombinedData.ts) rather than kept separate. */
  userDispensaries: Dispensary[]
  userProducts: Product[]

  setActiveTab: (t: AppTab) => void
  toggleDispensary: (id: string) => void
  setSelectedDispensaries: (ids: string[]) => void
  clearDispensarySelection: () => void

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

  /** Returns the new dispensary's id. */
  addUserDispensary: (d: Omit<Dispensary, 'id' | 'source'>) => string
  updateUserDispensary: (id: string, patch: Partial<Omit<Dispensary, 'id'>>) => void
  /** Also removes that dispensary's own user-added products, drops it from
   * selection/favorites, so nothing dangles pointing at a deleted id. */
  removeUserDispensary: (id: string) => void

  /** Returns the new product's id. */
  addUserProduct: (p: Omit<Product, 'id'>) => string
  updateUserProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => void
  removeUserProduct: (id: string) => void
}

export const FULL_PRICE_RANGE_CONST = FULL_PRICE_RANGE

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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

      favorites: [],
      activeTab: 'menu',
      userDispensaries: [],
      userProducts: [],

      setActiveTab: (t) => set({ activeTab: t }),
      toggleDispensary: (id) =>
        set((s) => ({ selectedDispensaryIds: toggleInArray(s.selectedDispensaryIds, id) })),
      setSelectedDispensaries: (ids) => set({ selectedDispensaryIds: ids }),
      clearDispensarySelection: () => set({ selectedDispensaryIds: [] }),

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
        set((s) => ({
          categories: [],
          accessorySubtypes: [],
          sizesG: [],
          priceRange: minMaxPrice([...products, ...s.userProducts]),
          strainIds: [],
          brandIds: [],
          lineages: [],
          thcRange: DEFAULT_THC_RANGE,
          terpeneRange: DEFAULT_TERPENE_RANGE,
        })),

      toggleFavorite: (productId) =>
        set((s) => ({ favorites: toggleInArray(s.favorites, productId) })),

      addUserDispensary: (d) => {
        const id = genId('user-disp')
        const dispensary: Dispensary = { ...d, id, source: 'user-added' }
        set((s) => ({ userDispensaries: [...s.userDispensaries, dispensary] }))
        return id
      },
      updateUserDispensary: (id, patch) =>
        set((s) => ({
          userDispensaries: s.userDispensaries.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeUserDispensary: (id) => {
        const productIds = new Set(
          get()
            .userProducts.filter((p) => p.dispensaryId === id)
            .map((p) => p.id),
        )
        set((s) => ({
          userDispensaries: s.userDispensaries.filter((d) => d.id !== id),
          userProducts: s.userProducts.filter((p) => p.dispensaryId !== id),
          selectedDispensaryIds: s.selectedDispensaryIds.filter((sid) => sid !== id),
          favorites: s.favorites.filter((fid) => !productIds.has(fid)),
        }))
      },

      addUserProduct: (p) => {
        const id = genId('user-prod')
        set((s) => ({
          userProducts: [...s.userProducts, { ...p, id }],
          priceRange: widenRangeFor(
            s.priceRange,
            p.sizes.map((sz) => sz.price),
          ),
        }))
        return id
      },
      updateUserProduct: (id, patch) =>
        set((s) => ({
          userProducts: s.userProducts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          priceRange: patch.sizes ? widenRangeFor(s.priceRange, patch.sizes.map((sz) => sz.price)) : s.priceRange,
        })),
      removeUserProduct: (id) =>
        set((s) => ({
          userProducts: s.userProducts.filter((p) => p.id !== id),
          favorites: s.favorites.filter((fid) => fid !== id),
        })),
    }),
    {
      name: 'leafmap-storage',
      partialize: (state) => ({
        favorites: state.favorites,
        selectedDispensaryIds: state.selectedDispensaryIds,
        userDispensaries: state.userDispensaries,
        userProducts: state.userProducts,
      }),
    },
  ),
)

export function useIsFavorite(productId: string): boolean {
  return useAppStore((s) => s.favorites.includes(productId))
}
