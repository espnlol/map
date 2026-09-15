// Small hand-rolled icon set (kept dependency-free).
import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>) {
  return { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', ...props }
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2}>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LeafIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <path d="M20 4c-9 0-16 7-16 16 9 0 16-7 16-16z" strokeLinejoin="round" />
      <path d="M5 19 15 9" strokeLinecap="round" />
    </svg>
  )
}
