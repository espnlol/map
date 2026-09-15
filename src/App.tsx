import { useState } from 'react'
import { StrainsPage } from './pages/StrainsPage'
import { TerpenesPage } from './pages/TerpenesPage'
import { LeafIcon } from './components/Icons'

type Tab = 'strains' | 'terpenes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'strains', label: 'Strains' },
  { id: 'terpenes', label: 'Terpenes' },
]

export default function App() {
  const [tab, setTabRaw] = useState<Tab>('strains')
  const [focusStrainId, setFocusStrainId] = useState<string | null>(null)
  const [focusTerpeneId, setFocusTerpeneId] = useState<string | null>(null)

  // Plain nav click: switch tabs, don't jump to anything in particular.
  function setTab(t: Tab) {
    setTabRaw(t)
    setFocusStrainId(null)
    setFocusTerpeneId(null)
  }

  // Cross-links: a terpene's "strains commonly high in this" tag jumps to
  // that strain's detail view; a strain's terpene breakdown's "Full
  // breakdown →" jumps to that terpene's entry, scrolled into view.
  function jumpToStrain(id: string) {
    setTabRaw('strains')
    setFocusStrainId(id)
  }
  function jumpToTerpene(id: string) {
    setTabRaw('terpenes')
    setFocusTerpeneId(id)
  }

  return (
    <div className="min-h-dvh bg-stone-50 dark:bg-stone-950">
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 font-semibold text-leaf-800 dark:text-leaf-300">
          <LeafIcon width={20} height={20} />
          StrainGuide
        </div>
        <nav className="flex gap-1 rounded-full bg-stone-100 p-1 dark:bg-stone-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-leaf-800 shadow-sm dark:bg-stone-700 dark:text-leaf-200'
                  : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'strains' && <StrainsPage focusStrainId={focusStrainId} jumpToTerpene={jumpToTerpene} />}
        {tab === 'terpenes' && <TerpenesPage focusTerpeneId={focusTerpeneId} jumpToStrain={jumpToStrain} />}
      </main>
    </div>
  )
}
