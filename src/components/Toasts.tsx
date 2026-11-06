export interface Toast {
  id: string
  title: string
  body: string
  tone: 'rare' | 'happening' | 'info'
  onOpen?: () => void
}

const TONE = {
  rare: 'ring-amber-400/60 bg-slate-900',
  happening: 'ring-orange-400/60 bg-slate-900',
  info: 'ring-slate-600 bg-slate-900',
}

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none safe-toasts fixed inset-x-0 z-[1500] flex flex-col items-center gap-2 px-3">
      {toasts.slice(0, 3).map((t) => (
        <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl px-3 py-2.5 shadow-xl ring-1 ${TONE[t.tone]}`}>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              t.onOpen?.()
              onDismiss(t.id)
            }}
          >
            <div className="text-sm font-semibold">{t.title}</div>
            <div className="truncate text-xs text-slate-400">{t.body}</div>
          </button>
          <button onClick={() => onDismiss(t.id)} className="text-slate-500" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
