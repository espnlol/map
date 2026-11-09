
export function Modal({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-[#0f172a] shadow-2xl sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Bars({ rows, onClick }: { rows: { label: string; value: number; color?: string; sub?: string }[]; onClick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="w-28 shrink-0 truncate text-left text-slate-400 sm:w-36" title={r.label}>{r.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded bg-slate-800">
              <span className="block h-full rounded" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? '#3b82f6' }} />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums text-slate-200">{r.value.toLocaleString()}</span>
          </>
        )
        return onClick ? (
          <button key={r.label} onClick={() => onClick(r.label)} className="flex w-full items-center gap-2 rounded text-xs hover:bg-slate-800/70">
            {inner}
          </button>
        ) : (
          <div key={r.label} className="flex items-center gap-2 text-xs">{inner}</div>
        )
      })}
    </div>
  )
}

export function AboutModal({ count, updated, onClose }: { count: number; updated?: string; onClose: () => void }) {
  return (
    <Modal title="About Black Box Atlas" onClose={onClose}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        <p>
          Black Box Atlas maps {count.toLocaleString()} aviation accidents from Wikipedia: every crash with its own article and a
          known location. Every detail is free: date, place, aircraft, airline, route, deaths, survivors and cause.
        </p>
        <p>
          The data comes from Wikipedia's articles and Wikidata, its structured-data twin, and refreshes itself every week
          {updated ? <> (last updated <b className="text-white">{updated}</b>)</> : null}. Eighty well-known crashes also
          have longer hand-written summaries.
        </p>
        <p>
          Each crash has a <b className="text-white">Watch on YouTube</b> button and a <b className="text-white">Read the full article</b> button.
          If you find a video you like, pin it to the crash and it plays right in the panel (saved in your browser).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-white">Statistics</b>: per-airline and per-aircraft breakdowns, crashes by country and ocean, and Top 5 lists.</li>
          <li><b className="text-white">Markers / Heatmap</b>: individual planes, or where accidents cluster.</li>
          <li><b className="text-white">Globe / Flat</b>: spin a 3D globe or use a flat map.</li>
          <li>Use the layers button (top right of the map) for satellite, terrain or dark maps.</li>
          <li>Press <kbd className="rounded bg-slate-800 px-1">/</kbd> to search and <kbd className="rounded bg-slate-800 px-1">Esc</kbd> to close.</li>
        </ul>
        <p className="text-xs text-slate-500">
          Causes are sorted automatically from Wikipedia's one-line summaries, so some read "Unknown" or are simplified;
          follow the article link for the full investigation findings. Positions for crashes without exact coordinates use
          the crash site's town or airport. Text from Wikipedia is available under CC BY-SA. Map tiles &copy; Esri.
        </p>
      </div>
    </Modal>
  )
}

export function GetAppModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Get the app" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300">
        <p>Black Box Atlas installs straight from your browser. It's free, with no app store needed.</p>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">iPhone / iPad</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the <b>Share</b> button.</li>
            <li>Tap <b>Add to Home Screen</b>.</li>
          </ol>
        </div>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">Android</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Open this page in <b>Chrome</b>.</li>
            <li>Tap the <b>⋮</b> menu.</li>
            <li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li>
          </ol>
        </div>
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="font-semibold text-white">Computer</div>
          <p className="mt-1">In Chrome or Edge, click the install icon at the right end of the address bar.</p>
        </div>
      </div>
    </Modal>
  )
}
