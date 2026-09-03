// packages/mobile/tests/unit/components/ui/filter-sheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { FilterSheet } from '../../../../components/ui/FilterSheet'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

describe('FilterSheet', () => {
  it('keeps the filters off screen until the trigger is pressed, and Done puts them away', () => {
    render(
      <FilterSheet count={0}>
        <Text>Easy</Text>
      </FilterSheet>
    )
    expect(screen.queryByText('Easy')).toBeNull()

    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Easy')).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('Easy')).toBeNull()
  })

  it('says how many filters are live on the trigger, so a closed sheet never hides a narrowed list', () => {
    render(
      <FilterSheet count={2}>
        <Text>Easy</Text>
      </FilterSheet>
    )
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })
})
