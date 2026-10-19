// Each section of the organisation profile editor, edited and then applied by "Save and publish".
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
const mockCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: jest.fn() }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps }))
jest.mock('../../../../components/organisation/org-leaders-section', () => ({ OrgLeadersSection: () => null }))
const mockPick = jest.fn(); const mockUpload = jest.fn()
jest.mock('../../../../lib/pick-photo', () => ({ pickPreviewedPhoto: (...a: unknown[]) => mockPick(...a) }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))

const org = (over: object = {}) => ({
  name: 'Northside', state: 'VIC', logo_url: 'https://x/logo.jpg', cover_url: 'https://x/cover.jpg', rate_note: 'Filament at cost',
  capabilities: ['Holds toys'], recycling_materials: ['PLA'], recycling_note: 'Side door', payment_methods: ['cash'],
  doors: [
    { id: 'd1', title: 'Ask for a toy', body: 'From the shelf', target: 'toy_library' },
    { id: 'd2', title: 'Message us', body: null, target: 'message' },
  ],
  rate_lines: [
    { id: 'r1', description: 'PLA', amount_cents: 450, claiming: true },
    { id: 'r2', description: 'Machine time', amount_cents: 800, claiming: false },
  ],
  ...over,
})
const save = () => screen.getByRole('button', { name: 'Save and publish' })
const loaded = () => screen.findByDisplayValue('Northside')
const patched = () => mockPatch.mock.calls[0][1]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) => Promise.resolve(p.endsWith('/thanks') ? [] : org()))
  mockPatch.mockResolvedValue({})
  mockPut.mockResolvedValue([])
})

describe('the profile editor sections', () => {
  it('L38 Replace the logo uploads it at once with the org id and slot, and shows the new picture without a profile write', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///new.jpg', fileName: 'new.jpg', mimeType: 'image/jpeg' }] })
    mockUpload.mockResolvedValue({ url: 'https://x/logo-new.jpg' })
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'Replace the logo' }))
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith('/api/upload/org-image', 'o1', { uri: 'file:///new.jpg', name: 'new.jpg', mimeType: 'image/jpeg' }, 'orgId', { slot: 'logo' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Current logo').props.source).toEqual({ uri: 'https://x/logo-new.jpg' }))
    expect(mockPatch).not.toHaveBeenCalled()
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(patched()).not.toHaveProperty('logo_url')
  })

  it('L38 a cancelled picker uploads nothing, and a refused upload shows the server sentence', async () => {
    mockPick.mockResolvedValue({ canceled: true })
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'Replace the cover photo' }))
    await waitFor(() => expect(mockPick).toHaveBeenCalled())
    expect(mockUpload).not.toHaveBeenCalled()

    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }] })
    mockUpload.mockRejectedValue(new Error('Request failed with status 400: Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.'))
    fireEvent.press(screen.getByRole('button', { name: 'Replace the cover photo' }))
    expect(await screen.findByText('Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.')).toBeTruthy()
  })

  it('L39 Remove the logo and the cover write nothing until Save and publish, which then sends both as null', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'Remove the logo' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remove the cover photo' }))
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Current logo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a logo' })).toBeTruthy()
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/profile', expect.objectContaining({ logo_url: null, cover_url: null })))
  })

  it('L40 Save and publish sends the doors as edited: a changed title, line and target, an added door, and a removed one', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.changeText(screen.getByDisplayValue('Ask for a toy'), 'Borrow a toy')
    fireEvent.changeText(screen.getByDisplayValue('From the shelf'), 'Pick one from the shelf.')
    fireEvent.press(screen.getAllByRole('radio', { name: 'Ask them to print' })[0])
    fireEvent.press(screen.getByRole('button', { name: 'Remove door 2' }))
    fireEvent.press(screen.getByRole('button', { name: 'Add a door' }))
    fireEvent.changeText(screen.getByLabelText('Door 2 title'), 'Come to a build day')
    fireEvent.press(screen.getAllByRole('radio', { name: 'Your events' })[1])
    fireEvent.press(save())
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/doors', expect.anything()))
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/doors', {
      doors: [
        { title: 'Borrow a toy', body: 'Pick one from the shelf.', target: 'print' },
        { title: 'Come to a build day', body: '', target: 'events' },
      ],
    })
  })

  it('L40 a door with a line but no title stops the save before anything is sent', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.changeText(screen.getByDisplayValue('Ask for a toy'), '')
    fireEvent.press(save())
    expect(await screen.findByText('Every door needs a title.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('L41 Save and publish sends the cost lines in cents with Claiming back or Covering it, the why note and the payment methods', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.changeText(screen.getByDisplayValue('4.50'), '$5')
    fireEvent.press(screen.getByRole('button', { name: 'Claiming back' }))
    fireEvent.press(screen.getAllByRole('button', { name: 'Covering it' })[1])
    fireEvent.press(screen.getByRole('button', { name: 'Add a line' }))
    fireEvent.changeText(screen.getByLabelText('Line 3 description'), 'Postage')
    fireEvent.changeText(screen.getByLabelText('Line 3 amount in dollars'), '3.20')
    fireEvent.changeText(screen.getByDisplayValue('Filament at cost'), 'Filament and postage at cost.')
    fireEvent.press(screen.getByRole('button', { name: 'PayID' }))
    fireEvent.press(screen.getByRole('button', { name: 'Cash on the day' }))
    fireEvent.press(save())
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2))
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/rate-lines', {
      lines: [
        { description: 'PLA', amount_cents: 500, claiming: false },
        { description: 'Machine time', amount_cents: 800, claiming: true },
        { description: 'Postage', amount_cents: 320, claiming: true },
      ],
    })
    expect(patched()).toMatchObject({ rate_note: 'Filament and postage at cost.', payment_methods: ['payid'] })
  })

  it('L41 removing a line drops it from the list sent, and costs with no why note stop the save', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'Remove line 2' }))
    fireEvent.changeText(screen.getByDisplayValue('Filament at cost'), '  ')
    fireEvent.press(save())
    expect(await screen.findByText('Say why these costs, in a sentence or two.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
    fireEvent.changeText(screen.getByLabelText(/Why these costs/), 'At cost.')
    fireEvent.press(save())
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/rate-lines', { lines: [{ description: 'PLA', amount_cents: 450, claiming: true }] }))
  })

  it('L42 the What you do chips switch on and off, and Save and publish sends the capability list', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'Holds toys' }))
    fireEvent.press(screen.getByRole('button', { name: 'Has a printer' }))
    fireEvent.press(screen.getByRole('button', { name: 'Runs build days' }))
    expect(screen.getByRole('button', { name: 'Holds toys' }).props.accessibilityState.selected).toBe(false)
    expect(mockPatch).not.toHaveBeenCalled()
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(patched().capabilities).toEqual(['Has a printer', 'Runs build days'])
  })

  it('L43 the recycling chips and How you want it brought are sent on Save and publish', async () => {
    render(<OrgProfileEditScreen />)
    await loaded()
    fireEvent.press(screen.getByRole('button', { name: 'PETG' }))
    fireEvent.press(screen.getByRole('button', { name: 'PLA' }))
    fireEvent.changeText(screen.getByDisplayValue('Side door'), 'Ring the side door.')
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(patched()).toMatchObject({ recycling_materials: ['PETG'], recycling_note: 'Ring the side door.' })
  })
})
