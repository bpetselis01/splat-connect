// packages/mobile/lib/my-children.ts
//
// The signed-in parent's child profiles, for the guide screens' "Suits <child>"
// (080). Empty until loaded, when childless, or when the read fails: the fit
// line is a suggestion, so its absence must never cost the screen.
import { useEffect, useState } from 'react'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from './api-client'

export function useMyChildren(): ChildProfile[] {
  const [children, setChildren] = useState<ChildProfile[]>([])
  useEffect(() => {
    let ignore = false
    apiClient
      .get<ChildProfile[]>('/api/child-profiles')
      .then((list) => {
        if (!ignore) setChildren(list)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])
  return children
}
