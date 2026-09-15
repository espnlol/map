import type { Terpene } from '../types'

// General, widely-published aromatic-chemistry reference info about the
// terpenes most commonly discussed in cannabis — what each one smells/
// tastes like, what it's commonly reported to contribute to a strain's
// effects, roughly where it vaporizes, and other everyday plants/foods
// that share it. This is educational background, not a lab assay of any
// specific product, and none of it is pulled from any single commercial
// platform. Boiling points are approximate — vaporization guides vary by
// a few degrees between sources depending on measurement method.
export const terpenes: Terpene[] = [
  {
    id: 'terpene-myrcene',
    name: 'Myrcene',
    aroma: ['Earthy', 'Musky', 'Clove', 'Ripe mango'],
    effects: [
      'Commonly linked to the relaxed, "couch-lock" feeling associated with indica-heavy strains',
      'Calming, sedating in higher concentrations',
    ],
    alsoFoundIn: ['Mango', 'Lemongrass', 'Thyme', 'Hops'],
    boilingPoint: '332°F / 167°C',
    description:
      'The single most abundant terpene in modern cannabis — most commercial strains are myrcene-dominant regardless of indica/sativa label. Some growers and researchers point to it as one reason "eating a mango before you smoke" is a persistent piece of cannabis folklore, since mango is also myrcene-rich, though that specific effect isn\'t well established.',
  },
  {
    id: 'terpene-limonene',
    name: 'Limonene',
    aroma: ['Citrus', 'Lemon', 'Orange'],
    effects: ['Often associated with an uplifted, energized mood', 'Commonly reported for stress relief'],
    alsoFoundIn: ['Citrus rinds', 'Juniper', 'Peppermint'],
    boilingPoint: '349°F / 176°C',
    description:
      'The second-most-common terpene in cannabis and the reason many citrus-flavored strains (Tangie, Super Lemon Haze) taste the way they do. Widely used outside cannabis too, in citrus-scented cleaning products and skincare, and often discussed as a mood-lifting counterpoint to myrcene\'s heavier, sedating reputation.',
  },
  {
    id: 'terpene-pinene',
    name: 'Pinene',
    aroma: ['Pine', 'Fresh forest', 'Rosemary'],
    effects: [
      'Associated with alertness and memory retention',
      'Anecdotally reported to counter some of THC\'s short-term "foggy" feeling',
    ],
    alsoFoundIn: ['Pine needles', 'Rosemary', 'Basil', 'Dill'],
    boilingPoint: '311°F / 155°C',
    description:
      'One of the most common terpenes in the natural world generally (it\'s literally what pine trees smell like), and the most likely reason a strain\'s aroma reads as "fresh" or "forest-y" rather than sweet or fuel-like. There are two isomers, alpha- and beta-pinene, with very similar pine/herbal character.',
  },
  {
    id: 'terpene-caryophyllene',
    name: 'Caryophyllene',
    aroma: ['Peppery', 'Spicy', 'Woody', 'Clove'],
    effects: [
      'The one terpene known to bind cannabinoid (CB2) receptors directly, making it functionally act a bit like a cannabinoid itself',
      'Often described as taking the edge off without adding sedation',
    ],
    alsoFoundIn: ['Black pepper', 'Cloves', 'Cinnamon', 'Basil'],
    boilingPoint: '266°F / 130°C',
    description:
      'Chemically unusual among terpenes because of that direct CB2 interaction, which is why you\'ll see it mentioned more often than most terpenes in discussions of the "entourage effect" (the idea that terpenes and cannabinoids work together, not just cannabinoids alone). It\'s also what gives black pepper its bite — chewing a peppercorn is a commonly cited (anecdotal) way to take the edge off feeling too high.',
  },
  {
    id: 'terpene-linalool',
    name: 'Linalool',
    aroma: ['Floral', 'Lavender', 'A little spicy'],
    effects: [
      'Commonly linked to calm and anti-anxiety associations',
      'Often reported to help with sleep, similar to how lavender is used outside cannabis',
    ],
    alsoFoundIn: ['Lavender', 'Birch bark', 'Coriander'],
    boilingPoint: '388°F / 198°C',
    description:
      'The terpene most responsible for lavender\'s calming reputation, and one of the less common dominant terpenes in cannabis — when a strain does lead with linalool, it tends to be marketed around relaxation and sleep. Also widely used in perfumery and aromatherapy outside of cannabis entirely.',
  },
  {
    id: 'terpene-humulene',
    name: 'Humulene',
    aroma: ['Earthy', 'Woody', 'Subtly hoppy/spicy'],
    effects: ['Sometimes associated with appetite suppression — notably the opposite of myrcene here'],
    alsoFoundIn: ['Hops', 'Coriander', 'Cloves', 'Basil'],
    boilingPoint: '222°F / 106°C',
    description:
      'Named for hops (Humulus lupulus), which it shares with cannabis as a close botanical relative — it\'s part of why some hoppy beers and earthy cannabis strains smell like they\'re in the same family. Usually shows up as a secondary rather than dominant terpene.',
  },
  {
    id: 'terpene-terpinolene',
    name: 'Terpinolene',
    aroma: ['Floral', 'Herbal', 'Slightly citrus/piney'],
    effects: ['Often described as uplifting and less sedating than myrcene-dominant strains'],
    alsoFoundIn: ['Lilacs', 'Nutmeg', 'Cumin', 'Apples'],
    boilingPoint: '366°F / 186°C',
    description:
      'Less common as a dominant terpene than myrcene or limonene, but strongly associated with a handful of well-known sativas (Jack Herer, Durban Poison) — when a strain is terpinolene-forward it tends to smell more complex and herbal than a simple "citrus" or "earthy" strain.',
  },
  {
    id: 'terpene-ocimene',
    name: 'Ocimene',
    aroma: ['Sweet', 'Herbal', 'Woody'],
    effects: ['Commonly associated with an uplifting, energizing feel'],
    alsoFoundIn: ['Mint', 'Parsley', 'Basil', 'Mangoes'],
    boilingPoint: '122°F / 50°C',
    description:
      'One of the more volatile terpenes here (it vaporizes at a much lower temperature than the others), which is part of why its sweet, herbal notes tend to be the first thing you smell when a jar is opened. Rarely dominant on its own; usually shows up as a supporting note.',
  },
]
