import { render, screen, fireEvent } from '@testing-library/react-native'
import { Provenance } from '../../../../components/guides/provenance'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const person = (name: string, role = 'collaborator') => ({ role, profiles: { name }, profile_id: name })

it('orders the byline primary-first and truncates at two names', () => {
  const onPerson = jest.fn()
  render(
    <Provenance
      contributors={[person('Priya K.'), person('Sam T.', 'primary'), person('Mei W.')]}
      orgs={[]}
      onPerson={onPerson}
      onOrg={jest.fn()}
    />
  )
  expect(screen.getByText(/^By/)).toBeTruthy()
  fireEvent.press(screen.getByText('Sam T.'))
  expect(onPerson).toHaveBeenCalledWith('Sam T.')
  expect(screen.getByText('+ 2')).toBeTruthy()
})

it('shows the mint backed-by chip for an accepted org and fires onOrg on press', () => {
  const onOrg = jest.fn()
  render(
    <Provenance
      contributors={[person('Sam T.', 'primary')]}
      orgs={[{ org_id: 'o1', status: 'accepted', organizations: { name: 'TAD Australia' } }]}
      onPerson={jest.fn()}
      onOrg={onOrg}
    />
  )
  fireEvent.press(screen.getByText('Backed by TAD Australia'))
  expect(onOrg).toHaveBeenCalledWith('o1')
})

it('shows the inert reviewed-by-SPLAT chip with no press handler when there is no accepted org', () => {
  const onOrg = jest.fn()
  render(
    <Provenance
      contributors={[person('Sam T.', 'primary')]}
      orgs={[]}
      onPerson={jest.fn()}
      onOrg={onOrg}
    />
  )
  const chip = screen.getByText('Reviewed by SPLAT')
  fireEvent.press(chip)
  expect(onOrg).not.toHaveBeenCalled()
})
