// journeys: L23
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

const org = (over: object = {}) => ({
  name: 'Northside', state: 'VIC', logo_url: 'https://x/logo.jpg', cover_url: null, rate_note: 'Filament at cost',
  capabilities: ['Holds toys'], recycling_materials: ['PLA'], recycling_note: null, payment_methods: ['cash'],
  doors: [{ id: 'd1', title: 'Ask for a toy', body: null, target: 'toy_library' }],
  rate_lines: [{ id: 'r1', description: 'PLA', amount_cents: 450, claiming: true }],
  ...over,
})
const save = () => screen.getByRole('button', { name: 'Save and publish' })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) => Promise.resolve(p.endsWith('/thanks') ? [] : org()))
  mockPatch.mockResolvedValue({})
  mockPut.mockResolvedValue([])
})

describe('OrgProfileEditScreen lists', () => {
  it('no longer says pictures are edited on the web', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    expect(screen.queryByText(/edited on the web/)).toBeNull()
  })

  it('saves the profile extras, then both lists, with cents round-tripped', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('4.50')
    fireEvent.changeText(screen.getByDisplayValue('4.50'), '$4.55')
    fireEvent.press(screen.getByRole('button', { name: 'Takes recycling' }))
    fireEvent.press(save())
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2))
    expect(mockPatch.mock.calls[0][1]).toMatchObject({
      capabilities: ['Holds toys', 'Takes recycling'], recycling_materials: ['PLA'], payment_methods: ['cash'], rate_note: 'Filament at cost',
    })
    expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('logo_url')
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/doors', { doors: [{ title: 'Ask for a toy', body: '', target: 'toy_library' }] })
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/rate-lines', { lines: [{ description: 'PLA', amount_cents: 455, claiming: true }] })
  })

  it('blocks a seventh door and a 21st line', async () => {
    mockGet.mockImplementation((p: string) =>
      Promise.resolve(p.endsWith('/thanks') ? [] : org({
        doors: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, title: `D${i}`, body: null, target: 'message' })),
        rate_lines: Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, description: `L${i}`, amount_cents: 100, claiming: true })),
      }))
    )
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    expect(screen.queryByRole('button', { name: 'Add a door' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a line' })).toBeNull()
  })

  it('a bad amount stops the save before anything is sent', async () => {
    render(<OrgProfileEditScreen />)
    fireEvent.changeText(await screen.findByDisplayValue('4.50'), 'lots')
    fireEvent.press(save())
    expect(await screen.findByText('"PLA" needs an amount in dollars.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('a picture uploads with orgId and slot; Remove then sends logo_url null on save', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }] })
    mockUpload.mockResolvedValue({ url: 'https://x/cover.jpg' })
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    fireEvent.press(screen.getByRole('button', { name: 'Add a cover photo' }))
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith('/api/upload/org-image', 'o1', { uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' }, 'orgId', { slot: 'cover' })
    )
    fireEvent.press(await screen.findByRole('button', { name: 'Remove the logo' }))
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ logo_url: null })
  })
})
