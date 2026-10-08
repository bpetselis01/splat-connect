// journeys: L23 L24
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { TextInput } from 'react-native'
import { OrgProfileEditScreen } from '../../../../components/organisation/org-profile-edit-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn(); const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
const mockRefresh = jest.fn()
const stableCaps = { caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false, refresh: (...a: unknown[]) => mockRefresh(...a) }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => stableCaps }))
jest.mock('../../../../components/organisation/org-leaders-section', () => ({ OrgLeadersSection: () => null }))

const ORDER = ['name', 'kind', 'description', 'about', 'suburb', 'visit_hours', 'service_area', 'contact_email', 'contact_phone', 'website_url']
const input = (key: string) => screen.UNSAFE_getAllByType(TextInput)[ORDER.indexOf(key)]
const org = (over: object = {}) => ({ name: 'Northside', kind: 'Therapy service', description: 'One line', about: 'About', suburb: 'Fitzroy', state: 'VIC', visit_hours: null, service_area: undefined, contact_email: 'hi@n.org', contact_phone: null, website_url: 'https://n.org', ...over })
const thanks = (over: object = {}) => ({ profile_id: 'p1', note: 'Lovely toy', show_note: true, hidden_at: null, byline: 'Hannah', ...over })
const serve = (o: unknown, t: unknown = []) =>
  mockGet.mockImplementation((p: string) => {
    const v = p.endsWith('/thanks') ? t : o
    return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  })
const save = () => screen.getByRole('button', { name: 'Save and publish' })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockPatch.mockResolvedValue({})
  serve(org())
})

