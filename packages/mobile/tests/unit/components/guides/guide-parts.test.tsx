import { Linking } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { GuideParts } from '../../../../components/guides/guide-parts'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const parts = [
  { id: 'p1', tutorial_id: 'g', name: 'Servo', quantity: 2, is_optional: false, price_cents: 1250, buy_links: [{ label: 'Jaycar', url: 'https://j.test/servo' }] },
  { id: 'p2', tutorial_id: 'g', name: 'Glue', quantity: 1, is_optional: true, price_cents: 500, buy_links: [] },
]

it('ticks a part and keeps it on the device', async () => {
  render(<GuideParts tutorialId="g" parts={parts} pricesCheckedOn={null} />)
  expect(await screen.findByText('0 of 2 gathered')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Glue: gathered'))
  expect(screen.getByText('1 of 2 gathered')).toBeTruthy()
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-parts.g', '["p2"]')
})

it('totals the prices and says when they were checked', async () => {
  render(<GuideParts tutorialId="g" parts={parts} pricesCheckedOn="2026-08-02" />)
  expect(await screen.findByText('Total')).toBeTruthy()
  expect(screen.getAllByText('$12.50')).toHaveLength(2) // Servo's row + the total; optional glue is left out
  expect(screen.getByText('Prices checked 2 Aug 2026')).toBeTruthy()
  expect(screen.getByText('Glue ×1 (optional)')).toBeTruthy()
})

it('opens a buy link in the browser', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  render(<GuideParts tutorialId="g" parts={parts} pricesCheckedOn={null} />)
  fireEvent.press(await screen.findByText('Jaycar'))
  expect(open).toHaveBeenCalledWith('https://j.test/servo')
})
