import type { ReactNode } from 'react'
import { ChevronDownIcon } from './Icons'

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

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 py-16 text-center dark:border-stone-700">
      <p className="text-stone-600 dark:text-stone-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-stone-400">{hint}</p>}
    </div>
  )
}

/** A collapsible section — the "more dropdown menus" pattern used
 * throughout the strain/terpene detail views. */
export function Dropdown({
  label,
  defaultOpen = false,
  children,
}: {
  label: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      className="group rounded-xl border border-stone-200 dark:border-stone-700"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-stone-700 marker:content-none dark:text-stone-200">
        {label}
        <ChevronDownIcon
          width={16}
          height={16}
          className="shrink-0 text-stone-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-stone-200 px-3 py-3 text-sm dark:border-stone-700">{children}</div>
    </details>
  )
}
