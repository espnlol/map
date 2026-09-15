import type { StrainLineage } from '../../types'

export const LINEAGE_BADGE: Record<StrainLineage, string> = {
  indica: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  sativa: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  hybrid: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
}
