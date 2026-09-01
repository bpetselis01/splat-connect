import { buildNav } from '@splat-connect/types'
import { myRoute } from '../../../lib/my-routes'
import { popoverTiles } from '../../../lib/my-splat-tiles'

const caps: any = {
  profile: { name: 'B', role: 'admin' }, isAdmin: true, ledOrgs: [{ id: 'o', name: 'A' }],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }, exchangeActions: 0,
}

it('maps every href the hub and popover can emit to a mobile route, and nothing to the web', () => {
  const hrefs = [...buildNav(caps).flatMap((g) => g.rows.map((r) => r.href)), ...popoverTiles(caps).map((t) => t.href)]
  for (const href of hrefs) {
    const route = myRoute(href)
    expect(route.startsWith('/')).toBe(true)
    expect(route).not.toContain('/dashboard')
    expect(route).not.toBe('/my-splat')
  }
})

it('sends the one public row to Explore and unknown hrefs to the hub', () => {
  expect(myRoute('/get-involved/submit-an-idea')).toBe('/explore/challenges/new')
  expect(myRoute('/nowhere')).toBe('/my-splat')
})
