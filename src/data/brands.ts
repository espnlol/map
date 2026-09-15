import type { Brand } from '../types'

// Fictional demo brands, tagged with which product categories they carry so
// the generator can assign realistic brand/category pairings.
export const brands: Brand[] = [
  { id: 'brand-golden-bud', name: 'Golden Bud Co.', categories: ['flower', 'cartridge'] },
  { id: 'brand-terra-extracts', name: 'Terra Extracts', categories: ['concentrate', 'cartridge'] },
  { id: 'brand-summit-farms', name: 'Summit Farms', categories: ['flower'] },
  { id: 'brand-pure-pressure', name: 'Pure Pressure Rosin Co.', categories: ['concentrate'] },
  { id: 'brand-cloud-nine', name: 'Cloud Nine Vapes', categories: ['cartridge'] },
  { id: 'brand-mountain-high', name: 'Mountain High Edibles', categories: ['edible'] },
  { id: 'brand-sweet-leaf', name: 'Sweet Leaf Confections', categories: ['edible'] },
  { id: 'brand-canna-drops', name: 'Canna Drops', categories: ['tincture'] },
  { id: 'brand-wellness-tincture', name: 'Wellness Tincture Co.', categories: ['tincture'] },
  { id: 'brand-grindhouse', name: 'Grindhouse Gear', categories: ['accessory'] },
  { id: 'brand-sparkworks', name: 'SparkWorks', categories: ['accessory'] },
  { id: 'brand-glasscraft', name: 'GlassCraft Studio', categories: ['accessory'] },
  { id: 'brand-evergreen', name: 'Evergreen Cultivators', categories: ['flower'] },
  { id: 'brand-alpine-extracts', name: 'Alpine Extracts', categories: ['concentrate'] },
  { id: 'brand-dab-nation', name: 'Dab Nation', categories: ['concentrate', 'accessory'] },
  { id: 'brand-root-stem', name: 'Root & Stem Farms', categories: ['flower', 'edible'] },
]

export function brandsFor(category: Brand['categories'][number]): Brand[] {
  return brands.filter((b) => b.categories.includes(category))
}
