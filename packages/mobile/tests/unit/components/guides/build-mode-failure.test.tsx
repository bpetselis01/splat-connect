// A failed guide load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { BuildMode } from '../../../../components/guides/build-mode'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('../../../../lib/guide-focus', () => ({ setGuideFocus: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }))
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn() }),
}))

const GUIDE = {
  id: 'g', title: 'Robot Arm', tutorial_contributors: [], safety_declared_at: '2026-08-01', safety_notes: [],
  steps: [{ id: 's1', tutorial_id: 'g', position: 1, title: 'Open it', body: 'Unscrew the lid.', photo_url: null }],
}

it('offline: says so, Try again re-fetches and opens the guide', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) =>
    p.endsWith('/notes') ? Promise.resolve([]) : down ? Promise.reject(new Error('Network request failed')) : Promise.resolve(GUIDE)
  )
  render(<BuildMode id="g" />)
  expect(await screen.findByText("Couldn't load this guide. Please try again.")).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Robot Arm', { exact: false })).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
