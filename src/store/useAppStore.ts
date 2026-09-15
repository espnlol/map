import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppTab, Dispensary, Product } from '../types'

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface AppState {
  favorites: string[]
  activeTab: AppTab

  /** Dispensaries/products added through the Manage tab — the only data
   * this app has. Saved only in this browser (persist middleware ->
   * localStorage); there's no shared backend, by design (see README). */
  userDispensaries: Dispensary[]
  userProducts: Product[]

  setActiveTab: (t: AppTab) => void
  toggleFavorite: (productId: string) => void

  /** Returns the new dispensary's id. */
  addUserDispensary: (d: Omit<Dispensary, 'id'>) => string
  updateUserDispensary: (id: string, patch: Partial<Omit<Dispensary, 'id'>>) => void
  /** Also removes that dispensary's own products and drops it from
   * favorites, so nothing dangles pointing at a deleted id. */
  removeUserDispensary: (id: string) => void

  /** Returns the new product's id. */
  addUserProduct: (p: Omit<Product, 'id'>) => string
  updateUserProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => void
  removeUserProduct: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      favorites: [],
      activeTab: 'websites',
      userDispensaries: [],
      userProducts: [],

      setActiveTab: (t) => set({ activeTab: t }),
      toggleFavorite: (productId) =>
        set((s) => ({ favorites: toggleInArray(s.favorites, productId) })),

      addUserDispensary: (d) => {
        const id = genId('user-disp')
        const dispensary: Dispensary = { ...d, id }
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
          favorites: s.favorites.filter((fid) => !productIds.has(fid)),
        }))
      },

      addUserProduct: (p) => {
        const id = genId('user-prod')
        set((s) => ({ userProducts: [...s.userProducts, { ...p, id }] }))
        return id
      },
      updateUserProduct: (id, patch) =>
        set((s) => ({
          userProducts: s.userProducts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
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
        userDispensaries: state.userDispensaries,
        userProducts: state.userProducts,
      }),
    },
  ),
)

export function useIsFavorite(productId: string): boolean {
  return useAppStore((s) => s.favorites.includes(productId))
}
