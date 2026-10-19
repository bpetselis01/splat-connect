// Editing a toy with awkward input and failures: ages, text, photos that fail
// or are too big, a second tap on Save or Publish. The ordinary journeys live
// in editor.test.tsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-toys/editor'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
let mockFocus: () => (() => void) | void
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() }), useFocusEffect: (e: () => (() => void) | void) => { mockFocus = e; useEffect(e, []) } }
})
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a), post: jest.fn(), delete: jest.fn() },
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
const mockCameraPerm = jest.fn()
const mockLibraryPerm = jest.fn()
const mockCamera = jest.fn()
const mockLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...a: unknown[]) => mockCameraPerm(...a),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockLibraryPerm(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
}))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({
    caps: { profile: { id: 'viewer1', name: 'Viewer' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 },
    loading: false,
    refresh: jest.fn(),
  }),
}))

const toy = (over: object = {}) => ({
  id: 'toy1', owner_id: 'viewer1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: null, condition: 5,
  switch_adapted: false, photo_urls: [] as string[], cover_photo_url: null, switch_photo_url: null, status: 'draft', offer_type: null,
  created_at: '', updated_at: '', ...over,
})
function serve(t = toy(), guidesFail = false) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/toys' ? Promise.resolve([t])
      : p === '/api/toy-transactions' ? Promise.resolve([])
      : p === '/api/public/tutorials' ? (guidesFail ? Promise.reject(new Error('down')) : Promise.resolve([{ id: 'g1', title: 'Bubble Blower' }]))
      : Promise.reject(new Error('unexpected ' + p))
  )
}
const asset = (over: object = {}) => ({ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', ...over })
const open = async (tab?: 'Photos' | 'Review') => {
  render(<Editor id="toy1" />)
  await screen.findByRole('tab', { name: 'Details' })
  if (tab) fireEvent.press(screen.getByRole('tab', { name: tab }))
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockCameraPerm.mockResolvedValue({ granted: true })
  mockLibraryPerm.mockResolvedValue({ granted: true })
  serve()
  mockPatch.mockResolvedValue(toy())
})

describe('details with awkward input', () => {
  it.each([
    ['letters', 'ab', ''],
    ['a minus sign', '-3', '3'],
    ['a decimal point', '2.5', '25'],
    ['an exponent', '1e', '1'],
    ['spaces', ' 7 ', '7'],
  ])('keeps only the digits of an age typed with %s', async (_what, typed, kept) => {
    await open()
    fireEvent.changeText(screen.getByLabelText('From age'), typed)
    expect(screen.getByLabelText('From age').props.value).toBe(kept)
  })

  it('W06 sends no age, never NaN, when the age box holds nothing numeric', async () => {
    await open()
    fireEvent.changeText(screen.getByLabelText('From age'), 'ab')
    fireEvent.changeText(screen.getByLabelText('To age'), '  ')
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ age_min: null, age_max: null })
  })

  it('W06 sends age zero as the number zero, not as no answer', async () => {
    await open()
    fireEvent.changeText(screen.getByLabelText('From age'), '0')
    fireEvent.changeText(screen.getByLabelText('To age'), '07')
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ age_min: 0, age_max: 7 })
  })

  it('W06 sends a whitespace-only description and facts as null', async () => {
    await open()
    fireEvent.changeText(screen.getByPlaceholderText('Description'), '  \n ')
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 2 × AA, included'), '   ')
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ description: null, batteries: null })
  })

  it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)))('W06 saves a name with $label text as typed', async ({ value }) => {
    await open()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), value)
    fireEvent.changeText(screen.getByPlaceholderText('Description'), value)
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ name: value, description: value })
  })

  it('W06 saves the name without the spaces around it', async () => {
    await open()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), '  Bubble machine \n')
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch.mock.calls[0][1].name).toBe('Bubble machine'))
  })

  it.each([1, 10])('W06 saves condition %i', async (c) => {
    await open()
    fireEvent.press(screen.getByLabelText(String(c)))
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch.mock.calls[0][1]).toMatchObject({ condition: c }))
  })

  it('W06 saves once when Save details is pressed twice before the answer', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}))
    await open()
    fireEvent.press(screen.getByLabelText('Save details'))
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('W06 shows the API reason, and keeps what was typed, when the save is refused', async () => {
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 400: Name must be 1 to 120 characters'))
    await open()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), '')
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(await screen.findByText('Name must be 1 to 120 characters')).toBeTruthy()
    expect(screen.getByPlaceholderText('Name').props.value).toBe('')
  })

  it('W06 falls back to a plain sentence on a server error, and offline says so', async () => {
    mockPatch.mockRejectedValueOnce(new Error('API PATCH /x failed with status 500: pg boom')).mockRejectedValueOnce(new TypeError('Network request failed'))
    await open()
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(await screen.findByText('Could not save details. Please try again.')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  })

  it('keeps the guide picker empty, and the editor working, when the guide list fails to load', async () => {
    serve(toy(), true)
    await open()
    expect(screen.getByLabelText('No guide')).toBeTruthy()
    expect(screen.queryByLabelText('Bubble Blower')).toBeNull()
  })

  it('keeps a linked guide that has left the library, so saving does not unlink it', async () => {
    serve(toy({ tutorial_id: 'gone' }))
    await open()
    expect(screen.getByLabelText('A guide no longer in the library')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch.mock.calls[0][1]).toMatchObject({ tutorial_id: 'gone' }))
  })
})

