// journeys: T20
import { teamRows } from '../../../lib/team-state'

const profile = (id: string, name: string) => ({ id, name }) as any

it('puts the owner first, then members, then pending, then declined', () => {
  const rows = teamRows(
    [
      { profile_id: 'a', role: 'primary', profiles: profile('a', 'Ada') },
      { profile_id: 'b', role: 'collaborator', profiles: profile('b', 'Bo') },
    ] as any,
    [
      { invited_profile_id: 'd', status: 'declined', profiles: profile('d', 'Di') },
      { invited_profile_id: 'c', status: 'pending', profiles: profile('c', 'Cy') },
    ] as any
  )
  expect(rows.map((r) => r.state)).toEqual(['primary', 'collaborator', 'pending', 'declined'])
})

it('hides an accepted invite whether or not its seat is visible', () => {
  const rows = teamRows([{ profile_id: 'a', role: 'primary', profiles: profile('a', 'Ada') }] as any, [
    { invited_profile_id: 'a', status: 'accepted', profiles: profile('a', 'Ada') },
    { invited_profile_id: 'z', status: 'accepted', profiles: profile('z', 'Zed') },
  ] as any)
  expect(rows).toHaveLength(1)
})
