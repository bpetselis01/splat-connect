import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { FilterPanel } from '../../../../components/ui/FilterPanel'

describe('FilterPanel', () => {
  it('keeps its filters out of the tree until the button opens them', () => {
    render(
      <FilterPanel activeCount={0}>
        <Text>Under 30 min</Text>
      </FilterPanel>
    )
    expect(screen.queryByText('Under 30 min')).toBeNull()
    const button = screen.getByRole('button', { name: 'Filters' })
    expect(button.props.accessibilityState).toMatchObject({ expanded: false })
    fireEvent.press(button)
    expect(screen.getByText('Under 30 min')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' }).props.accessibilityState).toMatchObject({ expanded: true })
    fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.queryByText('Under 30 min')).toBeNull()
  })

  it('shows the active count as a badge and says it aloud', () => {
    render(
      <FilterPanel activeCount={2}>
        <Text>x</Text>
      </FilterPanel>
    )
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeTruthy()
  })

  it('shows no badge at zero', () => {
    render(
      <FilterPanel activeCount={0}>
        <Text>x</Text>
      </FilterPanel>
    )
    expect(screen.queryByText('0')).toBeNull()
  })
})
