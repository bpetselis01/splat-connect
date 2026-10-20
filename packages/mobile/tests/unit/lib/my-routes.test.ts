import { buildNav } from '@splat-connect/types'
import { myRoute } from '../../../lib/my-routes'

const caps: any = {
  profile: { name: 'B', role: 'admin' }, isAdmin: true, ledOrgs: [{ id: 'o', name: 'A' }],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0,
}

it('Q02 maps every href the Me tab can emit to a mobile route, and nothing to the web', () => {
  const hrefs = buildNav(caps).flatMap((g) => g.rows.map((r) => r.href))
  for (const href of hrefs) {
    const route = myRoute(href)
    expect(route.startsWith('/')).toBe(true)
    expect(route).not.toContain('/dashboard')
    expect(route).not.toBe('/me')
  }
})

it('Q02 sends the one public row to Explore and unknown hrefs to the hub', () => {
  expect(myRoute('/get-involved/submit-an-idea')).toBe('/explore/challenges/new')
  expect(myRoute('/get-involved/makers-wanted')).toBe('/explore/makers-wanted')
  expect(myRoute('/dashboard/organisation/recycling')).toBe('/organisation/recycling')
  expect(myRoute('/dashboard/thanks')).toBe('/thanks')
  expect(myRoute('/dashboard/reports')).toBe('/reports')
  expect(myRoute('/nowhere')).toBe('/me')
})
