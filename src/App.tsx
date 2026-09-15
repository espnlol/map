import { useState } from 'react'
import { MapPage } from './pages/MapPage'
import { MenuPage } from './pages/MenuPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { useAppStore } from './store/useAppStore'
import { HeartIcon, MapPinIcon } from './components/Icons'

type Tab = 'map' | 'menu' | 'favorites'

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'menu', label: 'Menu' },
  { id: 'favorites', label: 'Favorites' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const favoritesCount = useAppStore((s) => s.favorites.length)

  return (
    <div className="min-h-dvh bg-stone-50 dark:bg-stone-950">
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 font-semibold text-leaf-800 dark:text-leaf-300">
          <MapPinIcon width={20} height={20} />
          LeafMap
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-stone-400 dark:bg-stone-800">
            Demo data
          </span>
        </div>
        <nav className="flex gap-1 rounded-full bg-stone-100 p-1 dark:bg-stone-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-leaf-800 shadow-sm dark:bg-stone-700 dark:text-leaf-200'
                  : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
              }`}
            >
              {t.id === 'favorites' ? (
                <span className="flex items-center gap-1">
                  <HeartIcon width={14} height={14} filled={favoritesCount > 0} />
                  {t.label}
                  {favoritesCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-leaf-600 px-1.5 text-[10px] text-white">
                      {favoritesCount}
                    </span>
                  )}
                </span>
              ) : (
                t.label
              )}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'map' && <MapPage />}
        {tab === 'menu' && <MenuPage />}
        {tab === 'favorites' && <FavoritesPage />}
      </main>
    </div>
  )
}
