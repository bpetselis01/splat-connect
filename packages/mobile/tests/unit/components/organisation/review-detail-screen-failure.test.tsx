// A failed project load says so, retries on Try again, and never hits console.error.
// journeys: L03
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ReviewDetailScreen } from '../../../../components/organisation/review-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: jest.fn() }) } } }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'leader1', name: 'Lee' }, isAdmin: false, ledOrgs: [{ id: 'org1', name: 'Riverside' }] }, loading: false, refresh: jest.fn() }),
}))

const detail = {
  id: 't1', title: 'Bubble machine', description: 'Switch-adapt a bubble machine.', difficulty: 'easy', kind: 'toy_adaptation',
  status: 'draft', tutorial_pdf_url: 't1/tutorial.pdf', photo_urls: [], toy_photo_url: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  parts: [], tools: [], stl_files: [],
  tutorial_contributors: [{ profile_id: 'a1', role: 'primary', profiles: { id: 'a1', name: 'Sam' } }],
}

it('offline: says so, Try again re-fetches and shows the project', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let round = 0
  mockGet.mockImplementation((p: string) => {
    if (round === 0) return p === '/api/tutorials/t1' ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])
    return Promise.resolve(p === '/api/tutorials/t1' ? detail : [])
  })
  render(<ReviewDetailScreen tutorialId="t1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  round = 1
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Bubble machine')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
