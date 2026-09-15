import { useMemo, useState } from 'react'
import { dispensaries } from '../data'
import { useAppStore } from '../store/useAppStore'
import { DispensaryMap } from '../components/map/DispensaryMap'
import {
  DETAIL_UNLOCK_THRESHOLD,
  dispensariesInBoundary,
  effectiveDispensaryIds,
} from '../utils/filters'
import { distanceMiles, formatDistance } from '../utils/geo'
import { Card, GhostButton, SectionHeading } from '../components/ui'
import { CircleIcon, CrosshairIcon, DrawIcon, MapPinIcon, SearchIcon, StarIcon, XIcon } from '../components/Icons'
import type { Coordinates } from '../types'

type Mode = 'none' | 'radius' | 'shape'

export function MapPage() {
  const boundary = useAppStore((s) => s.boundary)
  const setBoundary = useAppStore((s) => s.setBoundary)
  const selectedDispensaryIds = useAppStore((s) => s.selectedDispensaryIds)
  const toggleDispensary = useAppStore((s) => s.toggleDispensary)
  const setSelectedDispensaries = useAppStore((s) => s.setSelectedDispensaries)
  const clearDispensarySelection = useAppStore((s) => s.clearDispensarySelection)
  const userLocation = useAppStore((s) => s.userLocation)
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  const [mode, setMode] = useState<Mode>(
    boundary?.kind === 'circle' ? 'radius' : boundary?.kind === 'polygon' ? 'shape' : 'none',
  )
  const [radiusMiles, setRadiusMiles] = useState(boundary?.kind === 'circle' ? boundary.radiusMiles : 5)
  const [pickingCenter, setPickingCenter] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const visibleDispensaries = useMemo(() => dispensariesInBoundary(dispensaries, boundary), [boundary])
  const visibleIds = useMemo(() => new Set(visibleDispensaries.map((d) => d.id)), [visibleDispensaries])
  const selectedIds = useMemo(() => new Set(selectedDispensaryIds), [selectedDispensaryIds])
  const effective = useMemo(
    () => effectiveDispensaryIds(dispensaries, boundary, selectedDispensaryIds),
    [boundary, selectedDispensaryIds],
  )

  const referencePoint: Coordinates | null =
    userLocation ?? (boundary?.kind === 'circle' ? boundary.center : null)

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? dispensaries.filter(
          (d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q),
        )
      : dispensaries
    return [...list].sort((a, b) => {
      if (!referencePoint) return a.name.localeCompare(b.name)
      return distanceMiles(referencePoint, a.coords) - distanceMiles(referencePoint, b.coords)
    })
  }, [search, referencePoint])

  function chooseMode(next: Mode) {
    setPickingCenter(false)
    if (next === 'none') {
      setBoundary(null)
    }
    setMode(next)
  }

  function handleRadiusChange(miles: number) {
    setRadiusMiles(miles)
    if (boundary?.kind === 'circle') {
      setBoundary({ kind: 'circle', center: boundary.center, radiusMiles: miles })
    }
  }

  function handleUseMyLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(coords)
        if (mode === 'radius') {
          setBoundary({ kind: 'circle', center: coords, radiusMiles })
        }
      },
      () => setLocationError('Could not get your location — try clicking the map instead.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  function handlePickCenter(coords: Coordinates) {
    setBoundary({ kind: 'circle', center: coords, radiusMiles })
    setPickingCenter(false)
  }

  const unlocked = effective.length > 0 && effective.length <= DETAIL_UNLOCK_THRESHOLD

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[1600px] flex-col gap-4 p-4 lg:flex-row">
      <div className="flex w-full flex-col gap-3 lg:w-80 lg:shrink-0">
        <Card className="p-4">
          <SectionHeading>Search area</SectionHeading>
          <div className="flex gap-2">
            <GhostButton active={mode === 'none'} onClick={() => chooseMode('none')} className="flex-1">
              All areas
            </GhostButton>
            <GhostButton active={mode === 'radius'} onClick={() => chooseMode('radius')} className="flex-1">
              <span className="flex items-center justify-center gap-1">
                <CircleIcon width={14} height={14} /> Radius
              </span>
            </GhostButton>
            <GhostButton active={mode === 'shape'} onClick={() => chooseMode('shape')} className="flex-1">
              <span className="flex items-center justify-center gap-1">
                <DrawIcon width={14} height={14} /> Draw
              </span>
            </GhostButton>
          </div>

          {mode === 'radius' && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-stone-500 dark:text-stone-400">
                Distance: <span className="font-medium text-stone-700 dark:text-stone-200">{radiusMiles} mi</span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={radiusMiles}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="range-thumb pointer-events-auto w-full appearance-none bg-transparent"
              />
              <div className="flex gap-2">
                <GhostButton onClick={handleUseMyLocation} className="flex-1 text-xs">
                  <span className="flex items-center justify-center gap-1">
                    <CrosshairIcon width={14} height={14} /> Use my location
                  </span>
                </GhostButton>
                <GhostButton
                  active={pickingCenter}
                  onClick={() => setPickingCenter((v) => !v)}
                  className="flex-1 text-xs"
                >
                  <span className="flex items-center justify-center gap-1">
                    <MapPinIcon width={14} height={14} />
                    {pickingCenter ? 'Click the map…' : 'Pick point on map'}
                  </span>
                </GhostButton>
              </div>
              {locationError && <p className="text-xs text-amber-600">{locationError}</p>}
            </div>
          )}

          {mode === 'shape' && (
            <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
              Use the polygon or rectangle tool in the top-left of the map to trace a custom area —
              e.g. along specific roads or a neighborhood boundary — instead of a plain circle.
            </p>
          )}

          {boundary && (
            <button
              onClick={() => {
                setBoundary(null)
                setMode('none')
              }}
              className="mt-3 flex items-center gap-1 text-xs text-stone-500 underline hover:text-stone-700 dark:text-stone-400"
            >
              <XIcon width={12} height={12} /> Clear boundary
            </button>
          )}
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col p-4">
          <SectionHeading
            action={
              <div className="flex gap-2 text-xs">
                <button
                  className="text-leaf-700 hover:underline dark:text-leaf-400"
                  onClick={() => setSelectedDispensaries(visibleDispensaries.map((d) => d.id))}
                >
                  Select visible
                </button>
                <button
                  className="text-stone-400 hover:underline"
                  onClick={clearDispensarySelection}
                >
                  Clear
                </button>
              </div>
            }
          >
            Dispensaries ({effective.length}/{dispensaries.length})
          </SectionHeading>

          <div className="relative mb-2">
            <SearchIcon
              width={14}
              height={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or city…"
              className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-8 pr-2 text-sm dark:border-stone-600 dark:bg-stone-800"
            />
          </div>

          <div
            className={`mb-2 rounded-lg px-2.5 py-2 text-xs ${
              unlocked
                ? 'bg-leaf-50 text-leaf-800 dark:bg-leaf-950 dark:text-leaf-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
            }`}
          >
            {unlocked
              ? `Detail filters unlocked — head to Menu to filter by strain, brand, THC% & terpene%.`
              : `Select ${DETAIL_UNLOCK_THRESHOLD} or fewer dispensaries (via boundary or checkboxes) to unlock strain, brand, THC% & terpene% filters.`}
          </div>

          <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filteredList.map((d) => {
              const visible = visibleIds.has(d.id)
              const selected = selectedIds.has(d.id)
              const dist = referencePoint ? distanceMiles(referencePoint, d.coords) : null
              return (
                <li key={d.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                      !visible
                        ? 'cursor-not-allowed border-stone-100 opacity-40 dark:border-stone-800'
                        : selected
                          ? 'border-leaf-500 bg-leaf-50 dark:bg-leaf-950/40'
                          : 'border-stone-200 hover:border-leaf-300 dark:border-stone-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-leaf-600"
                      checked={selected}
                      disabled={!visible}
                      onChange={() => toggleDispensary(d.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-stone-800 dark:text-stone-100">
                        {d.name}
                      </span>
                      <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                        {d.address}, {d.city}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-0.5">
                          <StarIcon filled width={11} height={11} className="text-amber-500" />
                          {d.rating.toFixed(1)}
                        </span>
                        {dist !== null && <span>{formatDistance(dist)}</span>}
                        {!visible && <span className="italic">outside area</span>}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card className="min-h-[420px] flex-1 overflow-hidden">
        <DispensaryMap
          dispensaries={dispensaries}
          visibleIds={visibleIds}
          selectedIds={selectedIds}
          onToggleDispensary={toggleDispensary}
          boundary={boundary}
          onBoundaryChange={setBoundary}
          referencePoint={referencePoint}
          pickingCenter={pickingCenter}
          onPickCenter={handlePickCenter}
          drawMode={mode === 'shape' ? 'shape' : 'none'}
        />
      </Card>
    </div>
  )
}
