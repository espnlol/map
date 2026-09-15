import type {
  AccessorySubtype,
  ConcentrateSubtype,
  Dispensary,
  Product,
  ProductCategory,
  SizeOption,
  Strain,
} from '../types'
import { brandsFor } from './brands'
import { strains } from './strains'

// --- deterministic PRNG so the catalog is stable across reloads/builds ---
function mulberry32(seed: number) {
  let s = seed | 0
  return function random() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

type Rng = () => number

function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1))
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Pick `n` distinct items from arr (n clamped to arr.length). */
function pickMany<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  const count = Math.min(n, pool.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return out
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export const CATEGORY_SWATCH: Record<ProductCategory, string> = {
  flower: '#399462',
  cartridge: '#d97706',
  concentrate: '#ea580c',
  edible: '#db2777',
  tincture: '#2563eb',
  accessory: '#64748b',
}

const EFFECTS_BY_LINEAGE = {
  indica: ['relaxed', 'sleepy', 'calm', 'body-heavy'],
  sativa: ['energetic', 'uplifted', 'focused', 'creative'],
  hybrid: ['balanced', 'happy', 'euphoric', 'social'],
} as const

function effectsBlurb(rng: Rng, lineage: Strain['lineage']): string {
  const pool = EFFECTS_BY_LINEAGE[lineage]
  const picked = pickMany(rng, pool, 2)
  return `Effects: ${picked.join(', ')}.`
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter.toString(36)}`
}

function sizesFromGrams(
  rng: Rng,
  gramOptions: readonly number[],
  pricePerGramRange: [number, number],
  bulkDiscount = 0.85,
): SizeOption[] {
  const basePerGram = randRange(rng, pricePerGramRange[0], pricePerGramRange[1])
  return gramOptions.map((g, i) => {
    // larger sizes get a modest per-gram discount, like real menus
    const discountFactor = Math.pow(bulkDiscount, i)
    const price = Math.round(g * basePerGram * discountFactor)
    return { label: `${g}g`, grams: g, price }
  })
}

function makeFlower(rng: Rng, dispensaryId: string, strain: Strain): Product {
  const brand = pick(rng, brandsFor('flower'))
  const thc = round1(randRange(rng, 14, 28))
  const terp = round1(randRange(rng, 0.5, 3.5))
  return {
    id: nextId('flower'),
    dispensaryId,
    category: 'flower',
    name: strain.name,
    brandId: brand.id,
    strainId: strain.id,
    sizes: sizesFromGrams(rng, [1, 3.5, 7, 14, 28], [8, 14]),
    thcPercent: thc,
    terpenePercent: terp,
    swatch: CATEGORY_SWATCH.flower,
    description: `${strain.lineage[0].toUpperCase()}${strain.lineage.slice(1)} flower. ${effectsBlurb(rng, strain.lineage)}`,
  }
}

function makeCartridge(rng: Rng, dispensaryId: string, strain: Strain): Product {
  const brand = pick(rng, brandsFor('cartridge'))
  const thc = round1(randRange(rng, 65, 90))
  const terp = round1(randRange(rng, 2, 6))
  return {
    id: nextId('cart'),
    dispensaryId,
    category: 'cartridge',
    name: `${strain.name} Cartridge`,
    brandId: brand.id,
    strainId: strain.id,
    sizes: sizesFromGrams(rng, [0.5, 1, 2], [55, 75]),
    thcPercent: thc,
    terpenePercent: terp,
    swatch: CATEGORY_SWATCH.cartridge,
    description: `510-thread vape cartridge. ${effectsBlurb(rng, strain.lineage)}`,
  }
}

const CONCENTRATE_SUBTYPES_LIST: ConcentrateSubtype[] = [
  'rosin',
  'live-resin',
  'wax',
  'shatter',
  'badder',
  'diamonds',
]

const CONCENTRATE_LABEL: Record<ConcentrateSubtype, string> = {
  rosin: 'Rosin',
  'live-resin': 'Live Resin',
  wax: 'Wax',
  shatter: 'Shatter',
  badder: 'Badder',
  diamonds: 'Diamonds',
}

function makeConcentrate(rng: Rng, dispensaryId: string, strain: Strain): Product {
  const subtype = pick(rng, CONCENTRATE_SUBTYPES_LIST)
  const brand = pick(rng, brandsFor('concentrate'))
  const isRosin = subtype === 'rosin'
  // Rosin gets the full 0.5/1/2/3/4g menu requested; other concentrates keep
  // the more typical 0.5/1/2g menu.
  const gramOptions = isRosin ? [0.5, 1, 2, 3, 4] : [0.5, 1, 2]
  const priceRange: [number, number] = isRosin ? [45, 70] : [28, 48]
  const thc = round1(randRange(rng, isRosin ? 55 : 60, isRosin ? 78 : 85))
  const terp = round1(randRange(rng, isRosin ? 2.5 : 1, isRosin ? 9 : 6))
  return {
    id: nextId('conc'),
    dispensaryId,
    category: 'concentrate',
    subtype,
    name: `${strain.name} ${CONCENTRATE_LABEL[subtype]}`,
    brandId: brand.id,
    strainId: strain.id,
    sizes: sizesFromGrams(rng, gramOptions, priceRange, 0.88),
    thcPercent: thc,
    terpenePercent: terp,
    swatch: CATEGORY_SWATCH.concentrate,
    description: `Solventless & solvent-based extracts vary — this is a ${CONCENTRATE_LABEL[subtype]}. ${effectsBlurb(rng, strain.lineage)}`,
  }
}

const EDIBLE_TEMPLATES = [
  { form: 'Gummies', flavors: ['Mixed Fruit', 'Sour Watermelon', 'Blue Raspberry', 'Tropical Punch'] },
  { form: 'Chocolate Bar', flavors: ['Dark Chocolate', 'Milk Chocolate', 'Mint Chocolate', 'Salted Caramel'] },
  { form: 'Mints', flavors: ['Peppermint', 'Cinnamon', 'Spearmint'] },
  { form: 'Fruit Chews', flavors: ['Strawberry', 'Green Apple', 'Grape'] },
]

const EDIBLE_PACK_OPTIONS: { count: number; mgEach: number }[] = [
  { count: 5, mgEach: 10 },
  { count: 10, mgEach: 10 },
  { count: 10, mgEach: 5 },
  { count: 20, mgEach: 5 },
]

function makeEdible(rng: Rng, dispensaryId: string): Product {
  const brand = pick(rng, brandsFor('edible'))
  const template = pick(rng, EDIBLE_TEMPLATES)
  const flavor = pick(rng, template.flavors)
  const packs = pickMany(rng, EDIBLE_PACK_OPTIONS, randInt(rng, 2, 3))
  const basePricePerMg = randRange(rng, 0.13, 0.2)
  const sizes: SizeOption[] = packs
    .map((p) => {
      const totalMg = p.count * p.mgEach
      return {
        label: `${p.count}-pack (${p.mgEach}mg ea, ${totalMg}mg total)`,
        price: Math.round(totalMg * basePricePerMg),
        mg: totalMg,
      }
    })
    .sort((a, b) => (a.mg ?? 0) - (b.mg ?? 0))
  return {
    id: nextId('edible'),
    dispensaryId,
    category: 'edible',
    name: `${flavor} ${template.form}`,
    brandId: brand.id,
    sizes,
    swatch: CATEGORY_SWATCH.edible,
    description: 'Vegan & gluten-free options vary by batch. Onset ~30-90 minutes — start low, go slow.',
  }
}

const TINCTURE_TEMPLATES = [
  'Full-Spectrum MCT Tincture',
  'CBD:THC 1:1 Drops',
  'Fast-Acting Sublingual Drops',
  'High-THC Tincture',
]

function makeTincture(rng: Rng, dispensaryId: string): Product {
  const brand = pick(rng, brandsFor('tincture'))
  const name = pick(rng, TINCTURE_TEMPLATES)
  const bottles: { label: string; mL: number; mg: number }[] = [
    { label: '15mL', mL: 15, mg: randInt(rng, 300, 600) },
    { label: '30mL', mL: 30, mg: randInt(rng, 600, 1200) },
  ]
  const sizes: SizeOption[] = bottles.map((b) => ({
    label: `${b.label} bottle (${b.mg}mg total)`,
    price: Math.round(20 + b.mg * 0.045),
    mg: b.mg,
  }))
  return {
    id: nextId('tinc'),
    dispensaryId,
    category: 'tincture',
    name,
    brandId: brand.id,
    sizes,
    swatch: CATEGORY_SWATCH.tincture,
    description: 'Sublingual oil drops for precise, discreet dosing.',
  }
}

const ACCESSORY_TEMPLATES: {
  subtype: AccessorySubtype
  names: string[]
  priceRange: [number, number]
  materials: string[]
}[] = [
  {
    subtype: 'grinder',
    names: ['2-Piece Grinder', '4-Piece Aluminum Grinder', 'Sifter Grinder w/ Kief Catcher'],
    priceRange: [12, 55],
    materials: ['Aluminum', 'Zinc Alloy', 'Titanium'],
  },
  {
    subtype: 'lighter',
    names: ['Classic Flame Lighter', 'Torch Lighter', 'Windproof Lighter'],
    priceRange: [2, 18],
    materials: ['Standard', 'Refillable', 'Butane'],
  },
  {
    subtype: 'dab-rig',
    names: ['8in Recycler Dab Rig', 'Mini Dab Rig w/ Quartz Banger', 'Electric Dab Rig'],
    priceRange: [45, 220],
    materials: ['Borosilicate Glass', 'Glass + Quartz', 'Silicone/Glass Hybrid'],
  },
  {
    subtype: 'bong',
    names: ['12in Beaker Bong', 'Percolator Bong', 'Straight Tube Bong'],
    priceRange: [40, 200],
    materials: ['Borosilicate Glass', 'Thick Glass', 'Glass w/ Ice Catcher'],
  },
  {
    subtype: 'nectar-collector',
    names: ['Titanium Nectar Collector Kit', 'Glass & Quartz Nectar Collector'],
    priceRange: [30, 90],
    materials: ['Titanium Tip', 'Quartz Tip', 'Glass'],
  },
  {
    subtype: 'battery',
    names: ['510 Thread Vape Battery', 'Variable-Voltage 510 Battery', 'Buttonless Auto-Draw Battery'],
    priceRange: [12, 40],
    materials: ['Standard 510', 'USB-C Rechargeable', 'Adjustable Voltage'],
  },
  {
    subtype: 'papers',
    names: ['King Size Hemp Papers', 'Rice Rolling Papers', 'Organic Papers'],
    priceRange: [2, 6],
    materials: ['Hemp', 'Rice', 'Organic'],
  },
  {
    subtype: 'cones',
    names: ['Pre-Rolled Cones 6-Pack', 'King Size Pre-Rolled Cones', 'Flavored Pre-Rolled Cones'],
    priceRange: [4, 14],
    materials: ['Unbleached Paper', 'Hemp Paper', 'Rice Paper'],
  },
  {
    subtype: 'other',
    names: ['Rolling Tray', 'Storage Jar (Airtight)', 'Silicone Dab Container Set'],
    priceRange: [8, 35],
    materials: ['Metal', 'Glass', 'Silicone'],
  },
]

function makeAccessory(rng: Rng, dispensaryId: string): Product {
  const template = pick(rng, ACCESSORY_TEMPLATES)
  const brand = pick(rng, brandsFor('accessory'))
  const name = pick(rng, template.names)
  const material = pick(rng, template.materials)
  const price = Math.round(randRange(rng, template.priceRange[0], template.priceRange[1]))
  return {
    id: nextId('acc'),
    dispensaryId,
    category: 'accessory',
    subtype: template.subtype,
    name,
    brandId: brand.id,
    sizes: [{ label: 'One size', price }],
    swatch: CATEGORY_SWATCH.accessory,
    description: `${material}. Sold individually.`,
  }
}

/**
 * Deterministically generate a full product catalog for the given
 * dispensaries. Same input -> same output every time (no Math.random),
 * which keeps the demo dataset stable across reloads and builds.
 */
export function generateProducts(dispensaries: Dispensary[]): Product[] {
  const products: Product[] = []

  for (const disp of dispensaries) {
    const rng = mulberry32(hashString(disp.id))

    const flowerStrains = pickMany(rng, strains, 7)
    for (const s of flowerStrains) products.push(makeFlower(rng, disp.id, s))

    const cartStrains = pickMany(rng, strains, 6)
    for (const s of cartStrains) products.push(makeCartridge(rng, disp.id, s))

    const concStrains = pickMany(rng, strains, 6)
    for (const s of concStrains) products.push(makeConcentrate(rng, disp.id, s))

    for (let i = 0; i < 5; i++) products.push(makeEdible(rng, disp.id))
    for (let i = 0; i < 3; i++) products.push(makeTincture(rng, disp.id))
    for (let i = 0; i < 9; i++) products.push(makeAccessory(rng, disp.id))
  }

  return products
}
