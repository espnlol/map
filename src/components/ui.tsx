import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {children}
      </h3>
      {action}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-leaf-600 bg-leaf-600 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-leaf-400 hover:text-leaf-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200',
        disabled ? 'cursor-not-allowed opacity-40 hover:border-stone-300 hover:text-stone-700' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({
  children,
  onClick,
  className = '',
  type = 'button',
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl bg-leaf-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-leaf-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-leaf-600 ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  className = '',
  active = false,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-leaf-600 bg-leaf-50 text-leaf-800 dark:bg-leaf-950 dark:text-leaf-200'
          : 'border-stone-300 bg-white text-stone-700 hover:border-leaf-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  disabled,
}: {
  min: number
  max: number
  step?: number
  value: [number, number]
  onChange: (v: [number, number]) => void
  formatValue?: (n: number) => string
  disabled?: boolean
}) {
  const [lo, hi] = value
  const fmt = formatValue ?? ((n: number) => String(n))
  const span = max - min || 1
  const pctLo = ((lo - min) / span) * 100
  const pctHi = ((hi - min) / span) * 100

  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
      <div className="mb-1 flex justify-between text-xs text-stone-500 dark:text-stone-400">
        <span>{fmt(lo)}</span>
        <span>{fmt(hi)}</span>
      </div>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-leaf-500"
          style={{ left: `${pctLo}%`, right: `${100 - pctHi}%` }}
        />
        <input
          aria-label="Minimum"
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          disabled={disabled}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
          className="range-thumb pointer-events-none absolute w-full appearance-none bg-transparent"
        />
        <input
          aria-label="Maximum"
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          disabled={disabled}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
          className="range-thumb pointer-events-none absolute w-full appearance-none bg-transparent"
        />
      </div>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 py-16 text-center dark:border-stone-700">
      <p className="text-stone-600 dark:text-stone-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-stone-400">{hint}</p>}
    </div>
  )
}