describe('loading', () => {
  it('says the toy did not load when it is not on the shelf or the inventory', async () => {
    serve(toy({ id: 'someone-elses' }))
    mockGet.mockImplementation((p: string) => (p === '/api/toys' ? Promise.resolve([]) : p === '/api/toys/inventory' ? Promise.resolve([]) : Promise.resolve([])))
    render(<Editor id="toy1" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  })

  it('says the toy did not load when the request fails', async () => {
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    render(<Editor id="toy1" />)
    expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  })
})

describe('photos that fail', () => {
  it('says the upload failed, saves nothing, and goes on to take the next try', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [asset()] })
    mockUpload.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ url: 'toy1/b.jpg' })
    mockPatch.mockResolvedValue(toy({ photo_urls: ['a', 'toy1/b.jpg'] }))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', { photo_urls: ['a', 'toy1/b.jpg'] }))
    await waitFor(() => expect(screen.queryByText('Could not upload the photo. Please try again.')).toBeNull())
  })

  it('saves none of a batch when the second photo fails to upload', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [asset({ uri: 'file://1' }), asset({ uri: 'file://2' })] })
    mockUpload.mockResolvedValueOnce({ url: 'toy1/1.jpg' }).mockRejectedValueOnce(new Error('boom'))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('says the photo could not be saved, and keeps the old photos, when the upload worked but the save did not', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [asset()] })
    mockUpload.mockResolvedValue({ url: 'toy1/b.jpg' })
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 500'))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(screen.queryByLabelText('Remove photo 2')).toBeNull()
  })

  it('names a photo over ten megabytes, uploads nothing, and takes one of exactly ten', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockUpload.mockResolvedValue({ url: 'toy1/b.jpg' })
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset({ fileName: 'big.jpg', fileSize: 10 * 1024 * 1024 + 1 })] })
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    expect(await screen.findByText('big.jpg is over 10 MB. Try a smaller one.')).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset({ fileSize: 10 * 1024 * 1024 })] })
    mockPatch.mockResolvedValue(toy({ photo_urls: ['a', 'toy1/b.jpg'] }))
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
  })

  it('refuses the whole batch when any one photo in it is too big', async () => {
    serve(toy({ photo_urls: [] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [asset(), asset({ fileName: 'huge.jpg', fileSize: 99_000_000 })] })
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    expect(await screen.findByText('huge.jpg is over 10 MB. Try a smaller one.')).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('uploads only as many photos as there is room for when the picker returns more', async () => {
    serve(toy({ photo_urls: ['a', 'b', 'c', 'd'] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [asset({ uri: 'file://1' }), asset({ uri: 'file://2' }), asset({ uri: 'file://3' })] })
    mockUpload.mockResolvedValue({ url: 'toy1/new.jpg' })
    mockPatch.mockResolvedValue(toy({ photo_urls: ['a', 'b', 'c', 'd', 'toy1/new.jpg'] }))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockPatch.mock.calls[0][1].photo_urls).toHaveLength(5)
  })

  it('uploads once when the library button is pressed twice before the picker answers', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockReturnValue(new Promise(() => {}))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await act(async () => {})
    expect(mockLibrary).toHaveBeenCalledTimes(1)
  })

  it('does nothing, and shows no error, when the picker is cancelled or returns no photos', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockResolvedValueOnce({ canceled: true }).mockResolvedValueOnce({ canceled: false, assets: [] })
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockLibrary).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockLibrary).toHaveBeenCalledTimes(2))
    expect(mockUpload).not.toHaveBeenCalled()
    expect(screen.queryByText(/Could not/)).toBeNull()
  })

  it('falls back to a jpeg name and type for a photo the picker did not name', async () => {
    serve(toy({ photo_urls: ['a'] }))
    mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://x' }] })
    mockUpload.mockResolvedValue({ url: 'toy1/x.jpg' })
    mockPatch.mockResolvedValue(toy())
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Choose from library'))
    await waitFor(() => expect(mockUpload).toHaveBeenCalled())
    expect(mockUpload.mock.calls[0][2]).toEqual({ uri: 'file://x', name: 'photo.jpg', mimeType: 'image/jpeg' })
  })

  it('says the cover could not be changed, and the photo could not be removed, when those saves fail', async () => {
    serve(toy({ photo_urls: ['a', 'b'] }))
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 500'))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Make photo 2 the cover'))
    expect(await screen.findByText('Could not change the cover. Please try again.')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove photo 2'))
    expect(await screen.findByText('Could not remove that photo. Please try again.')).toBeTruthy()
    expect(screen.getByLabelText('Remove photo 2')).toBeTruthy()
  })

  it('removes a photo once when the remove button is pressed twice', async () => {
    serve(toy({ photo_urls: ['a', 'b'] }))
    mockPatch.mockReturnValue(new Promise(() => {}))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Remove photo 2'))
    fireEvent.press(screen.getByLabelText('Remove photo 2'))
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('leaves the switch tag alone when a photo other than the tagged one is removed', async () => {
    serve(toy({ photo_urls: ['a', 'b'], switch_adapted: true, switch_photo_url: 'a' }))
    mockPatch.mockResolvedValue(toy({ photo_urls: ['a'] }))
    await open('Photos')
    fireEvent.press(screen.getByLabelText('Remove photo 2'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', { photo_urls: ['a'] }))
  })

  it('shows all five slots filled for a toy with five photos, with the first as the cover', async () => {
    serve(toy({ photo_urls: ['a', 'b', 'c', 'd', 'e'] }))
    await open('Photos')
    expect(screen.getByText('Cover')).toBeTruthy()
    expect(screen.getAllByLabelText(/^Remove photo/)).toHaveLength(5)
    expect(screen.queryByLabelText('Make photo 1 the cover')).toBeNull()
  })
})

describe('publishing', () => {
  const ready = () => toy({ photo_urls: ['a'], offer_type: 'donation' })

  it('publishes once when pressed twice before the answer', async () => {
    serve(ready())
    mockPatch.mockReturnValue(new Promise(() => {}))
    await open('Review')
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1/publish', {})
  })

  it('shows the API reason when publishing is refused, and lets the owner try again', async () => {
    serve(ready())
    mockPatch.mockRejectedValueOnce(new Error('API PATCH /x failed with status 400: A switch-adapted toy needs a photo that shows the switch'))
    mockPatch.mockResolvedValueOnce(toy({ ...ready(), status: 'published' }))
    await open('Review')
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    expect(await screen.findByText('A switch-adapted toy needs a photo that shows the switch')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    expect(await screen.findByText('✓ Published · in the Toy Library')).toBeTruthy()
    expect(screen.queryByText('A switch-adapted toy needs a photo that shows the switch')).toBeNull()
  })

  it('falls back to a plain sentence on a server error when publishing', async () => {
    serve(ready())
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 500: pg boom'))
    await open('Review')
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    expect(await screen.findByText('Could not publish this toy. Please try again.')).toBeTruthy()
  })

  it('names what is missing for a toy with no photo and no offer, and holds Publish', async () => {
    serve(toy())
    await open('Review')
    expect(screen.getByLabelText('Publish to the Toy Library').props.accessibilityState.disabled).toBe(true)
    fireEvent.press(screen.getByLabelText('Publish to the Toy Library'))
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('shows the API reason when switching the offer type is refused', async () => {
    serve(ready())
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 409: This toy has open requests'))
    await open('Review')
    fireEvent.press(screen.getByText('Exchange'))
    expect(await screen.findByText('This toy has open requests')).toBeTruthy()
  })
})
