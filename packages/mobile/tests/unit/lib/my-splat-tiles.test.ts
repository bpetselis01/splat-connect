import { popoverTiles } from '../../../lib/my-splat-tiles'
import type { Capabilities } from '@splat-connect/types'

const base: Capabilities = {
  profile: { id: 'u', name: 'B', email: 'b@x', role: 'contributor', public_showcase: true, created_at: '' },
  isAdmin: false, ledOrgs: [], unread: { tutorials: 0, exchanges: 2, challenges: 1, total: 3 }, exchangeActions: 3,
}

it('is six tiles: exchanges with its count, design challenges with the challenge unread count', () => {
  const t = popoverTiles(base)
  expect(t.map((x) => x.label)).toEqual([
    'My exchanges', 'Design challenges', 'My toys', 'My tutorials', 'Saved', 'Account & child profiles',
  ])
  expect(t[0].count).toBe(3)
  expect(t[1].count).toBe(1)
  expect(t[2].count).toBeUndefined()
})

it('swaps Design challenges for Review queue when the account leads an organisation', () => {
  const t = popoverTiles({ ...base, ledOrgs: [{ id: 'o', name: 'A' } as any] })
  expect(t[1]).toMatchObject({ label: 'Review queue', href: '/dashboard/organisation' })
  expect(t).toHaveLength(6)
})
