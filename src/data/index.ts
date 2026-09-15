import { strains } from './strains'
import { terpenes } from './terpenes'
import type { Strain, Terpene } from '../types'

export { strains, terpenes }

export const strainById = new Map<string, Strain>(strains.map((s) => [s.id, s]))
export const terpeneById = new Map<string, Terpene>(terpenes.map((t) => [t.id, t]))
