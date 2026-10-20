import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

// The fake mirrors the three reads middleware.ts makes: auth.getUser(),
// profiles.role for /admin, and the user_agreements lookup for the terms gate.
const state = {
  user: null as { id: string } | null,
  role: 'contributor',
  agreements: [] as { id: string }[],
  agreementsError: null as { message: string } | null,
  agreementFilters: [] as [string, unknown][],
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role } }) }) }) }
      }
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state.agreementFilters.push([col, val])
          return chain
        },
        limit: async () => ({ data: state.agreements, error: state.agreementsError }),
      }
      return chain
    },
  }),
}))

import { middleware } from '../../../middleware'

async function go(path: string) {
  const res = await middleware(new NextRequest(`http://localhost${path}`))
  const location = res.headers.get('location')
  return { status: res.status, location: location ? new URL(location) : null }
}
const passes = (r: Awaited<ReturnType<typeof go>>) => expect(r).toEqual({ status: 200, location: null })

beforeEach(() => {
  state.user = null
  state.role = 'contributor'
  state.agreements = []
  state.agreementsError = null
  state.agreementFilters = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('middleware: signed-out visitors', () => {
  it.each([
    ['/dashboard', '%2Fdashboard'],
    ['/dashboard/toys', '%2Fdashboard%2Ftoys'],
    ['/upload?draft=1', '%2Fupload%3Fdraft%3D1'],
    ['/notifications', '%2Fnotifications'],
    ['/dashboard/exchanges/abc?tab=open', '%2Fdashboard%2Fexchanges%2Fabc%3Ftab%3Dopen'],
  ])('WA23 sends %s to /login carrying the path and query as ?next=', async (path, encoded) => {
    const r = await go(path)
    expect(r.status).toBe(307)
    expect(r.location!.pathname).toBe('/login')
    expect(r.location!.search).toBe(`?next=${encoded}`)
  })

  it('WA24 sends /admin to /login', async () => {
    const r = await go('/admin/review')
    expect(r.status).toBe(307)
    expect(r.location!.pathname).toBe('/login')
  })

  it('WA28 leaves /organizations open to a signed-out visitor', async () => {
    passes(await go('/organizations'))
  })
})

describe('middleware: /admin', () => {
  it('WA25 sends a member to the home page', async () => {
    state.user = { id: 'u1' }
    const r = await go('/admin')
    expect(r.status).toBe(307)
    expect(r.location!.pathname).toBe('/')
  })

  it('WA26 lets an admin through /admin without asking for terms', async () => {
    state.user = { id: 'a1' }
    state.role = 'admin'
    passes(await go('/admin/review'))
    expect(state.agreementFilters).toEqual([])
  })

  it('WA26 lets an admin with the terms through /dashboard', async () => {
    state.user = { id: 'a1' }
    state.role = 'admin'
    state.agreements = [{ id: 'g1' }]
    passes(await go('/dashboard'))
  })
})

describe('middleware: the contributor terms gate', () => {
  beforeEach(() => {
    state.user = { id: 'u1' }
  })

  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/toys/new', '/dashboard/toys/new'],
    ['/upload', '/upload'],
    ['/upload?draft=1', '/upload?draft=1'],
    ['/tutorials/abc/edit', '/tutorials/abc/edit'],
  ])('WA27 sends %s to the terms gate with next=%s, keeping the query string', async (path, next) => {
    const r = await go(path)
    expect(r.status).toBe(307)
    expect(r.location!.pathname).toBe('/onboarding/contributor-terms')
    expect(r.location!.searchParams.get('next')).toBe(next)
    expect(r.location!.search).toBe(`?next=${encodeURIComponent(next)}`)
  })

  it('WA27 asks for the current version of the contributor terms only', async () => {
    await go('/dashboard')
    expect(state.agreementFilters).toEqual([
      ['user_id', 'u1'],
      ['agreement_type', 'contributor_terms'],
      ['version', AGREEMENT_VERSIONS.contributor_terms],
    ])
  })

  it('WA27 lets a member with the current terms through', async () => {
    state.agreements = [{ id: 'g1' }]
    passes(await go('/dashboard'))
    passes(await go('/tutorials/abc/edit'))
  })

  it('WA27 blocks the member with a retry flag when the lookup fails, and logs it', async () => {
    state.agreementsError = { message: 'boom' }
    const r = await go('/dashboard?tab=a')
    expect(r.status).toBe(307)
    expect(r.location!.pathname).toBe('/onboarding/contributor-terms')
    expect(r.location!.search).toBe('?next=%2Fdashboard%3Ftab%3Da&retry=1')
    expect(console.error).toHaveBeenCalledWith('[middleware] contributor_terms lookup failed:', 'boom')
  })

  it.each(['/organizations', '/organizations/o1', '/organizations/o1/public', '/organizations/o1/message'])(
    'WA28 leaves %s open to a signed-in member without the terms',
    async (path) => {
      passes(await go(path))
      expect(state.agreementFilters).toEqual([])
    }
  )

  it.each([
    '/',
    '/library',
    '/tutorials/abc',
    '/toy-library/t1/request',
    '/get-involved/requests/new',
    '/onboarding/child',
    '/onboarding/contributor-terms',
    '/legal/contributor-terms',
  ])('WA29 leaves %s open to a member without the terms', async (path) => {
    passes(await go(path))
    expect(state.agreementFilters).toEqual([])
  })
})
