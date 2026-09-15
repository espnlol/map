import type { Strain } from '../types'

function overlapCount(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter((x) => setB.has(x)).length
}

/** "Related strains" is a similarity score over data we actually have —
 * shared lineage, effects, flavors, and dominant terpenes — not a claim
 * about real genetic relation/parentage. Weighted so a shared terpene
 * profile (the more specific/chemical signal) counts for more than a
 * shared effect adjective, and lineage is a modest tiebreaker rather than
 * the dominant factor (otherwise this just becomes "same lineage" sorted
 * arbitrarily). */
export function relatedStrains(strain: Strain, all: Strain[], count = 4): Strain[] {
  return all
    .filter((s) => s.id !== strain.id)
    .map((s) => ({
      strain: s,
      score:
        (s.lineage === strain.lineage ? 1 : 0) +
        overlapCount(s.effects, strain.effects) +
        overlapCount(s.flavors, strain.flavors) +
        overlapCount(s.dominantTerpenes, strain.dominantTerpenes) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.strain)
}
