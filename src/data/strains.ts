import type { Strain } from '../types'

// Generic cannabis cultivar (strain) names — these are widely used genetics
// names shared across the whole industry, not brand trademarks. Effects,
// flavors, dominant terpenes, and "helps with" tags are the commonly-
// reported characteristics you'd see on a seed bank listing or dispensary
// placard for each genetic — general industry-common knowledge, not lab
// results for any specific batch, and not pulled from any single
// commercial platform. Where a strain's parentage is mentioned, it's
// framed as "commonly cited" rather than settled fact, since breeders
// often don't formally disclose crosses and multiple stories exist for
// some of these. "Helps with" is what users commonly report, not medical
// advice — see the disclaimer shown alongside it in the UI.
export const strains: Strain[] = [
  {
    id: 'strain-blue-dream',
    name: 'Blue Dream',
    lineage: 'hybrid',
    effects: ['Happy', 'Relaxed', 'Euphoric', 'Creative'],
    flavors: ['Berry', 'Blueberry', 'Sweet'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-pinene'],
    helpsWith: ['Stress', 'Depression', 'Pain'],
    description:
      'A sativa-leaning hybrid commonly cited as a cross of Blueberry indica and Haze sativa. One of the most widely available strains in the US for years running, prized for a gentle, approachable balance of full-body relaxation and clear-headed, creative energy rather than a strong lean either way.',
  },
  {
    id: 'strain-og-kush',
    name: 'OG Kush',
    lineage: 'indica',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Sleepy'],
    flavors: ['Earthy', 'Pine', 'Woody', 'Spicy'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-limonene'],
    helpsWith: ['Stress', 'Pain', 'Insomnia'],
    description:
      "A West Coast staple whose exact genetic origins are famously disputed — even long-time breeders tell different stories about its parentage. Whatever its true lineage, it's become one of the most influential strains in modern cannabis, used as a parent for countless hybrids including the Cookies and Gelato families.",
  },
  {
    id: 'strain-sour-diesel',
    name: 'Sour Diesel',
    lineage: 'sativa',
    effects: ['Energetic', 'Uplifted', 'Happy', 'Focused'],
    flavors: ['Diesel', 'Pungent', 'Citrus'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-myrcene'],
    helpsWith: ['Stress', 'Depression', 'Fatigue'],
    description:
      'Known for its pungent, fuel-like aroma (hence the name) and a fast-acting, energizing effect that made it a longtime favorite for daytime use. Commonly believed to descend from Chemdawg genetics, though — like many older strains — the exact cross was never formally documented.',
  },
  {
    id: 'strain-gsc',
    name: 'Girl Scout Cookies',
    lineage: 'hybrid',
    effects: ['Euphoric', 'Relaxed', 'Happy', 'Creative'],
    flavors: ['Sweet', 'Earthy', 'Mint'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-limonene'],
    helpsWith: ['Stress', 'Pain', 'Nausea'],
    description:
      'Commonly cited as a cross of OG Kush and Durban Poison, bred in California and known for a sweet, earthy-mint flavor paired with strong, long-lasting effects. One of the most influential parent strains of the last decade — most "Cookies"-family strains (Gelato, Wedding Cake) trace back to it.',
  },
  {
    id: 'strain-gelato',
    name: 'Gelato',
    lineage: 'hybrid',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Uplifted'],
    flavors: ['Sweet', 'Citrus', 'Berry'],
    dominantTerpenes: ['terpene-limonene', 'terpene-caryophyllene'],
    helpsWith: ['Stress', 'Pain', 'Mood'],
    description:
      'A dessert-leaning cross commonly cited as Sunset Sherbert × Thin Mint Girl Scout Cookies, bred by Cookies Fam in the Bay Area. Known for a sweet, fruity flavor and a balanced, euphoric-relaxed effect — it has since spawned an entire numbered family of phenotypes (Gelato #33, #41, etc.) as well as further crosses like Runtz.',
  },
  {
    id: 'strain-wedding-cake',
    name: 'Wedding Cake',
    lineage: 'indica',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Sleepy'],
    flavors: ['Sweet', 'Vanilla', 'Earthy'],
    dominantTerpenes: ['terpene-limonene', 'terpene-caryophyllene'],
    helpsWith: ['Stress', 'Insomnia', 'Pain'],
    description:
      'An indica-leaning, dessert-flavored hybrid commonly cited as Triangle Kush × Animal Mints. Rich, sweet, and tangy, it\'s known for a heavy, relaxed body effect that leans toward the sedating side of the Cookies family it belongs to.',
  },
  {
    id: 'strain-gdp',
    name: 'Granddaddy Purple',
    lineage: 'indica',
    effects: ['Relaxed', 'Sleepy', 'Happy', 'Calm'],
    flavors: ['Grape', 'Berry', 'Sweet'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-pinene'],
    helpsWith: ['Insomnia', 'Pain', 'Muscle tension'],
    description:
      'A California classic bred in the early 2000s from Purple Urkle and Big Bud, known for its deep purple coloring and grape/berry aroma. One of the strains most responsible for popularizing the "purple" indica aesthetic, and a go-to for evening, wind-down use.',
  },
  {
    id: 'strain-jack-herer',
    name: 'Jack Herer',
    lineage: 'sativa',
    effects: ['Uplifted', 'Energetic', 'Creative', 'Focused'],
    flavors: ['Pine', 'Spicy', 'Citrus'],
    dominantTerpenes: ['terpene-terpinolene', 'terpene-pinene'],
    helpsWith: ['Stress', 'Fatigue', 'Mood'],
    description:
      'Named for the cannabis activist and author of The Emperor Wears No Clothes, this award-winning sativa (a Haze hybrid crossed with Northern Lights genetics) is prized for clear-headed, creative energy without the jittery edge some sativas bring.',
  },
  {
    id: 'strain-green-crack',
    name: 'Green Crack',
    lineage: 'sativa',
    effects: ['Energetic', 'Focused', 'Uplifted', 'Happy'],
    flavors: ['Citrus', 'Tropical', 'Earthy'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-pinene'],
    helpsWith: ['Fatigue', 'Stress', 'Depression'],
    description:
      "A punchy, citrusy sativa (originally a Skunk #1 phenotype) known for sharp mental energy and focus — reportedly renamed from its original moniker at Snoop Dogg's suggestion. A popular daytime, productivity-oriented choice.",
  },
  {
    id: 'strain-northern-lights',
    name: 'Northern Lights',
    lineage: 'indica',
    effects: ['Relaxed', 'Sleepy', 'Euphoric', 'Calm'],
    flavors: ['Earthy', 'Pine', 'Sweet'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-caryophyllene'],
    helpsWith: ['Insomnia', 'Pain', 'Stress'],
    description:
      'One of the most famous indicas ever bred and a parent to countless modern strains (including Jack Herer). A near-pure indica prized for fast-acting relaxation and a resinous, sweet-earthy aroma — an industry benchmark since the 1980s.',
  },
  {
    id: 'strain-pineapple-express',
    name: 'Pineapple Express',
    lineage: 'hybrid',
    effects: ['Energetic', 'Happy', 'Uplifted', 'Creative'],
    flavors: ['Tropical', 'Pineapple', 'Citrus'],
    dominantTerpenes: ['terpene-limonene', 'terpene-pinene'],
    helpsWith: ['Fatigue', 'Stress', 'Mood'],
    description:
      'A tropical, fruity cross of Trainwreck and Hawaiian, made famous well beyond cannabis circles by the 2008 film of the same name. Known for long-lasting, energetic effects that lean more sativa despite its hybrid billing.',
  },
  {
    id: 'strain-durban-poison',
    name: 'Durban Poison',
    lineage: 'sativa',
    effects: ['Energetic', 'Uplifted', 'Focused', 'Creative'],
    flavors: ['Sweet', 'Earthy', 'Pine'],
    dominantTerpenes: ['terpene-terpinolene', 'terpene-ocimene'],
    helpsWith: ['Fatigue', 'Stress', 'Focus'],
    description:
      'A pure African landrace sativa originating around Durban, South Africa — not a modern hybrid cross. Known for a sweet, anise-like aroma and a clear, energizing effect without the heavy sedation associated with indica-leaning strains.',
  },
  {
    id: 'strain-white-widow',
    name: 'White Widow',
    lineage: 'hybrid',
    effects: ['Euphoric', 'Uplifted', 'Energetic', 'Creative'],
    flavors: ['Earthy', 'Woody', 'Pungent'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-pinene'],
    helpsWith: ['Stress', 'Depression', 'Pain'],
    description:
      'A Dutch coffee-shop classic bred from a Brazilian sativa landrace and a South Indian indica. Coated heavily in white, resinous trichomes (hence the name), known for balanced, euphoric-energetic effects.',
  },
  {
    id: 'strain-purple-punch',
    name: 'Purple Punch',
    lineage: 'indica',
    effects: ['Relaxed', 'Sleepy', 'Happy', 'Calm'],
    flavors: ['Grape', 'Berry', 'Sweet'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-pinene'],
    helpsWith: ['Insomnia', 'Stress', 'Nausea'],
    description:
      'A dessert-like cross of Larry OG and Granddaddy Purple, known for a grape-candy aroma and heavily relaxing, sleepy effects — a popular choice specifically for nighttime use.',
  },
  {
    id: 'strain-zkittlez',
    name: 'Zkittlez',
    lineage: 'indica',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Calm'],
    flavors: ['Fruity', 'Sweet', 'Berry', 'Tropical'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-humulene'],
    helpsWith: ['Stress', 'Pain', 'Mood'],
    description:
      'A candy-flavored indica-leaning hybrid, commonly cited as a Grape Ape × Grapefruit cross, bred by 3rd Gen Family. Known for its fruity, candy-like aroma and calming, mood-lifting effects — and a parent strain to much of the modern "fruity candy" strain wave, including Runtz.',
  },
  {
    id: 'strain-super-lemon-haze',
    name: 'Super Lemon Haze',
    lineage: 'sativa',
    effects: ['Energetic', 'Uplifted', 'Happy', 'Focused'],
    flavors: ['Lemon', 'Citrus', 'Sweet'],
    dominantTerpenes: ['terpene-terpinolene', 'terpene-limonene'],
    helpsWith: ['Stress', 'Depression', 'Fatigue'],
    description:
      'An award-winning cross of Lemon Skunk and Super Silver Haze, repeatedly recognized at the Cannabis Cup in the late 2000s. Prized for a sharp, unmistakable citrus aroma and uplifting, sociable energy.',
  },
  {
    id: 'strain-gg4',
    name: 'Gorilla Glue #4',
    lineage: 'hybrid',
    effects: ['Relaxed', 'Euphoric', 'Happy', 'Sleepy'],
    flavors: ['Earthy', 'Pungent', 'Pine', 'Diesel'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-limonene'],
    helpsWith: ['Stress', 'Pain', 'Insomnia'],
    description:
      "An extremely resinous, potent hybrid discovered as an accidental cross (a hermaphroditic Chem's Sister pollinated a Sour Dubb and Chocolate Diesel). Known for its pungent, earthy-diesel aroma and heavy, glue-like trichome coverage that gave it its name.",
  },
  {
    id: 'strain-do-si-dos',
    name: 'Do-Si-Dos',
    lineage: 'indica',
    effects: ['Relaxed', 'Euphoric', 'Happy', 'Sleepy'],
    flavors: ['Sweet', 'Earthy', 'Floral'],
    dominantTerpenes: ['terpene-limonene', 'terpene-linalool'],
    helpsWith: ['Insomnia', 'Pain', 'Stress'],
    description:
      'A Cookies-family cross commonly cited as Girl Scout Cookies × Face Off OG, bred by Archive Seed Bank. Known for a sweet, earthy-floral aroma and strong, sedating body effects.',
  },
  {
    id: 'strain-strawberry-cough',
    name: 'Strawberry Cough',
    lineage: 'sativa',
    effects: ['Uplifted', 'Happy', 'Energetic', 'Focused'],
    flavors: ['Strawberry', 'Sweet', 'Berry'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-pinene'],
    helpsWith: ['Stress', 'Depression', 'Mood'],
    description:
      "Bred in the late '90s, known for a distinct sweet-strawberry aroma and a clear-headed, uplifting effect that made it a favorite for social and creative settings rather than heavy sedation.",
  },
  {
    id: 'strain-trainwreck',
    name: 'Trainwreck',
    lineage: 'hybrid',
    effects: ['Euphoric', 'Happy', 'Creative', 'Uplifted'],
    flavors: ['Pine', 'Lemon', 'Spicy'],
    dominantTerpenes: ['terpene-terpinolene', 'terpene-myrcene'],
    helpsWith: ['Stress', 'Pain', 'Mood'],
    description:
      'A potent, sativa-leaning Northern California hybrid known for a lemon-pine aroma and a fast-hitting blend of euphoric, cerebral effects with a relaxing undertone. One of the parent strains behind Pineapple Express.',
  },
  {
    id: 'strain-ice-cream-cake',
    name: 'Ice Cream Cake',
    lineage: 'indica',
    effects: ['Relaxed', 'Sleepy', 'Happy', 'Calm'],
    flavors: ['Sweet', 'Vanilla', 'Earthy'],
    dominantTerpenes: ['terpene-limonene', 'terpene-caryophyllene'],
    helpsWith: ['Insomnia', 'Stress', 'Pain'],
    description:
      'A rich, creamy-flavored cross of Wedding Cake and Gelato #33, known for deeply relaxing, sleepy effects that make it a popular late-evening choice within the Cookies/Gelato strain family.',
  },
  {
    id: 'strain-runtz',
    name: 'Runtz',
    lineage: 'hybrid',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Uplifted'],
    flavors: ['Sweet', 'Fruity', 'Tropical'],
    dominantTerpenes: ['terpene-limonene', 'terpene-caryophyllene'],
    helpsWith: ['Stress', 'Mood', 'Pain'],
    description:
      'A candy-sweet cross of Zkittlez and Gelato, bred by the Runtz collective and widely counterfeited/licensed once it became popular — genuine cuts are prized for their fruity aroma and balanced, euphoric effects.',
  },
  {
    id: 'strain-mimosa',
    name: 'Mimosa',
    lineage: 'sativa',
    effects: ['Uplifted', 'Energetic', 'Happy', 'Focused'],
    flavors: ['Citrus', 'Orange', 'Tropical', 'Sweet'],
    dominantTerpenes: ['terpene-limonene', 'terpene-myrcene'],
    helpsWith: ['Stress', 'Depression', 'Fatigue'],
    description:
      "An uplifting cross of Clementine and Purple Punch, bred by Symbiotic Genetics. Known for a bright citrus aroma and energetic, sociable effects that make it a popular morning or daytime strain, living up to its brunch-cocktail name.",
  },
  {
    id: 'strain-wedding-pie',
    name: 'Wedding Pie',
    lineage: 'hybrid',
    effects: ['Relaxed', 'Happy', 'Euphoric', 'Calm'],
    flavors: ['Sweet', 'Berry', 'Earthy'],
    dominantTerpenes: ['terpene-caryophyllene', 'terpene-limonene'],
    helpsWith: ['Stress', 'Pain', 'Mood'],
    description:
      'A cross of Wedding Cake and Grape Pie, known for a sweet, earthy-berry aroma and relaxed, happy effects that sit comfortably in the middle of the indica-sativa spectrum.',
  },
  {
    id: 'strain-forbidden-fruit',
    name: 'Forbidden Fruit',
    lineage: 'indica',
    effects: ['Relaxed', 'Happy', 'Sleepy', 'Calm'],
    flavors: ['Tropical', 'Berry', 'Sweet', 'Citrus'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-limonene'],
    helpsWith: ['Insomnia', 'Stress', 'Pain'],
    description:
      'A tropical cross of Cherry Pie and Tangie, known for a sweet citrus-berry aroma paired with heavily relaxing, sleepy body effects typical of its indica lineage.',
  },
  {
    id: 'strain-tangie',
    name: 'Tangie',
    lineage: 'sativa',
    effects: ['Uplifted', 'Energetic', 'Happy', 'Creative'],
    flavors: ['Tangerine', 'Citrus', 'Sweet'],
    dominantTerpenes: ['terpene-limonene', 'terpene-myrcene'],
    helpsWith: ['Stress', 'Depression', 'Mood'],
    description:
      'A modern revival of the 1990s classic "Tangerine Dream," bred by DNA Genetics. Known for an intensely tangerine aroma (one of the most citrus-forward strains around) and uplifting, creative energy.',
  },
  {
    id: 'strain-chemdawg',
    name: 'Chemdawg',
    lineage: 'hybrid',
    effects: ['Euphoric', 'Relaxed', 'Happy', 'Uplifted'],
    flavors: ['Diesel', 'Pungent', 'Earthy'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-caryophyllene'],
    helpsWith: ['Stress', 'Pain', 'Mood'],
    description:
      'A legendary, pungent, diesel-fuel-scented strain with murky, much-debated origins — widely believed to be an ancestor of both Sour Diesel and OG Kush, making it one of the most influential (if uncertain) genetic lines in modern cannabis.',
  },
  {
    id: 'strain-grape-ape',
    name: 'Grape Ape',
    lineage: 'indica',
    effects: ['Relaxed', 'Sleepy', 'Happy', 'Calm'],
    flavors: ['Grape', 'Berry', 'Sweet'],
    dominantTerpenes: ['terpene-myrcene', 'terpene-caryophyllene'],
    helpsWith: ['Insomnia', 'Stress', 'Muscle tension'],
    description:
      'A cross of Mendocino Purps, Skunk, and Afghani genetics, known for its sweet grape aroma and heavily relaxing, sedating effects — a parent strain behind Zkittlez.',
  },
]
