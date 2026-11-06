import { useEffect, useRef, useState, type ReactNode } from 'react'

export type SheetSize = 'peek' | 'half' | 'full'

interface Props {
  size: SheetSize
  onSize: (s: SheetSize) => void
  children: ReactNode
}

/** Phone-only panel that slides up over the map. Drag or tap the handle to resize. */
export default function BottomSheet({ size, onSize, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [parentH, setParentH] = useState(600)
  const [drag, setDrag] = useState<{ startY: number; startH: number; h: number } | null>(null)

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => setParentH(parent.clientHeight))
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const heights: Record<SheetSize, number> = { peek: 132, half: Math.round(parentH * 0.52), full: parentH - 8 }
  const height = drag ? drag.h : heights[size]

  const snap = (h: number) => {
    const order: SheetSize[] = ['peek', 'half', 'full']
    let best: SheetSize = 'peek'
    for (const s of order) if (Math.abs(heights[s] - h) < Math.abs(heights[best] - h)) best = s
    onSize(best)
  }

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 bottom-0 z-[700] flex flex-col overflow-hidden rounded-t-2xl bg-slate-900 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] ring-1 ring-slate-800"
      style={{ height, transition: drag ? 'none' : 'height 0.22s ease' }}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none justify-center py-2.5"
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          setDrag({ startY: e.clientY, startH: height, h: height })
        }}
        onPointerMove={(e) => {
          if (!drag) return
          const h = Math.max(90, Math.min(parentH - 8, drag.startH + (drag.startY - e.clientY)))
          setDrag({ ...drag, h })
        }}
        onPointerUp={(e) => {
          if (!drag) return
          const moved = Math.abs(e.clientY - drag.startY)
          setDrag(null)
          if (moved < 6) onSize(size === 'peek' ? 'half' : size === 'half' ? 'full' : 'peek')
          else snap(drag.h)
        }}
        onPointerCancel={() => setDrag(null)}
        role="button"
        aria-label="Resize panel"
      >
        <span className="h-1.5 w-10 rounded-full bg-slate-600" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
