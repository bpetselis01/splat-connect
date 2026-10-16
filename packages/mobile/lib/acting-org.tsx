// packages/mobile/lib/acting-org.tsx
//
// Which organisation a leader of several is acting for. The choice is kept on
// the device (SecureStore on a phone, localStorage in the Expo web export, as
// home-shortcuts does) and checked against the organisations the person still
// leads. Every leader screen reads it here instead of taking ledOrgs[0].
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Organization } from '@splat-connect/types'
import { useCapabilities } from './capabilities'
import { resolveAuthStorage } from './supabase-storage'

export const ACTING_ORG_KEY = 'acting_org_id'

type Store = { storedId: string | null; ready: boolean; set: (id: string | null) => void }
const NOT_MOUNTED: Store = { storedId: null, ready: true, set: () => {} }
const StoreContext = createContext<Store>(NOT_MOUNTED)

function persist(id: string | null) {
  const storage = resolveAuthStorage()
  const failed = (err: unknown) => console.error('[ActingOrg] could not save the organisation, keeping it in memory:', err)
  try {
    ;(id ? storage.setItem(ACTING_ORG_KEY, id) : storage.removeItem(ACTING_ORG_KEY)).catch(failed)
  } catch (err) {
    failed(err)
  }
}

export function ActingOrgProvider({ children }: { children: React.ReactNode }) {
  const [storedId, setStoredId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let ignore = false
    resolveAuthStorage()
      .getItem(ACTING_ORG_KEY)
      .then((raw) => {
        // A pick made before the read landed wins.
        if (!ignore) setStoredId((cur) => cur ?? raw)
      })
      .catch((err) => console.error('[ActingOrg] could not read the organisation, using the first:', err))
      .finally(() => {
        if (!ignore) setReady(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  const set = useCallback((id: string | null) => {
    setStoredId(id)
    persist(id)
  }, [])
  const value = useMemo(() => ({ storedId, ready, set }), [storedId, ready, set])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useActingOrg(): {
  org: Organization | null
  orgs: Organization[]
  loading: boolean
  refresh: () => Promise<void>
  setActingOrg: (id: string) => void
} {
  const { storedId, ready, set } = useContext(StoreContext)
  const { caps, loading, refresh } = useCapabilities()
  const orgs = caps?.ledOrgs ?? []
  const org = orgs.find((o) => o.id === storedId) ?? orgs[0] ?? null

  // An empty list can be a failed fetch, so only a non-empty one proves the
  // person stopped leading the stored organisation.
  useEffect(() => {
    if (ready && storedId && orgs.length > 0 && !orgs.some((o) => o.id === storedId)) set(null)
  }, [ready, storedId, orgs, set])

  return { org, orgs, loading: loading || !ready, refresh, setActingOrg: set }
}
