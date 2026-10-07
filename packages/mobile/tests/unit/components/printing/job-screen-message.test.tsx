// The printer card's Message button goes to the thread that is already on the
// page: no new screen, no new data.
// journeys: R05
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) } },
}))
jest.mock('expo-image-picker', () => ({}))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
const mockInvalidate = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  invalidateCapabilities: (...a: unknown[]) => mockInvalidate(...a),
  useCapabilities: () => ({ caps: { profile: { id: 'family' }, ledOrgs: [] } }),
}))

const mockFocus = jest.fn()
jest.mock('../../../../components/ui/TextField', () => {
  const React = jest.requireActual('react')
  const { TextInput } = jest.requireActual('react-native')
  return {
    TextField: ({ ref, ...props }: { ref?: unknown }) => {
      React.useImperativeHandle(ref, () => ({ focus: mockFocus }))
      return React.createElement(TextInput, props)
    },
  }
})

it('takes the family to the thread input from the printer card', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1'
      ? Promise.resolve({
          id: 'j1', type: 'print', status: 'accepted', requester_id: 'family', owner_id: 'maker', owner_org_id: null,
          requester_name: 'Family', owner_name: 'Tom B.', tutorial_title: 'Switch mount', printer_id: null, printer: null,
          print_files: [{ id: 's1', filename: 'mount.stl', quantity: 1 }], print_group_id: 'g', print_group_size: 1,
          printing_started_at: null, ready_at: null, ready_photo_url: null, owner_code: null, requester_code: '222222',
          owner_confirmed_at: null, requester_confirmed_at: null, created_at: new Date().toISOString(), messages: [],
        })
      : Promise.reject(new Error('n/a'))
  )
  render(<PrintJobScreen id="j1" />)
  fireEvent.press(await screen.findByText('Message'))
  expect(mockFocus).toHaveBeenCalled()
})
