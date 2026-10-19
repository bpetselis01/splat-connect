import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgProfileEditScreen } from '../../../../components/organisation/org-profile-edit-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn(); const mockPatch = jest.fn(); const mockPut = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: jest.fn() }),
}))
jest.mock('../../../../components/organisation/org-leaders-section', () => ({ OrgLeadersSection: () => null }))
const mockPick = jest.fn(); const mockUpload = jest.fn()
jest.mock('../../../../lib/pick-photo', () => ({ pickPreviewedPhoto: (...a: unknown[]) => mockPick(...a) }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(p.endsWith('/thanks') ? [] : { name: 'Northside', state: 'VIC', rate_note: 'why', rate_lines: [{ id: 'r1', description: 'PLA', amount_cents: 450, claiming: true }] })
  )
  mockPatch.mockResolvedValue({})
})

it('a failed PUT shows the server sentence and keeps the local edits', async () => {
  mockPut.mockRejectedValue(new Error('Request failed with status 400: Give "PLA" an amount.'))
  render(<OrgProfileEditScreen />)
  fireEvent.changeText(await screen.findByDisplayValue('4.50'), '9.99')
  fireEvent.press(screen.getByRole('button', { name: 'Save and publish' }))
  expect(await screen.findByText('Give "PLA" an amount.')).toBeTruthy()
  expect(screen.getByDisplayValue('9.99')).toBeTruthy()
})

it('a failed upload shows the server sentence and leaves the picture alone', async () => {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
  mockUpload.mockRejectedValue(new Error('Upload to /api/upload/org-image failed with status 400: Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.'))
  render(<OrgProfileEditScreen />)
  await screen.findByDisplayValue('Northside')
  fireEvent.press(screen.getByRole('button', { name: 'Add a logo' }))
  expect(await screen.findByText('Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove the logo' })).toBeNull())
})
