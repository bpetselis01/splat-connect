import { render, screen, act, waitFor } from '@testing-library/react-native'
import { RecentRows } from '../../../../components/home/recent-rows'
import { recordRecent, resetRecentsCache, setRecentsOwner, recentsKeyFor } from '../../../../lib/recents'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const mockDisk = new Map<string, string>()
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (k: string) => Promise.resolve(mockDisk.get(k) ?? null),
    setItem: (k: string, v: string) => { mockDisk.set(k, v); return Promise.resolve() },
    removeItem: (k: string) => { mockDisk.delete(k); return Promise.resolve() },
  }),
}))

beforeEach(() => {
  mockDisk.clear()
  resetRecentsCache()
  setRecentsOwner(null)
  setRecentsOwner('u1')
  resetRecentsCache()
})

it('a guide row keeps its subtitle and badge after the app is closed and opened again', async () => {
  act(() => {
    recordRecent({ id: '1', kind: 'guide', title: 'Build a Robot Arm', subtitle: 'Guide · 30 min build', badge: 'Easy', href: '/guides/1' })
  })
  await waitFor(() => expect(mockDisk.get(recentsKeyFor('u1'))).toContain('Guide · 30 min build'))

  resetRecentsCache()
  render(<RecentRows />)

  expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
  expect(screen.getByText('Guide · 30 min build')).toBeTruthy()
  expect(screen.getByText('Easy')).toBeTruthy()
})

it('a row stored without a badge shows no badge', async () => {
  mockDisk.set(recentsKeyFor('u1'), JSON.stringify([
    { key: 'guide:2', kind: 'guide', title: 'Light switch', subtitle: 'Guide', href: '/guides/2', at: 1 },
  ]))
  render(<RecentRows />)
  expect(await screen.findByText('Light switch')).toBeTruthy()
  expect(screen.getByText('Guide')).toBeTruthy()
  expect(screen.queryByTestId('recent-badge')).toBeNull()
})
