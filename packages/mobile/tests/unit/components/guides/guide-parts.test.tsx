import { Linking } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { GuideParts } from '../../../../components/guides/guide-parts'
import { useGatherTicks } from '../../../../lib/guide-progress'

// The screen owns the ticks (useGatherTicks); this stands in for it.
function Parts(props: Omit<React.ComponentProps<typeof GuideParts>, 'ticks'>) {
  const g = useGatherTicks('g', props.parts, [])
  return <GuideParts {...props} ticks={g.parts} />
}

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
  render(<Parts parts={parts} pricesCheckedOn={null} />)
  expect(await screen.findByText('0 of 2 gathered')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Glue: gathered'))
  expect(screen.getByText('1 of 2 gathered')).toBeTruthy()
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-parts.g.signed-out', '["p2"]')
})

it('totals the prices and says when they were checked', async () => {
  render(<Parts parts={parts} pricesCheckedOn="2026-08-02" />)
  expect(await screen.findByText('Total')).toBeTruthy()
  expect(screen.getAllByText('$12.50')).toHaveLength(2) // Servo's row + the total; optional glue is left out
  expect(screen.getByText('Prices checked 2 Aug 2026')).toBeTruthy()
  expect(screen.getByText('Glue ×1 (optional)')).toBeTruthy()
})

it('opens a buy link in the browser', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  render(<Parts parts={parts} pricesCheckedOn={null} />)
  fireEvent.press(await screen.findByText('Jaycar'))
  expect(open).toHaveBeenCalledWith('https://j.test/servo')
})

it('never opens a buy link that is not a web address', async () => {
  const { BuyLinks } = jest.requireActual('../../../../components/guides/guide-parts')
  render(<BuyLinks links={[{ label: 'Call us', url: 'tel:0400000000' }, { label: 'Jaycar', url: 'https://www.jaycar.com.au' }]} />)
  expect(screen.queryByText('Call us')).toBeNull()
  expect(screen.getByText('Jaycar')).toBeTruthy()
})
