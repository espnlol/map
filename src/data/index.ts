import { strains } from './strains'
import type { Strain } from '../types'

// The only reference data left — a strain-name taxonomy for optionally
// tagging a real, user-logged product in the Manage tab. Everything else
// (dispensaries, brands, products, prices) is real data entered by hand
// through the Manage tab and lives in the Zustand store, not here.
export { strains }

export const strainById = new Map<string, Strain>(strains.map((s) => [s.id, s]))
