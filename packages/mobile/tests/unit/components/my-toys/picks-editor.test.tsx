import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PicksEditor } from '../../../../components/my-toys/picks-editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPatch = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a) },
}))

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Drum', description: null, condition: 8,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '', updated_at: '', ...over,
}) as never

beforeEach(() => jest.clearAllMocks())

it('picks up to three and saves them in order', async () => {
  mockPut.mockResolvedValue({ picks: [] })
  const onSaved = jest.fn()
  render(
    <PicksEditor
      toy={toy({ picks_mode: 'picked', toy_picks: [] })}
      ownToys={[toy({ id: 't1' }), toy({ id: 't2', name: 'Robot' })]}
      guides={[{ id: 'g1', title: 'Switch mount' }, { id: 'g2', title: 'Big button' }, { id: 'g3', title: 'Bubble blower' }]}
      onSaved={onSaved}
    />
  )
  // The toy itself is never offered.
  expect(screen.queryByText('Drum')).toBeNull()
  for (const label of ['Robot', 'Switch mount', 'Big button', 'Bubble blower']) fireEvent.press(screen.getByText(label))
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() =>
    expect(mockPut).toHaveBeenCalledWith('/api/toys/t1/picks', {
      picks: [
        { entity_type: 'toy', entity_id: 't2' },
        { entity_type: 'tutorial', entity_id: 'g1' },
        { entity_type: 'tutorial', entity_id: 'g2' },
      ],
    })
  )
  expect(onSaved).toHaveBeenCalled()
})

it('switches the mode', async () => {
  mockPatch.mockResolvedValue(toy({ picks_mode: 'picked' }))
  const onSaved = jest.fn()
  render(<PicksEditor toy={toy({ picks_mode: 'auto' })} ownToys={[]} guides={[]} onSaved={onSaved} />)
  expect(screen.queryByText('Save picks')).toBeNull()
  fireEvent.press(screen.getByText('Hand-picked'))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { picks_mode: 'picked' }))
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ picks_mode: 'picked' }))
})
