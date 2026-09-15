// Domain types for the strain & terpene explorer.

export type StrainLineage = 'indica' | 'sativa' | 'hybrid'

export const LINEAGE_LABEL: Record<StrainLineage, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
}

export const LINEAGES: StrainLineage[] = ['indica', 'sativa', 'hybrid']

/** A real cannabis genetic (cultivar). Effects/flavors/helpsWith are the
 * commonly-reported characteristics you'd see on a seed bank listing or
 * dispensary placard for this genetic — general industry-common knowledge,
 * not lab results for any specific batch, and not scraped from any single
 * commercial platform. Genetic lineage/parentage mentioned in `description`
 * is noted as "commonly cited" where the actual cross is disputed or
 * unconfirmed, rather than stated as settled fact. */
export interface Strain {
  id: string
  name: string
  lineage: StrainLineage
  effects: string[]
  flavors: string[]
  /** Terpene ids most commonly reported as dominant in this genetic. */
  dominantTerpenes: string[]
  /** Commonly-reported reasons people reach for this strain — general,
   * user-reported association, not a medical claim or dosing guidance. */
  helpsWith: string[]
  description: string
}

/** A cannabis aroma compound. General, widely-published aromatic-chemistry
 * reference info — not per-product lab data, and not sourced from any
 * single commercial platform. Boiling points are approximate; vaporization
 * guides vary by a few degrees between sources. */
export interface Terpene {
  id: string
  name: string
  aroma: string[]
  effects: string[]
  alsoFoundIn: string[]
  boilingPoint: string
  description: string
}
