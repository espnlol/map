const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatPrice(cents: number): string {
  return currencyFormatter.format(cents)
}

export function formatGrams(g: number): string {
  return Number.isInteger(g) ? `${g}g` : `${g}g`
}
