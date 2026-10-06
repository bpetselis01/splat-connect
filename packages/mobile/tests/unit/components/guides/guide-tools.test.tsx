import { Linking } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { GuideTools } from '../../../../components/guides/guide-tools'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const tools = [
  { id: 't1', tutorial_id: 'g', name: 'Small Phillips screwdriver (#1)', is_optional: false, buy_links: [] },
  { id: 't2', tutorial_id: 'g', name: 'Hot glue gun', is_optional: false, buy_links: [] },
]

it('ticks the tools you already have and links to Learn', async () => {
  render(<GuideTools tutorialId="g" tools={tools} />)
  expect(await screen.findByText('0 of 2 already yours')).toBeTruthy()
  expect(screen.getByText('Not counted in the parts total — tools are a one-off.')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('I already have Hot glue gun'))
  expect(screen.getByText('1 of 2 already yours')).toBeTruthy()
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-tools.g', '["t2"]')
  fireEvent.press(screen.getByRole('button', { name: /Tools and materials on Learn/ }))
  expect(mockPush).toHaveBeenCalledWith('/explore/learn/tools-and-materials')
})

it('says why each tool and how to get it', async () => {
  render(<GuideTools tutorialId="g" tools={[{ ...tools[1], note: 'Anchoring the jack', get_by: 'borrow' }]} />)
  expect(await screen.findByText('Anchoring the jack')).toBeTruthy()
  expect(screen.getByText('Borrow')).toBeTruthy()
})

it('links each tool to where it is sold', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  render(<GuideTools tutorialId="g" tools={[{ ...tools[0], buy_links: [{ label: 'Bunnings', url: 'https://b.test/x' }] }]} />)
  fireEvent.press(await screen.findByText('Bunnings'))
  expect(open).toHaveBeenCalledWith('https://b.test/x')
})
