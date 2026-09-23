/**
 * The signed-in parent's child profiles, for the guide pages' "Suits <child>"
 * (080). Empty when signed out, childless, or the read fails: the fit line is a
 * suggestion, so its absence must never cost the page.
 *
 * Only called on the two pages that draw a fit, not in the layout —
 * lib/capabilities.ts explains why a per-page fetch was taken out of there.
 */
import { cache } from 'react'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import type { ChildProfile } from '@splat-connect/types'

export const getMyChildren = cache(async (): Promise<ChildProfile[]> => {
  if (!(await getCapabilities())) return []
  return apiClient.get<ChildProfile[]>('/api/child-profiles').catch(() => [])
})