describe('OrgProfileEditScreen', () => {
  it('fills the form from the organisation, with null and missing fields as empty text, never "null" or "undefined"', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    for (const k of ['visit_hours', 'service_area', 'contact_phone']) expect(input(k).props.value).toBe('')
    expect(input('contact_email').props.value).toBe('hi@n.org')
  })

  it('selects the current state and changing it is what gets saved', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    expect(screen.getByRole('radio', { name: 'VIC' }).props.accessibilityState.selected).toBe(true)
    fireEvent.press(screen.getByRole('radio', { name: 'QLD' }))
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/profile', expect.objectContaining({ state: 'QLD' })))
  })

  it('saves every field, with the name trimmed, and says it is live', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    fireEvent.changeText(input('name'), '  Northside Therapy  ')
    fireEvent.press(save())
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ name: 'Northside Therapy', suburb: 'Fitzroy', visit_hours: '', contact_email: 'hi@n.org' })
    expect(await screen.findByText('Saved. It is on your public page now.')).toBeTruthy()
  })

  it('the API\'s refusal is shown in its own words; offline says offline', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    mockPatch.mockRejectedValueOnce(new Error('Request failed with status 400: Name is required'))
    fireEvent.press(save())
    expect(await screen.findByText('Name is required')).toBeTruthy()
    mockPatch.mockRejectedValueOnce(new Error('Network request failed'))
    fireEvent.press(save())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  })

  it('a double tap on Save sends once', async () => {
    let resolve!: (v: unknown) => void
    mockPatch.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    fireEvent.press(save()); fireEvent.press(save())
    expect(mockPatch).toHaveBeenCalledTimes(1)
    resolve({})
  })

  it('a second save clears the previous failure first', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    mockPatch.mockRejectedValueOnce(new Error('Request failed with status 400: Bad'))
    fireEvent.press(save())
    await screen.findByText('Bad')
    fireEvent.press(save())
    await waitFor(() => expect(screen.queryByText('Bad')).toBeNull())
  })

  it.each(NAMES.filter((c) => c.label !== 'very long').map((c): [string, string] => [c.label, c.value]))(
    'an organisation name with %s is saved intact (trimmed)', async (_l, v) => {
      render(<OrgProfileEditScreen />)
      await screen.findByDisplayValue('Northside')
      fireEvent.changeText(input('name'), v)
      fireEvent.press(save())
      await waitFor(() => expect(mockPatch).toHaveBeenCalled())
      expect(mockPatch.mock.calls[0][1].name).toBe(v.trim())
    })

  it('the email and website fields never auto-capitalise, and phone uses the phone pad', async () => {
    render(<OrgProfileEditScreen />)
    await screen.findByDisplayValue('Northside')
    expect(input('contact_email').props.autoCapitalize).toBe('none')
    expect(input('website_url').props.autoCapitalize).toBe('none')
    expect(input('contact_phone').props.keyboardType).toBe('phone-pad')
  })

  describe('thanks from families', () => {
    it('counts families with singular and plural wording', async () => {
      serve(org(), [thanks()])
      const a = render(<OrgProfileEditScreen />)
      expect(await screen.findByText(/1 family has said thanks/)).toBeTruthy()
      a.unmount()
      serve(org(), [thanks(), thanks({ profile_id: 'p2' })])
      render(<OrgProfileEditScreen />)
      expect(await screen.findByText(/2 families have said thanks/)).toBeTruthy()
    })

    it('a thanks with no note is counted but not listed', async () => {
      serve(org(), [thanks({ note: null })])
      render(<OrgProfileEditScreen />)
      expect(await screen.findByText(/1 family has said thanks/)).toBeTruthy()
      expect(screen.queryByText(/Just for you|On your page|Hidden/)).toBeNull()
    })

    it('says where each note shows: on the page, hidden, or just for the leader', async () => {
      serve(org(), [
        thanks({ profile_id: 'a', note: 'A', byline: 'One' }),
        thanks({ profile_id: 'b', note: 'B', byline: 'Two', hidden_at: '2026-09-01T00:00:00Z' }),
        thanks({ profile_id: 'c', note: 'C', byline: 'Three', show_note: false }),
        thanks({ profile_id: 'd', note: 'D', byline: null }),
      ])
      render(<OrgProfileEditScreen />)
      expect(await screen.findByText('One · On your page')).toBeTruthy()
      expect(screen.getByText('Two · Hidden')).toBeTruthy()
      expect(screen.getByText('Three · Just for you')).toBeTruthy()
      expect(screen.getByText('A family · On your page')).toBeTruthy()
    })

    it('a note its author kept private offers no Hide button', async () => {
      serve(org(), [thanks({ show_note: false })])
      render(<OrgProfileEditScreen />)
      await screen.findByText(/Just for you/)
      expect(screen.queryByRole('button', { name: /Hide|Show again/ })).toBeNull()
    })

    it('Hide and Show again flip the same note through its own route and update the row', async () => {
      serve(org(), [thanks()])
      mockPatch.mockResolvedValueOnce(thanks({ hidden_at: '2026-09-01T00:00:00Z' }))
      render(<OrgProfileEditScreen />)
      fireEvent.press(await screen.findByRole('button', { name: 'Hide' }))
      await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/thanks/p1', { hidden: true }))
      expect(await screen.findByText('Hannah · Hidden')).toBeTruthy()
      mockPatch.mockResolvedValueOnce(thanks())
      fireEvent.press(screen.getByRole('button', { name: 'Show again' }))
      await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/thanks/p1', { hidden: false }))
    })

    it('a failed Hide leaves the row as it was and does not throw', async () => {
      serve(org(), [thanks()])
      mockPatch.mockRejectedValueOnce(new Error('offline'))
      render(<OrgProfileEditScreen />)
      fireEvent.press(await screen.findByRole('button', { name: 'Hide' }))
      await waitFor(() => expect(mockPatch).toHaveBeenCalled())
      expect(screen.getByText('Hannah · On your page')).toBeTruthy()
    })

    it('the thanks list failing still shows the form', async () => {
      serve(org(), new Error('500'))
      render(<OrgProfileEditScreen />)
      expect(await screen.findByDisplayValue('Northside')).toBeTruthy()
      expect(screen.getByText(/0 families have said thanks/)).toBeTruthy()
    })

    it('a note with quotes, angle brackets, emoji and RTL shows as plain text', async () => {
      const note = '<b>"Wow" & more</b> 🧸 سارة'
      serve(org(), [thanks({ note })])
      render(<OrgProfileEditScreen />)
      expect(await screen.findByText(`“${note}”`)).toBeTruthy()
    })
  })

  it('if the organisation cannot be loaded the screen offers a way to see that, not skeletons forever', async () => {
    serve(new Error('500'))
    render(<OrgProfileEditScreen />)
    expect(await screen.findByText(/Could not load/)).toBeTruthy()
  })
})
