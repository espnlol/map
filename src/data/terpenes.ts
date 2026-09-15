import type { Terpene } from '../types'

// General, widely-published aromatic-chemistry reference info about the
// terpenes most commonly discussed in cannabis — what each one smells/
// tastes like, what it's commonly reported to contribute to a strain's
// effects, and other everyday plants/foods that share it. This is
// educational background, not a lab assay of any specific product, and
// none of it is pulled from any single commercial platform.
export const terpenes: Terpene[] = [
  {
    id: 'terpene-myrcene',
    name: 'Myrcene',
    aroma: ['Earthy', 'Musky', 'Clove', 'Ripe mango'],
    effects: ['Commonly linked to the relaxed, "couch-lock" feeling of indica-heavy strains', 'Calming'],
    alsoFoundIn: ['Mango', 'Lemongrass', 'Thyme', 'Hops'],
  },
  {
    id: 'terpene-limonene',
    name: 'Limonene',
    aroma: ['Citrus', 'Lemon', 'Orange'],
    effects: ['Often associated with an uplifted, energized mood', 'Stress relief'],
    alsoFoundIn: ['Citrus rinds', 'Juniper', 'Peppermint'],
  },
  {
    id: 'terpene-pinene',
    name: 'Pinene',
    aroma: ['Pine', 'Fresh forest', 'Rosemary'],
    effects: ['Associated with alertness and memory retention', 'Counters some THC fog for a few people'],
    alsoFoundIn: ['Pine needles', 'Rosemary', 'Basil', 'Dill'],
  },
  {
    id: 'terpene-caryophyllene',
    name: 'Caryophyllene',
    aroma: ['Peppery', 'Spicy', 'Woody', 'Clove'],
    effects: [
      'The one terpene known to bind cannabinoid (CB2) receptors directly',
      'Often described as taking the edge off, without added sedation',
    ],
    alsoFoundIn: ['Black pepper', 'Cloves', 'Cinnamon', 'Basil'],
  },
  {
    id: 'terpene-linalool',
    name: 'Linalool',
    aroma: ['Floral', 'Lavender', 'A little spicy'],
    effects: ['Commonly linked to calm and anti-anxiety associations', 'Often reported to help with sleep'],
    alsoFoundIn: ['Lavender', 'Birch bark', 'Coriander'],
  },
  {
    id: 'terpene-humulene',
    name: 'Humulene',
    aroma: ['Earthy', 'Woody', 'Subtly hoppy/spicy'],
    effects: ['Sometimes associated with appetite suppression (the opposite of myrcene here)'],
    alsoFoundIn: ['Hops', 'Coriander', 'Cloves', 'Basil'],
  },
  {
    id: 'terpene-terpinolene',
    name: 'Terpinolene',
    aroma: ['Floral', 'Herbal', 'Slightly citrus/piney'],
    effects: ['Often described as uplifting and less sedating than myrcene-dominant strains'],
    alsoFoundIn: ['Lilacs', 'Nutmeg', 'Cumin', 'Apples'],
  },
  {
    id: 'terpene-ocimene',
    name: 'Ocimene',
    aroma: ['Sweet', 'Herbal', 'Woody'],
    effects: ['Commonly associated with an uplifting, energizing feel'],
    alsoFoundIn: ['Mint', 'Parsley', 'Basil', 'Mangoes'],
  },
]
