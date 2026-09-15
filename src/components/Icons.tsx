// Small hand-rolled icon set (kept dependency-free).
import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>) {
  return { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', ...props }
}

export function HeartIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8} fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M12 20s-7.5-4.6-10-9.3C.5 7.4 2 4 5.5 4c2 0 3.4 1 4.5 2.5C11.1 5 12.5 4 14.5 4 18 4 19.5 7.4 22 10.7 19.5 15.4 12 20 12 20z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
    </svg>
  )
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="10.5" width="16" height="9.5" rx="1.8" />
      <path d="M7.5 10.5V7a4.5 4.5 0 1 1 9 0v3.5" />
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

export function StarIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.2} fill={filled ? 'currentColor' : 'none'}>
      <path
        d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20l1.4-6.3-4.8-4.3 6.4-.6L12 3z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

