import { Text } from 'react-native'
import { render, screen, act, waitFor } from '@testing-library/react-native'
import { TutorialDraftProvider, useDraft, type TutorialDraft } from '../../../lib/use-tutorial-draft'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: jest.fn(),
  },
}))

const loaded = {
  id: 't1',
  title: 'A guide',
  kind: 'toy_adaptation',
  difficulty: 'easy',
  status: 'draft',
  updated_at: 'v1',
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [],
  tutorial_recommendations: [],
}

let draft: TutorialDraft
function Probe() {
  draft = useDraft()
  return <Text>{draft.tutorial?.title ?? 'none'}</Text>
}
const mount = () =>
  render(
    <TutorialDraftProvider id="t1">
      <Probe />
    </TutorialDraftProvider>
  )

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockGet.mockResolvedValue(loaded)
})
afterEach(() => jest.useRealTimers())

it('loads the tutorial once', async () => {
  mount()
  await waitFor(() => expect(screen.getByText('A guide')).toBeTruthy())
  expect(mockGet).toHaveBeenCalledWith('/api/tutorials/t1')
})

it('debounces a save and sends the updated_at it last saw', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, title: 'Renamed', updated_at: 'v2' })

  act(() => {
    draft.save({ title: 'Ren' })
  })
  act(() => {
    draft.save({ title: 'Renamed' })
  })
  expect(mockPatch).not.toHaveBeenCalled()

  await act(async () => {
    jest.advanceTimersByTime(250)
  })
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Renamed',
    updated_at: 'v1',
  })
})

it('carries the fresh updated_at into the next save', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })

  await act(async () => {
    draft.save({ title: 'One' })
    jest.advanceTimersByTime(250)
  })
  await act(async () => {
    draft.save({ title: 'Two' })
    jest.advanceTimersByTime(250)
  })

  expect(mockPatch).toHaveBeenNthCalledWith(2, '/api/tutorials/t1', {
    title: 'Two',
    updated_at: 'v2',
  })
})

it.each(['approved', 'rejected'] as const)(
  're-queues a %s tutorial to pending on save',
  async (status) => {
    mockGet.mockResolvedValue({ ...loaded, status })
    mount()
    await waitFor(() => expect(draft.tutorial).toBeTruthy())
    mockPatch.mockResolvedValue({ ...loaded, status: 'pending', updated_at: 'v2' })

    await act(async () => {
      draft.save({ title: 'Edited' })
      jest.advanceTimersByTime(250)
    })

    expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
      title: 'Edited',
      updated_at: 'v1',
      status: 'pending',
    })
  }
)

it('does not re-queue a draft', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })
  await act(async () => {
    draft.save({ title: 'Edited' })
    jest.advanceTimersByTime(250)
  })
  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Edited',
    updated_at: 'v1',
  })
})

it('keeps the edit on screen and reports an error when a save fails', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockRejectedValue(new Error('500'))

  await act(async () => {
    draft.save({ title: 'Renamed' })
    jest.advanceTimersByTime(250)
  })

  expect(draft.saveState).toBe('error')
  expect(draft.saveError).toBe('Could not save. Your changes are still here - try again.')
  // Optimistic value survives the failure: never silently discard typing.
  expect(draft.tutorial?.title).toBe('Renamed')
})

it('posts the replace-set for parts and drops rows with no name', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPost.mockResolvedValue([
    { id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [] },
  ])

  await act(async () => {
    draft.replaceItems('parts', [
      { name: 'Switch', quantity: 2, is_optional: false, buy_links: [] },
      { name: '   ', quantity: 1, is_optional: false, buy_links: [] },
    ])
    jest.advanceTimersByTime(250)
  })

  expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/parts', {
    parts: [{ name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }],
  })
  expect(draft.tutorial?.parts).toHaveLength(1)
})

it('posts tools without a quantity', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPost.mockResolvedValue([{ id: 'x1', name: 'Screwdriver', is_optional: true, buy_links: [] }])

  await act(async () => {
    draft.replaceItems('tools', [{ name: 'Screwdriver', is_optional: true, buy_links: [] }])
    jest.advanceTimersByTime(250)
  })

  expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/tools', {
    tools: [{ name: 'Screwdriver', is_optional: true, buy_links: [] }],
  })
})

it('flush sends a pending save immediately', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })

  act(() => {
    draft.save({ title: 'Leaving' })
  })
  await act(async () => {
    await draft.flush()
  })

  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Leaving',
    updated_at: 'v1',
  })
})

it('reports a load failure', async () => {
  mockGet.mockRejectedValue(new Error('offline'))
  mount()
  await waitFor(() => expect(draft.loadError).toBe(true))
})
